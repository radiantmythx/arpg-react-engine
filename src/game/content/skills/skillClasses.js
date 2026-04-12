/**
 * skills.js — Pure active skill definitions for the Q / E / R hotbar.
 *
 * A SkillDef behaves like a Weapon but fires only when the player presses
 * a hotkey.  It is NOT placed in player.autoSkills[] — it lives in
 * engine.activeSkillSystem.slots[] separately.
 *
 * Interface required by ActiveSkillSystem:
 *   id, name, icon, description, cooldown
 *   activate(player, entities, engine)
 *   levelUp()
 *   _timer   — managed externally by ActiveSkillSystem
 *   _isPureSkill = true
 *   isActive = true
 */

import { applyAilmentsOnHit, resolvePenetrationMap } from '../../data/skillTags.js';
import { ELEMENT_TYPES, makeDamageRange, scaleDamageMap, sumAverageDamageMap } from '../../damageUtils.js';
import { SKILL_TUNING } from '../tuning/index.js';
import { MAX_SUPPORT_SOCKETS, openSupportSlotsForLevel } from '../../supportSockets.js';
import { SCALING_CONFIG } from '../../config/scalingConfig.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  scaleProjectileMotion,
} from '../../projectileSupport.js';

function tickVisuals(list, dt) {
  if (!Array.isArray(list) || list.length === 0) return;
  for (const fx of list) fx.age += dt;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].age >= list[i].duration) list.splice(i, 1);
  }
}

function applyGlobalActiveGemScaling(stats, level) {
  const l = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const steps = l - 1;
  const cfg = SCALING_CONFIG.gem.active;

  if (Number.isFinite(stats.damage)) {
    stats.damage = Math.round(stats.damage * Math.pow(1 + cfg.dmgPerLevel, steps));
  }
  if (Number.isFinite(stats.manaCost)) {
    stats.manaCost = Math.max(0, Math.round(stats.manaCost * Math.pow(1 + cfg.manaCostPerLevel, steps)));
  }
  if (Number.isFinite(stats.cooldown)) {
    const mult = Math.max(cfg.cooldownFloor, Math.pow(1 + cfg.cooldownPerLevel, steps));
    stats.cooldown = Math.max(0.05, stats.cooldown * mult);
  }
  if (Number.isFinite(stats.castTime)) {
    const mult = Math.max(cfg.castTimeFloor, Math.pow(1 + cfg.castTimePerLevel, steps));
    stats.castTime = Math.max(0, stats.castTime * mult);
  }
  for (const key of ['radius', 'pillarRadius', 'meleeRadius', 'impactRadius', 'afterRadius', 'duration']) {
    if (Number.isFinite(stats[key])) {
      stats[key] = stats[key] * Math.pow(1 + cfg.aoePerLevel, steps);
    }
  }
}

class SkillDef {
  constructor(cfg) {
    this.id           = cfg.id;
    this.name         = cfg.name;
    this.icon         = cfg.icon ?? '⚡';
    this.description  = cfg.description;
    this.cooldown     = cfg.cooldown;
    this._timer       = cfg.cooldown; // start ready
    this._isPureSkill = true;
    this.isActive     = true;
    this.level        = 1;
    /** Current XP accumulated toward next level. */
    this._xp          = 0;
    /** Max level cap. */
    this.maxLevel     = 20;

    // ── Phase 12.2 stat formula ─────────────────────────────────────────────
    /** Base numeric values at level 1.  computedStats() scales these by level. */
    this.base     = cfg.base     ?? {};
    /** Per-key increments: { statKey: { flat, pct } }
     *  val = base + (level-1)*flat + base*(level-1)*pct */
    this.scaling  = cfg.scaling  ?? {};
    /** Seconds from activation press to effect delivery (0 = instant). */
    this.castTime = cfg.castTime ?? 0;
    /** Reserved for future resource system. */
    this.manaCost = cfg.manaCost ?? 0;
    /**
     * Support gem sockets. Open sockets scale by gem level:
     * level 1 = 1, 4 = 2, 7 = 3, 10 = 4, 13+ = 5.
     * @type {Array<null|object>}
     */
    this.supportSlots = Array(MAX_SUPPORT_SOCKETS).fill(null);

    /**
     * Skill identity tags — set by each subclass constructor.
     * Drives support gem compatibility, passive tree scaling, and ailment application.
     * @type {string[]}
     */
    this.tags = [];
  }

  /**
   * XP threshold to reach the next level.
   * Formula: 100 × level^1.8
   * @param {number} level — current level (XP needed to reach level+1)
   */
  static xpNeeded(level) {
    return Math.round(100 * Math.pow(level, 1.8));
  }

  /**
   * Grant XP to this skill. Returns true if levelled up at least once.
   * @param {number} amount
   * @returns {boolean}
   */
  addXP(amount) {
    if (this.level >= this.maxLevel) return false;
    this._xp += amount;
    let levelled = false;
    while (this.level < this.maxLevel) {
      const needed = SkillDef.xpNeeded(this.level);
      if (this._xp < needed) break;
      this._xp -= needed;
      this.levelUp();
      levelled = true;
    }
    // Clamp XP to 0 at max level
    if (this.level >= this.maxLevel) this._xp = 0;
    return levelled;
  }

  /**
   * Compute the final runtime stats for this skill at fire time.
   *
   * Step 1 — level scaling (additive on the base value):
   *   val = base[key] + (level-1)*flat + base[key]*(level-1)*pct
   * Step 2 — support gem modifiers: each socketed support calls support.modify(stats, this)
   * Step 3 — player tag bonuses: e.g. player.spellDamage adds to Spell-tagged skills
   *
   * @param {import('../entities/Player.js').Player} [player]
   * @returns {object} snapshot of computed stats — safe to read and discard
   */
  computedStats(player) {
    const stats = { manaCost: this.manaCost, cooldown: this.cooldown, castTime: this.castTime };

    // 1. Base values scaled by level
    for (const [key, baseVal] of Object.entries(this.base)) {
      const r = this.scaling[key];
      stats[key] = r
        ? baseVal + (this.level - 1) * (r.flat ?? 0) + baseVal * (r.pct ?? 0) * (this.level - 1)
        : baseVal;
    }

    applyGlobalActiveGemScaling(stats, this.level);

    // 2. Support gem modifiers
    for (const support of this.supportSlots) {
      if (support?.modify) support.modify(stats, this);
    }

    // 3. Player tag-based bonuses — domain (Spell/Attack/AoE) + per-element flat/increased/more
    if (stats.damage != null && player) {
      let domainInc = 0;
      if (this.tags.includes('Spell')  && (player.spellDamage  ?? 0) > 0) domainInc += player.spellDamage;
      if (this.tags.includes('Attack') && (player.attackDamage ?? 0) > 0) domainInc += player.attackDamage;
      if (this.tags.includes('AoE')    && (player.aoeDamage    ?? 0) > 0) domainInc += player.aoeDamage;

      const activeElems = ELEMENT_TYPES.filter((e) => this.tags.includes(e));
      const typedElems = activeElems.length > 0 ? activeElems : ['Physical'];
      const basePer = stats.damage / typedElems.length;
      const breakdown = {};
      for (const elem of typedElems) {
        const flat = player[`flat${elem}Damage`] ?? 0;
        const elemInc = player[`increased${elem}Damage`] ?? 0;
        const more = player[`more${elem}Damage`] ?? 0;
        const baseTyped = (basePer + flat) * (1 + domainInc + elemInc) * (1 + more);
        breakdown[elem] = makeDamageRange(baseTyped, elem);
      }
      stats.damageBreakdown = breakdown;
      stats.damage = Math.round(sumAverageDamageMap(breakdown));
      const mins = Object.values(breakdown).map((r) => r.min ?? 0);
      const maxs = Object.values(breakdown).map((r) => r.max ?? 0);
      stats.damageRange = { min: mins.reduce((a, b) => a + b, 0), max: maxs.reduce((a, b) => a + b, 0) };
    } else if (stats.damage != null) {
      stats.damageBreakdown = { Physical: makeDamageRange(stats.damage, 'Physical') };
      stats.damage = Math.round(sumAverageDamageMap(stats.damageBreakdown));
      const one = stats.damageBreakdown.Physical;
      stats.damageRange = { min: one.min, max: one.max };
    }

    return stats;
  }

  /**
   * Returns the number of support slots that should be open at the given skill level.
   * @param {number} level
   * @returns {number}
   */
  static slotsForLevel(level) {
    return openSupportSlotsForLevel(level);
  }

  activate(_player, _entities, _engine) {}

  draw(_renderer, _player) {}

  levelUp() {
    this.level++;
    this._applyLevelStats();
  }

  _applyLevelStats() {}
}

// ─── Chaos Blink ────────────────────────────────────────────────────────────
class ChaosBlink extends SkillDef {
  constructor() {
    super({
      id:          'blink',
      name:        'Chaos Blink',
      icon:        '✦',
      description: 'Teleport 200 px in your facing direction and briefly become invulnerable.',
      cooldown:    4,
      castTime:    0.20,
      manaCost:    8,
      base:    { distance: 200 },
      scaling: { distance: { flat: 60, pct: 0 } },
    });
    this.tags = ['Spell', 'Movement'];
  }

  activate(player) {
    const { distance } = this.computedStats(player);
    player.x += player.facingX * distance;
    player.y += player.facingY * distance;
    player.invulnerable = Math.max(player.invulnerable, 0.5);
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.5 }, 3: { cooldown: 3.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Frost Nova ─────────────────────────────────────────────────────────────
class FrostNova extends SkillDef {
  constructor() {
    const tuning = SKILL_TUNING.frostNova;
    super({
      id:          'frost_nova',
      name:        'Frost Nova',
      icon:        '❄',
      description: 'Release an ice ring that damages and freezes enemies within 250 px for 2 s.',
      cooldown:    tuning.baseCooldown,
      castTime:    0.65,
      manaCost:    16,
      base:    { damage: tuning.baseDamage, radius: 250, freeze: 2.0 },
      scaling: { damage: { flat: 7.5, pct: 0 }, radius: { flat: 35, pct: 0 }, freeze: { flat: 0.25, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Frost'];
    this._bursts = [];
  }

  activate(player, entities, engine) {
    const { damage, radius, freeze } = this.computedStats(player);
    this._bursts.push({ x: player.x, y: player.y, radius, age: 0, duration: 0.42, color: '#74b9ff' });
    const rSq = radius * radius;
    for (const enemy of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(enemy, damage);
        enemy.takeDamage(damage, this.tags);
        enemy.frozenTimer = Math.max(enemy.frozenTimer, freeze);
        if (!enemy.active && engine) engine.onEnemyKilled(enemy);
      }
    }
    if (engine) engine.particles.emit('death', player.x, player.y, { color: '#74b9ff', count: 24 });
  }

  update(dt) {
    tickVisuals(this._bursts, dt);
  }

  draw(renderer) {
    for (const burst of this._bursts) {
      const t = burst.age / burst.duration;
      const radius = burst.radius * (0.3 + 0.7 * t);
      renderer.drawCircle(burst.x, burst.y, radius, burst.color, 0.14 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, radius, '#dff3ff', 3, 0.9 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, radius * 0.66, burst.color, 2, 0.5 * (1 - t));
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Gravity Well ───────────────────────────────────────────────────────────
class GravityWell extends SkillDef {
  constructor() {
    super({
      id:          'gravity_well',
      name:        'Gravity Well',
      icon:        '◎',
      description: 'Violently pull all enemies within 350 px toward you.',
      cooldown:    8,
      castTime:    0.80,
      manaCost:    18,
      base:    { radius: 350, pullForce: 380 },
      scaling: { radius: { flat: 50, pct: 0 }, pullForce: { flat: 60, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Duration'];
  }

  activate(player, entities) {
    const { radius, pullForce } = this.computedStats(player);
    const rSq = radius * radius;
    for (const enemy of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!enemy.active) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rSq && distSq > 4) {
        const dist = Math.sqrt(distSq);
        const pull = Math.min(pullForce, dist * 0.75);
        enemy.x += (dx / dist) * pull;
        enemy.y += (dy / dist) * pull;
      }
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 7 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Blood Pact ─────────────────────────────────────────────────────────────
class BloodPact extends SkillDef {
  constructor() {
    super({
      id:          'blood_pact',
      name:        'Blood Pact',
      icon:        '♥',
      description: 'Sacrifice 25% of your current HP to boost all weapon damage by +80% for 4 s.',
      cooldown:    10,
      castTime:    0.40,
      manaCost:    14,
      base:    { buffMult: 1.8, buffDuration: 4.0, hpCostPct: 0.25 },
      scaling: { buffMult: { flat: 0.2, pct: 0 }, buffDuration: { flat: 0.5, pct: 0 } },
    });
    this.tags = ['Spell', 'Duration'];
  }

  activate(player) {
    if (player.damageBuffTimer > 0) return; // already active
    const { buffMult, buffDuration, hpCostPct } = this.computedStats(player);
    const cost = Math.max(1, Math.floor(player.health * hpCostPct));
    if (player.health - cost < 1) return;   // would kill the player
    player.health -= cost;

    // Temporarily boost all weapon damages
    player.damageBuff      = buffMult;
    player.damageBuffTimer = buffDuration;
    for (const w of player.autoSkills) {
      w._preBuffDamage = w.damage;
      w.damage = Math.round(w.damage * buffMult);
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 8 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Wraith Summon ───────────────────────────────────────────────────────────
class WraithSummon extends SkillDef {
  constructor() {
    super({
      id:          'wraith_summon',
      name:        'Summon Wraith',
      icon:        '☠',
      description: 'Dispatch a wraith to the nearest enemy. It explodes on arrival for 200 damage.',
      cooldown:    12,
      castTime:    1.00,
      manaCost:    22,
      base:    { damage: 200, burstRadius: 80 },
      scaling: { damage: { flat: 80, pct: 0 }, burstRadius: { flat: 20, pct: 0 } },
    });
    this.tags = ['Spell', 'Minion', 'Duration', 'Unholy'];
    this._bursts = [];
  }

  activate(player, entities, engine) {
    const { damage, burstRadius } = this.computedStats(player);
    // Find nearest enemy
    let nearest = null;
    let nearestDSq = Infinity;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d  = dx * dx + dy * dy;
      if (d < nearestDSq) { nearestDSq = d; nearest = e; }
    }

    const tx = nearest ? nearest.x : player.x + (player.facingX ?? 0) * 200;
    const ty = nearest ? nearest.y : player.y + (player.facingY ?? 1) * 200;

    // Burst at target position
    const rSq = burstRadius * burstRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, damage);
          e.takeDamage(damage, this.tags);
          if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', tx, ty, { color: '#a29bfe', count: 30 });
    this._bursts.push({ x: tx, y: ty, radius: burstRadius, age: 0, duration: 0.46, color: '#a29bfe' });
  }

  update(dt) {
    tickVisuals(this._bursts, dt);
  }

  draw(renderer) {
    for (const burst of this._bursts) {
      const t = burst.age / burst.duration;
      const radius = burst.radius * (0.25 + 0.75 * t);
      renderer.drawCircle(burst.x, burst.y, radius, burst.color, 0.16 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, radius, '#f0e6ff', 3, 0.85 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, radius * 0.5, '#6c5ce7', 2, 0.55 * (1 - t));
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 10 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Time Warp ───────────────────────────────────────────────────────────────
class TimeWarp extends SkillDef {
  constructor() {
    super({
      id:          'time_warp',
      name:        'Time Warp',
      icon:        '⏳',
      description: 'Slow all enemies on screen to 20% speed for 3 s.',
      cooldown:    15,
      castTime:    0.50,
      manaCost:    24,
      base:    { slowFactor: 0.20, duration: 3.0 },
      scaling: { slowFactor: { flat: -0.025, pct: 0 }, duration: { flat: 1.0, pct: 0 } },
    });
    this.tags = ['Spell', 'Duration', 'AoE'];
  }

  activate(player, entities) {
    const { slowFactor, duration } = this.computedStats(player);
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      e.speedMult  = slowFactor;
      e.speedTimer = duration;
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 14 }, 3: { cooldown: 12 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Iron Bulwark ────────────────────────────────────────────────────────────
class IronBulwark extends SkillDef {
  constructor() {
    super({
      id:          'bulwark',
      name:        'Iron Bulwark',
      icon:        '🛡',
      description: 'Erect a 3 s shield that absorbs up to 80 damage before breaking.',
      cooldown:    8,
      castTime:    0.30,
      manaCost:    13,
      base:    { shield: 80, duration: 3.0 },
      scaling: { shield: { flat: 40, pct: 0 }, duration: { flat: 0.5, pct: 0 } },
    });
    this.tags = ['Duration'];
  }

  activate(player) {
    const { shield, duration } = this.computedStats(player);
    player.bulwarkShield   = Math.max(player.bulwarkShield, shield);
    player.bulwarkDuration = duration;
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 7 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Arcane Surge ────────────────────────────────────────────────────────────
class ArcaneSurge extends SkillDef {
  constructor() {
    super({
      id:          'arcane_surge',
      name:        'Arcane Surge',
      icon:        '⚡',
      description: 'Instantly refresh all weapon and skill cooldowns; fire at zero cooldown for 2 s. Also grants +30% cast speed for 6 s.',
      cooldown:    6,
      castTime:    0.25,
      manaCost:    12,
      base:    { arcaneTime: 2.0 },
      scaling: { arcaneTime: { flat: 0.5, pct: 0 } },
    });
    this.tags = ['Spell', 'Duration'];
  }

  activate(player, entities, engine) {
    const { arcaneTime } = this.computedStats(player);
    // Reset all auto-skill cooldown timers so they fire immediately
    for (const w of player.autoSkills) {
      w._timer = w.cooldown + 1; // over threshold → fires first tick
    }
    // Reset all active skill cooldown timers
    if (engine?.activeSkillSystem) {
      engine.activeSkillSystem.resetTimers();
    }
    // Brief zero-cooldown window on the player
    player.arcaneTimer = arcaneTime;
    // +30% castSpeed for 6 s (Phase 12.3); refresh without stacking
    if (player._arcaneCastSpeedTimer <= 0) {
      player.castSpeed = Math.round((player.castSpeed + 0.3) * 100) / 100;
    }
    player._arcaneCastSpeedTimer = 6.0;
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 5.5 }, 3: { cooldown: 5.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Fireball ────────────────────────────────────────────────────────────────
class Fireball extends SkillDef {
  constructor() {
    const tuning = SKILL_TUNING.fireball;
    super({
      id:          'fireball',
      name:        'Fireball',
      icon:        '🔥',
      description: 'Launch an arcing fireball that detonates on impact, dealing fire damage to all enemies within 60 px and igniting them.',
      cooldown:    tuning.baseCooldown,
      castTime:    0.75,
      manaCost:    17,
      base:    { damage: tuning.baseDamage, radius: 60 },
      scaling: { damage: { flat: 18, pct: 0 }, radius: { flat: 10, pct: 0 } },
    });
    this.tags = ['Spell', 'Projectile', 'Blaze', 'AoE'];
    this._bursts = [];
  }

  activate(player, entities, engine) {
    const computed = this.computedStats(player);
    const { damage, radius, damageBreakdown } = computed;
    const supportState = getProjectileSupportState(computed, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const tags = this.tags;
    const penMap = resolvePenetrationMap(tags, player);

    // Aim toward nearest enemy, fallback to facing direction
    let tx = player.x + (player.facingX ?? 0) * 300;
    let ty = player.y + (player.facingY ?? 1) * 300;
    let minSq = Infinity;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < minSq) { minSq = d; tx = e.x; ty = e.y; }
    }
    const dx = tx - player.x, dy = ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const motion = scaleProjectileMotion(380, 2.0, supportState);
    const baseAngle = Math.atan2(dy / dist, dx / dist);

    // AoE burst helper — detonates at world position (bx, by)
    const burst = (bx, by) => {
      this._bursts.push({ x: bx, y: by, radius, age: 0, duration: 0.38, color: '#ff7f50' });
      const rSq = radius * radius;
      for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
        if (!e.active) continue;
        const ex = e.x - bx, ey = e.y - by;
        if (ex * ex + ey * ey <= rSq) {
          if (engine) engine.onEnemyHit(e, damage);
          e.takeDamage(damageBreakdown ?? damage, tags, penMap);
          applyAilmentsOnHit(tags, damageBreakdown ?? damage, e, player);
          if (!e.active && engine) engine.onEnemyKilled(e);
        }
      }
      if (engine) engine.particles.emit('death', bx, by, { color: '#e17055', count: 22 });
    };

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.14)) {
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage:          1,
          damageBreakdown: null,
          radius:          8,
          color:           '#e17055',
          lifetime:        motion.lifetime,
          sourceTags:      [],
          onHit:           (proj) => burst(proj.x, proj.y),
          onExpire:        (proj) => burst(proj.x, proj.y),
        }, supportState, this.tags, { sourceTags: [] }),
      );
    }
    if (engine) engine.onSkillFire();
  }

  update(dt) {
    tickVisuals(this._bursts, dt);
  }

  draw(renderer) {
    for (const burst of this._bursts) {
      const t = burst.age / burst.duration;
      const ringRadius = burst.radius * (0.25 + 0.75 * t);
      renderer.drawCircle(burst.x, burst.y, ringRadius, '#ff8d5b', 0.18 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, ringRadius, '#ffe0b2', 3, 0.95 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, ringRadius * 0.58, '#e17055', 2, 0.6 * (1 - t));
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.5 }, 3: { cooldown: 3.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Glacial Cascade ─────────────────────────────────────────────────────────
class GlacialCascade extends SkillDef {
  constructor() {
    super({
      id:          'glacial_cascade',
      name:        'Glacial Cascade',
      icon:        '❄️',
      description: 'Erupt 5 ice pillars in a line, each damaging and chilling enemies within 36 px.',
      cooldown:    7.0,
      castTime:    0.85,
      manaCost:    19,
      base:    { damage: 30, pillarRadius: 36 },
      scaling: { damage: { flat: 12, pct: 0 }, pillarRadius: { flat: 5, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Frost', 'Duration'];
    this._pillars = [];
  }

  activate(player, entities, engine) {
    const { damage, pillarRadius, damageBreakdown } = this.computedStats(player);
    const tags = this.tags;
    const penMap = resolvePenetrationMap(tags, player);

    // Direction toward nearest enemy, fallback to player facing
    let dirX = player.facingX ?? 0;
    let dirY = player.facingY ?? 1;
    let minSq = Infinity;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < minSq) { minSq = d; dirX = dx; dirY = dy; }
    }
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= len; dirY /= len;

    const step = 65;
    const rSq  = pillarRadius * pillarRadius;
    const pillarCount = 5;
    for (let i = 1; i <= pillarCount; i++) {
      const px = player.x + dirX * step * i;
      const py = player.y + dirY * step * i;
      this._pillars.push({ x: px, y: py, radius: pillarRadius, age: 0, duration: 0.5 });
      for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
        if (!e.active) continue;
        const dx = e.x - px, dy = e.y - py;
        if (dx * dx + dy * dy <= rSq) {
          if (engine) engine.onEnemyHit(e, damage);
          e.takeDamage(damageBreakdown ?? damage, tags, penMap);
          applyAilmentsOnHit(tags, damageBreakdown ?? damage, e, player);
          if (!e.active && engine) engine.onEnemyKilled(e);
        }
      }
      if (engine) engine.particles.emit('death', px, py, { color: '#74b9ff', count: 12 });
    }
    if (engine) engine.onSkillFire();
  }

  update(dt) {
    tickVisuals(this._pillars, dt);
  }

  draw(renderer) {
    for (const pillar of this._pillars) {
      const t = pillar.age / pillar.duration;
      const heightPulse = 0.55 + (1 - t) * 0.85;
      renderer.drawCircle(pillar.x, pillar.y, pillar.radius * 0.9, '#8fd3ff', 0.12 * (1 - t));
      renderer.drawStrokeCircle(pillar.x, pillar.y, pillar.radius, '#e8f7ff', 2.5, 0.85 * (1 - t));
      renderer.drawLine(pillar.x, pillar.y + pillar.radius * 0.2, pillar.x, pillar.y - pillar.radius * heightPulse, '#bfe7ff', 3, 0.75 * (1 - t));
      renderer.drawLine(pillar.x - pillar.radius * 0.35, pillar.y + pillar.radius * 0.35, pillar.x, pillar.y - pillar.radius * 0.5, '#74b9ff', 2, 0.6 * (1 - t));
      renderer.drawLine(pillar.x + pillar.radius * 0.35, pillar.y + pillar.radius * 0.35, pillar.x, pillar.y - pillar.radius * 0.5, '#74b9ff', 2, 0.6 * (1 - t));
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 6 }, 3: { cooldown: 5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Lightning Strike ────────────────────────────────────────────────────────
class LightningStrike extends SkillDef {
  constructor() {
    super({
      id:          'lightning_strike',
      name:        'Lightning Strike',
      icon:        '⚡',
      description: 'Melee burst within 80 px (1.5× damage), then fire 3 lightning bolts forward.',
      cooldown:    3.5,
      castTime:    0.40,
      manaCost:    11,
      base:    { damage: 35, meleeRadius: 80, boltDamage: 22 },
      scaling: { damage: { flat: 12, pct: 0 }, boltDamage: { flat: 8, pct: 0 } },
    });
    this.tags = ['Attack', 'Projectile', 'Melee', 'Thunder'];
    this._bursts = [];
  }

  activate(player, entities, engine) {
    const computed = this.computedStats(player);
    const { damage, meleeRadius, boltDamage, damageBreakdown } = computed;
    const supportState = getProjectileSupportState(computed, {
      baseProjectiles: 3,
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const tags = this.tags;
    const penMap = resolvePenetrationMap(tags, player);
    this._bursts.push({ x: player.x, y: player.y, radius: meleeRadius, age: 0, duration: 0.26, color: '#7fd7ff' });

    // Phase 1 — melee burst
    const rSq = meleeRadius * meleeRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        const mDmg = Math.round(damage * 1.5);
        const meleeBreakdown = scaleDamageMap(damageBreakdown, 1.5);
        if (engine) engine.onEnemyHit(e, mDmg);
        e.takeDamage(meleeBreakdown ?? mDmg, tags, penMap);
        applyAilmentsOnHit(tags, meleeBreakdown ?? mDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }

    // Phase 2 — lightning bolts forward
    const base = Math.atan2(player.facingY ?? 1, player.facingX ?? 0);
    const motion = scaleProjectileMotion(520, 1.0, supportState);
    for (const angle of buildSpreadAngles(base, supportState.totalProjectiles, Math.PI / 9)) {
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage: boltDamage,
          damageBreakdown: null,
          radius: 5,
          color: '#74b9ff',
          lifetime: motion.lifetime,
        }, supportState, tags),
      );
    }
    if (engine) engine.onSkillFire();
  }

  update(dt) {
    tickVisuals(this._bursts, dt);
  }

  draw(renderer, player) {
    for (const burst of this._bursts) {
      const t = burst.age / burst.duration;
      const radius = burst.radius * (0.45 + 0.55 * t);
      renderer.drawStrokeCircle(burst.x, burst.y, radius, '#dff8ff', 3, 0.9 * (1 - t));
      renderer.drawStrokeCircle(burst.x, burst.y, radius * 0.72, burst.color, 2, 0.7 * (1 - t));
      if (player) {
        renderer.drawLine(burst.x, burst.y, burst.x + (player.facingX ?? 0) * radius, burst.y + (player.facingY ?? 1) * radius, '#74b9ff', 3, 0.65 * (1 - t));
      }
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.0 }, 3: { cooldown: 2.5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Blade Flurry ────────────────────────────────────────────────────────────
class BladeFlurry extends SkillDef {
  constructor() {
    super({
      id:          'blade_flurry',
      name:        'Blade Flurry',
      icon:        '🌀',
      description: 'Activate to build stages (up to 6). Auto-releases after 1.2 s for a scaling AoE burst. More stages = more damage & radius.',
      cooldown:    8.0,
      castTime:    0,
      manaCost:    15,
      base:    { damage: 30, baseRadius: 55 },
      scaling: { damage: { flat: 10, pct: 0 }, baseRadius: { flat: 8, pct: 0 } },
    });
    this.tags = ['Attack', 'Channelling', 'Physical', 'AoE', 'Melee'];
    this._stages       = 0;
    this._releaseTimer = 0;
    this._slashes      = [];
  }

  activate(player, entities, engine) {
    if (this._stages === 0) {
      this._stages       = 1;
      this._releaseTimer = 1.2;
      if (engine) engine.particles.emit('death', player.x, player.y, { color: '#ff7675', count: 6 });
    } else if (this._stages < (this._maxStages ?? 6) && this._releaseTimer > 0) {
      this._stages++;
      this._releaseTimer = 1.2; // refresh auto-release
      if (engine) engine.particles.emit('death', player.x, player.y, { color: '#ff7675', count: 4 });
      if (this._stages >= (this._maxStages ?? 6)) this._release(player, entities, engine);
    }
  }

  update(dt, player, entities, engine) {
    tickVisuals(this._slashes, dt);
    if (this._releaseTimer > 0 && this._stages > 0) {
      this._releaseTimer -= dt;
      if (this._releaseTimer <= 0) this._release(player, entities, engine);
    }
  }

  _release(player, entities, engine) {
    if (!player || !entities) return;
    const { damage, baseRadius, damageBreakdown } = this.computedStats(player);
    const stages        = this._stages;
    const releaseDmg    = Math.round(damage * (0.5 + stages * 0.25));
    const releaseMult   = (0.5 + stages * 0.25);
    const releaseBreakdown = scaleDamageMap(damageBreakdown, releaseMult);
    const releaseRadius = baseRadius + stages * 12;
    const tags          = this.tags;
    const penMap = resolvePenetrationMap(tags, player);
    const rSq           = releaseRadius * releaseRadius;

    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, releaseDmg);
        e.takeDamage(releaseBreakdown ?? releaseDmg, tags, penMap);
        applyAilmentsOnHit(tags, releaseBreakdown ?? releaseDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) {
      engine.particles.emit('death', player.x, player.y, { color: '#ff7675', count: 10 + stages * 4 });
      engine.onSkillFire();
    }
    this._slashes.push({ x: player.x, y: player.y, radius: releaseRadius, age: 0, duration: 0.34, stages });
    this._stages       = 0;
    this._releaseTimer = 0;
    this._timer        = 0; // restart cooldown from release
  }

  draw(renderer) {
    for (const slash of this._slashes) {
      const t = slash.age / slash.duration;
      const radius = slash.radius * (0.35 + 0.65 * t);
      const alpha = (1 - t);
      renderer.drawStrokeCircle(slash.x, slash.y, radius, '#ffd0d0', 3, 0.8 * alpha);
      renderer.drawStrokeCircle(slash.x, slash.y, radius * 0.78, '#ff7675', 2, 0.6 * alpha);
      const spokeCount = Math.min(8, 2 + slash.stages);
      for (let i = 0; i < spokeCount; i++) {
        const angle = t * Math.PI * 3 + (i / spokeCount) * Math.PI * 2;
        const inner = radius * 0.25;
        const outer = radius;
        renderer.drawLine(
          slash.x + Math.cos(angle) * inner,
          slash.y + Math.sin(angle) * inner,
          slash.x + Math.cos(angle) * outer,
          slash.y + Math.sin(angle) * outer,
          '#ff9aa2',
          2,
          0.45 * alpha,
        );
      }
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 7 }, 3: { cooldown: 6 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Earthquake ──────────────────────────────────────────────────────────────
class Earthquake extends SkillDef {
  constructor() {
    super({
      id:          'earthquake',
      name:        'Earthquake',
      icon:        '🌍',
      description: 'Instant ground slam (80 px, 80% dmg) + aftershock 1.5 s later (140 px, 100% dmg). Both apply Bleed.',
      cooldown:    9.0,
      castTime:    1.20,
      manaCost:    21,
      base:    { damage: 70, impactRadius: 80, afterRadius: 140 },
      scaling: { damage: { flat: 25, pct: 0 }, impactRadius: { flat: 10, pct: 0 }, afterRadius: { flat: 15, pct: 0 } },
    });
    this.tags = ['Attack', 'AoE', 'Physical', 'Duration'];
    this._aftershockPending = false;
    this._aftershockTimer   = 0;
    this._aftershockCtx     = null;
    this._shockwaves        = [];
  }

  activate(player, entities, engine) {
    const { damage, impactRadius, afterRadius, damageBreakdown } = this.computedStats(player);
    const tags   = this.tags;
    const penMap = resolvePenetrationMap(tags, player);
    const impDmg = Math.round(damage * 0.80);
    const impBreakdown = scaleDamageMap(damageBreakdown, 0.80);
    const rSq    = impactRadius * impactRadius;
    this._shockwaves.push({ x: player.x, y: player.y, radius: impactRadius, age: 0, duration: 0.4, color: '#fdcb6e' });

    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, impDmg);
        e.takeDamage(impBreakdown ?? impDmg, tags, penMap);
        applyAilmentsOnHit(tags, impBreakdown ?? impDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', player.x, player.y, { color: '#fdcb6e', count: 28 });

    this._aftershockPending = true;
    this._aftershockTimer   = 1.5;
    this._aftershockCtx     = { originX: player.x, originY: player.y, damage, damageBreakdown, afterRadius, entities, engine, player, tags, penMap };
  }

  update(dt) {
    tickVisuals(this._shockwaves, dt);
    if (this._aftershockPending) {
      this._aftershockTimer -= dt;
      if (this._aftershockTimer <= 0) this._doAfterShock();
    }
  }

  _doAfterShock() {
    const ctx = this._aftershockCtx;
    if (!ctx) return;
    const { originX, originY, damage, damageBreakdown, afterRadius, entities, engine, player, tags, penMap } = ctx;
    const rSq = afterRadius * afterRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - originX, dy = e.y - originY;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, damage);
        e.takeDamage(damageBreakdown ?? damage, tags, penMap);
        applyAilmentsOnHit(tags, damageBreakdown ?? damage, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', originX, originY, { color: '#fdcb6e', count: 40 });
    this._shockwaves.push({ x: originX, y: originY, radius: afterRadius, age: 0, duration: 0.55, color: '#ffe08a' });
    this._aftershockPending = false;
    this._aftershockCtx     = null;
  }

  draw(renderer) {
    for (const wave of this._shockwaves) {
      const t = wave.age / wave.duration;
      const radius = wave.radius * (0.2 + 0.8 * t);
      const alpha = 1 - t;
      renderer.drawCircle(wave.x, wave.y, radius, '#ffe29a', 0.12 * alpha);
      renderer.drawStrokeCircle(wave.x, wave.y, radius, wave.color, 3, 0.9 * alpha);
      renderer.drawStrokeCircle(wave.x, wave.y, radius * 0.68, '#c79b32', 2, 0.5 * alpha);
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 8 }, 3: { cooldown: 7 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Vortex ───────────────────────────────────────────────────────────────────
class Vortex extends SkillDef {
  constructor() {
    super({
      id:          'vortex',
      name:        'Vortex',
      icon:        '🌊',
      description: 'Summon a chilling vortex at the nearest enemy that pulses cold damage every 0.3 s for 3 s.',
      cooldown:    8.0,
      castTime:    0.60,
      manaCost:    18,
      base:    { damage: 18, radius: 60, duration: 3.0 },
      scaling: { damage: { flat: 6, pct: 0 }, radius: { flat: 8, pct: 0 }, duration: { flat: 0.5, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Frost', 'Duration'];
    /** @type {Array<{x,y,remaining,tickAccum,damage,radius,player,entities,engine}>} */
    this._vortices = [];
  }

  activate(player, entities, engine) {
    const { damage, radius, duration, damageBreakdown } = this.computedStats(player);

    let tx = player.x + (player.facingX ?? 0) * 200;
    let ty = player.y + (player.facingY ?? 1) * 200;
    let minSq = Infinity;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < minSq) { minSq = d; tx = e.x; ty = e.y; }
    }

    this._vortices.push({ x: tx, y: ty, remaining: duration, totalDuration: duration, tickAccum: 0, damage, damageBreakdown, radius, player, entities, engine });
    if (engine) engine.particles.emit('death', tx, ty, { color: '#74b9ff', count: 16 });
    if (engine) engine.onSkillFire();
  }

  update(dt) {
    const tags = this.tags;
    for (const v of this._vortices) {
      const penMap = resolvePenetrationMap(tags, v.player);
      v.remaining -= dt;
      v.tickAccum  += dt;
      if (v.tickAccum >= 0.30) {
        v.tickAccum -= 0.30;
        const rSq = v.radius * v.radius;
        for (const e of (v.entities.getHostiles ? v.entities.getHostiles() : v.entities.enemies)) {
          if (!e.active) continue;
          const dx = e.x - v.x, dy = e.y - v.y;
          if (dx * dx + dy * dy <= rSq) {
            if (v.engine) v.engine.onEnemyHit(e, v.damage);
            e.takeDamage(v.damageBreakdown ?? v.damage, tags, penMap);
            applyAilmentsOnHit(tags, v.damageBreakdown ?? v.damage, e, v.player);
            if (!e.active && v.engine) v.engine.onEnemyKilled(e);
          }
        }
        if (v.engine) v.engine.particles.emit('death', v.x, v.y, { color: '#74b9ff', count: 6 });
      }
    }
    this._vortices = this._vortices.filter((v) => v.remaining > 0);
  }

  draw(renderer) {
    for (const vortex of this._vortices) {
      const life = Math.max(0, vortex.remaining / (vortex.totalDuration || 1));
      const pulse = 0.82 + Math.sin(vortex.tickAccum * Math.PI * 5) * 0.12;
      renderer.drawCircle(vortex.x, vortex.y, vortex.radius * pulse, '#74b9ff', 0.12 + life * 0.06);
      renderer.drawStrokeCircle(vortex.x, vortex.y, vortex.radius, '#d9f3ff', 2.5, 0.45 + life * 0.2);
      renderer.drawStrokeCircle(vortex.x, vortex.y, vortex.radius * 0.68, '#5dade2', 2, 0.3 + life * 0.15);
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 7 }, 3: { cooldown: 6 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }
}

// ─── Skill class exports ────────────────────────────────────────────────────

export {
  ChaosBlink,
  FrostNova,
  GravityWell,
  BloodPact,
  WraithSummon,
  TimeWarp,
  IronBulwark,
  ArcaneSurge,
  Fireball,
  GlacialCascade,
  LightningStrike,
  BladeFlurry,
  Earthquake,
  Vortex,
};




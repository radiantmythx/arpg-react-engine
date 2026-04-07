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

import { applyAilmentsOnHit } from './skillTags.js';

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
     * Support gem sockets.  Starts with 1 slot; gains more at levels 4/7/10/14/18.
     * Each entry is null (empty) or a SkillSupport instance.
     * @type {Array<null|object>}
     */
    this.supportSlots = [null];

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
    const stats = {};

    // 1. Base values scaled by level
    for (const [key, baseVal] of Object.entries(this.base)) {
      const r = this.scaling[key];
      stats[key] = r
        ? baseVal + (this.level - 1) * (r.flat ?? 0) + baseVal * (r.pct ?? 0) * (this.level - 1)
        : baseVal;
    }

    // 2. Support gem modifiers
    for (const support of this.supportSlots) {
      if (support?.modify) support.modify(stats, this);
    }

    // 3. Player tag-based "increased" multipliers (additive pool, applied once)
    if (stats.damage != null && player) {
      let inc = 0;
      if (this.tags.includes('Spell')   && (player.spellDamage  ?? 0) > 0) inc += player.spellDamage;
      if (this.tags.includes('Attack')  && (player.attackDamage ?? 0) > 0) inc += player.attackDamage;
      if (this.tags.includes('AoE')     && (player.aoeDamage    ?? 0) > 0) inc += player.aoeDamage;
      if (inc > 0) stats.damage = Math.round(stats.damage * (1 + inc));
    }

    return stats;
  }

  /**
   * Returns the number of support slots that should be open at the given skill level.
   * @param {number} level
   * @returns {number}
   */
  static slotsForLevel(level) {
    if (level >= 18) return 6;
    if (level >= 14) return 5;
    if (level >= 10) return 4;
    if (level >= 7)  return 3;
    if (level >= 4)  return 2;
    return 1;
  }

  activate(_player, _entities, _engine) {}

  levelUp() {
    this.level++;
    // Open new support slots when a level threshold is crossed
    const slotCount = SkillDef.slotsForLevel(this.level);
    while (this.supportSlots.length < slotCount) this.supportSlots.push(null);
    this._applyLevelStats();
    if (this.level >= this.maxLevel) this._applyMaxLevelEffect();
  }

  _applyLevelStats() {}

  /**
   * Called once when the skill reaches level 20.
   * Override in each subclass to apply the max-level bonus.
   */
  _applyMaxLevelEffect() {}

  /** A human-readable description of the max-level bonus. Override per skill. */
  get maxLevelBonus() { return null; }
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
    if (this._maxLevel20Invisible) {
      // Become invisible for 0.8 s — enemies lose targeting
      player.invisibleTimer = Math.max(player.invisibleTimer ?? 0, 0.8);
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.5 }, 3: { cooldown: 3.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: +50% blink distance and become briefly invisible after blinking
    const key = 'distance';
    this.base[key] = Math.round((this.base[key] ?? 0) * 1.5);
    this._maxLevel20Invisible = true;
  }

  get maxLevelBonus() { return '+50% distance; brief invisibility on blink'; }
}

// ─── Frost Nova ─────────────────────────────────────────────────────────────
class FrostNova extends SkillDef {
  constructor() {
    super({
      id:          'frost_nova',
      name:        'Frost Nova',
      icon:        '❄',
      description: 'Release an ice ring that damages and freezes enemies within 250 px for 2 s.',
      cooldown:    6,
      castTime:    0.65,
      base:    { damage: 15, radius: 250, freeze: 2.0 },
      scaling: { damage: { flat: 7.5, pct: 0 }, radius: { flat: 35, pct: 0 }, freeze: { flat: 0.25, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Cold'];
  }

  activate(player, entities, engine) {
    const { damage, radius, freeze } = this.computedStats(player);
    const rSq = radius * radius;
    for (const enemy of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(enemy, damage);
        enemy.takeDamage(damage);
        enemy.frozenTimer = Math.max(enemy.frozenTimer, freeze);
        if (!enemy.active && engine) engine.onEnemyKilled(enemy);
      }
    }
    if (engine) engine.particles.emit('death', player.x, player.y, { color: '#74b9ff', count: 24 });
    // Level 20: frozen enemies shatter on death, causing AoE from their position
    if (this._maxLevel20Shatter) {
      for (const enemy of [...(entities.getHostiles ? entities.getHostiles() : entities.enemies)]) {
        if (!enemy.active && enemy.frozenTimer > 0) {
          const shatterDmg = Math.round((enemy.maxHp ?? enemy.hp ?? damage) * 0.5);
          const sRq = 80 * 80;
          for (const e2 of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
            if (!e2.active) continue;
            const dx2 = e2.x - enemy.x, dy2 = e2.y - enemy.y;
            if (dx2 * dx2 + dy2 * dy2 <= sRq) {
              if (engine) engine.onEnemyHit(e2, shatterDmg);
              e2.takeDamage(shatterDmg);
              if (!e2.active && engine) engine.onEnemyKilled(e2);
            }
          }
          if (engine) engine.particles.emit('death', enemy.x, enemy.y, { color: '#dfe6e9', count: 18 });
        }
      }
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: frozen enemies shatter on death, dealing 50% of their max HP as AoE damage within 80 px
    this._maxLevel20Shatter = true;
  }

  get maxLevelBonus() { return 'Frozen enemies shatter on death for 50% max HP AoE'; }
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
        if (this._maxLevel20Stun) {
          enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, 1.5);
          enemy.speedMult  = 0;
          enemy.speedTimer = 1.5;
        }
      }
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 7 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: enemies sucked in are stunned for 1.5 s (can't move/attack)
    this._maxLevel20Stun = true;
  }

  get maxLevelBonus() { return 'Pulled enemies are stunned for 1.5 s'; }
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
    // Level 20: regen 5 HP/s for the buff duration
    if (this._maxLevel20HpRegen) {
      player.regenBonusTimer = Math.max(player.regenBonusTimer ?? 0, buffDuration);
      player.regenBonus      = (player.regenBonus ?? 0) + 5;
    }
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 8 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: buff also heals 5 HP/s for its duration
    this._maxLevel20HpRegen = true;
  }

  get maxLevelBonus() { return 'Buff also provides 5 HP/s regeneration'; }
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
      base:    { damage: 200, burstRadius: 80 },
      scaling: { damage: { flat: 80, pct: 0 }, burstRadius: { flat: 20, pct: 0 } },
    });
    this.tags = ['Spell', 'Minion', 'Duration'];
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

    // Level 20: WraithSummon fires 2 extra bolts before exploding
    if (this._maxLevel20Haunt && nearest) {
      const bAngle = Math.atan2(ty - player.x, tx - player.y);
      for (let i = -1; i <= 1; i += 2) {
        const a = bAngle + i * 0.3;
        entities.acquireProjectile(
          player.x, player.y,
          Math.cos(a) * 320, Math.sin(a) * 320,
          { damage: Math.round(damage * 0.4), radius: 5, color: '#a29bfe', lifetime: 1.2, sourceTags: this.tags },
        );
      }
    }

    // Burst at target position
    const rSq = burstRadius * burstRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, damage);
        e.takeDamage(damage);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', tx, ty, { color: '#a29bfe', count: 30 });
  }

  _applyLevelStats() {
    const table = { 3: { cooldown: 10 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: wraith haunts the enemy, firing 2 extra bolts before exploding
    this._maxLevel20Haunt = true;
  }

  get maxLevelBonus() { return 'Wraith fires 2 additional projectiles before exploding'; }
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
      if (this._maxLevel20Freeze) {
        e.frozenTimer = Math.max(e.frozenTimer ?? 0, 0.5);
      }
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 14 }, 3: { cooldown: 12 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: time stop (5%) instead of merely 20% slow
    this._maxLevel20Freeze = true;
  }

  get maxLevelBonus() { return 'Enemies are frozen for first 0.5 s of slow'; }
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

  _applyMaxLevelEffect() {
    // Level 20: reflect 20% of absorbed damage back to nearby enemies
    this._maxLevel20Reflect = true;
  }

  get maxLevelBonus() { return 'Reflects 20% of absorbed damage to nearby enemies'; }
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
    // Level 20: +25% cast speed becomes permanent — only apply once
    if (this._maxLevel20PermanentSpeed) {
      if (!this._permSpeedApplied) {
        player.castSpeed = Math.round((player.castSpeed + 0.25) * 100) / 100;
        this._permSpeedApplied = true;
      }
    } else {
      // +30% castSpeed for 6 s (Phase 12.3); refresh without stacking
      if (player._arcaneCastSpeedTimer <= 0) {
        player.castSpeed = Math.round((player.castSpeed + 0.3) * 100) / 100;
      }
      player._arcaneCastSpeedTimer = 6.0;
    }
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 5.5 }, 3: { cooldown: 5.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: cast speed bonus is permanent (+25%) instead of temporary
    this._maxLevel20PermanentSpeed = true;
  }

  get maxLevelBonus() { return '+25% cast speed becomes permanent (no timer)'; }
}

// ─── Fireball ────────────────────────────────────────────────────────────────
class Fireball extends SkillDef {
  constructor() {
    super({
      id:          'fireball',
      name:        'Fireball',
      icon:        '🔥',
      description: 'Launch an arcing fireball that detonates on impact, dealing fire damage to all enemies within 60 px and igniting them.',
      cooldown:    4.0,
      castTime:    0.75,
      base:    { damage: 55, radius: 60 },
      scaling: { damage: { flat: 18, pct: 0 }, radius: { flat: 10, pct: 0 } },
    });
    this.tags = ['Spell', 'Projectile', 'Fire', 'AoE'];
  }

  activate(player, entities, engine) {
    const { damage, radius } = this.computedStats(player);
    const tags = this.tags;

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

    // AoE burst helper — detonates at world position (bx, by)
    const burst = (bx, by) => {
      const rSq = radius * radius;
      for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
        if (!e.active) continue;
        const ex = e.x - bx, ey = e.y - by;
        if (ex * ex + ey * ey <= rSq) {
          if (engine) engine.onEnemyHit(e, damage);
          e.takeDamage(damage);
          applyAilmentsOnHit(tags, damage, e, player);
          // Level 20: guaranteed ignite
          if (this._maxLevel20GuaranteedIgnite && e.active) {
            e.ignitedTimer = Math.max(e.ignitedTimer ?? 0, 3.0);
            e.ignitedDamage = Math.max(e.ignitedDamage ?? 0, damage * 0.2);
          }
          if (!e.active && engine) engine.onEnemyKilled(e);
        }
      }
      if (engine) engine.particles.emit('death', bx, by, { color: '#e17055', count: 22 });
    };

    entities.acquireProjectile(
      player.x, player.y,
      (dx / dist) * 380, (dy / dist) * 380,
      {
        damage:     1,    // minimal trigger; real damage handled by burst
        radius:     8,
        color:      '#e17055',
        lifetime:   2.0,
        sourceTags: [],   // no per-hit ailments; burst applies them internally
        onHit:      (proj) => burst(proj.x, proj.y),
        onExpire:   (proj) => burst(proj.x, proj.y),
      },
    );
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.5 }, 3: { cooldown: 3.0 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: explosion ignites all hit enemies (guaranteed ignite)
    this._maxLevel20GuaranteedIgnite = true;
  }

  get maxLevelBonus() { return 'Explosion guarantees Ignite on all hit enemies'; }
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
      base:    { damage: 30, pillarRadius: 36 },
      scaling: { damage: { flat: 12, pct: 0 }, pillarRadius: { flat: 5, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Cold', 'Duration'];
  }

  activate(player, entities, engine) {
    const { damage, pillarRadius } = this.computedStats(player);
    const tags = this.tags;

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
    const pillarCount = this._maxLevel20ExtraPillars ? 7 : 5;
    for (let i = 1; i <= pillarCount; i++) {
      const px = player.x + dirX * step * i;
      const py = player.y + dirY * step * i;
      for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
        if (!e.active) continue;
        const dx = e.x - px, dy = e.y - py;
        if (dx * dx + dy * dy <= rSq) {
          if (engine) engine.onEnemyHit(e, damage);
          e.takeDamage(damage);
          applyAilmentsOnHit(tags, damage, e, player);
          if (!e.active && engine) engine.onEnemyKilled(e);
        }
      }
      if (engine) engine.particles.emit('death', px, py, { color: '#74b9ff', count: 12 });
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 6 }, 3: { cooldown: 5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: 7 pillars instead of 5, wider spacing
    this._maxLevel20ExtraPillars = true;
  }

  get maxLevelBonus() { return 'Erupts 7 ice pillars (was 5)'; }
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
      base:    { damage: 35, meleeRadius: 80, boltDamage: 22 },
      scaling: { damage: { flat: 12, pct: 0 }, boltDamage: { flat: 8, pct: 0 } },
    });
    this.tags = ['Attack', 'Projectile', 'Melee', 'Lightning'];
  }

  activate(player, entities, engine) {
    const { damage, meleeRadius, boltDamage } = this.computedStats(player);
    const tags = this.tags;

    // Phase 1 — melee burst
    const rSq = meleeRadius * meleeRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        const mDmg = Math.round(damage * 1.5);
        if (engine) engine.onEnemyHit(e, mDmg);
        e.takeDamage(mDmg);
        applyAilmentsOnHit(tags, mDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }

    // Phase 2 — lightning bolts forward
    const base = Math.atan2(player.facingY ?? 1, player.facingX ?? 0);
    const spread = Math.PI / 9; // 20°
    const boltCount = this._maxLevel20ExtraBolts ? 5 : 3;
    const boltOffset = (boltCount - 1) / 2;
    for (let i = 0; i < boltCount; i++) {
      const a = base + (i - boltOffset) * spread;
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(a) * 520, Math.sin(a) * 520,
        { damage: boltDamage, radius: 5, color: '#74b9ff', lifetime: 1.0, sourceTags: tags },
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 3.0 }, 3: { cooldown: 2.5 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: 5 bolts forward instead of 3
    this._maxLevel20ExtraBolts = true;
  }

  get maxLevelBonus() { return 'Fires 5 lightning bolts (was 3)'; }
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
      base:    { damage: 30, baseRadius: 55 },
      scaling: { damage: { flat: 10, pct: 0 }, baseRadius: { flat: 8, pct: 0 } },
    });
    this.tags = ['Attack', 'Channelling', 'Physical', 'AoE', 'Melee'];
    this._stages       = 0;
    this._releaseTimer = 0;
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
    if (this._releaseTimer > 0 && this._stages > 0) {
      this._releaseTimer -= dt;
      if (this._releaseTimer <= 0) this._release(player, entities, engine);
    }
  }

  _release(player, entities, engine) {
    if (!player || !entities) return;
    const { damage, baseRadius } = this.computedStats(player);
    const stages        = this._stages;
    const releaseDmg    = Math.round(damage * (0.5 + stages * 0.25));
    const releaseRadius = baseRadius + stages * 12;
    const tags          = this.tags;
    const rSq           = releaseRadius * releaseRadius;

    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, releaseDmg);
        e.takeDamage(releaseDmg);
        applyAilmentsOnHit(tags, releaseDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) {
      engine.particles.emit('death', player.x, player.y, { color: '#ff7675', count: 10 + stages * 4 });
      engine.onSkillFire();
    }
    this._stages       = 0;
    this._releaseTimer = 0;
    this._timer        = 0; // restart cooldown from release
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 7 }, 3: { cooldown: 6 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: max stages increases to 8 (was 6)
    this._maxStages = 8;
  }

  get maxLevelBonus() { return 'Maximum stages increased to 8 (was 6)'; }
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
      base:    { damage: 70, impactRadius: 80, afterRadius: 140 },
      scaling: { damage: { flat: 25, pct: 0 }, impactRadius: { flat: 10, pct: 0 }, afterRadius: { flat: 15, pct: 0 } },
    });
    this.tags = ['Attack', 'AoE', 'Physical', 'Duration'];
    this._aftershockPending = false;
    this._aftershockTimer   = 0;
    this._aftershockCtx     = null;
  }

  activate(player, entities, engine) {
    const { damage, impactRadius, afterRadius } = this.computedStats(player);
    const tags   = this.tags;
    const impDmg = Math.round(damage * 0.80);
    const rSq    = impactRadius * impactRadius;

    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, impDmg);
        e.takeDamage(impDmg);
        applyAilmentsOnHit(tags, impDmg, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', player.x, player.y, { color: '#fdcb6e', count: 28 });

    this._aftershockPending = true;
    this._aftershockTimer   = 1.5;
    this._aftershockCtx     = { originX: player.x, originY: player.y, damage, afterRadius, entities, engine, player, tags };
    // Level 20: queue a second aftershock 1.5 s after the first
    if (this._maxLevel20DoubleAfterShock) {
      this._aftershock2Pending = true;
      this._aftershock2Timer   = 3.0;
    }
  }

  update(dt) {
    if (this._aftershockPending) {
      this._aftershockTimer -= dt;
      if (this._aftershockTimer <= 0) this._doAfterShock();
    }
    if (this._aftershock2Pending) {
      this._aftershock2Timer -= dt;
      if (this._aftershock2Timer <= 0) {
        this._aftershock2Pending = false;
        // Re-fire aftershock from same origin
        const ctx = this._aftershockCtx;
        if (ctx) {
          const { originX, originY, damage, afterRadius, entities, engine, player, tags } = ctx;
          const rSq = afterRadius * afterRadius;
          for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
            if (!e.active) continue;
            const dx = e.x - originX, dy = e.y - originY;
            if (dx * dx + dy * dy <= rSq) {
              if (engine) engine.onEnemyHit(e, damage);
              e.takeDamage(damage);
              applyAilmentsOnHit(tags, damage, e, player);
              if (!e.active && engine) engine.onEnemyKilled(e);
            }
          }
          if (engine) engine.particles.emit('death', originX, originY, { color: '#fdcb6e', count: 40 });
        }
      }
    }
  }

  _doAfterShock() {
    const ctx = this._aftershockCtx;
    if (!ctx) return;
    const { originX, originY, damage, afterRadius, entities, engine, player, tags } = ctx;
    const rSq = afterRadius * afterRadius;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - originX, dy = e.y - originY;
      if (dx * dx + dy * dy <= rSq) {
        if (engine) engine.onEnemyHit(e, damage);
        e.takeDamage(damage);
        applyAilmentsOnHit(tags, damage, e, player);
        if (!e.active && engine) engine.onEnemyKilled(e);
      }
    }
    if (engine) engine.particles.emit('death', originX, originY, { color: '#fdcb6e', count: 40 });
    this._aftershockPending = false;
    this._aftershockCtx     = null;
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 8 }, 3: { cooldown: 7 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: aftershock fires a second time 1.5 s after the first
    this._maxLevel20DoubleAfterShock = true;
  }

  get maxLevelBonus() { return 'Aftershock fires twice (second aftershock at +1.5 s)'; }
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
      base:    { damage: 18, radius: 60, duration: 3.0 },
      scaling: { damage: { flat: 6, pct: 0 }, radius: { flat: 8, pct: 0 }, duration: { flat: 0.5, pct: 0 } },
    });
    this.tags = ['Spell', 'AoE', 'Cold', 'Duration'];
    /** @type {Array<{x,y,remaining,tickAccum,damage,radius,player,entities,engine}>} */
    this._vortices = [];
  }

  activate(player, entities, engine) {
    const { damage, radius, duration } = this.computedStats(player);

    let tx = player.x + (player.facingX ?? 0) * 200;
    let ty = player.y + (player.facingY ?? 1) * 200;
    let minSq = Infinity;
    for (const e of (entities.getHostiles ? entities.getHostiles() : entities.enemies)) {
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < minSq) { minSq = d; tx = e.x; ty = e.y; }
    }

    this._vortices.push({ x: tx, y: ty, remaining: duration, tickAccum: 0, damage, radius, player, entities, engine });
    if (engine) engine.particles.emit('death', tx, ty, { color: '#74b9ff', count: 16 });
    if (engine) engine.onSkillFire();
  }

  update(dt) {
    const tags = this.tags;
    for (const v of this._vortices) {
      v.remaining -= dt;
      v.tickAccum  += dt;
      // Level 20: drift toward nearest enemy
      if (this._maxLevel20Tracking) {
        let nearest = null, nearestDSq = Infinity;
        for (const e of (v.entities.getHostiles ? v.entities.getHostiles() : v.entities.enemies)) {
          if (!e.active) continue;
          const dx = e.x - v.x, dy = e.y - v.y;
          const d = dx * dx + dy * dy;
          if (d < nearestDSq) { nearestDSq = d; nearest = e; }
        }
        if (nearest) {
          const dx = nearest.x - v.x, dy = nearest.y - v.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          v.x += (dx / dist) * 40 * dt;
          v.y += (dy / dist) * 40 * dt;
        }
      }
      if (v.tickAccum >= 0.30) {
        v.tickAccum -= 0.30;
        const rSq = v.radius * v.radius;
        for (const e of (v.entities.getHostiles ? v.entities.getHostiles() : v.entities.enemies)) {
          if (!e.active) continue;
          const dx = e.x - v.x, dy = e.y - v.y;
          if (dx * dx + dy * dy <= rSq) {
            if (v.engine) v.engine.onEnemyHit(e, v.damage);
            e.takeDamage(v.damage);
            applyAilmentsOnHit(tags, v.damage, e, v.player);
            if (!e.active && v.engine) v.engine.onEnemyKilled(e);
          }
        }
        if (v.engine) v.engine.particles.emit('death', v.x, v.y, { color: '#74b9ff', count: 6 });
      }
    }
    this._vortices = this._vortices.filter((v) => v.remaining > 0);
  }

  _applyLevelStats() {
    const table = { 2: { cooldown: 7 }, 3: { cooldown: 6 } };
    const s = table[this.level];
    if (s?.cooldown) this.cooldown = s.cooldown;
  }

  _applyMaxLevelEffect() {
    // Level 20: vortex slowly drifts toward nearest enemy instead of staying fixed
    this._maxLevel20Tracking = true;
  }

  get maxLevelBonus() { return 'Vortex slowly tracks the nearest enemy'; }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** All 14 constructors — 8 original + 6 new Phase 12.4 skills. */
export const PURE_SKILL_CTORS = {
  blink:             ChaosBlink,
  frost_nova:        FrostNova,
  gravity_well:      GravityWell,
  blood_pact:        BloodPact,
  wraith_summon:     WraithSummon,
  time_warp:         TimeWarp,
  bulwark:           IronBulwark,
  arcane_surge:      ArcaneSurge,
  fireball:          Fireball,
  glacial_cascade:   GlacialCascade,
  lightning_strike:  LightningStrike,
  blade_flurry:      BladeFlurry,
  earthquake:        Earthquake,
  vortex:            Vortex,
};

/**
 * SKILL_OFFER_POOL — entries shown at milestone levels (5 / 15 / 30).
 * Each entry:
 *   id, name, description
 *   isWeaponSkill: true  → create() returns a Weapon instance; add to player.autoSkills[]
 *   isWeaponSkill: false → createSkill() returns a SkillDef instance; add to player.pureSkills[]
 *   available(player, engine) → bool — filtered before shuffle
 */
import { ArcaneLance }    from '../weapons/ArcaneLance.js';
import { PhantomBlade }   from '../weapons/PhantomBlade.js';
import { TectonicCleave } from '../weapons/TectonicCleave.js';
import { BoneSpear }      from '../weapons/BoneSpear.js';
import { ChainLightning } from '../weapons/ChainLightning.js';
import { VoidShardSwarm } from '../weapons/VoidShardSwarm.js';

export const SKILL_OFFER_POOL = [
  // ── Weapon-based active skills ──────────────────────────────────────────
  {
    id:           'PHANTOM_BLADE',
    name:         'Phantom Blade',
    description:  'Hurl a spectral blade in your facing direction.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'PHANTOM_BLADE'),
    create:       () => new PhantomBlade(),
  },
  {
    id:           'TECTONIC_CLEAVE',
    name:         'Tectonic Cleave',
    description:  'Launch a massive earth-rending projectile that pierces all enemies.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'TECTONIC_CLEAVE'),
    create:       () => new TectonicCleave(),
  },
  {
    id:           'BONE_SPEAR',
    name:         'Bone Spear',
    description:  'Impale enemies with a slow, devastating piercing bone shard.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'BONE_SPEAR'),
    create:       () => new BoneSpear(),
  },
  {
    id:           'CHAIN_LIGHTNING',
    name:         'Chain Lightning',
    description:  'Discharge a bolt that arcs to up to 4 additional nearby enemies.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'CHAIN_LIGHTNING'),
    create:       () => new ChainLightning(),
  },
  {
    id:           'VOID_SHARD_SWARM',
    name:         'Void Shard Swarm',
    description:  'Fire 3 spiraling shards that home in on the nearest enemy.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'VOID_SHARD_SWARM'),
    create:       () => new VoidShardSwarm(),
  },
  {
    id:           'ARCANE_LANCE',
    name:         'Arcane Lance',
    description:  'Fire a precise magical bolt at the nearest enemy.',
    isWeaponSkill: true,
    available:    (player) => !player.autoSkills.some((w) => w.id === 'ARCANE_LANCE'),
    create:       () => new ArcaneLance(),
  },
  // ── Pure SkillDef skills ─────────────────────────────────────────────────
  {
    id:            'blink',
    name:          'Chaos Blink',
    description:   'Teleport 200 px forward and gain brief invulnerability.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('blink'),
    createSkill:   () => new ChaosBlink(),
  },
  {
    id:            'frost_nova',
    name:          'Frost Nova',
    description:   'Freeze all enemies within 250 px for 2 s and deal 15 damage.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('frost_nova'),
    createSkill:   () => new FrostNova(),
  },
  {
    id:            'gravity_well',
    name:          'Gravity Well',
    description:   'Pull all enemies within 350 px violently toward you.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('gravity_well'),
    createSkill:   () => new GravityWell(),
  },
  {
    id:            'blood_pact',
    name:          'Blood Pact',
    description:   'Sacrifice 25% HP for +80% weapon damage for 4 s.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('blood_pact'),
    createSkill:   () => new BloodPact(),
  },
  {
    id:            'wraith_summon',
    name:          'Summon Wraith',
    description:   'Send a wraith to the nearest enemy; it explodes on arrival for 200 damage.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('wraith_summon'),
    createSkill:   () => new WraithSummon(),
  },
  {
    id:            'time_warp',
    name:          'Time Warp',
    description:   'Slow all enemies to 20% speed for 3 s.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('time_warp'),
    createSkill:   () => new TimeWarp(),
  },
  {
    id:            'bulwark',
    name:          'Iron Bulwark',
    description:   'Erect a shield that absorbs the next 80 damage for 3 s.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('bulwark'),
    createSkill:   () => new IronBulwark(),
  },
  {
    id:            'arcane_surge',
    name:          'Arcane Surge',
    description:   'Reset all cooldowns and fire weapons at near-zero cost for 2 s. +30% cast speed for 6 s.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('arcane_surge'),
    createSkill:   () => new ArcaneSurge(),
  },
  // ── Phase 12.4 skills ────────────────────────────────────────────────────
  {
    id:            'fireball',
    name:          'Fireball',
    description:   'Arcing fireball detonates in 60 px AoE on impact; ignites enemies.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('fireball'),
    createSkill:   () => new Fireball(),
  },
  {
    id:            'glacial_cascade',
    name:          'Glacial Cascade',
    description:   '5 ice pillars along a line; each damages and chills enemies.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('glacial_cascade'),
    createSkill:   () => new GlacialCascade(),
  },
  {
    id:            'lightning_strike',
    name:          'Lightning Strike',
    description:   'Melee burst + 3 lightning bolts forward; applies Shock.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('lightning_strike'),
    createSkill:   () => new LightningStrike(),
  },
  {
    id:            'blade_flurry',
    name:          'Blade Flurry',
    description:   'Build up to 6 stages then unleash a scaling melee AoE burst.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('blade_flurry'),
    createSkill:   () => new BladeFlurry(),
  },
  {
    id:            'earthquake',
    name:          'Earthquake',
    description:   'Instant ground slam + aftershock 1.5 s later at origin.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('earthquake'),
    createSkill:   () => new Earthquake(),
  },
  {
    id:            'vortex',
    name:          'Vortex',
    description:   'Chilling cold vortex at target; pulses damage/tick for 3 s; applies Chill.',
    isWeaponSkill: false,
    available:     (_player, engine) => !engine.activeSkillSystem.hasPureSkill('vortex'),
    createSkill:   () => new Vortex(),
  },
];

/** Return all skill offers that are currently learnable by the player. */
export function getAvailableSkillOffers(player, engine) {
  return SKILL_OFFER_POOL.filter((offer) => offer.available(player, engine));
}

/** Find a skill offer entry by id. */
export function getSkillOfferById(offerId) {
  return SKILL_OFFER_POOL.find((offer) => offer.id === offerId) ?? null;
}

/** Build a 1x1 inventory item that can be consumed to learn a skill offer. */
export function createSkillGemItem(offer) {
  const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `skill_gem_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  return {
    uid,
    id: `skill_gem_${String(offer.id).toLowerCase()}`,
    type: 'skill_gem',
    skillOfferId: offer.id,
    name: `${offer.name} Gem`,
    rarity: 'magic',
    slot: 'gem',
    gridW: 1,
    gridH: 1,
    gemIcon: offer.isWeaponSkill ? '✦' : '◇',
    description: `Learn ${offer.name}. ${offer.description}`,
    affixes: [],
  };
}


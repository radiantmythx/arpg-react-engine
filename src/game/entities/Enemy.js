import { Entity } from './Entity.js';
import { ENEMY_AI, DEFAULT_ENEMY_SKILLS } from '../config.js';
import { firstTaggedElement, makeDamageRange, rollDamageEntry } from '../damageUtils.js';

const ATTACK_VISUAL_DURATION = 0.2; // seconds for the enemy attack arc to fade

export class Enemy extends Entity {
  constructor(x, y, config) {
    super(x, y);
    this.type = config.id;
    this.radius = config.radius;
    this.speed = config.speed;
    this.health = config.health;
    this.maxHealth = config.health;
    this.damage = config.damage;
    this.xpValue = config.xpValue;
    this.color = config.color;
    // ── Active-skill debuff fields (Phase 11) ─────────────────────────────
    /** Seconds remaining where this enemy cannot move (Frost Nova). */
    this.frozenTimer = 0;
    /** Speed multiplier (1.0 = normal; 0.2 = Time Warp slow). */
    this.speedMult   = 1.0;
    /** How long the current speedMult lasts. */
    this.speedTimer  = 0;

    // ── Ailment state (Phase 12.4) ─────────────────────────────────────────
    this.ailments = {
      ignite:  null,  // { timer, dps }    — fire DoT per second
      chill:   null,  // { timer }         — visual marker; speed via speedTimer
      shock:   null,  // { timer }         — boosts damage taken
      bleed:   [],    // [{ timer, dps }]  — physical DoT while moving (stackable)
      poison:  [],    // [{ timer, dps }]  — chaos DoT, unlimited stacks
    };
    /** Incoming damage multiplier while shocked (1.0 = normal, 1.4 = shocked). */
    this.shockedMult = 1.0;

    // ── Resistance map ───────────────────────────────────────────────────────
    // Keys are lowercase elemental tag names: physical, blaze, thunder, frost, holy, unholy.
    // Values are fractional: 0.20 = 20% less damage; -0.15 = 15% more damage (weakness).
    // Sourced from config; defaults to empty object (no resistances).
    this.resistances = config.resistances ?? {};
    /** Multiplier applied to all skill damage at delivery time — set by ClusterSpawner from area level. */
    this.damageScale  = config.damageScale ?? 1;
    this.aggroRadius = config.aggroRadius ?? ENEMY_AI.baseAggroRadius;
    this.propagationRadius = config.propagationRadius ?? ENEMY_AI.propagationRadius;
    this.packId = config.packId ?? null;
    this.spawnX = x;
    this.spawnY = y;
    this.lastKnownPlayerX = x;
    this.lastKnownPlayerY = y;
    this.aggroSource = null;
    this._justAggroed = false;
    this._path = null;
    this._pathIndex = 0;
    this._repathTimer = 0;

    // ── Enemy skill system ────────────────────────────────────────────────
    // Each skill: { id, name, damage: {min,max}, cooldown, castTime, range, tags, _timer }
    const skillDefs = config.skills ?? DEFAULT_ENEMY_SKILLS;
    this.skills = skillDefs.map((s) => ({
      ...s,
      _timer: s.cooldown * (0.3 + Math.random() * 0.4), // stagger first attack
    }));
    /** Visual attack arc state — null when hidden. */
    this._attackAge = null;
    this._attackAngle = 0;
    /** Active cast state — null when idle. */
    this._casting = null; // { skill, elapsed, duration, player, engine }
  }

  update(dt, player, engine) {
    // Tick attack visual
    if (this._attackAge !== null) {
      this._attackAge += dt;
      if (this._attackAge >= ATTACK_VISUAL_DURATION) this._attackAge = null;
    }

    this.tryAcquireAggro(player);
    if (!this.isBoss && this.aiState !== 'aggro') {
      return;
    }

    this.lastKnownPlayerX = player.x;
    this.lastKnownPlayerY = player.y;

    // ── Debuff ticks ─────────────────────────────────────────────────────
    if (this.frozenTimer > 0) {
      this.frozenTimer = Math.max(0, this.frozenTimer - dt);
      if (this.frozenTimer > 0) { this._casting = null; return; } // frozen: cancel cast, skip frame
    }
    if (this.speedTimer > 0) {
      this.speedTimer = Math.max(0, this.speedTimer - dt);
      if (this.speedTimer <= 0) this.speedMult = 1.0;
    }

    // Tick DoT ailments; if a DoT kills the enemy, report it and stop
    if (this._tickAilments(dt) && engine) {
      engine.onEnemyKilled(this);
      return;
    }

    // ── Tick skill cooldowns ─────────────────────────────────────────────
    for (const skill of this.skills) {
      if (skill._timer > 0) skill._timer -= dt;
    }

    // ── Active cast — tick and deliver ───────────────────────────────────
    if (this._casting) {
      this._casting.elapsed += dt;
      if (this._casting.elapsed >= this._casting.duration) {
        this._deliverSkill(this._casting.skill, player, engine);
        this._casting.skill._timer = this._casting.skill.cooldown;
        this._casting = null;
      }
      return; // stand still while casting
    }

    // ── Check skill range vs player ─────────────────────────────────────
    const dxP = player.x - this.x;
    const dyP = player.y - this.y;
    const distToPlayer = Math.sqrt(dxP * dxP + dyP * dyP);

    // If any skill is usable at this distance, begin casting.
    if (this._tryUseSkills(distToPlayer, player, engine)) {
      return; // started a cast — skip movement
    }

    // If in range of the shortest-range skill, hold position (cooldown pending).
    if (this._isInAnySkillRange(distToPlayer, player)) {
      return;
    }

    // ── Movement (chase toward player) ───────────────────────────────────
    let targetX = player.x;
    let targetY = player.y;

    const hasDirectPath = engine?.hasLineOfSight?.(this.x, this.y, player.x, player.y) ?? true;
    if (hasDirectPath) {
      this._path = null;
      this._pathIndex = 0;
      this._repathTimer = ENEMY_AI.repathInterval;
    } else {
      this._repathTimer -= dt;
      if (this._repathTimer <= 0) {
        this._repathTimer = ENEMY_AI.repathInterval;
        this._path = engine?.getPathForEnemy?.(this, player.x, player.y) ?? null;
        this._pathIndex = this._path?.length > 1 ? 1 : 0;
      }

      if (this._path && this._pathIndex < this._path.length) {
        const node = this._path[this._pathIndex];
        targetX = node.x;
        targetY = node.y;

        const ndx = targetX - this.x;
        const ndy = targetY - this.y;
        const nodeDistSq = ndx * ndx + ndy * ndy;
        const reachedSq = (this.radius + 10) * (this.radius + 10);
        if (nodeDistSq <= reachedSq && this._pathIndex < this._path.length - 1) {
          this._pathIndex++;
          const next = this._path[this._pathIndex];
          targetX = next.x;
          targetY = next.y;
        }
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed * this.speedMult * dt;
      this.y += (dy / dist) * this.speed * this.speedMult * dt;
    }
  }

  // ── Enemy skill helpers ───────────────────────────────────────────────

  /**
   * Returns the effective center-to-center distance at which a skill can hit.
   */
  _skillEffectiveRange(skill, target) {
    return this.radius + (target.radius ?? 0) + (skill.range ?? 10);
  }

  /**
   * Returns true if the enemy is within range of any of its skills.
   */
  _isInAnySkillRange(dist, target) {
    for (const skill of this.skills) {
      if (dist <= this._skillEffectiveRange(skill, target)) return true;
    }
    return false;
  }

  /**
   * Try to begin casting the first ready skill that is in range.
   * @returns {boolean} true if a cast was started (or instantly fired) this frame
   */
  _tryUseSkills(dist, player, engine) {
    for (const skill of this.skills) {
      if (skill._timer > 0) continue;
      if (dist > this._skillEffectiveRange(skill, player)) continue;
      const castTime = skill.castTime ?? 0;
      if (castTime > 0) {
        this._casting = { skill, elapsed: 0, duration: castTime };
      } else {
        this._deliverSkill(skill, player, engine);
        skill._timer = skill.cooldown;
      }
      return true;
    }
    return false;
  }

  /**
   * Deliver a skill hit to the player.  Rolls damage from the skill's damage
   * range and applies it through the player's normal mitigation pipeline.
   */
  _deliverSkill(skill, player, engine) {
    const rawDamage = rollDamageEntry(skill.damage);
    const damage = rawDamage * (this.damageScale ?? 1);
    player.takeDamage(Math.round(damage));
    // Record attack visual
    this._attackAge = 0;
    this._attackAngle = Math.atan2(player.y - this.y, player.x - this.x);
    if (player.health <= 0) {
      engine?.gameOver();
      return;
    }
    // onPlayerHit triggers screen shake / damage number; only fires when
    // takeDamage actually landed (invulnerability resets to 0.5).
    if (player.invulnerable > 0.45) engine?.onPlayerHit(damage);
  }

  takeDamage(amountOrMap, sourceTags = null, sourcePenetration = null) {
    this.setAggro('damaged');

    let mitigated = 0;

    // Typed map path: apply each resistance to its own damage bucket.
    // Example: { Physical: 20, Frost: 30 } checks physical and frost independently.
    if (amountOrMap && typeof amountOrMap === 'object') {
      for (const [type, rawAmount] of Object.entries(amountOrMap)) {
        if (rawAmount == null) continue;
        const rolledAmount = rollDamageEntry(rawAmount);
        if (!Number.isFinite(rolledAmount)) continue;
        const lower = String(type).toLowerCase();
        const res = this.resistances?.[lower] ?? 0;
        const pen = sourcePenetration?.[lower] ?? 0;
        const effectiveRes = res - pen;
        // Positive res = damage reduction; negative = weakness (more damage).
        // Hard cap at 75% resistance; no cap on weakness.
        mitigated += rolledAmount * (1 - Math.min(effectiveRes, 0.75));
      }
    } else {
      // Backward-compatible numeric path used by DoT ticks and non-projectile hits.
      let amount = Number(amountOrMap) || 0;
      const taggedElem = firstTaggedElement(sourceTags);
      if (taggedElem && amount > 0) {
        amount = rollDamageEntry(makeDamageRange(amount, taggedElem));
      }
      mitigated = amount;
      if (sourceTags && sourceTags.length > 0 && this.resistances) {
        for (const tag of sourceTags) {
          const lower = tag.toLowerCase();
          const res = this.resistances[lower];
          if (res != null) {
            const pen = sourcePenetration?.[lower] ?? 0;
            const effectiveRes = res - pen;
            mitigated = amount * (1 - Math.min(effectiveRes, 0.75));
            break;
          }
        }
      }
    }

    this.health -= mitigated * this.shockedMult;
    const dealt = mitigated * this.shockedMult;
    if (this.health <= 0) {
      this.active = false;
    }
    return dealt;
  }

  tryAcquireAggro(player) {
    if (this.isBoss || this.aiState === 'aggro') return false;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const aggroRadius = this.aggroRadius ?? ENEMY_AI.baseAggroRadius;
    if (dx * dx + dy * dy > aggroRadius * aggroRadius) return false;
    this.setAggro('player_proximity');
    return true;
  }

  setAggro(source = 'unknown') {
    if (this.isBoss) return;
    if (this.aiState === 'aggro') return;
    this.aiState = 'aggro';
    this.aggroSource = source;
    this._justAggroed = true;
    this._repathTimer = 0;
    this._path = null;
    this._pathIndex = 0;
  }

  consumeAggroEvent() {
    if (!this._justAggroed) return false;
    this._justAggroed = false;
    return true;
  }

  /**
   * Tick all active ailments by dt seconds.
   * @returns {boolean} true if the enemy died from a DoT this frame
   */
  _tickAilments(dt) {
    if (!this.active) return false;
    const a = this.ailments;

    // Ignite — fire DoT
    if (a.ignite) {
      this.takeDamage(a.ignite.dps * dt);
      a.ignite.timer -= dt;
      if (a.ignite.timer <= 0) a.ignite = null;
      if (!this.active) return true;
    }

    // Chill — visual marker; actual speed is handled by speedTimer
    if (a.chill) {
      a.chill.timer -= dt;
      if (a.chill.timer <= 0) a.chill = null;
    }

    // Shock — expires when timer runs out
    if (a.shock) {
      a.shock.timer -= dt;
      if (a.shock.timer <= 0) {
        a.shock = null;
        this.shockedMult = 1.0;
      }
    }

    // Bleed — physical DoT while the enemy is moving (not frozen)
    for (const b of a.bleed) {
      b.timer -= dt;
      if (this.frozenTimer <= 0) {
        this.takeDamage(b.dps * dt);
        if (!this.active) { a.bleed = a.bleed.filter((x) => x.timer > 0); return true; }
      }
    }
    a.bleed = a.bleed.filter((b) => b.timer > 0);

    // Poison — chaos DoT, unlimited stacks
    for (const p of a.poison) {
      p.timer -= dt;
      this.takeDamage(p.dps * dt);
      if (!this.active) { a.poison = a.poison.filter((x) => x.timer > 0); return true; }
    }
    a.poison = a.poison.filter((p) => p.timer > 0);

    return false;
  }

  /**
   * Apply a single ailment to this enemy.
   * @param {string} name — AILMENT_DEFS key (e.g. 'Ignite', 'Shock')
   * @param {number} hitDamage — the damage of the triggering hit
   * @param {object} def — matching entry from AILMENT_DEFS
   */
  applyAilment(name, hitDamage, def) {
    const a = this.ailments;
    switch (name) {
      case 'Ignite':
        // Non-stackable — re-applying refreshes the timer
        a.ignite = { timer: def.duration, dps: def.damageFormula(hitDamage) };
        break;
      case 'Chill':
        a.chill = { timer: def.duration };
        // Apply speed penalty only if stronger than current state
        if (this.frozenTimer <= 0) {
          const chillMult = 1 - def.speedPenalty;
          if (this.speedMult > chillMult) {
            this.speedMult  = chillMult;
            this.speedTimer = Math.max(this.speedTimer, def.duration);
          }
        }
        break;
      case 'Freeze':
        a.chill = null;
        this.frozenTimer = Math.max(this.frozenTimer, def.duration);
        break;
      case 'Shock':
        a.shock      = { timer: def.duration };
        this.shockedMult = def.damageTakenMult;
        break;
      case 'Bleed':
        if (a.bleed.length < (def.maxStacks ?? 8)) {
          a.bleed.push({ timer: def.duration, dps: def.damageFormula(hitDamage) });
        }
        break;
      case 'Poison':
        a.poison.push({ timer: def.duration, dps: def.damageFormula(hitDamage) });
        break;
    }
  }

  draw(renderer) {
    // Gold pulse ring for Corrupted Champions.
    if (this.isChampion) {
      renderer.drawStrokeCircle(this.x, this.y, this.radius + 5, '#f1c40f', 3, 0.85);
    }

    // Ailment indicator rings (drawn just outside champion ring)
    const a = this.ailments;
    let ringR = this.radius + (this.isChampion ? 11 : 6);
    if (a.ignite) {
      renderer.drawStrokeCircle(this.x, this.y, ringR, '#e17055', 2, 0.9);
      ringR += 5;
    }
    if (a.chill || this.frozenTimer > 0) {
      renderer.drawStrokeCircle(this.x, this.y, ringR, '#74b9ff', 2, 0.9);
      ringR += 5;
    }
    if (a.shock) {
      renderer.drawStrokeCircle(this.x, this.y, ringR, '#fdcb6e', 2, 0.9);
      ringR += 5;
    }
    if (a.bleed.length > 0) {
      renderer.drawStrokeCircle(this.x, this.y, ringR, '#ff7675', 2, 0.9);
      ringR += 5;
    }
    if (a.poison.length > 0) {
      renderer.drawStrokeCircle(this.x, this.y, ringR, '#55efc4', 2, 0.9);
    }

    renderer.drawCircle(this.x, this.y, this.radius, this.color);

    // ── Attack swing arc visual ────────────────────────────────────────
    if (this._attackAge !== null) {
      const t = this._attackAge / ATTACK_VISUAL_DURATION; // 0 → 1
      const r = this.radius * (0.8 + t * 0.6);
      const alpha = 0.7 * (1 - t);
      const arcHalf = Math.PI / 4; // 90-degree arc
      const { ctx } = renderer;
      const p = renderer.toScreen(this.x, this.y);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, this._attackAngle - arcHalf, this._attackAngle + arcHalf);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Only show health bar when damaged
    if (this.health < this.maxHealth) {
      renderer.drawHealthBar(
        this.x,
        this.y,
        this.health,
        this.maxHealth,
        this.radius * 2 + 4,
        -(this.radius + 8),
      );
    }

    // ── Cast bar (green, fills left-to-right while casting) ─────────────
    if (this._casting) {
      const barW = this.radius * 2 + 4;
      const barH = 3;
      const ratio = Math.min(1, this._casting.elapsed / this._casting.duration);
      const healthShowing = this.health < this.maxHealth;
      const offsetY = -(this.radius + (healthShowing ? 14 : 8));
      const p = renderer.toScreen(this.x, this.y);
      const bx = p.x - barW / 2;
      const by = p.y + offsetY;
      const { ctx } = renderer;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(bx, by, barW * ratio, barH);
    }
  }
}

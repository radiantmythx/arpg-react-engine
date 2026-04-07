import { Entity } from './Entity.js';
import { ENEMY_AI } from '../config.js';

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

    // ── C11.1 aggro state ────────────────────────────────────────────────
    this.aiState = config.aiState ?? 'idle';
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
  }

  update(dt, player, engine) {
    this.tryAcquireAggro(player);
    if (!this.isBoss && this.aiState !== 'aggro') {
      return;
    }

    this.lastKnownPlayerX = player.x;
    this.lastKnownPlayerY = player.y;

    // ── Debuff ticks ─────────────────────────────────────────────────────
    if (this.frozenTimer > 0) {
      this.frozenTimer = Math.max(0, this.frozenTimer - dt);
      if (this.frozenTimer > 0) return; // frozen: skip movement this frame
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

    let targetX = player.x;
    let targetY = player.y;

    const hasDirectPath = engine?.hasLineOfSight?.(this.x, this.y, player.x, player.y) ?? true;
    if (hasDirectPath) {
      // Keep nearby enemies aggressive and direct when there is no wall blocking the lane.
      this._path = null;
      this._pathIndex = 0;
      this._repathTimer = ENEMY_AI.repathInterval;
    } else {
      this._repathTimer -= dt;
      if (this._repathTimer <= 0) {
        this._repathTimer = ENEMY_AI.repathInterval;
        this._path = engine?.getPathForEnemy?.(this, player.x, player.y) ?? null;
        // Skip current node (enemy is already near it).
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

  takeDamage(amount) {
    this.setAggro('damaged');
    this.health -= amount * this.shockedMult;
    if (this.health <= 0) {
      this.active = false;
    }
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
  }
}

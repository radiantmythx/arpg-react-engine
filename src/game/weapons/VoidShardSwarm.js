/**
 * VoidShardSwarm — fires 3 small shards in a forward spread that home toward
 * enemies once they have orbited far enough outward.
 *
 * Each shard is a standard pooled projectile but has homing applied via a
 * per-frame `vx/vy` update driven by this weapon's own update loop, which
 * patches projectile velocities in _shards[].
 *
 * Shards deactivate on enemy contact (CollisionSystem) or lifetime expiry.
 * We track them in a local WeakSet so we only update shards belonging to this
 * weapon instance.
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

/** Distance at which shards begin homing in (px from spawn origin). */
const ORBIT_RADIUS = 90;
/** Turn speed toward target (radians per second). */
const HOME_TURN_RATE = Math.PI * 3.5;

export class VoidShardSwarm extends Weapon {
  constructor() {
    super(WEAPONS.VOID_SHARD_SWARM);
    this.tags = ['Spell', 'Projectile', 'Unholy'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
    /** Track live shards we own so we can steer them. */
    this._shards = new Set();
  }

  fire(player, entities, engine) {
    const stats = this.computedStats(player);
    const facing = Math.atan2(player.facingY ?? 1, player.facingX ?? 0);
    const spreadAngles = [-0.20, 0, 0.20]; // radians
    const speed = this.config.projectileSpeed;

    for (const spread of spreadAngles) {
      const angle = facing + spread;
      const proj = entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        {
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        this.config.projectileLifetime,
          piercing:        false,
          _spawnX:         player.x,
          _spawnY:         player.y,
          _homing:         false,
          sourceTags:      this.tags,
        },
      );
      if (proj) this._shards.add(proj);
    }
    if (engine) engine.onSkillFire();
  }

  update(dt, player, entities, engine) {
    // Remove expired/inactive shards from our tracking set.
    for (const s of this._shards) {
      if (!s.active) this._shards.delete(s);
    }

    // Steer active shards that have passed the orbit radius.
    for (const shard of this._shards) {
      if (!shard.active) continue;

      const dx = shard.x - shard._spawnX;
      const dy = shard.y - shard._spawnY;
      const distFromSpawn = Math.sqrt(dx * dx + dy * dy);

      if (distFromSpawn >= ORBIT_RADIUS) {
        shard._homing = true;
      }

      if (shard._homing) {
        // Find nearest enemy to home toward.
        let nearest = null;
        let nearestDSq = Infinity;
        for (const e of entities.getHostiles()) {
          if (!e.active) continue;
          const ex = e.x - shard.x;
          const ey = e.y - shard.y;
          const d = ex * ex + ey * ey;
          if (d < nearestDSq) { nearestDSq = d; nearest = e; }
        }
        if (nearest) {
          const tdx = nearest.x - shard.x;
          const tdy = nearest.y - shard.y;
          const targetAngle = Math.atan2(tdy, tdx);
          const currentAngle = Math.atan2(shard.vy, shard.vx);
          // Rotate current angle toward target angle by at most HOME_TURN_RATE * dt.
          let diff = targetAngle - currentAngle;
          // Normalise to [-π, π].
          while (diff > Math.PI)  diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          const rotate = Math.sign(diff) * Math.min(Math.abs(diff), HOME_TURN_RATE * dt);
          const newAngle = currentAngle + rotate;
          const spd = Math.sqrt(shard.vx ** 2 + shard.vy ** 2);
          shard.vx = Math.cos(newAngle) * spd;
          shard.vy = Math.sin(newAngle) * spd;
        }
      }
    }

    // Standard cooldown — only auto-fires when NOT an active skill.
    this._timer += dt;
    if (!this.isActive && this._timer >= this.cooldown) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 20, cooldown: 1.6 },
      3: { damage: 28, cooldown: 1.4, projectileLifetime: 2.4 },
      4: { damage: 38, cooldown: 1.2 },
      5: { damage: 50, cooldown: 1.0, projectileLifetime: 3.0 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage           !== undefined) this.damage   = s.damage;
    if (s.cooldown         !== undefined) this.cooldown = s.cooldown;
    if (s.projectileLifetime !== undefined) this.config = { ...this.config, projectileLifetime: s.projectileLifetime };
  }
}

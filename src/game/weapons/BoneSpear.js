/**
 * BoneSpear — slow-firing, high-damage piercing projectile.
 *
 * Fires a single large heavy projectile toward the nearest enemy.
 * Pierces through all enemies it touches.  On expiry (or if it travels
 * its full lifetime) it leaves a brief ground crack visual (a short
 * cross-hair drawn by this weapon's own draw call, stored in _cracks[]).
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  scaleProjectileMotion,
} from '../projectileSupport.js';

/** How long a ground crack decal persists (seconds). */
const CRACK_LIFETIME = 2.0;

export class BoneSpear extends Weapon {
  constructor() {
    super(WEAPONS.BONE_SPEAR);
    this.tags = ['Attack', 'Projectile', 'Physical'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
    /** @type {Array<{x,y,age}>} */
    this._cracks = [];
    /** Track last known projectile positions so we can spawn cracks on expiry. */
    this._tracked = new WeakMap();
  }

  fire(player, entities, engine) {
    let nearest = null;
    let nearestDSq = Infinity;
    for (const e of entities.getHostiles()) {
      if (!e.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < nearestDSq) { nearestDSq = d; nearest = e; }
    }

    const tx = nearest ? nearest.x : player.x + (player.facingX ?? 0) * 300;
    const ty = nearest ? nearest.y : player.y + (player.facingY ?? 1) * 300;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stats = this.computedStats(player);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(dy / dist, dx / dist);

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.12)) {
      const proj = entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        motion.lifetime,
          piercing:        true,
          onExpire:        (expiredProj) => this._cracks.push({ x: expiredProj.x, y: expiredProj.y, age: 0 }),
        }, supportState, this.tags),
      );
      if (proj) this._tracked.set(proj, true);
    }
    if (engine) engine.onSkillFire();
  }

  update(dt, player, entities, engine) {
    for (const c of this._cracks) c.age += dt;
    this._cracks = this._cracks.filter((c) => c.age < CRACK_LIFETIME);

    this._timer += dt;
    if (!this.isActive && this._timer >= this.cooldown) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  draw(renderer) {
    for (const c of this._cracks) {
      const alpha = Math.max(0, 0.6 * (1 - c.age / CRACK_LIFETIME));
      const size = 18;
      // Draw a simple + cross crack at landing point.
      renderer.drawLine(c.x - size, c.y, c.x + size, c.y, '#c8a050', 2, alpha);
      renderer.drawLine(c.x, c.y - size * 0.6, c.x, c.y + size * 0.6, '#c8a050', 2, alpha);
      // Diagonal cracks
      renderer.drawLine(c.x - size * 0.6, c.y - size * 0.4, c.x + size * 0.6, c.y + size * 0.4, '#c8a050', 1.5, alpha * 0.7);
      renderer.drawLine(c.x + size * 0.6, c.y - size * 0.4, c.x - size * 0.6, c.y + size * 0.4, '#c8a050', 1.5, alpha * 0.7);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 70, cooldown: 1.2 },
      3: { damage: 90, cooldown: 1.1, projectileRadius: 14 },
      4: { damage: 115, cooldown: 1.0 },
      5: { damage: 145, cooldown: 0.9, projectileRadius: 16 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage          !== undefined) this.damage   = s.damage;
    if (s.cooldown        !== undefined) this.cooldown = s.cooldown;
    if (s.projectileRadius !== undefined) this.config  = { ...this.config, projectileRadius: s.projectileRadius };
  }
}

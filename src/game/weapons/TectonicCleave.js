/**
 * TectonicCleave — earth-rending piercing projectile.
 *
 * Fires a single large, slow projectile toward the nearest enemy.
 * The projectile is affected by world-Y gravity giving it a curved arc path,
 * and it pierces through every enemy it touches.
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

export class TectonicCleave extends Weapon {
  constructor() {
    super(WEAPONS.TECTONIC_CLEAVE);
    this.tags = ['Attack', 'AoE', 'Physical', 'Melee'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
  }

  fire(player, entities) {
    // Find nearest active enemy.
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const enemy of entities.getHostiles()) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < nearestDistSq) {
        nearestDistSq = d;
        nearest = enemy;
      }
    }

    let dx, dy;
    if (nearest) {
      dx = nearest.x - player.x;
      dy = nearest.y - player.y;
    } else {
      dx = player.facingX ?? 0;
      dy = player.facingY ?? 1;
    }

    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = this.config.projectileSpeed;

    entities.acquireProjectile(
      player.x, player.y,
      (dx / dist) * speed, (dy / dist) * speed,
      {
        damage:   this.damage,
        radius:   this.config.projectileRadius,
        color:    this.config.color,
        lifetime: this.config.projectileLifetime,
        piercing: true,
        gravity:  this.config.gravity,
        sourceTags: this.tags,
        sourceTags: this.tags,
      },
    );
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 55, gravity: 240 },
      3: { damage: 75, gravity: 280 },
      4: { damage: 100, gravity: 320 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage  !== undefined) this.damage = s.damage;
    if (s.gravity !== undefined) this.config = { ...this.config, gravity: s.gravity };
  }
}

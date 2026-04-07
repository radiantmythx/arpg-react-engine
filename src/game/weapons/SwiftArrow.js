/**
 * SwiftArrow — Rogue's default auto-fire starter skill.
 *
 * Looses a fast arrow toward the cursor-facing direction.
 * Tags: Attack, Projectile, Physical.
 */
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

export class SwiftArrow extends Weapon {
  constructor() {
    super(WEAPONS.SWIFT_ARROW);
    this.tags = ['Attack', 'Projectile', 'Physical'];
    // isActive = false (default) — fires automatically on cooldown.
    this._timer = this.cooldown; // start ready
  }

  fire(player, entities, engine) {
    let dx = player.facingX ?? 1;
    let dy = player.facingY ?? 0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
      dx = 1;
      dy = 0;
    } else {
      dx /= dist;
      dy /= dist;
    }

    const speed = this.config.projectileSpeed;
    const count = 1 + (player.projectileCountBonus ?? 0);
    const spread = 0.10;  // tighter spread than magic bolt — more accurate
    const base = Math.atan2(dy, dx);

    for (let i = 0; i < count; i++) {
      const a = base - (spread * (count - 1)) / 2 + spread * i;
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        {
          damage: this.damage,
          radius: this.config.projectileRadius,
          color: this.config.color,
          lifetime: this.config.projectileLifetime,
          piercing: false,
          sourceTags: this.tags,
          sourceTags: this.tags,
        },
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 15, cooldown: 0.80 },
      3: { damage: 22, cooldown: 0.72 },
      4: { damage: 30, cooldown: 0.62 },
      5: { damage: 40, cooldown: 0.55, piercing: true },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage   !== undefined) this.damage   = s.damage;
    if (s.cooldown !== undefined) this.cooldown = s.cooldown;
    if (s.piercing) this.config = { ...this.config, piercing: true };
  }
}

/**
 * MagicBolt — Sage's default auto-fire starter skill.
 *
 * Fires a violet bolt of arcane energy toward the cursor-facing direction.
 * Tags: Spell, Projectile.
 */
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

export class MagicBolt extends Weapon {
  constructor() {
    super(WEAPONS.MAGIC_BOLT);
    this.tags = ['Spell', 'Projectile', 'Thunder'];
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

    const stats = this.computedStats(player);
    const speed = this.config.projectileSpeed;
    const count = 1 + (player.projectileCountBonus ?? 0);
    const spread = 0.14;
    const base = Math.atan2(dy, dx);

    for (let i = 0; i < count; i++) {
      const a = base - (spread * (count - 1)) / 2 + spread * i;
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        {
          damage: stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius: this.config.projectileRadius,
          color: this.config.color,
          lifetime: this.config.projectileLifetime,
          piercing: false,
          sourceTags: this.tags,
        },
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 20, cooldown: 1.05 },
      3: { damage: 28, cooldown: 0.9 },
      4: { damage: 38, cooldown: 0.78 },
      5: { damage: 50, cooldown: 0.65 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage   !== undefined) this.damage   = s.damage;
    if (s.cooldown !== undefined) this.cooldown = s.cooldown;
  }
}

/**
 * SwiftArrow — Rogue's default auto-fire starter skill.
 *
 * Looses a fast arrow toward the cursor-facing direction.
 * Tags: Attack, Projectile, Physical.
 */
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  normalizeDirection,
  scaleProjectileMotion,
} from '../projectileSupport.js';

export class SwiftArrow extends Weapon {
  constructor() {
    super(WEAPONS.SWIFT_ARROW);
    this.tags = ['Attack', 'Projectile', 'Physical'];
    // isActive = false (default) — fires automatically on cooldown.
    this._timer = this.cooldown; // start ready
  }

  fire(player, entities, engine) {
    const stats = this.computedStats(player);
    const direction = normalizeDirection(player.facingX ?? 1, player.facingY ?? 0, 1, 0);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(direction.y, direction.x);

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.10)) {
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        motion.lifetime,
          piercing:        false,
        }, supportState, this.tags),
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

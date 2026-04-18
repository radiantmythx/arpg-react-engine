/**
 * MagicBolt — Sage's default auto-fire starter skill.
 *
 * Fires a violet bolt of arcane energy toward the cursor-facing direction.
 * Tags: Spell, Projectile.
 */
import { Skill } from './Skill.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  normalizeDirection,
  scaleProjectileMotion,
} from '../projectileSupport.js';

export class MagicBolt extends Skill {
  constructor() {
    super(WEAPONS.MAGIC_BOLT);
    this.tags = ['Spell', 'Projectile', 'Thunder'];
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

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.14)) {
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage: stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius: this.config.projectileRadius,
          color: this.config.color,
          lifetime: motion.lifetime,
          piercing: false,
        }, supportState, this.tags),
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 20, castTime: 0.44 },
      3: { damage: 28, castTime: 0.38 },
      4: { damage: 38, castTime: 0.32 },
      5: { damage: 50, castTime: 0.26 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage   !== undefined) this.damage   = s.damage;
    if (s.castTime !== undefined) this.castTime = s.castTime;
  }
}

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  scaleProjectileMotion,
} from '../projectileSupport.js';

export class ArcaneLance extends Weapon {
  constructor() {
    super(WEAPONS.ARCANE_LANCE);
    this.tags = ['Spell', 'Projectile', 'Thunder'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
  }

  fire(player, entities, engine) {
    const target = this._findNearest(player, entities.getHostiles());
    if (!target) return;

    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const stats = this.computedStats(player);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(dy, dx);

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.14)) {
      entities.acquireProjectile(
        player.x, player.y, Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage: stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius: this.config.projectileRadius,
          color: this.config.color,
          lifetime: motion.lifetime,
          piercing: this.config.piercing ?? false,
        }, supportState, this.tags),
      );
    }
    if (engine) engine.onSkillFire();
  }

  _findNearest(player, enemies) {
    let nearest = null;
    let minDistSq = Infinity;
    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = enemy;
      }
    }
    return nearest;
  }

  _applyLevelStats() {
    // Progressive improvements per level
    const table = {
      2: { damage: 30, cooldown: 0.85 },
      3: { damage: 40, cooldown: 0.70 },
      4: { damage: 55, cooldown: 0.60 },
      5: { damage: 70, cooldown: 0.50, piercing: true },
    };
    const stats = table[this.level];
    if (!stats) return;
    if (stats.damage !== undefined) this.damage = stats.damage;
    if (stats.cooldown !== undefined) this.cooldown = stats.cooldown;
    if (stats.piercing) this.config = { ...this.config, piercing: true };
  }
}

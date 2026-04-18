import { Skill } from './Skill.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  scaleProjectileMotion,
} from '../projectileSupport.js';

export class PhantomBlade extends Skill {
  constructor() {
    super(WEAPONS.PHANTOM_BLADE);
    this.tags = ['Attack', 'Projectile', 'Physical'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
  }

  fire(player, entities, engine) {
    const dx = player.facingX;
    const dy = player.facingY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const stats = this.computedStats(player);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(dy / len, dx / len);

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.20)) {
      entities.acquireProjectile(
        player.x, player.y, Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        motion.lifetime,
          piercing:        this.config.piercing ?? false,
        }, supportState, this.tags),
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 22, castTime: 0.47 },
      3: { damage: 30, castTime: 0.40 },
      4: { damage: 38, castTime: 0.33 },
      5: { damage: 50, castTime: 0.27, piercing: true },
    };
    const stats = table[this.level];
    if (!stats) return;
    if (stats.damage   !== undefined) this.damage   = stats.damage;
    if (stats.castTime !== undefined) this.castTime = stats.castTime;
    if (stats.piercing) this.config = { ...this.config, piercing: true };
  }
}

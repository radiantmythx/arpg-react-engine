import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

export class PhantomBlade extends Weapon {
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
    const speed = this.config.projectileSpeed;
    const total = 1 + (player.projectileCountBonus ?? 0);
    const spread = 0.20; // radians between projectiles
    const baseAngle = Math.atan2(dy / len, dx / len);
    const startAngle = baseAngle - spread * (total - 1) / 2;

    for (let i = 0; i < total; i++) {
      const a = startAngle + spread * i;
      entities.acquireProjectile(
        player.x, player.y, Math.cos(a) * speed, Math.sin(a) * speed,
        {
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        this.config.projectileLifetime,
          piercing:        this.config.piercing ?? false,
          sourceTags:      this.tags,
        },
      );
    }
    if (engine) engine.onSkillFire();
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 22, cooldown: 1.2 },
      3: { damage: 30, cooldown: 1.0 },
      4: { damage: 38, cooldown: 0.8 },
      5: { damage: 50, cooldown: 0.7, piercing: true },
    };
    const stats = table[this.level];
    if (!stats) return;
    if (stats.damage !== undefined) this.damage = stats.damage;
    if (stats.cooldown !== undefined) this.cooldown = stats.cooldown;
    if (stats.piercing) this.config = { ...this.config, piercing: true };
  }
}

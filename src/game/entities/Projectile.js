import { Entity } from './Entity.js';

export class Projectile extends Entity {
  /**
   * @param {number} x - world x spawn position
   * @param {number} y - world y spawn position
   * @param {number} vx - x velocity in px/s
   * @param {number} vy - y velocity in px/s
   * @param {{ damage, radius, color, lifetime, piercing? }} config
   */
  constructor(x, y, vx, vy, config) {
    super(x, y);
    this.vx = vx;
    this.vy = vy;
    this.damage = config.damage;
    /** Per-element damage map { Physical: N, Frost: N, ... }. null when untyped. */
    this.damageBreakdown = config.damageBreakdown ?? null;
    this.radius = config.radius;
    this.color = config.color;
    this.lifetime = config.lifetime;
    this.age = 0;
    this.piercing = config.piercing ?? false;
    this.pierceCount = this.piercing === true
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(config.pierceCount) || 0);
    this.gravity = config.gravity ?? 0;
    this.forkCount = Math.max(0, Number(config.forkCount) || 0);
    this.forkSpread = config.forkSpread ?? 0.34;
    this.splitProjectiles = Math.max(2, Number(config.splitProjectiles) || 2);
    this.chainCount = Math.max(0, Number(config.chainCount) || 0);
    this.chainRadius = Math.max(1, Number(config.chainRadius) || 180);
    this.chainDamageMult = config.chainDamageMult ?? 0.75;
    // Set of enemies already hit by this projectile or its chain path.
    this.hitEnemies = (this.pierceCount > 0 || this.forkCount > 0 || this.chainCount > 0) ? new Set() : null;
    // Optional payload fields for specialised weapons.
    this.chainWeapon = config.chainWeapon ?? null;
    this.chainConfig = config.chainConfig ?? null;
    this.onExpire    = config.onExpire    ?? null;
    this.onHit       = config.onHit       ?? null;
    this._spawnX     = config._spawnX     ?? x;
    this._spawnY     = config._spawnY     ?? y;
    this._homing     = config._homing     ?? false;
    /** Source skill/weapon tags — used by CollisionSystem to roll ailments on hit. */
    this.sourceTags  = config.sourceTags  ?? [];
  }

  /**
   * Re-initialise this instance for object-pool recycling.
   * Called by EntityManager.acquireProjectile() instead of constructing a new object.
   */
  reset(x, y, vx, vy, config) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = config.damage;
    this.damageBreakdown = config.damageBreakdown ?? null;
    this.radius = config.radius;
    this.color = config.color;
    this.lifetime = config.lifetime;
    this.age = 0;
    this.active = true;
    this.piercing = config.piercing ?? false;
    this.pierceCount = this.piercing === true
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(config.pierceCount) || 0);
    this.gravity = config.gravity ?? 0;
    this.forkCount = Math.max(0, Number(config.forkCount) || 0);
    this.forkSpread = config.forkSpread ?? 0.34;
    this.splitProjectiles = Math.max(2, Number(config.splitProjectiles) || 2);
    this.chainCount = Math.max(0, Number(config.chainCount) || 0);
    this.chainRadius = Math.max(1, Number(config.chainRadius) || 180);
    this.chainDamageMult = config.chainDamageMult ?? 0.75;
    if (this.pierceCount > 0 || this.forkCount > 0 || this.chainCount > 0) {
      if (this.hitEnemies) this.hitEnemies.clear();
      else this.hitEnemies = new Set();
    } else {
      this.hitEnemies = null;
    }
    // Optional payload fields for specialised weapons.
    this.chainWeapon = config.chainWeapon ?? null;
    this.chainConfig = config.chainConfig ?? null;
    this.onExpire    = config.onExpire    ?? null;
    this.onHit       = config.onHit       ?? null;
    this._spawnX     = config._spawnX     ?? x;
    this._spawnY     = config._spawnY     ?? y;
    this._homing     = config._homing     ?? false;
    this.sourceTags  = config.sourceTags  ?? [];
  }

  update(dt) {
    if (this.gravity) this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    if (this.age >= this.lifetime) {
      if (this.onExpire) this.onExpire(this);
      this.active = false;
    }
  }

  draw(renderer) {
    const alpha = 1 - (this.age / this.lifetime) * 0.4;
    renderer.drawCircle(this.x, this.y, this.radius, this.color, alpha);
  }
}

import { Entity } from './Entity.js';
import { PLAYER } from '../config.js';

export class XPGem extends Entity {
  constructor(x, y, value) {
    super(x, y);
    this.value = value;
    this.radius = value >= 5 ? 7 : 5;
    this.color = value >= 5 ? '#e74c3c' : '#2ecc71';
    this.magnetized = false;
  }

  /**
   * Re-initialise this instance for object-pool recycling.
   * Called by EntityManager.acquireGem() instead of constructing a new object.
   */
  reset(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = value >= 5 ? 7 : 5;
    this.color = value >= 5 ? '#e74c3c' : '#2ecc71';
    this.magnetized = false;
    this.active = true;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq = dx * dx + dy * dy;
    const pickupR  = PLAYER.PICKUP_RADIUS + (player.pickupRadiusBonus ?? 0);
    const pickupSq = pickupR * pickupR;

    if (distSq <= pickupSq) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const dist = Math.sqrt(distSq);
      if (dist > 1) {
        const pullSpeed = 300; // px/s
        this.x += (dx / dist) * pullSpeed * dt;
        this.y += (dy / dist) * pullSpeed * dt;
      }
    }
  }

  draw(renderer) {
    renderer.drawCircle(this.x, this.y, this.radius, this.color, 0.9);
  }
}

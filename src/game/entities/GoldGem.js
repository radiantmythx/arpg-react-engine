import { Entity } from './Entity.js';
import { PLAYER } from '../config.js';

/**
 * GoldGem — common currency pickup used for vendor economy.
 * Magnetises toward the player like XP gems and is collected on overlap.
 */
export class GoldGem extends Entity {
  constructor(x, y, value = 1) {
    super(x, y);
    this.value = value;
    this.radius = Math.min(7, 4 + value * 0.5);
    this._magnetized = false;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq = dx * dx + dy * dy;
    const pickupR = PLAYER.PICKUP_RADIUS + (player.pickupRadiusBonus ?? 0);

    if (distSq <= pickupR * pickupR) this._magnetized = true;

    if (this._magnetized) {
      const dist = Math.sqrt(distSq);
      if (dist > 1) {
        const pullSpeed = 310;
        this.x += (dx / dist) * pullSpeed * dt;
        this.y += (dy / dist) * pullSpeed * dt;
      }
    }
  }

  draw(renderer) {
    renderer.drawStrokeCircle(this.x, this.y, this.radius + 2, '#f6d365', 1.5, 0.35);
    renderer.drawCircle(this.x, this.y, this.radius, '#ffd166', 0.95);
    renderer.drawCircle(this.x, this.y, 1.6, '#fff7d6', 0.75);
  }
}

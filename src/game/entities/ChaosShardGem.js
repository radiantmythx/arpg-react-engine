import { Entity } from './Entity.js';
import { PLAYER } from '../config.js';

/**
 * ChaosShardGem — a glittering gold collectible that persists between runs.
 *
 * Behaves like an XPGem (magnetises to player when within pickup radius,
 * then moves toward them) but is collected by CollisionSystem.checkPlayerVsShardGems
 * and credited to engine.shardsThisRun rather than the XP counter.
 */
export class ChaosShardGem extends Entity {
  constructor(x, y, value = 1) {
    super(x, y);
    this.value      = value;
    this.radius     = 6;
    this.color      = '#f0c040';
    this._magnetized = false;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq  = dx * dx + dy * dy;
    const pickupR = PLAYER.PICKUP_RADIUS + (player.pickupRadiusBonus ?? 0);

    if (distSq <= pickupR * pickupR) this._magnetized = true;

    if (this._magnetized) {
      const dist = Math.sqrt(distSq);
      if (dist > 1) {
        this.x += (dx / dist) * 280 * dt;
        this.y += (dy / dist) * 280 * dt;
      }
    }
  }

  draw(renderer) {
    // Outer glow ring
    renderer.drawStrokeCircle(this.x, this.y, this.radius + 3, '#f0c040', 1.5, 0.35);
    // Inner gem — a small bright gold circle
    renderer.drawCircle(this.x, this.y, this.radius, '#f8e060', 0.95);
    // Tiny white sparkle at centre
    renderer.drawCircle(this.x, this.y, 2, '#ffffff', 0.65);
  }
}

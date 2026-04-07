/**
 * ItemDrop — a world-space glowing pickup spawned when an enemy dies.
 *
 * Unlike XP gems, item drops:
 *   - Do NOT magnetize toward the player
 *   - Pulse with the item's color to draw attention
 *   - Trigger a pickup popup (handled by GameEngine) on overlap
 */
import { Entity } from './Entity.js';

const PULSE_SPEED = 2.4; // radians per second

export class ItemDrop extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {object} itemDef — plain config object from items.js (not PassiveItem instance)
   */
  constructor(x, y, itemDef) {
    super(x, y);
    this.itemDef = itemDef;
    this.radius  = 10;
    this.color   = itemDef.color;
    this._pulse  = Math.random() * Math.PI * 2; // randomize phase so multiple drops don't sync
  }

  update(dt) {
    this._pulse += PULSE_SPEED * dt;
  }

  draw(renderer) {
    // Pulsing outer glow ring
    const glowAlpha = 0.25 + 0.2 * Math.sin(this._pulse);
    renderer.drawStrokeCircle(this.x, this.y, this.radius + 6, this.color, 2.5, glowAlpha);

    // Inner solid gem body
    renderer.drawCircle(this.x, this.y, this.radius, this.color, 0.95);

    // Bright highlight at top-left
    renderer.drawCircle(this.x - 3, this.y - 3, 3, '#ffffff', 0.55);
  }
}

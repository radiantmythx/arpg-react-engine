import { Entity } from './Entity.js';

/**
 * AoEZone — a timed damage area placed by a boss attack.
 *
 * Phases:
 *   warning (warningDuration s): pulsing orange outline — telegraphs the hit, no damage yet
 *   active  (activeDuration s):  solid fill; deals damage to the player via CollisionSystem
 *
 * The CollisionSystem calls player.takeDamage(zone.damage) once per 0.5 s naturally
 * because Player.takeDamage respects its own invulnerability timer.
 */
export class AoEZone extends Entity {
  /**
   * @param {number} x - world X
   * @param {number} y - world Y
   * @param {object} config
   * @param {number} config.radius
   * @param {number} config.damage
   * @param {string} [config.color]
   * @param {number} [config.activeDuration]
   * @param {number} [config.warningDuration]
   */
  constructor(x, y, config) {
    super(x, y);
    this.radius          = config.radius;
    this.damage          = config.damage;
    this.color           = config.color ?? '#e74c3c';
    this.activeDuration  = config.activeDuration  ?? 3.0;
    this._warningDuration = config.warningDuration ?? 1.2;
    this._age            = 0;
    this.isWarning       = true;
  }

  update(dt) {
    this._age += dt;
    if (this.isWarning) {
      if (this._age >= this._warningDuration) {
        this.isWarning = false;
        this._age = 0; // reset timer for the active phase
      }
      return;
    }
    if (this._age >= this.activeDuration) {
      this.active = false;
    }
  }

  draw(renderer) {
    if (this.isWarning) {
      const pulse = (Math.sin(this._age * Math.PI * 5) + 1) * 0.5;
      renderer.drawCircle(this.x, this.y, this.radius, '#f39c12', 0.06 + pulse * 0.07);
      renderer.drawStrokeCircle(this.x, this.y, this.radius, '#f39c12', 2, 0.28 + pulse * 0.48);
    } else {
      const lifeRatio = 1 - this._age / this.activeDuration;
      renderer.drawCircle(this.x, this.y, this.radius, this.color, 0.15 * lifeRatio);
      renderer.drawStrokeCircle(this.x, this.y, this.radius, this.color, 2, 0.55 * lifeRatio);
    }
  }
}

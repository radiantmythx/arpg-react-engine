import { Entity } from './Entity.js';

/**
 * PortalEntity (C6)
 * Purely visual portal marker used to communicate remaining map portals.
 */
export class PortalEntity extends Entity {
  constructor(x, y, type = 'entry') {
    super(x, y);
    this.radius = 18;
    this.type = type; // 'entry' | 'used'
    this._t = Math.random() * Math.PI * 2;
  }

  setType(type) {
    this.type = type;
  }

  update(dt) {
    this._t += dt;
  }

  draw(renderer) {
    const active = this.type === 'entry';
    const base = active ? '#4d8bff' : '#5f6672';
    const ring = active ? '#9fc2ff' : '#7d8593';
    const pulse = active ? 0.8 + Math.sin(this._t * 3.0) * 0.2 : 0.45;

    renderer.drawCircle(this.x, this.y, this.radius + 10, base, 0.16 * pulse);
    renderer.drawStrokeCircle(this.x, this.y, this.radius + 3, ring, 2, 0.75 * pulse);
    renderer.drawStrokeCircle(this.x, this.y, this.radius - 3, ring, 1.5, 0.55 * pulse);
    renderer.drawCircle(this.x, this.y, 4, ring, 0.85);
  }
}

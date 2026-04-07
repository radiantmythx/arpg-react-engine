/**
 * Particle — a lightweight, poolable visual-only entity.
 *
 * Particles are owned by ParticleSystem, not EntityManager, and are never
 * involved in collision or gameplay logic.  They can be recycled via reset().
 */
export class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 3;
    this.color = '#ffffff';
    this.alpha = 1;
    this.lifetime = 0.5;
    this.age = 0;
    this.drag = 0; // velocity multiplier per second (0 = no drag, 0.9 = high drag)
  }

  /**
   * Initialise (or re-initialise from pool) this particle.
   * @param {number} x
   * @param {number} y
   * @param {number} vx
   * @param {number} vy
   * @param {number} radius
   * @param {string} color
   * @param {number} lifetime  seconds
   * @param {number} [drag=0]  velocity decay rate in (0‥1) expressed as fraction lost per second
   */
  reset(x, y, vx, vy, radius, color, lifetime, drag = 0) {
    this.active   = true;
    this.x        = x;
    this.y        = y;
    this.vx       = vx;
    this.vy       = vy;
    this.radius   = radius;
    this.color    = color;
    this.lifetime = lifetime;
    this.age      = 0;
    this.alpha    = 1;
    this.drag     = drag;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.active = false;
      return;
    }
    const t = this.age / this.lifetime;
    this.alpha = 1 - t;

    if (this.drag) {
      const decay = Math.pow(1 - this.drag, dt);
      this.vx *= decay;
      this.vy *= decay;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(renderer) {
    if (this.alpha <= 0) return;
    renderer.drawCircle(this.x, this.y, this.radius, this.color, this.alpha);
  }
}

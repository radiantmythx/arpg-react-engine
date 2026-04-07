/**
 * ParticleSystem
 * Manages a flat pool of Particle instances.  Use emit() to trigger effects;
 * the system recycles inactive slots before allocating new ones.
 *
 * Effect types:
 *   'hit'      — 4–6 small sparks radiating from the impact point
 *   'tuning_pop' — larger impact burst used for chunky feedback moments
 *   'damage_number' — floating combat text value at impact point
 *   'death'    — 10–14 medium particles burst from an enemy's last position
 *   'xp'       — 5–8 tiny golden motes rising from a collected gem
 *   'level_up' — 24 large coloured particles radiating from the player
 */
import { Particle } from '../entities/Particle.js';

const TAU = Math.PI * 2;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  constructor() {
    /** @type {Particle[]} */
    this._pool = [];
    /** @type {Array<{x:number,y:number,vx:number,vy:number,age:number,lifetime:number,text:string,color:string,size:number,alpha:number}>} */
    this._floatTexts = [];
  }

  /** Retrieve an inactive Particle from the pool, or allocate a new one. */
  _acquire() {
    for (const p of this._pool) {
      if (!p.active) return p;
    }
    const p = new Particle();
    this._pool.push(p);
    return p;
  }

  /**
   * Emit a named effect at world position (x, y).
   * @param {'hit'|'tuning_pop'|'damage_number'|'death'|'xp'|'level_up'} type
   * @param {number} x
   * @param {number} y
   * @param {{ color?: string, count?: number, value?: number|string, size?: number, lifetime?: number }} [options]
   */
  emit(type, x, y, options = {}) {
    switch (type) {
      case 'hit':
        this._emitHit(x, y, options.color ?? '#ffe066');
        break;
      case 'tuning_pop':
        this._emitTuningPop(x, y, options.color ?? '#ffd166', options.count ?? 12);
        break;
      case 'damage_number':
        this._emitDamageNumber(x, y, options.value ?? 0, {
          color: options.color ?? '#f7f2d7',
          size: options.size ?? 15,
          lifetime: options.lifetime ?? 0.65,
        });
        break;
      case 'death':
        this._emitDeath(x, y, options.color ?? '#e74c3c');
        break;
      case 'xp':
        this._emitXp(x, y);
        break;
      case 'level_up':
        this._emitLevelUp(x, y);
        break;
    }
  }

  _emitHit(x, y, color) {
    const count = 4 + Math.floor(Math.random() * 3); // 4–6
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const speed = rand(60, 140);
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(1.5, 3),
        color,
        rand(0.2, 0.4),
        0.6,
      );
    }
  }

  _emitTuningPop(x, y, color, count = 12) {
    const sparks = Math.max(8, count);
    for (let i = 0; i < sparks; i++) {
      const angle = rand(0, TAU);
      const speed = rand(120, 320);
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(2.2, 4.8),
        color,
        rand(0.18, 0.34),
        0.7,
      );
    }
    for (let i = 0; i < 4; i++) {
      const angle = rand(0, TAU);
      const speed = rand(40, 120);
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(3.8, 7.2),
        '#ffffff',
        rand(0.12, 0.22),
        0.8,
      );
    }
  }

  _emitDamageNumber(x, y, value, options) {
    const n = typeof value === 'number' ? Math.max(0, Math.round(value)) : value;
    this._floatTexts.push({
      x,
      y,
      vx: rand(-16, 16),
      vy: rand(-86, -58),
      age: 0,
      lifetime: options.lifetime,
      text: `${n}`,
      color: options.color,
      size: options.size,
      alpha: 1,
    });
  }

  _emitDeath(x, y, color) {
    const count = 10 + Math.floor(Math.random() * 5); // 10–14
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const speed = rand(80, 220);
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(2.5, 5.5),
        color,
        rand(0.35, 0.65),
        0.5,
      );
    }
    // White flash burst — a few bright centred particles.
    for (let i = 0; i < 4; i++) {
      const angle = rand(0, TAU);
      const speed = rand(20, 60);
      const p     = this._acquire();
      p.reset(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, rand(3, 6), '#ffffff', 0.25, 0.8);
    }
  }

  _emitXp(x, y) {
    const count = 5 + Math.floor(Math.random() * 4); // 5–8
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + rand(-0.8, 0.8); // mostly upward
      const speed = rand(30, 90);
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(1.5, 3),
        '#f1c40f',
        rand(0.4, 0.7),
        0.4,
      );
    }
  }

  _emitLevelUp(x, y) {
    const count = 24;
    const colors = ['#3498db', '#9b59b6', '#2ecc71', '#f1c40f', '#e74c3c', '#00bcd4'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU;
      const speed = rand(120, 280);
      const color = colors[i % colors.length];
      const p     = this._acquire();
      p.reset(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(3.5, 7),
        color,
        rand(0.6, 0.9),
        0.55,
      );
    }
  }

  update(dt) {
    for (const p of this._pool) {
      if (p.active) p.update(dt);
    }

    for (const t of this._floatTexts) {
      t.age += dt;
      const q = t.age / t.lifetime;
      t.alpha = Math.max(0, 1 - q);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vx *= Math.pow(0.3, dt);
      t.vy *= Math.pow(0.45, dt);
    }
    this._floatTexts = this._floatTexts.filter((t) => t.age < t.lifetime);
  }

  draw(renderer) {
    for (const p of this._pool) {
      if (p.active) p.draw(renderer);
    }

    const { ctx } = renderer;
    for (const t of this._floatTexts) {
      if (t.alpha <= 0) continue;
      const s = renderer.toScreen(t.x, t.y);
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.fillStyle = t.color;
      ctx.font = `700 ${t.size}px 'Trebuchet MS', Verdana, sans-serif`;
      ctx.strokeText(t.text, s.x, s.y);
      ctx.fillText(t.text, s.x, s.y);
      ctx.restore();
    }
  }

  /** How many active particles are currently alive (for debug overlay). */
  get count() {
    let n = 0;
    for (const p of this._pool) if (p.active) n++;
    return n;
  }
}

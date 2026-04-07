/**
 * WraithfireBomb — lobbed explosive that leaves a lingering fire zone.
 *
 * A bomb arcs toward the nearest enemy.  When it lands (lifetime expires)
 * it explodes into a fire zone that pulses damage for several seconds.
 * Visually: the bomb is a dark-green circle that pulses; the zone is a
 * translucent green ring that fades over time.
 *
 * Implementation mirrors SacredRite's flask / zone pattern.
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';

export class WraithfireBomb extends Weapon {
  constructor() {
    super(WEAPONS.WRAITHFIRE_BOMB);
    this.tags = ['Spell', 'AoE', 'Fire', 'Duration'];
    /** @type {{ x, y, vx, vy, age } | null} */
    this._bomb = null;
    /** @type {Array<{ x, y, age, damageTimer }>} active fire zones */
    this._zones = [];
  }

  fire(player, entities) {
    let nearest = null;
    let nearestDSq = Infinity;
    for (const e of entities.getHostiles()) {
      if (!e.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < nearestDSq) { nearestDSq = d; nearest = e; }
    }
    const tx = nearest ? nearest.x : player.x + (player.facingX ?? 0) * 280;
    const ty = nearest ? nearest.y : player.y + (player.facingY ?? 1) * 280;

    const dx = tx - player.x;
    const dy = ty - player.y;
    const lifetime = this.config.bombLifetime;
    const speed    = Math.sqrt(dx * dx + dy * dy) / lifetime;
    const dist     = Math.sqrt(dx * dx + dy * dy) || 1;

    this._bomb = {
      x: player.x,
      y: player.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      age: 0,
    };
  }

  update(dt, player, entities, engine) {
    // -- Advance bomb --
    if (this._bomb) {
      const b = this._bomb;
      b.x   += b.vx * dt;
      b.y   += b.vy * dt;
      b.age += dt;
      if (b.age >= this.config.bombLifetime) {
        // Explode — spawn a fire zone
        this._zones.push({ x: b.x, y: b.y, age: 0, damageTimer: 0 });
        this._bomb = null;
      }
    }

    // -- Tick zones --
    for (const zone of this._zones) {
      zone.age        += dt;
      zone.damageTimer += dt;
      if (zone.damageTimer >= this.config.zonePulseRate) {
        zone.damageTimer -= this.config.zonePulseRate;
        const rSq = this.config.zoneRadius * this.config.zoneRadius;
        for (const e of entities.getHostiles()) {
          if (!e.active) continue;
          const ex = e.x - zone.x;
          const ey = e.y - zone.y;
          if (ex * ex + ey * ey <= rSq) {
            if (engine) engine.onEnemyHit(e, this.damage);
            e.takeDamage(this.damage);
            if (!e.active && engine) engine.onEnemyKilled(e);
          }
        }
      }
    }
    this._zones = this._zones.filter((z) => z.age < this.config.zoneDuration);

    // -- Cooldown (don't fire a new bomb while one is in flight) --
    this._timer += dt;
    if (this._timer >= this.cooldown && !this._bomb) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  draw(renderer) {
    // Draw in-flight bomb
    if (this._bomb) {
      const b = this._bomb;
      // Pulsing glow
      const pulse = 0.7 + 0.3 * Math.sin(b.age * 12);
      renderer.drawCircle(b.x, b.y, 9 * pulse, this.config.color);
      renderer.drawStrokeCircle(b.x, b.y, 12 * pulse, '#a8ff00', 2, 0.8);
    }
    // Draw fire zones
    for (const zone of this._zones) {
      const alpha = Math.max(0, 0.45 * (1 - zone.age / this.config.zoneDuration));
      renderer.drawCircle(zone.x, zone.y, this.config.zoneRadius, this.config.color, alpha);
      renderer.drawStrokeCircle(zone.x, zone.y, this.config.zoneRadius, '#a8ff00', 2, alpha + 0.1);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 20, zoneRadius: 80, zoneDuration: 3.5 },
      3: { damage: 28, zoneRadius: 90, zonePulseRate: 0.45 },
      4: { damage: 38, zoneRadius: 100, zoneDuration: 4.5 },
      5: { damage: 50, zoneRadius: 110, cooldown: 3.0, zonePulseRate: 0.35 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage        !== undefined) this.damage = s.damage;
    if (s.zoneRadius    !== undefined) this.config = { ...this.config, zoneRadius: s.zoneRadius };
    if (s.zoneDuration  !== undefined) this.config = { ...this.config, zoneDuration: s.zoneDuration };
    if (s.zonePulseRate !== undefined) this.config = { ...this.config, zonePulseRate: s.zonePulseRate };
    if (s.cooldown      !== undefined) this.cooldown = s.cooldown;
  }
}

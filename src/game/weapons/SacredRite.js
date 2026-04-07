/**
 * SacredRite — consecrated flask that creates a lingering damage zone.
 *
 * On fire, hurls a flask toward the nearest enemy. When the flask lands
 * (its lifetime expires) it becomes a circular damage zone that pulses
 * every `zonePulseRate` seconds for `zoneDuration` seconds total.
 *
 * The weapon manages its own flask state and zone pool internally,
 * bypassing the EntityManager — no extra entity types needed.
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import { resolvePenetrationMap } from '../data/skillTags.js';

export class SacredRite extends Weapon {
  constructor() {
    super(WEAPONS.SACRED_RITE);
    this.tags = ['Spell', 'AoE', 'Blaze', 'Duration'];
    /** @type {{ x, y, vx, vy, age } | null} */
    this._flask = null;
    /** @type {Array<{ x, y, age, damageTimer }>} */
    this._zones = [];
  }

  /**
   * Fully overrides base update — manages flask flight, zone ticking, and cooldown.
   */
  update(dt, player, entities, engine) {
    const stats = this.computedStats(player);
    const hitDamage = stats.damage;
    const hitBreakdown = stats.damageBreakdown;
    const penMap = resolvePenetrationMap(this.tags, player);

    // --- Advance flask ---
    if (this._flask) {
      const f = this._flask;
      f.x   += f.vx * dt;
      f.y   += f.vy * dt;
      f.age += dt;
      if (f.age >= this.config.flaskLifetime) {
        // Flask lands: create a damage zone at landing position.
        this._zones.push({ x: f.x, y: f.y, age: 0, damageTimer: 0 });
        this._flask = null;
      }
    }

    // --- Advance zones ---
    for (const zone of this._zones) {
      zone.age        += dt;
      zone.damageTimer += dt;
      if (zone.damageTimer >= this.config.zonePulseRate) {
        zone.damageTimer -= this.config.zonePulseRate;
        const rSq = this.config.zoneRadius * this.config.zoneRadius;
        for (const enemy of entities.getHostiles()) {
          if (!enemy.active) continue;
          const dx = enemy.x - zone.x;
          const dy = enemy.y - zone.y;
          if (dx * dx + dy * dy <= rSq) {
            if (engine) engine.onEnemyHit(enemy, hitDamage);
            enemy.takeDamage(hitBreakdown ?? hitDamage, this.tags, penMap);
            if (!enemy.active) engine.onEnemyKilled(enemy);
          }
        }
      }
    }
    // Expire zones that have lasted their duration.
    this._zones = this._zones.filter((z) => z.age < this.config.zoneDuration);

    // --- Weapon cooldown (only fires when no flask is in flight) ---
    this._timer += dt;
    if (this._timer >= this.cooldown && !this._flask) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  fire(player, entities) {
    // Aim at nearest enemy, or straight ahead if none present.
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const enemy of entities.getHostiles()) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < nearestDistSq) {
        nearestDistSq = d;
        nearest = enemy;
      }
    }

    let dx, dy;
    if (nearest) {
      dx = nearest.x - player.x;
      dy = nearest.y - player.y;
    } else {
      dx = player.facingX ?? 0;
      dy = player.facingY ?? 1;
    }

    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = this.config.flaskSpeed;

    this._flask = {
      x: player.x, y: player.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      age: 0,
    };
  }

  draw(renderer, _player) {
    // Draw in-flight flask.
    if (this._flask) {
      renderer.drawCircle(
        this._flask.x, this._flask.y,
        this.config.flaskRadius,
        this.config.color,
        0.9,
      );
    }

    // Draw damage zones: filled translucent pool + fading ring on each pulse.
    for (const zone of this._zones) {
      const lifeAlpha = 0.35 * (1 - zone.age / this.config.zoneDuration);
      renderer.drawCircle(zone.x, zone.y, this.config.zoneRadius, this.config.color, lifeAlpha);

      // A bright ring flashes immediately after damage, then fades before next tick.
      const pulseT     = zone.damageTimer / this.config.zonePulseRate; // 0→1
      const ringAlpha  = 0.65 * (1 - pulseT);
      renderer.drawStrokeCircle(zone.x, zone.y, this.config.zoneRadius, this.config.color, 2, ringAlpha);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 20, zoneRadius: 80  },
      3: { damage: 28, zoneRadius: 95,  zoneDuration: 4.0 },
      4: { damage: 38, zoneRadius: 110, zoneDuration: 4.5 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage      !== undefined) this.damage = s.damage;
    if (s.zoneRadius  !== undefined) this.config = { ...this.config, zoneRadius:  s.zoneRadius  };
    if (s.zoneDuration !== undefined) this.config = { ...this.config, zoneDuration: s.zoneDuration };
  }
}

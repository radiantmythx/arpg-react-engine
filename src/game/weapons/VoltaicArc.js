/**
 * VoltaicArc — discharging ring of electricity.
 *
 * On fire, spawns an expanding ring centred on the player. The ring expands
 * outward at `expandSpeed` px/s and zaps every enemy whose centre falls
 * inside the ring's collision band (once per enemy per ring). Multi-charges
 * can be active simultaneously if the cooldown elapses before previous
 * rings expire.
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import { resolvePenetrationMap } from '../data/skillTags.js';

/** Half-width of the collision band that surrounds the ring's leading edge. */
const RING_TOLERANCE = 10;

export class VoltaicArc extends Weapon {
  constructor() {
    super(WEAPONS.VOLTAIC_ARC);
    this.tags = ['Spell', 'AoE', 'Thunder'];
    /** @type {Array<{ x, y, radius, hitEnemies: Set }>} */
    this._arcs = [];
  }

  /**
   * Fully overrides base update — manages arc expansion, collision, and cooldown.
   */
  update(dt, player, entities, engine) {
    const stats = this.computedStats(player);
    const hitDamage = stats.damage;
    const hitBreakdown = stats.damageBreakdown;
    const penMap = resolvePenetrationMap(this.tags, player);

    // --- Expand arcs and zap enemies ---
    for (const arc of this._arcs) {
      arc.radius += this.config.expandSpeed * dt;

      const rimInner = arc.radius - RING_TOLERANCE;
      const rimOuter = arc.radius + RING_TOLERANCE;

      for (const enemy of entities.getHostiles()) {
        if (!enemy.active || arc.hitEnemies.has(enemy)) continue;
        const dx   = enemy.x - arc.x;
        const dy   = enemy.y - arc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Hit if any part of the enemy circle intersects the ring band.
        if (dist + enemy.radius >= rimInner && dist - enemy.radius <= rimOuter) {
          engine.onEnemyHit(enemy, hitDamage);
          enemy.takeDamage(hitBreakdown ?? hitDamage, this.tags, penMap);
          arc.hitEnemies.add(enemy);
          if (!enemy.active) engine.onEnemyKilled(enemy);
        }
      }
    }
    // Remove arcs that have expanded beyond their max radius.
    this._arcs = this._arcs.filter((a) => a.radius < this.config.maxRadius);

    // --- Weapon cooldown ---
    this._timer += dt;
    if (this._timer >= this.cooldown) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  fire(player) {
    this._arcs.push({
      x:          player.x,
      y:          player.y,
      radius:     player.radius + 2,
      hitEnemies: new Set(),
    });
  }

  draw(renderer, _player) {
    for (const arc of this._arcs) {
      // Arc fades from fully opaque at birth to transparent at max radius.
      const alpha = Math.max(0, 1 - arc.radius / this.config.maxRadius);
      renderer.drawStrokeCircle(arc.x, arc.y, arc.radius, this.config.color, 2.5, alpha);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 38, maxRadius: 240, expandSpeed: 360 },
      3: { damage: 52, maxRadius: 280, expandSpeed: 400 },
      4: { damage: 70, maxRadius: 320, expandSpeed: 440 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage !== undefined) this.damage = s.damage;
    this.config = { ...this.config, maxRadius: s.maxRadius, expandSpeed: s.expandSpeed };
  }
}

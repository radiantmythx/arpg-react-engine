/**
 * RighteousPyre — pulsing holy aura.
 *
 * Every `cooldown` seconds it burns all enemies within `auraRadius` for `damage`.
 * On each pulse a visible expanding ring radiates outward from the player and fades.
 */

import { Skill } from './Skill.js';
import { WEAPONS } from '../config.js';
import { resolvePenetrationMap } from '../data/skillTags.js';

const PULSE_DURATION = 0.45; // seconds for the ring to fully expand and fade

export class RighteousPyre extends Skill {
  constructor() {
    super(WEAPONS.RIGHTEOUS_PYRE);
    this.tags = ['Spell', 'AoE', 'Blaze', 'Duration'];
    /** null when no pulse is showing; seconds elapsed since last fire otherwise. */
    this._pulseAge = null;
    this._pulseX = 0;
    this._pulseY = 0;
  }

  update(dt, player, entities, engine) {
    // Advance the pulse ring decay independently of the cooldown timer.
    if (this._pulseAge !== null) {
      this._pulseAge += dt;
      if (this._pulseAge >= PULSE_DURATION) this._pulseAge = null;
    }
    super.update(dt, player, entities, engine);
  }

  fire(player, entities, engine) {
    const stats = this.computedStats(player);
    const hitDamage = stats.damage;
    const hitBreakdown = stats.damageBreakdown;
    const penMap = resolvePenetrationMap(this.tags, player);
    const radiusSq = this.config.auraRadius * this.config.auraRadius;
    for (const enemy of entities.getHostiles()) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy <= radiusSq) {
        engine.onEnemyHit(enemy, hitDamage);
        enemy.takeDamage(hitBreakdown ?? hitDamage, this.tags, penMap);
        if (!enemy.active) engine.onEnemyKilled(enemy);
      }
    }
    // Kick off the visual pulse ring at the player's current position.
    this._pulseX = player.x;
    this._pulseY = player.y;
    this._pulseAge = 0;
  }

  draw(renderer, _player) {
    if (this._pulseAge === null) return;
    const t = this._pulseAge / PULSE_DURATION;             // 0 → 1
    const radius = this.config.auraRadius * (0.4 + t * 0.75); // expands from 40% to 115%
    const alpha  = 0.7 * (1 - t);                          // fades from 0.7 → 0
    renderer.drawStrokeCircle(this._pulseX, this._pulseY, radius, this.config.color, 2.5, alpha);
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 8,  auraRadius: 100 },
      3: { damage: 12, auraRadius: 115 },
      4: { damage: 16, auraRadius: 130 },
      5: { damage: 22, auraRadius: 150 },
    };
    const stats = table[this.level];
    if (!stats) return;
    if (stats.damage     !== undefined) this.damage = stats.damage;
    if (stats.auraRadius !== undefined) this.config = { ...this.config, auraRadius: stats.auraRadius };
  }
}


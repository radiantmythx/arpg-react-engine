/**
 * ChainLightning — fires a bolt that arcs to nearby enemies on each hit.
 *
 * On fire, a primary projectile launches toward the nearest enemy.
 * When it hits an enemy, it "chains" to up to `maxChains` additional
 * nearby enemies within `chainRadius` px, with damage reduced by
 * `chainDecay` per hop.  Chaining is handled in GameEngine.onEnemyKilled
 * via this weapon's `processChain()` method instead of in CollisionSystem
 * so we can read the chain parameters cleanly.
 *
 * For simplicity the base projectile is a standard pooled projectile; the
 * chain hops are dealt as instant damage (no extra projectile entities) and
 * drawn as ephemeral line flashes stored in this._flashes[].
 */

import { Weapon } from './Weapon.js';
import { WEAPONS } from '../config.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  scaleProjectileMotion,
} from '../projectileSupport.js';

/** How long each chain flash line is visible (seconds). */
const FLASH_LIFETIME = 0.12;

export class ChainLightning extends Weapon {
  constructor() {
    super(WEAPONS.CHAIN_LIGHTNING);
    this.tags = ['Spell', 'Projectile', 'Thunder'];
    this.isActive = true;  // hotbar skill — fires only on key press
    this._timer = this.cooldown; // start ready
    /** @type {Array<{x1,y1,x2,y2,age}>} ephemeral arc visuals */
    this._flashes = [];
  }

  fire(player, entities, engine) {
    // Aim at the nearest active enemy.
    let nearest = null;
    let nearestDSq = Infinity;
    for (const e of entities.getHostiles()) {
      if (!e.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = dx * dx + dy * dy;
      if (d < nearestDSq) { nearestDSq = d; nearest = e; }
    }

    const tx = nearest ? nearest.x : player.x + (player.facingX ?? 0) * 200;
    const ty = nearest ? nearest.y : player.y + (player.facingY ?? 1) * 200;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stats = this.computedStats(player);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(dy / dist, dx / dist);
    const chainConfig = {
      ...this.config,
      maxChains: (this.config.maxChains ?? 0) + (supportState.chainCount ?? 0),
    };

    for (const angle of buildSpreadAngles(baseAngle, supportState.totalProjectiles, 0.14)) {
      entities.acquireProjectile(
        player.x, player.y,
        Math.cos(angle) * motion.speed, Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage:          stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius:          this.config.projectileRadius,
          color:           this.config.color,
          lifetime:        motion.lifetime,
          piercing:        false,
          chainWeapon:     this,
          chainConfig,
          chainCount:      0,
        }, supportState, this.tags, { chainCount: 0 }),
      );
    }
    if (engine) engine.onSkillFire();
  }

  /**
   * Called by GameEngine.onEnemyKilled when a projectile with chainWeapon===this
   * scores a kill.  Deals chain damage to nearby enemies and records flash visuals.
   * @param {Enemy} sourceEnemy  — the enemy that was just killed / hit
  * @param {object[]} allEnemies — hostiles array (enemies + active bosses)
   * @param {number} hopDamage   — damage for this hop (caller reduces per hop)
   * @param {number} hopsLeft    — remaining arc hops
   * @param {Set}    alreadyHit  — enemies already struck this chain
   */
  processChain(sourceEnemy, allEnemies, hopDamage, hopsLeft, alreadyHit, chainConfig = this.config) {
    if (hopsLeft <= 0 || hopDamage < 1) return;

    const chainR = chainConfig.chainRadius ?? this.config.chainRadius;
    const chainRSq = chainR * chainR;
    const decay = chainConfig.chainDecay ?? this.config.chainDecay;

    // Find all unvisited enemies within chainRadius.
    const candidates = [];
    for (const e of allEnemies) {
      if (!e.active || alreadyHit.has(e)) continue;
      const dx = e.x - sourceEnemy.x;
      const dy = e.y - sourceEnemy.y;
      if (dx * dx + dy * dy <= chainRSq) candidates.push(e);
    }

    // Sort closest first; take up to maxChains.
    candidates.sort((a, b) => {
      const da = (a.x - sourceEnemy.x) ** 2 + (a.y - sourceEnemy.y) ** 2;
      const db = (b.x - sourceEnemy.x) ** 2 + (b.y - sourceEnemy.y) ** 2;
      return da - db;
    });

    const targets = candidates.slice(0, chainConfig.maxChains ?? this.config.maxChains);
    for (const target of targets) {
      alreadyHit.add(target);
      this._flashes.push({ x1: sourceEnemy.x, y1: sourceEnemy.y, x2: target.x, y2: target.y, age: 0 });
      target.takeDamage(Math.round(hopDamage), this.tags);
      // Recurse (chain continues from this target with reduced damage).
      this.processChain(target, allEnemies, Math.round(hopDamage * (1 - decay)), hopsLeft - 1, alreadyHit);
    }
  }

  update(dt, player, entities, engine) {
    // Tick flash lifetimes.
    for (const f of this._flashes) f.age += dt;
    this._flashes = this._flashes.filter((f) => f.age < FLASH_LIFETIME);

    // Standard cooldown — only auto-fires when NOT an active skill.
    this._timer += dt;
    if (!this.isActive && this._timer >= this.cooldown) {
      this._timer -= this.cooldown;
      this.fire(player, entities, engine);
    }
  }

  draw(renderer) {
    for (const f of this._flashes) {
      const alpha = Math.max(0, 1 - f.age / FLASH_LIFETIME);
      renderer.drawLine(f.x1, f.y1, f.x2, f.y2, this.config.color, 2, alpha);
    }
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 30, maxChains: 4 },
      3: { damage: 42, maxChains: 5, chainRadius: 180 },
      4: { damage: 58, maxChains: 6, chainDecay: 0.15 },
      5: { damage: 75, maxChains: 6, chainRadius: 220, cooldown: 1.4 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage     !== undefined) this.damage              = s.damage;
    if (s.maxChains  !== undefined) this.config              = { ...this.config, maxChains: s.maxChains };
    if (s.chainRadius !== undefined) this.config             = { ...this.config, chainRadius: s.chainRadius };
    if (s.chainDecay  !== undefined) this.config             = { ...this.config, chainDecay: s.chainDecay };
    if (s.cooldown    !== undefined) this.cooldown           = s.cooldown;
  }
}

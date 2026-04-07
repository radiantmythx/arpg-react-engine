import { Enemy } from './Enemy.js';
import { AoEZone } from './AoEZone.js';

/**
 * BossEnemy — a powerful enemy that spawns on a fixed schedule.
 * Extends Enemy for movement + health; overrides update() to add an
 * attack phase and a 2.5-second telegraphed warning entrance.
 *
 * Bosses live in EntityManager.bosses[] (not .enemies[]), so they are
 * updated via a separate loop in GameEngine, which passes `engine` as the
 * third argument so boss attacks can add AoEZones to the entity pool.
 *
 * Three attack patterns:
 *   ring    — 8 AoE zones in a ring around the boss (The Hollow Sovereign)
 *   scatter — 4 AoE zones at random positions near the player (The Undying Tide)
 *   combo   — ring + scatter simultaneously (Wraeclast's Chosen)
 */
export class BossEnemy extends Enemy {
  constructor(x, y, config) {
    super(x, y, config);
    this.isBoss          = true;
    this.bossName        = config.name;
    this.attackType      = config.attackType;
    this.attackCooldown  = config.attackCooldown;
    this.attackDamage    = config.attackDamage;
    this._attackTimer    = config.attackCooldown * 0.6; // slight delay before first strike
    this.aoeRadiusMult   = config.aoeRadiusMult ?? 1;
    // The boss flashes for 2.5 s on arrival before becoming active.
    this._warningTime    = 2.5;
    this.isWarning       = true;
    this._deathHandled   = false; // set by GameEngine to avoid double processing
  }

  /**
   * @param {number} dt
   * @param {object} player
   * @param {import('../GameEngine.js').GameEngine} engine
   */
  update(dt, player, engine) {
    if (this.isWarning) {
      this._warningTime -= dt;
      if (this._warningTime <= 0) this.isWarning = false;
      return; // frozen during entrance
    }

    // Move toward player (inherited Enemy AI)
    super.update(dt, player, engine);

    // Attack cooldown
    this._attackTimer -= dt;
    if (this._attackTimer <= 0) {
      this._attackTimer = this.attackCooldown;
      this._doAttack(player, engine);
    }
  }

  _doAttack(player, engine) {
    if (this.attackType === 'ring') {
      this._spawnRing(engine);
    } else if (this.attackType === 'scatter') {
      this._spawnScatter(player, engine);
    } else if (this.attackType === 'combo') {
      this._spawnRing(engine);
      this._spawnScatter(player, engine);
    }
    // AudioManager silently ignores unknown sound IDs.
    engine.audio.play('boss_attack');
  }

  /** Eight AoE zones evenly spaced in a ring around the boss. */
  _spawnRing(engine) {
    const count = 8;
    const dist  = 115 * this.aoeRadiusMult;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      engine.entities.addAoeZone(new AoEZone(
        this.x + Math.cos(angle) * dist,
        this.y + Math.sin(angle) * dist,
        { radius: 52, damage: this.attackDamage, color: this.color,
          activeDuration: 2.5, warningDuration: 1.0 },
      ));
    }
  }

  /** Four AoE zones scattered around the player position. */
  _spawnScatter(player, engine) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = (25 + Math.random() * 120) * this.aoeRadiusMult;
      engine.entities.addAoeZone(new AoEZone(
        player.x + Math.cos(angle) * dist,
        player.y + Math.sin(angle) * dist,
        { radius: 62 * this.aoeRadiusMult, damage: this.attackDamage, color: this.color,
          activeDuration: 3.5, warningDuration: 1.2 },
      ));
    }
  }

  draw(renderer) {
    if (this.isWarning) {
      // Pulsing gold silhouette during entrance warning.
      const pulse = (Math.sin(Date.now() * 0.008) + 1) * 0.5;
      renderer.drawStrokeCircle(this.x, this.y, this.radius + 12, '#f1c40f', 3, 0.25 + pulse * 0.55);
      renderer.drawCircle(this.x, this.y, this.radius, this.color, 0.3 + pulse * 0.4);
      return;
    }

    // Permanent glow ring distinguishing boss from elite enemies.
    renderer.drawStrokeCircle(this.x, this.y, this.radius + 9, this.color, 3, 0.4);
    // Body
    renderer.drawCircle(this.x, this.y, this.radius, this.color);
    // Health bar (always visible on bosses)
    renderer.drawHealthBar(
      this.x, this.y,
      this.health, this.maxHealth,
      this.radius * 2 + 10,
      -(this.radius + 11),
    );
  }
}

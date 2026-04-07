import { Enemy } from '../entities/Enemy.js';
import { WAVE_SCHEDULE, SPAWN_RADIUS, DESPAWN_RADIUS } from '../config.js';
import { getEnemyById, listEnemyIds } from '../content/registries/enemyRegistry.js';

/**
 * WaveSpawner
 * Two-layer spawning system:
 *   1. Scheduled waves — pre-authored set pieces at specific timestamps
 *   2. Continuous spawning — random groups every few seconds, scaling with elapsed time
 */
export class WaveSpawner {
  constructor(entities) {
    this.entities = entities;
    this._waveIndex = 0;
    this._continuousTimer = 0;
    this._continuousInterval = 3.0; // seconds between continuous spawn groups
  }

  update(dt, elapsed, player, mapLayout = null) {
    // --- Scheduled waves ---
    while (
      this._waveIndex < WAVE_SCHEDULE.length &&
      elapsed >= WAVE_SCHEDULE[this._waveIndex].time
    ) {
      const wave = WAVE_SCHEDULE[this._waveIndex];
      this._spawnGroup(wave.type, wave.count, player, mapLayout);
      this._waveIndex++;
    }

    // --- Continuous spawning ---
    this._continuousTimer += dt;
    if (this._continuousTimer >= this._continuousInterval) {
      this._continuousTimer -= this._continuousInterval;

      const typeKeys = listEnemyIds();
      const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
      // Difficulty scales from 1x at t=0 to 5x at t=8min
      const difficulty = Math.min(1 + elapsed / 120, 5);
      const count = Math.max(1, Math.floor(2 * difficulty));
      this._spawnGroup(typeKey, count, player, mapLayout);
    }

    // --- Despawn enemies that have wandered too far ---
    this._despawnFar(player);
  }

  _spawnGroup(typeId, count, player, mapLayout = null) {
    const baseConfig = getEnemyById(typeId);
    if (!baseConfig) return;
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      if (mapLayout) {
        const p = mapLayout.findSpawnPointNear(player, SPAWN_RADIUS * 0.55, SPAWN_RADIUS * 1.2);
        x = p.x;
        y = p.y;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist  = SPAWN_RADIUS + Math.random() * 100;
        x = player.x + Math.cos(angle) * dist;
        y = player.y + Math.sin(angle) * dist;
      }

      // 5% chance to spawn a Corrupted Champion (2× HP, 1.3× speed, 2× XP).
      const isChampion = Math.random() < 0.05;
      const config = isChampion
        ? {
            ...baseConfig,
            health:   baseConfig.health   * 2,
            speed:    baseConfig.speed    * 1.3,
            xpValue:  baseConfig.xpValue  * 2,
          }
        : baseConfig;

      const enemy = new Enemy(x, y, config);
      if (isChampion) enemy.isChampion = true;
      this.entities.add(enemy);
    }
  }

  _despawnFar(player) {
    const limitSq = DESPAWN_RADIUS * DESPAWN_RADIUS;
    for (const enemy of this.entities.enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy > limitSq) {
        enemy.active = false;
      }
    }
  }

  reset() {
    this._waveIndex = 0;
    this._continuousTimer = 0;
  }
}

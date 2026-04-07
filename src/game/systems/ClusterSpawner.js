import { Enemy } from '../entities/Enemy.js';
import { BossEnemy } from '../entities/BossEnemy.js';
import { ItemDrop } from '../entities/ItemDrop.js';
import { WAVE_SCHEDULE, SPAWN_RADIUS, DESPAWN_RADIUS, BOSS_DEFS, ENEMY_AI } from '../config.js';
import { generateItem } from '../data/itemGenerator.js';
import { getEnemyById, listEnemyIds } from '../content/registries/enemyRegistry.js';
import { listGenericItemDefs, listUniqueItemDefs } from '../content/registries/itemRegistry.js';

const GENERIC_ITEM_DEFS = listGenericItemDefs();
const UNIQUE_ITEM_DEFS = listUniqueItemDefs();

/**
 * ClusterSpawner (C5)
 * - Map mode: place enemies once on map load (no continuous spawns).
 * - Legacy mode (no map layout): keeps old wave + continuous behavior.
 */
export class ClusterSpawner {
  constructor(entities) {
    this.entities = entities;
    this._waveIndex = 0;
    this._continuousTimer = 0;
    this._continuousInterval = 3.0;
    this._mapSeeded = false;
  }

  /**
   * Populate enemies/champions/boss for the generated map.
   * @returns {{ enemiesTotal: number }}
   */
  populateMap(mapLayout, mapDef = {}, entities = this.entities, difficulty = 1, mapInstance = null) {
    if (!mapLayout) return { enemiesTotal: 0 };

    let total = 0;
    const enemyPool = this._resolveEnemyPool(mapDef, difficulty);
    const modEffects = mapInstance?.modEffects ?? {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
      packSizeMult: 1,
      extraChampionPacks: 0,
    };
    const rooms = mapLayout.clusterRooms ?? [];
    let packSeq = 0;

    for (const room of rooms) {
      const roomMult = room.type === 'elite' ? 1.6 : room.type === 'treasure' ? 0.6 : 1.0;
      const packsPerRoom = Math.max(1, Math.round((mapDef.packsPerRoom ?? 2) * roomMult * modEffects.packSizeMult));
      const roomCount = packsPerRoom + this._rollInt(1, 3);

      for (let i = 0; i < roomCount; i++) {
        const packId = `room:${room.id}:pack:${packSeq++}`;
        const enemyType = this._pickWeighted(enemyPool);
        if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, difficulty, false, modEffects, packId)) total++;
      }

      // 5% champion pack chance per room (higher in elite rooms)
      const champChance = room.type === 'elite' ? 0.16 : 0.05;
      if (Math.random() < champChance) {
        const championPackId = `room:${room.id}:champ:${packSeq++}`;
        const championCount = this._rollInt(1, 3);
        for (let i = 0; i < championCount; i++) {
          const enemyType = this._pickWeighted(enemyPool);
          if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, difficulty, true, modEffects, championPackId)) total++;
        }
      }

      // Treasure rooms get a guaranteed item drop.
      if (room.type === 'treasure') {
        const pool = Math.random() < 0.2 && UNIQUE_ITEM_DEFS.length ? UNIQUE_ITEM_DEFS : GENERIC_ITEM_DEFS;
        const base = pool[Math.floor(Math.random() * pool.length)];
        const rarity = room.type === 'elite' ? 'rare' : 'magic';
        const itemDef = generateItem(base, rarity);
        const { x, y } = this._randomPointInRoom(room, mapLayout);
        entities.itemDrops.push(new ItemDrop(x, y, itemDef));
      }
    }

    // C9 modifier: guaranteed extra champion packs added after baseline seeding.
    const extraChampions = Math.max(0, Math.round(modEffects.extraChampionPacks ?? 0));
    if (extraChampions > 0 && rooms.length > 0) {
      for (let i = 0; i < extraChampions; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        const championPackId = `room:${room.id}:extra:${packSeq++}`;
        const championCount = this._rollInt(2, 4);
        for (let j = 0; j < championCount; j++) {
          const enemyType = this._pickWeighted(enemyPool);
          if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, difficulty, true, modEffects, championPackId)) total++;
        }
      }
    }

    // Boss spawn in the designated boss room.
    const bossId = mapDef.bossId ?? this._defaultBossIdForTier(mapDef.tier ?? 1);
    const bossRoom = mapLayout.bossRoom;
    let bossName = null;
    if (bossRoom) {
      const boss = this.spawnBoss(bossId, bossRoom, mapLayout, entities, modEffects);
      if (boss) {
        total++;
        bossName = boss.bossName;
      }
    }

    this._mapSeeded = true;
    return { enemiesTotal: total, bossName };
  }

  /**
   * Update spawner each frame.
   * In generated-map mode, this is intentionally a no-op.
   */
  update(dt, elapsed, player, mapLayout = null) {
    if (mapLayout) return;

    // Legacy arena fallback behavior.
    while (
      this._waveIndex < WAVE_SCHEDULE.length &&
      elapsed >= WAVE_SCHEDULE[this._waveIndex].time
    ) {
      const wave = WAVE_SCHEDULE[this._waveIndex];
      this._spawnLegacyGroup(wave.type, wave.count, player);
      this._waveIndex++;
    }

    this._continuousTimer += dt;
    if (this._continuousTimer >= this._continuousInterval) {
      this._continuousTimer -= this._continuousInterval;
      const keys = listEnemyIds();
      const type = keys[Math.floor(Math.random() * keys.length)];
      const scale = Math.min(1 + elapsed / 120, 5);
      const count = Math.max(1, Math.floor(2 * scale));
      this._spawnLegacyGroup(type, count, player);
    }

    this._despawnFar(player);
  }

  placeSingleEnemy(typeId, room, mapLayout, entities = this.entities, difficulty = 1, forceChampion = false, modEffects = null, packId = null) {
    const base = getEnemyById(typeId);
    if (!base) return null;

    const mods = modEffects ?? {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
    };

    const { x, y } = this._randomPointInRoom(room, mapLayout);
    const healthScale = 1 + (difficulty - 1) * 0.22;
    const damageScale = 1 + (difficulty - 1) * 0.14;
    const xpScale = 1 + (difficulty - 1) * 0.18;

    const isChampion = forceChampion;
    const config = {
      ...base,
      health: Math.round(base.health * healthScale * (isChampion ? 2 : 1) * mods.enemyLifeMult),
      speed: Math.round(base.speed * (isChampion ? 1.2 : 1) * mods.enemySpeedMult),
      damage: Math.round(base.damage * damageScale),
      xpValue: Math.round(base.xpValue * xpScale * (isChampion ? 2 : 1)),
      aggroRadius: ENEMY_AI.baseAggroRadius + (isChampion ? ENEMY_AI.championAggroBonus : 0),
      propagationRadius: ENEMY_AI.propagationRadius,
      packId,
      aiState: 'idle',
    };

    const enemy = new Enemy(x, y, config);
    enemy.radius = Math.round(enemy.radius * Math.sqrt(mods.enemyAoeMult));
    if (isChampion) enemy.isChampion = true;
    enemy._path = null;
    enemy._pathIndex = 0;
    enemy._repathTimer = 0;
    entities.add(enemy);
    return enemy;
  }

  spawnBoss(bossId, room, mapLayout, entities = this.entities, modEffects = null) {
    const def = BOSS_DEFS[bossId];
    if (!def || !room) return null;
    const mods = modEffects ?? {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
    };
    const p = mapLayout.tileToWorld(room.centerX, room.centerY);
    const boss = new BossEnemy(p.x, p.y, {
      ...def,
      health: Math.round(def.health * mods.enemyLifeMult),
      speed: Math.round(def.speed * mods.enemySpeedMult),
      attackDamage: Math.round(def.attackDamage * Math.max(1, mods.enemyAoeMult * 0.92)),
    });
    boss.aoeRadiusMult = mods.enemyAoeMult;
    entities.add(boss);
    return boss;
  }

  reset() {
    this._waveIndex = 0;
    this._continuousTimer = 0;
    this._mapSeeded = false;
  }

  _spawnLegacyGroup(typeId, count, player) {
    const base = getEnemyById(typeId);
    if (!base) return;
    const legacyPackId = `legacy:${this._waveIndex}:${Math.floor(this._continuousTimer * 1000)}`;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = SPAWN_RADIUS + Math.random() * 100;
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;
      const enemy = new Enemy(x, y, base);
      if (Math.random() < 0.05) {
        enemy.isChampion = true;
        enemy.health *= 2;
        enemy.maxHealth *= 2;
        enemy.speed *= 1.3;
        enemy.xpValue *= 2;
      }
      enemy.aggroRadius = ENEMY_AI.baseAggroRadius + (enemy.isChampion ? ENEMY_AI.championAggroBonus : 0);
      enemy.propagationRadius = ENEMY_AI.propagationRadius;
      enemy.packId = legacyPackId;
      enemy.aiState = 'idle';
      enemy._path = null;
      enemy._pathIndex = 0;
      enemy._repathTimer = 0;
      this.entities.add(enemy);
    }
  }

  _despawnFar(player) {
    const limitSq = DESPAWN_RADIUS * DESPAWN_RADIUS;
    for (const enemy of this.entities.enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy > limitSq) enemy.active = false;
    }
  }

  _resolveEnemyPool(mapDef, difficulty) {
    if (Array.isArray(mapDef.enemyPool) && mapDef.enemyPool.length > 0) {
      return mapDef.enemyPool.map((entry) => {
        if (typeof entry === 'string') return { id: entry, weight: 1 };
        return { id: entry.id, weight: entry.weight ?? 1 };
      });
    }

    const pool = [
      { id: 'RHOA', weight: 3 },
      { id: 'RATTLING_REMNANT', weight: 3 },
      { id: 'UNDYING_THRALL', weight: 2 },
      { id: 'SHRIEKING_BANSHEE', weight: difficulty >= 2 ? 2 : 0 },
      { id: 'PLAGUE_CRAWLER', weight: difficulty >= 3 ? 2 : 0 },
      { id: 'VOID_STALKER', weight: difficulty >= 4 ? 2 : 0 },
      { id: 'SHADE', weight: difficulty >= 5 ? 2 : 0 },
      { id: 'IRON_COLOSSUS', weight: difficulty >= 5 ? 1 : 0 },
    ];
    return pool.filter((p) => p.weight > 0);
  }

  _defaultBossIdForTier(tier) {
    const ids = Object.keys(BOSS_DEFS);
    if (ids.length === 0) return null;
    return ids[Math.min(ids.length - 1, Math.max(0, tier - 1))];
  }

  _pickWeighted(pool) {
    if (!pool.length) return 'RHOA';
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) return p.id;
    }
    return pool[pool.length - 1].id;
  }

  _rollInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _randomPointInRoom(room, mapLayout) {
    const margin = 1;
    const tx = this._rollInt(room.x + margin, room.x + room.w - 1 - margin);
    const ty = this._rollInt(room.y + margin, room.y + room.h - 1 - margin);
    return mapLayout.tileToWorld(tx, ty);
  }
}

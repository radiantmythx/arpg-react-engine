import { Enemy } from '../entities/Enemy.js';
import { BossEnemy } from '../entities/BossEnemy.js';
import { WAVE_SCHEDULE, SPAWN_RADIUS, DESPAWN_RADIUS, BOSS_DEFS, ENEMY_AI } from '../config.js';
import { getEnemyById, listEnemyIds } from '../content/registries/enemyRegistry.js';
import { enemyDamageMultiplier, enemyLifeMultiplier, enemyXpMultiplier, enemyDensityMultiplier } from '../config/scalingConfig.js';

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
  populateMap(mapLayout, mapDef = {}, entities = this.entities, areaLevel = 1, mapInstance = null) {
    if (!mapLayout) return { enemiesTotal: 0 };

    let total = 0;
    const enemyPool = this._resolveEnemyPool(mapDef, areaLevel);
    const densityMult = enemyDensityMultiplier(areaLevel);
    const modEffects = mapInstance?.modEffects ?? {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
      packSizeMult: 1,
      extraChampionPacks: 0,
    };
    const roomSetpieceMap = this._buildRoomSetpieceMap(mapLayout?.encounterMetadata, mapLayout?.clusterRooms ?? []);
    const rooms = mapLayout.clusterRooms ?? [];
    let packSeq = 0;

    for (const room of rooms) {
      const setpieceTags = roomSetpieceMap[room.id] ?? [];
      const encounterTuning = this._deriveRoomEncounterTuning(room, setpieceTags);
      const roomMult = room.type === 'elite' ? 1.6 : room.type === 'treasure' ? 0.6 : 1.0;
      const packsPerRoom = Math.max(
        1,
        Math.round((mapDef.packsPerRoom ?? 2) * roomMult * modEffects.packSizeMult * encounterTuning.packMult * densityMult),
      );
      const roomCount = packsPerRoom + this._rollInt(1, 3);

      for (let i = 0; i < roomCount; i++) {
        const packId = `room:${room.id}:pack:${packSeq++}`;
        const enemyType = this._pickWeighted(enemyPool);
        if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, areaLevel, false, modEffects, packId)) total++;
      }

      // 5% champion pack chance per room (higher in elite rooms)
      const champChance = room.type === 'elite' ? 0.16 : 0.05;
      const tunedChampChance = Math.max(0.01, Math.min(0.72, champChance + encounterTuning.championChanceAdd));
      if (encounterTuning.forceChampionPack || Math.random() < tunedChampChance) {
        const championPackId = `room:${room.id}:champ:${packSeq++}`;
        const championCount = this._rollInt(1, 3);
        for (let i = 0; i < championCount; i++) {
          const enemyType = this._pickWeighted(enemyPool);
          if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, areaLevel, true, modEffects, championPackId)) total++;
        }
      }

      // Treasure/reward rooms no longer pre-place items at spawn time.
      // Items are dropped by enemies when they are killed (see GameEngine.onEnemyKilled).
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
          if (this.placeSingleEnemy(enemyType, room, mapLayout, entities, areaLevel, true, modEffects, championPackId)) total++;
        }
      }
    }

    // Boss spawn in the designated boss room.
    const bossId = mapDef.bossId ?? this._defaultBossIdForArea(areaLevel);
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

  placeSingleEnemy(typeId, room, mapLayout, entities = this.entities, areaLevel = 1, forceChampion = false, modEffects = null, packId = null) {
    const base = getEnemyById(typeId);
    if (!base) return null;

    const mods = modEffects ?? {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
    };

    const { x, y } = this._randomPointInRoom(room, mapLayout);
    const healthScale = enemyLifeMultiplier(areaLevel);
    const damageScale = enemyDamageMultiplier(areaLevel);
    const xpScale = enemyXpMultiplier(areaLevel);

    const isChampion = forceChampion;
    const config = {
      ...base,
      health: Math.round(base.health * healthScale * (isChampion ? 2 : 1) * mods.enemyLifeMult),
      speed: Math.round(base.speed * (isChampion ? 1.2 : 1) * mods.enemySpeedMult),
      damage: Math.round(base.damage * damageScale),
      damageScale,
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

  _resolveEnemyPool(mapDef, areaLevel) {
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
      { id: 'SHRIEKING_BANSHEE', weight: areaLevel >= 20 ? 2 : 0 },
      { id: 'PLAGUE_CRAWLER', weight: areaLevel >= 33 ? 2 : 0 },
      { id: 'VOID_STALKER', weight: areaLevel >= 45 ? 2 : 0 },
      { id: 'SHADE', weight: areaLevel >= 57 ? 2 : 0 },
      { id: 'IRON_COLOSSUS', weight: areaLevel >= 57 ? 1 : 0 },
    ];
    return pool.filter((p) => p.weight > 0);
  }

  _defaultBossIdForArea(areaLevel) {
    const ids = Object.keys(BOSS_DEFS);
    if (ids.length === 0) return null;
    const idx = areaLevel >= 65 ? 4
      : areaLevel >= 50 ? 3
        : areaLevel >= 35 ? 2
          : areaLevel >= 20 ? 1
            : 0;
    return ids[Math.min(ids.length - 1, Math.max(0, idx))];
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

  _buildRoomSetpieceMap(encounterMetadata = null, rooms = []) {
    const byRoom = {};

    for (const [roomId, tags] of Object.entries(encounterMetadata?.roomTagsById ?? {})) {
      if (!Array.isArray(byRoom[roomId])) byRoom[roomId] = [];
      for (const tag of tags ?? []) {
        if (!byRoom[roomId].includes(tag)) byRoom[roomId].push(tag);
      }
    }

    for (const node of encounterMetadata?.setpieceNodes ?? []) {
      if (!node?.roomId || !node?.type) continue;
      if (!Array.isArray(byRoom[node.roomId])) byRoom[node.roomId] = [];
      if (!byRoom[node.roomId].includes(node.type)) byRoom[node.roomId].push(node.type);
    }

    for (const room of rooms) {
      if (!room?.id || !Array.isArray(room.encounterTags)) continue;
      if (!Array.isArray(byRoom[room.id])) byRoom[room.id] = [];
      for (const tag of room.encounterTags) {
        if (!byRoom[room.id].includes(tag)) byRoom[room.id].push(tag);
      }
    }

    return byRoom;
  }

  _deriveRoomEncounterTuning(room, setpieceTags = []) {
    const tuning = {
      packMult: 1,
      championChanceAdd: 0,
      forceChampionPack: false,
      guaranteedRewardDrop: false,
      rewardRarity: null,
    };

    if (setpieceTags.includes('shrine_room')) {
      tuning.packMult *= 1.1;
    }
    if (setpieceTags.includes('elite_ambush_room')) {
      tuning.packMult *= 1.35;
      tuning.forceChampionPack = true;
      tuning.championChanceAdd += 0.2;
    }
    if (setpieceTags.includes('cursed_chest_pocket')) {
      tuning.guaranteedRewardDrop = true;
      tuning.rewardRarity = room.type === 'elite' ? 'rare' : 'magic';
    }
    if (setpieceTags.includes('trap_antechamber')) {
      tuning.packMult *= 1.2;
      tuning.championChanceAdd += 0.08;
    }
    if (setpieceTags.includes('vault_side_room')) {
      tuning.guaranteedRewardDrop = true;
      tuning.rewardRarity = 'rare';
    }
    if (setpieceTags.includes('boss_prelude_hall')) {
      tuning.packMult *= 1.5;
      tuning.forceChampionPack = true;
      tuning.championChanceAdd += 0.15;
    }
    if (setpieceTags.includes('boss_approach_final_third')) {
      tuning.packMult *= 1.18;
      tuning.championChanceAdd += 0.1;
    }
    if (setpieceTags.includes('progress_stage_late') || setpieceTags.includes('setpiece_stage_late')) {
      tuning.packMult *= 1.12;
    }
    if (setpieceTags.includes('progress_stage_early')) {
      tuning.packMult *= 0.9;
    }

    return tuning;
  }

  _randomPointInRoom(room, mapLayout) {
    const candidates = room.floorTiles ?? [];
    if (candidates.length > 0) {
      const pick = candidates[this._rollInt(0, candidates.length - 1)];
      return mapLayout.tileToWorld(pick.tx, pick.ty);
    }
    return mapLayout.tileToWorld(room.centerX, room.centerY);
  }
}

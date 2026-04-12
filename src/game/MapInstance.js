/**
 * MapInstance — lightweight runtime map state.
 *
 * A new instance is created each time the player enters a map.
 * In C4 this will also hold the generated MapLayout (rooms, corridors, walls).
 * In C5 the ClusterSpawner will read this to place enemy clusters.
 */
import { SCALING_CONFIG, clampAreaLevel } from './config/scalingConfig.js';

export class MapInstance {
  /**
  * @param {object} [mapDef]  — registry-resolved runtime map definition
   * @param {number} [seed]    — RNG seed for procedural generation
   */
  constructor(mapDef, seed) {
    this.mapDef  = mapDef ?? { id: 'placeholder', name: 'Unknown' };
    this.seed    = seed ?? Math.floor(Math.random() * 0xffffffff);
    const fallbackSourceMapItemLevel = this.mapDef?.rewards?.itemLevel ?? 1;
    this.sourceMapItemLevel = clampAreaLevel(this.mapDef?.sourceMapItemLevel ?? fallbackSourceMapItemLevel);
    this.areaLevel = clampAreaLevel(this.mapDef?.areaLevel ?? this.sourceMapItemLevel);
    this.enemyScalarProfileVersion = SCALING_CONFIG.version;
    this.encounterDebug = {
      sourceMapItemLevel: this.sourceMapItemLevel,
      computedAreaLevel: this.areaLevel,
      enemyScalarProfileVersion: this.enemyScalarProfileVersion,
    };

    /** Portals the player has remaining in this instance. Consumed on death. */
    this.portalsRemaining = 3;

    /** Set to true when the map boss is killed. */
    this.isCleared = false;

    /** Number of enemies placed when entering this map instance. */
    this.enemiesTotal = 0;
    /** Number of enemies killed in this map instance. */
    this.enemiesKilled = 0;

    /** Visual portal entities rendered in-world near the start room. */
    this.portalsInWorld = [];

    /** Raw map modifiers (from map item or scripted map definition). */
    this.mods = [];
    /** Parsed runtime effects consumed by spawner and player hooks. */
    this.modEffects = {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
      packSizeMult: 1,
      extraChampionPacks: 0,
      playerNoRegen: false,
      playerDamageTakenMult: 1,
      corrupted: false,
      layoutTwisting: 0,
      layoutFortified: 0,
      layoutFlooded: 0,
      layoutOvergrown: 0,
      layoutVolatile: 0,
      hybridRemixHint: null,
      geometryModIds: [],
    };

    this.applyMods(this.mapDef?.mods ?? []);

    this.startedAt = Date.now();
  }

  /**
   * Parse map modifiers into normalized runtime effects.
   * @param {Array<{id: string, value: any, label?: string, type?: string}>} mods
   */
  applyMods(mods = []) {
    this.mods = Array.isArray(mods) ? [...mods] : [];
    this.modEffects = {
      enemyLifeMult: 1,
      enemySpeedMult: 1,
      enemyAoeMult: 1,
      packSizeMult: 1,
      extraChampionPacks: 0,
      playerNoRegen: false,
      playerDamageTakenMult: 1,
      corrupted: false,
      layoutTwisting: 0,
      layoutFortified: 0,
      layoutFlooded: 0,
      layoutOvergrown: 0,
      layoutVolatile: 0,
      hybridRemixHint: null,
      geometryModIds: [],
    };

    for (const mod of this.mods) {
      switch (mod?.id) {
        case 'enemy_life':
          this.modEffects.enemyLifeMult *= Number(mod.value ?? 1.5);
          break;
        case 'enemy_speed':
          this.modEffects.enemySpeedMult *= Number(mod.value ?? 1.2);
          break;
        case 'area_of_effect':
          this.modEffects.enemyAoeMult *= Number(mod.value ?? 1.4);
          break;
        case 'pack_size':
          this.modEffects.packSizeMult *= Number(mod.value ?? 1.3);
          break;
        case 'extra_champion_packs':
          this.modEffects.extraChampionPacks += Math.max(0, Number(mod.value ?? 3));
          break;
        case 'reduced_player_regen':
          this.modEffects.playerNoRegen = true;
          break;
        case 'elemental_weakness':
          // No elemental resistance layer exists yet, so model this as +25% incoming damage.
          this.modEffects.playerDamageTakenMult *= 1.25;
          break;
        case 'corrupted':
          this.modEffects.corrupted = true;
          break;
        case 'twisting':
          this.modEffects.layoutTwisting += Math.max(1, Number(mod.value ?? 1));
          this.modEffects.geometryModIds.push('twisting');
          break;
        case 'fortified':
          this.modEffects.layoutFortified += Math.max(1, Number(mod.value ?? 1));
          this.modEffects.geometryModIds.push('fortified');
          break;
        case 'flooded':
          this.modEffects.layoutFlooded += Math.max(1, Number(mod.value ?? 1));
          this.modEffects.geometryModIds.push('flooded');
          break;
        case 'overgrown':
          this.modEffects.layoutOvergrown += Math.max(1, Number(mod.value ?? 1));
          this.modEffects.geometryModIds.push('overgrown');
          break;
        case 'volatile':
          this.modEffects.layoutVolatile += Math.max(1, Number(mod.value ?? 1));
          this.modEffects.geometryModIds.push('volatile');
          break;
      }
    }

    const hasTwisting = this.modEffects.layoutTwisting > 0;
    const hasFlooded = this.modEffects.layoutFlooded > 0;
    const hasOvergrown = this.modEffects.layoutOvergrown > 0;
    if (hasTwisting && (hasFlooded || hasOvergrown)) {
      this.modEffects.hybridRemixHint = hasFlooded ? 'twisting+flooded' : 'twisting+overgrown';
    }
  }
}

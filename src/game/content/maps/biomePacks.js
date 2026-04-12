export const BIOME_PACKS = [
  {
    id: 'pack_ruined_keep',
    name: 'Ruined Keep',
    contentStage: 'act',
    theme: 'ruins',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'linear',
    terrainProfile: 'mud+ash',
    obstacleSet: ['pillars', 'barricades', 'gatehouses'],
    terrainPalette: ['mud', 'ash'],
    enemyPackPreferences: ['melee_brute', 'skeletal_swarm'],
    bossArenaStylePool: ['throne_dais', 'pillar_hall', 'duel_circle'],
    renderHints: {
      floorPalette: 'ruined_stone',
      propPalette: 'fortress_props',
    },
    defaultPacksPerRoom: 2,
    defaultDifficulty: 1.15,
  },
  {
    id: 'pack_siege_road',
    name: 'Siege Road',
    contentStage: 'act',
    theme: 'wastes',
    layoutFamily: 'gauntlet_lane',
    pathStyle: 'linear',
    terrainProfile: 'ash+cracked_ice+mud',
    obstacleSet: ['barricades', 'wagons', 'fences'],
    terrainPalette: ['ash', 'cracked_ice', 'mud'],
    enemyPackPreferences: ['lane_pressure', 'ranged_harass'],
    bossArenaStylePool: ['broken_arena', 'duel_circle'],
    renderHints: {
      floorPalette: 'ash_road',
      propPalette: 'siege_debris',
    },
    defaultPacksPerRoom: 2,
    defaultDifficulty: 1.35,
  },
  {
    id: 'pack_fungal_grotto',
    name: 'Fungal Grotto',
    contentStage: 'act',
    theme: 'archive',
    layoutFamily: 'meandering_cavern',
    pathStyle: 'curved',
    terrainProfile: 'shallow_water+cracked_ice',
    obstacleSet: ['fungal_pillars', 'root_clusters', 'crystal_spines'],
    terrainPalette: ['shallow_water', 'cracked_ice'],
    enemyPackPreferences: ['ambush', 'sustain_casters'],
    bossArenaStylePool: ['chapel_cross', 'pillar_hall'],
    renderHints: {
      floorPalette: 'flooded_cavern',
      propPalette: 'fungal_growth',
    },
    defaultPacksPerRoom: 3,
    defaultDifficulty: 1.6,
  },
  {
    id: 'pack_flooded_crypt',
    name: 'Flooded Crypt',
    contentStage: 'both',
    endgameTierBand: 1,
    theme: 'cathedral',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'branching',
    terrainProfile: 'brambles+mud+ash',
    obstacleSet: ['sarcophagi', 'pillars', 'bone_fences'],
    terrainPalette: ['mud', 'brambles', 'ash'],
    enemyPackPreferences: ['pressure_mixed', 'summoners'],
    bossArenaStylePool: ['chapel_cross', 'throne_dais', 'pillar_hall'],
    renderHints: {
      floorPalette: 'drowned_sanctum',
      propPalette: 'crypt_props',
    },
    defaultPacksPerRoom: 3,
    defaultDifficulty: 1.95,
  },
  {
    id: 'pack_spiral_abyss',
    name: 'Spiral Abyss',
    contentStage: 'both',
    endgameTierBand: 3,
    theme: 'abyss',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'linear',
    terrainProfile: 'ash+brambles+shallow_water',
    obstacleSet: ['ritual_spires', 'void_rubble', 'altars'],
    terrainPalette: ['ash', 'brambles', 'shallow_water'],
    enemyPackPreferences: ['elite_dense', 'void_hunters'],
    bossArenaStylePool: ['duel_circle', 'broken_arena', 'throne_dais'],
    renderHints: {
      floorPalette: 'embered_voidstone',
      propPalette: 'abyssal_relics',
    },
    defaultPacksPerRoom: 4,
    defaultDifficulty: 2.25,
  },
  {
    id: 'pack_open_fields',
    name: 'Open Fields',
    contentStage: 'endgame',
    endgameTierBand: 2,
    theme: 'fields',
    layoutFamily: 'open_fields',
    pathStyle: 'open',
    terrainProfile: 'mud+ash',
    obstacleSet: ['sparse_stones', 'field_pillars'],
    terrainPalette: ['mud', 'ash'],
    enemyPackPreferences: ['open_space_pressure', 'ranged_skirmishers'],
    bossArenaStylePool: ['duel_circle', 'broken_arena'],
    renderHints: {
      floorPalette: 'open_grasslands',
      propPalette: 'scattered_ruins',
    },
    defaultPacksPerRoom: 2,
    defaultDifficulty: 1.4,
  },
];

export const BIOME_PACK_BY_ID = Object.fromEntries(BIOME_PACKS.map((p) => [p.id, p]));

export const BIOME_PACK_BY_THEME = Object.fromEntries(
  BIOME_PACKS.map((p) => [p.theme, p]),
);

export const ACT_BIOME_PACKS = BIOME_PACKS.filter(
  (p) => p.contentStage === 'act' || p.contentStage === 'both',
);

export const ENDGAME_BIOME_PACKS = BIOME_PACKS.filter(
  (p) => p.contentStage === 'endgame' || p.contentStage === 'both',
);

export function biomePackSupportsAct(pack) {
  return !!pack && (pack.contentStage === 'act' || pack.contentStage === 'both');
}

export function biomePackSupportsEndgame(pack) {
  return !!pack && (pack.contentStage === 'endgame' || pack.contentStage === 'both');
}

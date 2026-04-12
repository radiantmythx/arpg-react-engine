import { rollMapMods } from '../content/maps/index.js';
import {
  BIOME_PACK_BY_ID,
  BIOME_PACK_BY_THEME,
  ENDGAME_BIOME_PACKS,
} from '../content/maps/biomePacks.js';
import { listFreeMaps } from '../content/registries/index.js';
import { SCALING_CONFIG, clampAreaLevel } from '../config/scalingConfig.js';

const FREE_MAPS = listFreeMaps();

const MAP_ITEM_COLORS = {
  magic: '#6ea8ff',
  rare: '#f1c40f',
  unique: '#d58b3b',
};

const MAP_THEMES = ['ruins', 'wastes', 'archive', 'cathedral', 'abyss'];

const MAP_TYPE_LABEL_BY_LAYOUT = {
  bsp_fortress: 'Fortress',
  meandering_cavern: 'Cavern',
  gauntlet_lane: 'Gauntlet',
  open_fields: 'Fields',
};

const UNIQUE_MAPS = [
  {
    id: 'unique_map_twilight_ossuary',
    name: 'Twilight Ossuary',
    theme: 'cathedral',
    fixedMods: [
      { id: 'enemy_life', type: 'prefix', label: 'Enemies have +50% maximum life', value: 1.5 },
      { id: 'pack_size', type: 'prefix', label: '+30% more enemy packs per room', value: 1.3 },
      { id: 'reduced_player_regen', type: 'suffix', label: 'Players cannot regenerate life', value: true },
    ],
  },
  {
    id: 'unique_map_glass_dominion',
    name: 'Glass Dominion',
    theme: 'archive',
    fixedMods: [
      { id: 'enemy_speed', type: 'prefix', label: 'Enemies are 20% faster', value: 1.2 },
      { id: 'area_of_effect', type: 'prefix', label: 'Enemy area attacks gain +40% radius', value: 1.4 },
      { id: 'elemental_weakness', type: 'suffix', label: 'Players have -25% elemental resistances', value: -25 },
    ],
  },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function makeUid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `map_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function rollMapRarity(isChampion = false) {
  const roll = Math.random();
  if (isChampion && roll < 0.08) return 'unique';
  if (roll < 0.42) return 'rare';
  return 'magic';
}

function mapThemeForAreaLevel(areaLevel) {
  const idx = Math.floor(Math.max(0, areaLevel - 1) / 20) % MAP_THEMES.length;
  return MAP_THEMES[idx];
}

function resolveInstanceDeltaTable() {
  const minDelta = Math.floor(SCALING_CONFIG.mapDrop.instanceMinDelta ?? -5);
  const maxDelta = Math.floor(SCALING_CONFIG.mapDrop.instanceMaxDelta ?? 5);
  const range = Math.max(1, maxDelta - minDelta + 1);
  const raw = Array.isArray(SCALING_CONFIG.mapDrop.instanceWeights) ? SCALING_CONFIG.mapDrop.instanceWeights : [];
  const fallbackWeight = 1 / range;
  const weights = Array.from({ length: range }, (_, i) => {
    const w = Number(raw[i]);
    return Number.isFinite(w) && w >= 0 ? w : fallbackWeight;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  const normalized = total > 0
    ? weights.map((w) => w / total)
    : weights.map(() => fallbackWeight);

  return normalized.map((weight, i) => ({ delta: minDelta + i, weight }));
}

function pickWeightedDelta(table) {
  let roll = Math.random();
  for (const row of table) {
    roll -= row.weight;
    if (roll <= 0) return row.delta;
  }
  return table[table.length - 1]?.delta ?? 0;
}

export function rollMapDropItemLevel(options = {}) {
  const context = options.dropContext ?? 'legacy';
  const baseLevel = clampAreaLevel(options.sourceMapItemLevel ?? options.areaLevel ?? options.playerLevel ?? 1);
  const threshold = Math.max(0, Math.floor(SCALING_CONFIG.mapDrop.badLuckThreshold ?? 0));
  const badLuckState = options.badLuckState ?? null;
  const protectionEligible = !!badLuckState && threshold > 0 && (badLuckState.negativeStreak ?? 0) >= threshold;

  const campaignVariance = Math.max(0, Math.floor(SCALING_CONFIG.mapDrop.campaignVariance ?? 2));
  const fullTable = resolveInstanceDeltaTable();
  const contextTable = context === 'campaign'
    ? fullTable.filter((row) => row.delta >= -campaignVariance && row.delta <= campaignVariance)
    : fullTable;
  const nonNegativeTable = contextTable.filter((row) => row.delta >= 0);
  const table = protectionEligible && nonNegativeTable.length ? nonNegativeTable : (contextTable.length ? contextTable : fullTable);
  const delta = pickWeightedDelta(table);

  const nonNegative = delta >= 0;
  if (badLuckState) {
    badLuckState.totalDrops = (badLuckState.totalDrops ?? 0) + 1;
    if (protectionEligible && nonNegative) {
      badLuckState.protectionTriggers = (badLuckState.protectionTriggers ?? 0) + 1;
    }
    badLuckState.negativeStreak = nonNegative ? 0 : ((badLuckState.negativeStreak ?? 0) + 1);
  }

  return {
    mapItemLevel: clampAreaLevel(baseLevel + delta),
    baseLevel,
    delta,
    context,
    badLuckProtectionApplied: protectionEligible,
  };
}

function titleCase(value = '') {
  if (!value) return '';
  return value[0].toUpperCase() + value.slice(1);
}

function mapTypeLabel(layoutFamily, theme) {
  return MAP_TYPE_LABEL_BY_LAYOUT[layoutFamily] ?? titleCase(theme ?? 'Unknown');
}

function makeName(layoutFamily, theme) {
  return `${mapTypeLabel(layoutFamily, theme)} Map`;
}

function pickEndgameBiomePackForAreaLevel(areaLevel = 1) {
  const pool = ENDGAME_BIOME_PACKS.length ? ENDGAME_BIOME_PACKS : Object.values(BIOME_PACK_BY_ID);
  if (!pool.length) return null;

  const targetBand = clamp(Math.ceil(Math.max(1, areaLevel) / 34), 1, 3);
  const scored = pool.map((pack) => {
    const band = clamp(Number(pack.endgameTierBand ?? 2), 1, 3);
    const distance = Math.abs(targetBand - band);
    const weight = distance === 0 ? 4 : distance === 1 ? 2 : 1;
    return { pack, weight };
  });

  const total = scored.reduce((sum, row) => sum + row.weight, 0);
  let roll = Math.random() * Math.max(1, total);
  for (const row of scored) {
    roll -= row.weight;
    if (roll <= 0) return row.pack;
  }

  return scored[scored.length - 1]?.pack ?? pool[0] ?? null;
}

function pickTemplateForAreaLevel(areaLevel = 1) {
  if (!FREE_MAPS.length) return null;
  const near = FREE_MAPS.filter((m) => Math.abs((m?.areaLevel ?? 1) - areaLevel) <= 12);
  const pool = near.length ? near : FREE_MAPS;
  return pool[Math.floor(Math.random() * pool.length)] ?? FREE_MAPS[0] ?? null;
}

function buildBaseMapDef(item) {
  const itemLevel = clampAreaLevel(item.mapItemLevel ?? 1);
  const template = pickTemplateForAreaLevel(itemLevel);
  const biomePack = BIOME_PACK_BY_ID[item.mapBiomePackId]
    ?? BIOME_PACK_BY_ID[template?.biomePackId]
    ?? BIOME_PACK_BY_THEME[item.mapTheme ?? template?.theme ?? 'ruins']
    ?? null;

  const resolvedLayoutFamily = item.mapLayoutFamily
    ?? template?.layoutFamily
    ?? biomePack?.layoutFamily
    ?? 'bsp_fortress';
  const resolvedPathStyle = item.mapPathStyle
    ?? template?.pathStyle
    ?? biomePack?.pathStyle
    ?? 'branching';
  const resolvedTerrainProfile = item.mapTerrainProfile
    ?? template?.terrainProfile
    ?? biomePack?.terrainProfile
    ?? 'auto';

  return {
    id: `map_item_${item.uid}`,
    source: 'map_item',
    sourceMapItemLevel: itemLevel,
    name: item.name,
    description: item.description,
    biomePackId: biomePack?.id ?? template?.biomePackId ?? null,
    biomeContentStage: biomePack?.contentStage ?? null,
    theme: item.mapTheme ?? template?.theme ?? biomePack?.theme ?? 'ruins',
    layoutFamily: resolvedLayoutFamily,
    pathStyle: resolvedPathStyle,
    terrainProfile: resolvedTerrainProfile,
    obstacleSet: template?.obstacleSet ?? biomePack?.obstacleSet ?? [],
    terrainPalette: template?.terrainPalette ?? biomePack?.terrainPalette ?? [],
    enemyPackPreferences: template?.enemyPackPreferences ?? biomePack?.enemyPackPreferences ?? [],
    bossArenaStylePool: template?.bossArenaStylePool ?? biomePack?.bossArenaStylePool ?? [],
    renderHints: template?.renderHints ?? biomePack?.renderHints ?? null,
    packsPerRoom: template?.packsPerRoom ?? 2,
    difficulty: template?.difficulty ?? 1,
    areaLevel: itemLevel,
    rewards: {
      xpMult: template?.rewards?.xpMult ?? 1,
      itemLevel,
    },
    enemyPool: template?.enemyPool ?? FREE_MAPS[0]?.enemyPool ?? [],
    bossId: template?.bossId ?? FREE_MAPS[0]?.bossId ?? null,
    mods: item.mapMods ?? [],
  };
}

// Params object only: { areaLevel, sourceMapItemLevel, playerLevel, isChampion, dropContext, badLuckState }
export function createMapItemDrop(params = {}) {
  const areaLevel = clampAreaLevel(params.areaLevel ?? params.playerLevel ?? 1);
  const rarity = rollMapRarity(!!params.isChampion);
  const template = pickTemplateForAreaLevel(areaLevel);
  const endgameBiomePack = pickEndgameBiomePackForAreaLevel(areaLevel);
  const selectedBiomePack = endgameBiomePack;
  const dropRoll = rollMapDropItemLevel({
    dropContext: params.dropContext,
    areaLevel,
    sourceMapItemLevel: params.sourceMapItemLevel,
    playerLevel: params.playerLevel,
    badLuckState: params.badLuckState,
  });
  const mapItemLevel = dropRoll.mapItemLevel;

  let theme = selectedBiomePack?.theme
    ?? template?.theme
    ?? mapThemeForAreaLevel(areaLevel);
  let layoutFamily = template?.layoutFamily
    ?? selectedBiomePack?.layoutFamily
    ?? 'bsp_fortress';
  let pathStyle = template?.pathStyle
    ?? selectedBiomePack?.pathStyle
    ?? 'branching';
  let terrainProfile = template?.terrainProfile
    ?? selectedBiomePack?.terrainProfile
    ?? 'auto';

  const resolvedBiomePack = BIOME_PACK_BY_ID[template?.biomePackId]
    ?? (layoutFamily === 'open_fields' ? BIOME_PACK_BY_ID.pack_open_fields : null)
    ?? selectedBiomePack
    ?? BIOME_PACK_BY_THEME[theme]
    ?? null;

  let name = makeName(layoutFamily, theme);
  let mods = rollMapMods(rarity);
  if (rarity === 'unique') {
    const picked = UNIQUE_MAPS[Math.floor(Math.random() * UNIQUE_MAPS.length)];
    name = picked.name;
    mods = picked.fixedMods;
    theme = picked.theme;
    layoutFamily = template?.layoutFamily ?? layoutFamily;
    pathStyle = template?.pathStyle ?? pathStyle;
    terrainProfile = template?.terrainProfile ?? terrainProfile;
  }

  const typeLabel = mapTypeLabel(layoutFamily, theme);

  return {
    uid: makeUid(),
    id: `map_item_${rarity}`,
    type: 'map_item',
    slot: 'map',
    rarity,
    color: MAP_ITEM_COLORS[rarity],
    gridW: 1,
    gridH: 1,
    name,
    description: `${typeLabel} layout. Place into the Map Device to open a portal to a new instance.`,
    mapTheme: theme,
    mapTypeLabel: typeLabel,
    mapBiomePackId: resolvedBiomePack?.id ?? template?.biomePackId ?? null,
    mapBiomeContentStage: resolvedBiomePack?.contentStage ?? null,
    mapLayoutFamily: layoutFamily,
    mapPathStyle: pathStyle,
    mapTerrainProfile: terrainProfile,
    mapMods: mods,
    mapItemLevel,
    mapDropMeta: {
      context: dropRoll.context,
      baseLevel: dropRoll.baseLevel,
      delta: dropRoll.delta,
      badLuckProtectionApplied: dropRoll.badLuckProtectionApplied,
    },
    affixes: mods,
    baseStats: {
      mapItemLevel,
      mapType: typeLabel,
      mapTheme: titleCase(theme),
      layoutFamily,
      pathStyle,
      terrainProfile,
      modCount: mods.length,
    },
  };
}

export function isMapItem(itemDef) {
  return itemDef?.type === 'map_item';
}

export function mapItemToMapDef(itemDef) {
  if (!isMapItem(itemDef)) return null;
  return buildBaseMapDef(itemDef);
}

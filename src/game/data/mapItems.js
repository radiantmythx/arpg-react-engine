import { rollMapMods } from '../content/maps/index.js';
import { listFreeMaps } from '../content/registries/index.js';

const FREE_MAPS = listFreeMaps();

const MAP_ITEM_COLORS = {
  magic: '#6ea8ff',
  rare: '#f1c40f',
  unique: '#d58b3b',
};

const MAP_THEMES = ['ruins', 'wastes', 'archive', 'cathedral', 'abyss'];

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

function rollMapRarity(championKill = false) {
  const roll = Math.random();
  if (championKill && roll < 0.08) return 'unique';
  if (roll < 0.42) return 'rare';
  return 'magic';
}

function mapTierFromContext(sourceTier = 1, playerLevel = 1) {
  const tierByLevel = Math.floor(playerLevel / 10) + 1;
  return clamp(Math.max(sourceTier, tierByLevel), 1, 10);
}

function mapThemeForTier(tier) {
  return MAP_THEMES[(Math.max(1, tier) - 1) % MAP_THEMES.length];
}

function ilvlForTier(tier, playerLevel = 1) {
  return clamp(Math.round(6 + tier * 4 + playerLevel * 0.9), 4, 100);
}

function makeName(rarity, tier, theme) {
  const tierName = tier <= 3 ? 'Weathered' : tier <= 6 ? 'Ancient' : 'Elder';
  if (rarity === 'rare') return `${tierName} ${theme[0].toUpperCase()}${theme.slice(1)} Map`;
  return `${tierName} Map`;
}

function buildBaseMapDef(item) {
  const tier = clamp(item.mapTier ?? 1, 1, 10);
  const template = FREE_MAPS[Math.min(FREE_MAPS.length - 1, Math.max(0, tier - 1))];
  return {
    id: `map_item_${item.uid}`,
    source: 'map_item',
    name: item.name,
    tier,
    description: item.description,
    theme: item.mapTheme ?? template?.theme ?? 'ruins',
    packsPerRoom: template?.packsPerRoom ?? 2,
    difficulty: Math.max(template?.difficulty ?? 1, 1 + tier * 0.22),
    rewards: {
      xpMult: Math.max(template?.rewards?.xpMult ?? 1, 1 + tier * 0.03),
      itemLevel: item.mapItemLevel ?? template?.rewards?.itemLevel ?? 1,
    },
    enemyPool: template?.enemyPool ?? FREE_MAPS[0].enemyPool,
    bossId: template?.bossId ?? FREE_MAPS[0].bossId,
    mods: item.mapMods ?? [],
  };
}

export function createMapItemDrop(sourceTier = 1, playerLevel = 1, championKill = false) {
  const tier = mapTierFromContext(sourceTier, playerLevel);
  const rarity = rollMapRarity(championKill);
  let theme = mapThemeForTier(tier);
  const mapItemLevel = ilvlForTier(tier, playerLevel);

  let name = makeName(rarity, tier, theme);
  let mods = rollMapMods(rarity);
  if (rarity === 'unique') {
    const picked = UNIQUE_MAPS[Math.floor(Math.random() * UNIQUE_MAPS.length)];
    name = picked.name;
    mods = picked.fixedMods;
    theme = picked.theme;
  }

  return {
    uid: makeUid(),
    id: `map_item_${tier}_${rarity}`,
    type: 'map_item',
    slot: 'map',
    rarity,
    color: MAP_ITEM_COLORS[rarity],
    gridW: 1,
    gridH: 1,
    name,
    description: 'Place into the Map Device to open a portal to a new instance.',
    mapTier: tier,
    mapTheme: theme,
    mapMods: mods,
    mapItemLevel,
    affixes: mods,
    baseStats: {
      mapTier: tier,
      mapItemLevel,
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

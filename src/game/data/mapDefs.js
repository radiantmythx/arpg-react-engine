export const FREE_MAPS = [
  {
    id: 'act1_fallen_cloister',
    name: 'Act I: The Fallen Cloister',
    tier: 1,
    description: 'Shattered halls and corrupted acolytes.',
    theme: 'ruins',
    unlockReq: null,
    packsPerRoom: 2,
    difficulty: 1.0,
    rewards: { xpMult: 1.0, itemLevel: 4 },
    bossId: 'HOLLOW_SOVEREIGN',
    enemyPool: [
      { id: 'RHOA', weight: 3 },
      { id: 'RATTLING_REMNANT', weight: 3 },
      { id: 'UNDYING_THRALL', weight: 2 },
    ],
  },
  {
    id: 'act2_scorched_foothills',
    name: 'Act II: Scorched Foothills',
    tier: 2,
    description: 'Ash storms sweep through abandoned war camps.',
    theme: 'wastes',
    unlockReq: 'act1_fallen_cloister',
    packsPerRoom: 2,
    difficulty: 1.2,
    rewards: { xpMult: 1.08, itemLevel: 8 },
    bossId: 'UNDYING_TIDE',
    enemyPool: [
      { id: 'RHOA', weight: 2 },
      { id: 'UNDYING_THRALL', weight: 3 },
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
    ],
  },
  {
    id: 'act3_sunken_archive',
    name: 'Act III: The Sunken Archive',
    tier: 3,
    description: 'Flooded vaults guard forbidden arcana.',
    theme: 'archive',
    unlockReq: 'act2_scorched_foothills',
    packsPerRoom: 3,
    difficulty: 1.4,
    rewards: { xpMult: 1.15, itemLevel: 12 },
    bossId: 'WRAECLASTS_CHOSEN',
    enemyPool: [
      { id: 'UNDYING_THRALL', weight: 2 },
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 1 },
    ],
  },
  {
    id: 'act4_blighted_cathedral',
    name: 'Act IV: Blighted Cathedral',
    tier: 4,
    description: 'A desecrated sanctuary ruled by zealot champions.',
    theme: 'cathedral',
    unlockReq: 'act3_sunken_archive',
    packsPerRoom: 3,
    difficulty: 1.7,
    rewards: { xpMult: 1.22, itemLevel: 16 },
    bossId: 'THE_STARVELING',
    enemyPool: [
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 2 },
      { id: 'SHADE', weight: 2 },
    ],
  },
  {
    id: 'act5_throne_of_embers',
    name: 'Act V: Throne of Embers',
    tier: 5,
    description: 'The final ascent through a burning citadel.',
    theme: 'abyss',
    unlockReq: 'act4_blighted_cathedral',
    packsPerRoom: 4,
    difficulty: 2.0,
    rewards: { xpMult: 1.3, itemLevel: 20 },
    bossId: 'ABYSSAL_ENGINE',
    enemyPool: [
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 2 },
      { id: 'SHADE', weight: 2 },
      { id: 'IRON_COLOSSUS', weight: 1 },
    ],
  },
];

export const MAP_MOD_POOL = {
  prefix: [
    { id: 'pack_size', type: 'prefix', label: '+30% more enemy packs per room', value: 1.3 },
    { id: 'enemy_life', type: 'prefix', label: 'Enemies have +50% maximum life', value: 1.5 },
    { id: 'enemy_speed', type: 'prefix', label: 'Enemies are 20% faster', value: 1.2 },
    { id: 'area_of_effect', type: 'prefix', label: 'Enemy area attacks gain +40% radius', value: 1.4 },
    { id: 'extra_champion_packs', type: 'prefix', label: '+3 additional champion packs', value: 3 },
  ],
  suffix: [
    { id: 'reduced_player_regen', type: 'suffix', label: 'Players cannot regenerate life', value: true },
    { id: 'elemental_weakness', type: 'suffix', label: 'Players have -25% elemental resistances', value: -25 },
  ],
  special: [
    { id: 'corrupted', type: 'special', label: 'Corrupted: gains one additional random modifier', value: true },
  ],
};

function sampleDistinct(pool, count) {
  const copy = [...pool];
  const out = [];
  while (copy.length && out.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

export function rollMapMods(rarity = 'magic') {
  const mods = [];

  if (rarity === 'unique') return mods;

  const prefixCount = rarity === 'rare' ? 3 : 1;
  const suffixCount = rarity === 'rare' ? 3 : 1;
  mods.push(...sampleDistinct(MAP_MOD_POOL.prefix, prefixCount));
  mods.push(...sampleDistinct(MAP_MOD_POOL.suffix, suffixCount));

  // Small corruption chance on non-unique maps.
  if (Math.random() < 0.08) {
    mods.push(MAP_MOD_POOL.special[0]);
    const extraPool = [...MAP_MOD_POOL.prefix, ...MAP_MOD_POOL.suffix]
      .filter((cand) => !mods.some((m) => m.id === cand.id));
    if (extraPool.length) {
      mods.push(extraPool[Math.floor(Math.random() * extraPool.length)]);
    }
  }

  return mods;
}

export function getFreeMapById(id) {
  return FREE_MAPS.find((m) => m.id === id) ?? null;
}

export function isFreeMapUnlocked(mapDef, actsCleared = []) {
  if (!mapDef?.unlockReq) return true;
  return actsCleared.includes(mapDef.unlockReq);
}

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

  if (Math.random() < 0.08) {
    mods.push(MAP_MOD_POOL.special[0]);
    const extraPool = [...MAP_MOD_POOL.prefix, ...MAP_MOD_POOL.suffix]
      .filter((cand) => !mods.some((mod) => mod.id === cand.id));
    if (extraPool.length) {
      mods.push(extraPool[Math.floor(Math.random() * extraPool.length)]);
    }
  }

  return mods;
}

import { listGenericItemDefs } from '../src/game/content/registries/itemRegistry.js';
import { getAffixCapsForRarity } from '../src/game/data/rarityProfiles.js';
import { generateItem } from '../src/game/data/itemGenerator.js';

const SAMPLE_SIZE = 2500;
const RARITIES = ['normal', 'magic', 'rare'];
const GENERIC_ITEM_DEFS = listGenericItemDefs();
const SEEDED_RUN = 1337;

function createSeededRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function run() {
  const rng = createSeededRng(SEEDED_RUN);
  const perRarity = Object.fromEntries(RARITIES.map((r) => [r, {
    count: 0,
    explicitCountTotal: 0,
    implicitCountTotal: 0,
    prefixes: 0,
    suffixes: 0,
    tiers: {},
  }]));
  const goldValues = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const rarity = RARITIES[i % RARITIES.length];
    const base = GENERIC_ITEM_DEFS[Math.floor(rng() * GENERIC_ITEM_DEFS.length)];
    const itemLevel = 1 + Math.floor(rng() * 100);
    const item = generateItem(base, rarity, { itemLevel, rng });

    const expectedCaps = getAffixCapsForRarity(rarity);
    const explicitAffixes = Array.isArray(item.explicitAffixes) ? item.explicitAffixes : [];
    const implicitAffixes = Array.isArray(item.implicitAffixes) ? item.implicitAffixes : [];
    const prefixCount = explicitAffixes.filter((a) => a.type === 'prefix').length;
    const suffixCount = explicitAffixes.filter((a) => a.type === 'suffix').length;

    perRarity[rarity].count++;
    perRarity[rarity].explicitCountTotal += explicitAffixes.length;
    perRarity[rarity].implicitCountTotal += implicitAffixes.length;
    perRarity[rarity].prefixes += prefixCount;
    perRarity[rarity].suffixes += suffixCount;

    if (prefixCount > expectedCaps.prefix || suffixCount > expectedCaps.suffix) {
      throw new Error(`Affix cap mismatch for rarity ${rarity}: expected <= ${expectedCaps.prefix}/${expectedCaps.suffix}, got ${prefixCount}/${suffixCount}`);
    }

    for (const a of item.affixes) {
      if (!a?.id || !a?.tier) {
        throw new Error(`Generated affix missing canonical fields: ${JSON.stringify(a)}`);
      }
      if (typeof a.goldValue !== 'number' || a.goldValue < 0) {
        throw new Error(`Generated affix has invalid goldValue: ${JSON.stringify(a)}`);
      }
      perRarity[rarity].tiers[a.tier] = (perRarity[rarity].tiers[a.tier] ?? 0) + 1;
      goldValues.push(a.goldValue);
    }
  }

  const avgGold = goldValues.length
    ? goldValues.reduce((s, n) => s + n, 0) / goldValues.length
    : 0;

  console.log('Item generation sanity simulation passed.');
  for (const rarity of RARITIES) {
    const row = perRarity[rarity];
    const avgExplicit = row.count ? (row.explicitCountTotal / row.count).toFixed(2) : '0.00';
    const avgImplicit = row.count ? (row.implicitCountTotal / row.count).toFixed(2) : '0.00';
    const tierSummary = Object.entries(row.tiers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tier, count]) => `${tier}=${count}`)
      .join(' ');
    console.log(`- ${rarity}: samples=${row.count}, avgExplicit=${avgExplicit}, avgImplicit=${avgImplicit}, prefixes=${row.prefixes}, suffixes=${row.suffixes}`);
    console.log(`  tiers ${tierSummary || 'none'}`);
  }
  console.log(`- Affix gold values sampled: count=${goldValues.length}, avg=${avgGold.toFixed(2)}`);
}

run();

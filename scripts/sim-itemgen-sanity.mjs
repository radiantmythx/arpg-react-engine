import { listGenericItemDefs } from '../src/game/content/registries/itemRegistry.js';
import { generateItem } from '../src/game/data/itemGenerator.js';
import { getAffixCountForRarity } from '../src/game/data/rarityProfiles.js';

const SAMPLE_SIZE = 2500;
const RARITIES = ['normal', 'magic', 'rare'];
const GENERIC_ITEM_DEFS = listGenericItemDefs();

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function run() {
  const perRarity = Object.fromEntries(RARITIES.map((r) => [r, { count: 0, affixCountTotal: 0 }]));
  const goldValues = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const rarity = RARITIES[i % RARITIES.length];
    const base = pickRandom(GENERIC_ITEM_DEFS);
    const item = generateItem(base, rarity);

    const expected = getAffixCountForRarity(rarity);
    const got = Array.isArray(item.affixes) ? item.affixes.length : 0;

    perRarity[rarity].count++;
    perRarity[rarity].affixCountTotal += got;

    if (got !== expected) {
      throw new Error(`Affix count mismatch for rarity ${rarity}: expected ${expected}, got ${got}`);
    }

    for (const a of item.affixes) {
      if (!a?.id || !a?.tier) {
        throw new Error(`Generated affix missing canonical fields: ${JSON.stringify(a)}`);
      }
      if (typeof a.goldValue !== 'number' || a.goldValue < 0) {
        throw new Error(`Generated affix has invalid goldValue: ${JSON.stringify(a)}`);
      }
      goldValues.push(a.goldValue);
    }
  }

  const avgGold = goldValues.length
    ? goldValues.reduce((s, n) => s + n, 0) / goldValues.length
    : 0;

  console.log('Item generation sanity simulation passed.');
  for (const rarity of RARITIES) {
    const row = perRarity[rarity];
    const avgAffixes = row.count ? (row.affixCountTotal / row.count).toFixed(2) : '0.00';
    console.log(`- ${rarity}: samples=${row.count}, avgAffixes=${avgAffixes}`);
  }
  console.log(`- Affix gold values sampled: count=${goldValues.length}, avg=${avgGold.toFixed(2)}`);
}

run();

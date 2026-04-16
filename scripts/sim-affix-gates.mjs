import { SCALING_CONFIG, clampAreaLevel } from '../src/game/config/scalingConfig.js';
import {
  AFFIX_TIERS,
  ALL_AFFIX_POOL,
  affixMatchesItemContext,
  affixTierGate,
  getAffixLevelBracket,
  isAffixTierUnlocked,
  unlockedAffixTiers,
} from '../src/game/data/affixes.js';
import { buildAffixItemContext, generateItem } from '../src/game/data/itemGenerator.js';
import { listGenericItemDefs } from '../src/game/content/registries/itemRegistry.js';

const CHECKPOINTS = [1, 25, 50, 75, 90, 100];
const SAMPLE_PER_LEVEL = 200;
const genericBases = listGenericItemDefs();

function createSeededRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function countByTier(rows) {
  const counts = Object.fromEntries(AFFIX_TIERS.map((tier) => [tier, 0]));
  for (const row of rows) {
    counts[row.tier] = (counts[row.tier] ?? 0) + 1;
  }
  return counts;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function printPoolAvailability(itemLevel) {
  const itemContext = buildAffixItemContext(genericBases[0], itemLevel);
  const unlocked = new Set(unlockedAffixTiers(itemLevel));
  const unlockedAffixes = ALL_AFFIX_POOL.filter((a) => unlocked.has(a.tier) && affixMatchesItemContext(a, itemContext));
  const counts = countByTier(unlockedAffixes);

  const tierState = AFFIX_TIERS
    .map((tier) => `${tier}:${isAffixTierUnlocked(itemLevel, tier) ? 'on' : 'off'}(>=${affixTierGate(tier)})`)
    .join(' ');

  console.log(`\n[Pool] iLvl ${itemLevel}`);
  console.log(`  gates ${tierState}`);
  console.log(
    `  available affixes ${AFFIX_TIERS.map((tier) => `${tier}=${counts[tier]}`).join(' ')}`,
  );
}

function verifyGeneratedItems(itemLevel) {
  const rng = createSeededRng(9000 + itemLevel);
  const rolledCounts = Object.fromEntries(AFFIX_TIERS.map((tier) => [tier, 0]));

  for (let i = 0; i < SAMPLE_PER_LEVEL; i += 1) {
    const base = genericBases[Math.floor(rng() * genericBases.length)];
    const rarity = i % 3 === 0 ? 'rare' : 'magic';
    const item = generateItem(base, rarity, { itemLevel, rng });
    const context = buildAffixItemContext(base, itemLevel);
    const seenGroups = new Set();
    const seenFamilies = new Set();

    for (const affix of item.affixes ?? []) {
      if (!isAffixTierUnlocked(itemLevel, affix.tier)) {
        throw new Error(
          `Gate violation: iLvl ${itemLevel} rolled ${affix.id} tier=${affix.tier} (gate ${affixTierGate(affix.tier)})`,
        );
      }
      if (!affixMatchesItemContext(affix, context)) {
        throw new Error(`Pool violation: iLvl ${itemLevel} rolled ${affix.id} outside eligible pool for ${base.id}`);
      }
      if (affix.kind !== 'implicit') {
        if (seenGroups.has(affix.group)) throw new Error(`Conflict violation: duplicate group ${affix.group} on ${base.id}`);
        if (seenFamilies.has(affix.family)) throw new Error(`Conflict violation: duplicate family ${affix.family} on ${base.id}`);
        seenGroups.add(affix.group);
        seenFamilies.add(affix.family);
      }
      rolledCounts[affix.tier] = (rolledCounts[affix.tier] ?? 0) + 1;
    }
  }

  console.log(
    `  rolled tiers (${SAMPLE_PER_LEVEL} samples): ${AFFIX_TIERS.map((tier) => `${tier}=${rolledCounts[tier]}`).join(' ')}`,
  );
}

function main() {
  console.log('=== Affix Pool Legality Simulation (Phase 7) ===');
  console.log(`Config version: ${SCALING_CONFIG.version}`);
  console.log(`Configured gates: ${AFFIX_TIERS.map((tier) => `${tier}:${affixTierGate(tier)}`).join(', ')}`);

  for (const checkpoint of CHECKPOINTS) {
    const itemLevel = clampAreaLevel(checkpoint);
    console.log(`  bracket=${getAffixLevelBracket(itemLevel)}`);
    printPoolAvailability(itemLevel);
    verifyGeneratedItems(itemLevel);
  }

  console.log('\nAffix legality simulation passed. No out-of-gate or out-of-pool affixes were generated.');
}

main();

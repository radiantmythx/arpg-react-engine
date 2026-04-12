import { SCALING_CONFIG, clampAreaLevel } from '../src/game/config/scalingConfig.js';
import {
  AFFIX_POOL,
  AFFIX_TIERS,
  affixTierGate,
  isAffixTierUnlocked,
  unlockedAffixTiers,
} from '../src/game/data/affixes.js';
import { generateItem } from '../src/game/data/itemGenerator.js';
import { listGenericItemDefs } from '../src/game/content/registries/itemRegistry.js';

const CHECKPOINTS = [1, 25, 50, 75, 90, 100];
const SAMPLE_PER_LEVEL = 200;
const genericBases = listGenericItemDefs();

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
  const unlocked = new Set(unlockedAffixTiers(itemLevel));
  const unlockedAffixes = AFFIX_POOL.filter((a) => unlocked.has(a.tier));
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
  const rolledCounts = Object.fromEntries(AFFIX_TIERS.map((tier) => [tier, 0]));

  for (let i = 0; i < SAMPLE_PER_LEVEL; i += 1) {
    const base = pickRandom(genericBases);
    const rarity = i % 3 === 0 ? 'rare' : 'magic';
    const item = generateItem(base, rarity, { itemLevel });

    for (const affix of item.affixes ?? []) {
      if (!isAffixTierUnlocked(itemLevel, affix.tier)) {
        throw new Error(
          `Gate violation: iLvl ${itemLevel} rolled ${affix.id} tier=${affix.tier} (gate ${affixTierGate(affix.tier)})`,
        );
      }
      rolledCounts[affix.tier] = (rolledCounts[affix.tier] ?? 0) + 1;
    }
  }

  console.log(
    `  rolled tiers (${SAMPLE_PER_LEVEL} samples): ${AFFIX_TIERS.map((tier) => `${tier}=${rolledCounts[tier]}`).join(' ')}`,
  );
}

function main() {
  console.log('=== Affix iLvl Gate Simulation (Phase 6) ===');
  console.log(`Config version: ${SCALING_CONFIG.version}`);
  console.log(`Configured gates: ${AFFIX_TIERS.map((tier) => `${tier}:${affixTierGate(tier)}`).join(', ')}`);

  for (const checkpoint of CHECKPOINTS) {
    const itemLevel = clampAreaLevel(checkpoint);
    printPoolAvailability(itemLevel);
    verifyGeneratedItems(itemLevel);
  }

  console.log('\nAffix gate simulation passed. No out-of-gate affixes were generated.');
}

main();

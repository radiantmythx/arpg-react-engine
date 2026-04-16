import { listGenericItemDefs } from '../src/game/content/registries/itemRegistry.js';
import { generateItem } from '../src/game/data/itemGenerator.js';
import { applyCraftingAction, CRAFTING_ACTIONS } from '../src/game/data/itemCrafting.js';
import { getAffixCapsForRarity } from '../src/game/data/rarityProfiles.js';

function createSeededRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assertLegalExplicits(itemDef) {
  const explicitAffixes = Array.isArray(itemDef.explicitAffixes) ? itemDef.explicitAffixes : [];
  const caps = getAffixCapsForRarity(itemDef.rarity ?? 'normal');
  const prefixCount = explicitAffixes.filter((affix) => affix?.type === 'prefix').length;
  const suffixCount = explicitAffixes.filter((affix) => affix?.type === 'suffix').length;
  if (prefixCount > caps.prefix || suffixCount > caps.suffix) {
    throw new Error(`Affix caps exceeded for ${itemDef.name}: ${prefixCount}/${suffixCount} > ${caps.prefix}/${caps.suffix}`);
  }
  const seenGroups = new Set();
  const seenFamilies = new Set();
  for (const affix of explicitAffixes) {
    if (seenGroups.has(affix.group)) throw new Error(`Duplicate affix group ${affix.group}`);
    if (seenFamilies.has(affix.family)) throw new Error(`Duplicate affix family ${affix.family}`);
    seenGroups.add(affix.group);
    seenFamilies.add(affix.family);
  }
}

function main() {
  const bases = listGenericItemDefs();
  const sampleActions = CRAFTING_ACTIONS.map((action) => action.id);
  const masterRng = createSeededRng(424242);

  for (let i = 0; i < 120; i += 1) {
    const base = bases[Math.floor(masterRng() * bases.length)];
    const rarity = i % 2 === 0 ? 'magic' : 'rare';
    const itemLevel = 10 + Math.floor(masterRng() * 90);
    const baseItem = generateItem(base, rarity, { itemLevel, rng: masterRng });

    for (const actionId of sampleActions) {
      const seed = 9000 + i * 17 + actionId.length;
      const first = applyCraftingAction(baseItem, actionId, { rng: createSeededRng(seed) });
      const second = applyCraftingAction(baseItem, actionId, { rng: createSeededRng(seed) });

      const firstKey = JSON.stringify({ ok: first.ok, reason: first.reason, afterItem: first.afterItem ?? null });
      const secondKey = JSON.stringify({ ok: second.ok, reason: second.reason, afterItem: second.afterItem ?? null });
      if (firstKey !== secondKey) {
        throw new Error(`Non-deterministic crafting result for ${actionId} on ${baseItem.name}`);
      }

      if (first.ok) {
        assertLegalExplicits(first.afterItem);
        if (actionId === 'regal_upgrade' && first.afterItem.rarity !== 'rare') {
          throw new Error(`Regal upgrade did not produce a rare item for ${baseItem.name}`);
        }
      }
    }
  }

  console.log('Crafting simulation passed. Results are deterministic and legal across sampled actions.');
}

main();
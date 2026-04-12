/**
 * Item Generator
 * Procedurally generates item definitions by rolling a rarity tier and
 * selecting affixes from the pool to layer on top of the base item stats.
 *
 * Flow:
 *   rollRarity(difficulty, isChampion) → 'normal' | 'magic' | 'rare'
 *   generateItem(baseDef, rarity)      → generated itemDef (plain object)
 *
 * Generated itemDef is compatible with `new PassiveItem(def)` — all stats
 * are pre-merged so PassiveItem.apply() / remove() work with one snapshot.
 */
import { AFFIX_POOL, isAffixTierUnlocked } from './affixes.js';
import { getAffixCountForRarity } from './rarityProfiles.js';
import { ITEM_GENERATION_TUNING } from '../content/tuning/index.js';
import { clampAreaLevel } from '../config/scalingConfig.js';

// Rarity display colors — mirrors PoE naming tiers
export const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

export const RARITY_LABELS = {
  normal: 'Normal',
  magic:  'Magic',
  rare:   'Rare',
  unique: 'Unique',
};

/** The canonical color for Unique-tier items. */
export const UNIQUE_COLOR = '#c86400';

/** Stats that stack multiplicatively; all others stack additively. */
const MULT_STATS = new Set(['damageMult', 'cooldownMult', 'xpMultiplier']);

/**
 * Merge an additional set of affix stats on top of base stats.
 * Multiplicative stats compound; additive stats sum.
 * @param {object} base
 * @param {object} extra
 * @returns {object}
 */
function mergeStats(base, extra) {
  const result = { ...base };
  for (const [key, val] of Object.entries(extra)) {
    if (MULT_STATS.has(key)) {
      result[key] = (result[key] ?? 1) * val;
    } else {
      result[key] = (result[key] ?? 0) + val;
    }
  }
  return result;
}

/**
 * Roll a rarity tier.
 * Rare and Magic chances scale up with difficulty (1–5).
 * Champions are guaranteed at least Magic rarity.
 *
 * @param {number} difficulty — clipped 1–5
 * @param {boolean} [isChampion]
 * @returns {'normal'|'magic'|'rare'}
 */
export function rollRarity(difficulty, isChampion = false) {
  const t = Math.min(Math.max((difficulty - 1) / 4, 0), 1); // 0 at diff=1, 1 at diff=5

  // Rare:  5% at difficulty 1 → 25% at difficulty 5
  // Magic: 25% at difficulty 1 → 45% at difficulty 5
  const rareChance  = ITEM_GENERATION_TUNING.rareChanceBase + t * 0.20;
  const magicChance = ITEM_GENERATION_TUNING.magicChanceBase + t * 0.20;

  const roll = Math.random();
  let rarity;
  if (roll < rareChance) {
    rarity = 'rare';
  } else if (roll < rareChance + magicChance) {
    rarity = 'magic';
  } else {
    rarity = 'normal';
  }

  // Champions always at least Magic
  if (isChampion && rarity === 'normal') rarity = 'magic';

  return rarity;
}

function resolveItemLevel(baseDef, options = {}) {
  const raw =
    options.itemLevel
    ?? baseDef?.itemLevel
    ?? baseDef?.baseStats?.itemLevel
    ?? baseDef?.mapItemLevel
    ?? 1;
  return clampAreaLevel(raw);
}

/**
 * Generate a procedural item definition.
 *
 * @param {object} baseDef — raw entry from ITEM_DEFS (items.js)
 * @param {'normal'|'magic'|'rare'} rarity
 * @param {{itemLevel?: number}} [options]
 * @returns {object} generated itemDef — a plain config object accepted by PassiveItem
 */
export function generateItem(baseDef, rarity, options = {}) {
  const itemLevel = resolveItemLevel(baseDef, options);

  // Unique items bypass the affix roller entirely
  if (baseDef.isUnique) {
    return {
      ...baseDef,
      uid:       crypto.randomUUID(),
      rarity:    'unique',
      color:     UNIQUE_COLOR,
      baseColor: baseDef.color,
      itemLevel,
      affixes:   [],
      baseStats: baseDef.stats,
    };
  }

  const count = getAffixCountForRarity(rarity);

  // Filter eligible affixes by slot, then by defenseType if the affix requires it
  const baseDefenseTypes = baseDef.defenseType ? baseDef.defenseType.split('/') : [];
  const eligible = AFFIX_POOL
    .filter((a) => {
      if (!a.slots.includes(baseDef.slot)) return false;
      if (!isAffixTierUnlocked(itemLevel, a.tier)) return false;
      // If the affix has a defenseTypes restriction, the base must match at least one
      if (a.defenseTypes) {
        return a.defenseTypes.some((dt) => baseDefenseTypes.includes(dt));
      }
      return true;
    })
    .sort(() => Math.random() - 0.5);

  // Pick up to `count` affixes, one per stat key (no duplicate stats)
  const chosen = [];
  const usedStats = new Set();
  for (const affix of eligible) {
    if (chosen.length >= count) break;
    if (usedStats.has(affix.stat)) continue;
    chosen.push(affix);
    usedStats.add(affix.stat);
  }

  // Build the extra stat map from chosen affixes
  const affixStats = {};
  for (const affix of chosen) {
    if (MULT_STATS.has(affix.stat)) {
      affixStats[affix.stat] = (affixStats[affix.stat] ?? 1) * affix.value;
    } else {
      affixStats[affix.stat] = (affixStats[affix.stat] ?? 0) + affix.value;
    }
  }

  return {
    ...baseDef,
    uid:       crypto.randomUUID(),
    rarity,
    // Override color with rarity tier color so HUD slots reflect rarity visually
    color:     RARITY_COLORS[rarity],
    // Preserve original item color for possible future icon use
    baseColor: baseDef.color,
    itemLevel,
    affixes:   chosen.map((a) => ({
      id: a.id,
      type: a.type,
      label: a.label,
      stat: a.stat,
      value: a.value,
      tier: a.tier,
      goldValue: a.goldValue,
      weight: a.weight,
      tags: a.tags,
    })),
    stats:     mergeStats(baseDef.stats, affixStats),
    baseStats: baseDef.stats,
  };
}

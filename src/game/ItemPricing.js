/**
 * ItemPricing.js
 * Gold value calculation for items and affixes.
 * Used by vendor sell system to determine item liquidation value.
 */

import { AFFIX_BY_ID } from './data/affixes.js';

/** Base prices by item slot (used if item doesn't have explicit basePrice). */
const DEFAULT_BASE_PRICES = {
  weapon: 12,
  armor: 10,
  helmet: 6,
  boots: 6,
  offhand: 6,
  jewelry: 3,
};

/** Default gold value for affixes (used if not defined on affix). */
const DEFAULT_AFFIX_PRICES = {
  minor: 2,
  major: 5,
};

/** Get base sell price for an item. */
export function getBaseItemPrice(itemDef) {
  if (!itemDef) return 0;
  // If the item has an explicit basePrice, use it
  if (typeof itemDef.basePrice === 'number') {
    return itemDef.basePrice;
  }
  // Fall back to slot-based defaults
  const slot = itemDef.slot ?? 'jewelry';
  return DEFAULT_BASE_PRICES[slot] ?? 3;
}

/** Get the list of active affixes on an item (those with a defined goldValue). */
export function getAffixesWithPrice(itemDef) {
  if (!itemDef || !Array.isArray(itemDef.affixes)) {
    return [];
  }

  return itemDef.affixes
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return AFFIX_BY_ID[entry] ?? null;
      }
      if (typeof entry === 'object') {
        return entry.id ? (AFFIX_BY_ID[entry.id] ?? entry) : entry;
      }
      return null;
    })
    .filter((a) => a !== null);
}

/** Get gold value for one affix. Scales by tier (minor/major). */
export function getAffixPrice(affix) {
  if (!affix) return 0;
  // If affix has explicit goldValue, use it
  if (typeof affix.goldValue === 'number') {
    return affix.goldValue;
  }
  // Fall back to tier-based defaults.
  if (affix.tier === 'minor') return DEFAULT_AFFIX_PRICES.minor;
  if (affix.tier === 'major') return DEFAULT_AFFIX_PRICES.major;
  if (affix.tier === 'epic') return 8;
  // Legacy id-based fallback for older saves/content.
  if (affix.id && affix.id.includes('_minor')) {
    return DEFAULT_AFFIX_PRICES.minor;
  }
  if (affix.id && affix.id.includes('_major')) {
    return DEFAULT_AFFIX_PRICES.major;
  }
  return DEFAULT_AFFIX_PRICES.major; // Default to major
}

/** Calculate total sell price: base + sum of all affix values. */
export function calcSellPrice(itemDef) {
  if (!itemDef) return 0;

  const basePrice = getBaseItemPrice(itemDef);
  const affixes = getAffixesWithPrice(itemDef);
  const affixTotal = affixes.reduce((sum, affix) => sum + getAffixPrice(affix), 0);

  return Math.max(1, basePrice + affixTotal);
}

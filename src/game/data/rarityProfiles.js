/**
 * Rarity profiles centralize procedural item-generation rules.
 * Phase 6: affix count and roll weight are data-driven, not hardcoded.
 */

export const ITEM_RARITY_PROFILES = {
  normal: {
    affixCount: 0,
    affixCaps: { prefix: 0, suffix: 0 },
    rollWeight: 70,
  },
  magic: {
    affixCount: 2,
    affixCaps: { prefix: 1, suffix: 1 },
    rollWeight: 24,
  },
  rare: {
    affixCount: 6,
    affixCaps: { prefix: 3, suffix: 3 },
    rollWeight: 6,
  },
  unique: {
    affixCount: 0,
    affixCaps: { prefix: 0, suffix: 0 },
    rollWeight: 0,
  },
};

export function getAffixCountForRarity(rarity = 'normal') {
  return ITEM_RARITY_PROFILES[rarity]?.affixCount ?? 0;
}

export function getAffixCapsForRarity(rarity = 'normal') {
  const caps = ITEM_RARITY_PROFILES[rarity]?.affixCaps ?? { prefix: 0, suffix: 0 };
  return {
    prefix: Math.max(0, Math.floor(caps.prefix ?? 0)),
    suffix: Math.max(0, Math.floor(caps.suffix ?? 0)),
  };
}

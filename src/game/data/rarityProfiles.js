/**
 * Rarity profiles centralize procedural item-generation rules.
 * Phase 6: affix count and roll weight are data-driven, not hardcoded.
 */

export const ITEM_RARITY_PROFILES = {
  normal: {
    affixCount: 0,
    rollWeight: 70,
  },
  magic: {
    affixCount: 1,
    rollWeight: 24,
  },
  rare: {
    affixCount: 2,
    rollWeight: 6,
  },
  unique: {
    affixCount: 0,
    rollWeight: 0,
  },
};

export function getAffixCountForRarity(rarity = 'normal') {
  return ITEM_RARITY_PROFILES[rarity]?.affixCount ?? 0;
}

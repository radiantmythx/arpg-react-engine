import { getAffixCapsForRarity } from './rarityProfiles.js';
import { affixTierGate, isAffixTierUnlocked } from './affixes.js';
import {
  buildExplicitCandidates,
  buildImplicitCandidates,
  hydrateItemAffixState,
  normalizeAffixForItem,
  rollTierForCandidates,
  RARITY_COLORS,
  weightRollWithRng,
} from './itemGenerator.js';
import { MAP_MOD_POOL } from '../content/maps/mapMods.js';
import { normalizeWeaponItem } from './weaponTypes.js';

export const CRAFTING_ACTIONS = [
  { id: 'reroll_implicits', label: 'Reroll Implicits', description: 'Roll a fresh implicit set from the item base pool.' },
  { id: 'reroll_prefixes', label: 'Reroll Prefixes', description: 'Keep suffixes, replace all prefixes with new rolls.' },
  { id: 'reroll_suffixes', label: 'Reroll Suffixes', description: 'Keep prefixes, replace all suffixes with new rolls.' },
  { id: 'augment', label: 'Augment', description: 'Add one legal explicit affix if there is room.' },
  { id: 'regal_upgrade', label: 'Regal Upgrade', description: 'Upgrade a magic item to rare and add one legal explicit affix.' },
  { id: 'transmute', label: 'Transmute', description: 'Upgrade a normal item to magic and add one explicit affix.' },
  { id: 'alteration', label: 'Alteration', description: 'Reroll all explicit affixes on a magic item.' },
  { id: 'chaos_reroll', label: 'Chaos Orb', description: 'Reroll all explicit affixes on a rare item.' },
  { id: 'annul', label: 'Annul', description: 'Remove one random explicit affix from the item.' },
];

const CRAFTING_ACTION_BY_ID = Object.fromEntries(CRAFTING_ACTIONS.map((action) => [action.id, action]));

const MAP_MOD_TIER_BY_ID = {
  pack_size: 'major',
  enemy_life: 'advanced',
  enemy_speed: 'major',
  area_of_effect: 'advanced',
  extra_champion_packs: 'high',
  twisting: 'minor',
  fortified: 'minor',
  flooded: 'minor',
  overgrown: 'minor',
  volatile: 'minor',
  reduced_player_regen: 'high',
  elemental_weakness: 'advanced',
};

const MAP_MOD_WEIGHT_BY_TIER = {
  minor: 100,
  major: 65,
  advanced: 45,
  high: 30,
  pinnacle: 18,
};

const MAP_EXPLICIT_CRAFTING_POOL = [
  ...(MAP_MOD_POOL.prefix ?? []),
  ...(MAP_MOD_POOL.suffix ?? []),
].map((mod) => {
  const tier = MAP_MOD_TIER_BY_ID[mod.id] ?? 'major';
  return {
    ...mod,
    kind: 'explicit',
    slots: ['map'],
    family: `map_${mod.id}`,
    group: `map_${mod.type}:${mod.id}`,
    tier,
    minItemLevel: Math.max(1, Math.floor(affixTierGate(tier))),
    weight: MAP_MOD_WEIGHT_BY_TIER[tier] ?? 45,
  };
});

function cloneItem(itemDef) {
  return structuredClone(itemDef);
}

function splitExplicits(itemDef = {}) {
  const explicitAffixes = Array.isArray(itemDef.explicitAffixes) ? itemDef.explicitAffixes : [];
  return {
    prefixes: explicitAffixes.filter((affix) => affix?.type === 'prefix'),
    suffixes: explicitAffixes.filter((affix) => affix?.type === 'suffix'),
  };
}

function describeBlockedReason(reason, itemDef, action) {
  const actionLabel = action?.label ?? 'Crafting action';
  switch (reason) {
    case 'missing_item':
      return 'Select an equipped item first.';
    case 'unknown_action':
      return 'Unknown crafting action.';
    case 'unique_item':
      return 'Unique items cannot be modified at the bench.';
    case 'no_implicit_pool':
      return `${actionLabel} failed because this base has no implicit pool.`;
    case 'no_prefixes':
      return 'This item has no prefixes to reroll.';
    case 'no_suffixes':
      return 'This item has no suffixes to reroll.';
    case 'no_open_affix_slot':
      return 'This item has no open affix slot for an augment.';
    case 'regal_requires_magic':
      return 'Regal Upgrade requires a magic item.';
    case 'chaos_requires_rare':
      return 'Chaos Orb requires a Rare item.';
    case 'augment_requires_magic':
      return 'Orb of Augmentation requires a Magic item.';
    case 'no_legal_affix':
      return `No legal ${action?.label?.toLowerCase() ?? 'crafting'} outcome exists for this item.`;
    default:
      return `${actionLabel} was blocked for ${itemDef?.name ?? 'this item'}.`;
  }
}

function pickAffix(options, itemLevel, rng) {
  const chosenTier = rollTierForCandidates(options, itemLevel, rng);
  const tierOptions = chosenTier
    ? options.filter((candidate) => candidate.tier === chosenTier)
    : options;
  return weightRollWithRng(tierOptions, rng);
}

function rollExplicitSet(baseItem, itemLevel, rng, preservedExplicitAffixes = [], type, count) {
  const blockedGroups = new Set(preservedExplicitAffixes.map((affix) => affix?.group).filter(Boolean));
  const blockedFamilies = new Set(preservedExplicitAffixes.map((affix) => affix?.family).filter(Boolean));
  const chosen = [];
  const candidates = buildCraftingExplicitCandidates(baseItem, itemLevel);

  for (let i = 0; i < count; i += 1) {
    const options = candidates.filter((affix) => affix.type === type
      && !blockedGroups.has(affix.group)
      && !blockedFamilies.has(affix.family));
    if (!options.length) break;
    const rolled = pickAffix(options, itemLevel, rng);
    if (!rolled) break;
    chosen.push(normalizeAffixForItem(rolled, rng));
    blockedGroups.add(rolled.group);
    blockedFamilies.add(rolled.family);
  }

  return chosen;
}

function rollSingleAugment(baseItem, itemLevel, rarity, rng, explicitAffixes) {
  const caps = getAffixCapsForRarity(rarity);
  const prefixCount = explicitAffixes.filter((affix) => affix?.type === 'prefix').length;
  const suffixCount = explicitAffixes.filter((affix) => affix?.type === 'suffix').length;
  const allowedTypes = [];
  if (prefixCount < caps.prefix) allowedTypes.push('prefix');
  if (suffixCount < caps.suffix) allowedTypes.push('suffix');
  if (allowedTypes.length === 0) return { ok: false, reason: 'no_open_affix_slot' };

  const chosenType = allowedTypes.length === 1
    ? allowedTypes[0]
    : weightRollWithRng(allowedTypes.map((type) => ({ type, weight: 1 })), rng)?.type;
  const rolled = rollExplicitSet(baseItem, itemLevel, rng, explicitAffixes, chosenType, 1);
  if (!rolled.length) return { ok: false, reason: 'no_legal_affix' };
  return { ok: true, affix: rolled[0] };
}

function finalizeCraftedItem(baseItem, rarity, explicitAffixes, implicitAffixes) {
  // Enforce rarity-driven affix caps before hydration.
  const caps = getAffixCapsForRarity(rarity);
  const clampedExplicit = [
    ...explicitAffixes.filter((a) => a.type === 'prefix').slice(0, caps.prefix),
    ...explicitAffixes.filter((a) => a.type === 'suffix').slice(0, caps.suffix),
  ];

  if (clampedExplicit.length !== explicitAffixes.length) {
    console.warn(
      `[itemCrafting] Affix cap exceeded for rarity "${rarity}" `
      + `(caps ${caps.prefix}p/${caps.suffix}s). `
      + `Dropped ${explicitAffixes.length - clampedExplicit.length} affix(es).`
    );
  }

  const hydrated = hydrateItemAffixState({
    ...cloneItem(baseItem),
    rarity,
    color: RARITY_COLORS[rarity] ?? baseItem.color,
    explicitAffixes: clampedExplicit,
    implicitAffixes,
  });
  const normalized = normalizeWeaponItem(hydrated);
  if (!isMapCraftingItem(normalized)) return normalized;

  const mapMods = (normalized.explicitAffixes ?? []).map((affix) => ({
    id: affix.id,
    type: affix.type,
    label: affix.label,
    value: affix.value,
    tier: affix.tier ?? null,
  }));

  return {
    ...normalized,
    // Map instances consume mapMods; keep it synced with crafted explicit affixes.
    mapMods,
    affixes: [...mapMods],
    implicitAffixes: [],
    baseStats: {
      ...(normalized.baseStats ?? {}),
      modCount: mapMods.length,
    },
  };
}

export function applyCraftingAction(itemDef, actionId, options = {}) {
  const action = CRAFTING_ACTION_BY_ID[actionId] ?? null;
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  if (!itemDef) {
    return { ok: false, reason: 'missing_item', blockedReason: describeBlockedReason('missing_item', null, action), action };
  }
  if (!action) {
    return { ok: false, reason: 'unknown_action', blockedReason: describeBlockedReason('unknown_action', itemDef, action), action: null };
  }

  const current = hydrateItemAffixState(cloneItem(itemDef));
  if (current.isUnique) {
    return { ok: false, reason: 'unique_item', blockedReason: describeBlockedReason('unique_item', current, action), action };
  }

  const itemLevel = current.itemLevel ?? current.baseStats?.itemLevel ?? current.mapItemLevel ?? 1;
  const { prefixes, suffixes } = splitExplicits(current);
  const currentImplicits = Array.isArray(current.implicitAffixes) ? current.implicitAffixes : [];

  if (actionId === 'reroll_implicits') {
    const candidates = buildImplicitCandidates(current, itemLevel);
    if (!candidates.length) {
      return { ok: false, reason: 'no_implicit_pool', blockedReason: describeBlockedReason('no_implicit_pool', current, action), action };
    }
    const rolled = pickAffix(candidates, itemLevel, rng);
    if (!rolled) {
      return { ok: false, reason: 'no_legal_affix', blockedReason: describeBlockedReason('no_legal_affix', current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, current.rarity ?? 'normal', [...prefixes, ...suffixes], [normalizeAffixForItem(rolled, rng)]),
    };
  }

  if (actionId === 'reroll_prefixes') {
    if (prefixes.length === 0) {
      return { ok: false, reason: 'no_prefixes', blockedReason: describeBlockedReason('no_prefixes', current, action), action };
    }
    const rolledPrefixes = rollExplicitSet(current, itemLevel, rng, suffixes, 'prefix', prefixes.length);
    if (rolledPrefixes.length !== prefixes.length) {
      return { ok: false, reason: 'no_legal_affix', blockedReason: describeBlockedReason('no_legal_affix', current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, current.rarity ?? 'normal', [...rolledPrefixes, ...suffixes], currentImplicits),
    };
  }

  if (actionId === 'reroll_suffixes') {
    if (suffixes.length === 0) {
      return { ok: false, reason: 'no_suffixes', blockedReason: describeBlockedReason('no_suffixes', current, action), action };
    }
    const rolledSuffixes = rollExplicitSet(current, itemLevel, rng, prefixes, 'suffix', suffixes.length);
    if (rolledSuffixes.length !== suffixes.length) {
      return { ok: false, reason: 'no_legal_affix', blockedReason: describeBlockedReason('no_legal_affix', current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, current.rarity ?? 'normal', [...prefixes, ...rolledSuffixes], currentImplicits),
    };
  }

  if (actionId === 'augment') {
    if ((current.rarity ?? 'normal') !== 'magic') {
      return { ok: false, reason: 'augment_requires_magic', blockedReason: describeBlockedReason('augment_requires_magic', current, action), action };
    }
    const augment = rollSingleAugment(current, itemLevel, 'magic', rng, [...prefixes, ...suffixes]);
    if (!augment.ok) {
      return { ok: false, reason: augment.reason, blockedReason: describeBlockedReason(augment.reason, current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, 'magic', [...prefixes, ...suffixes, augment.affix], currentImplicits),
    };
  }

  if (actionId === 'regal_upgrade') {
    if ((current.rarity ?? 'normal') !== 'magic') {
      return { ok: false, reason: 'regal_requires_magic', blockedReason: describeBlockedReason('regal_requires_magic', current, action), action };
    }
    const augment = rollSingleAugment(current, itemLevel, 'rare', rng, [...prefixes, ...suffixes]);
    if (!augment.ok) {
      return { ok: false, reason: augment.reason, blockedReason: describeBlockedReason(augment.reason, current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, 'rare', [...prefixes, ...suffixes, augment.affix], currentImplicits),
    };
  }

  if (actionId === 'transmute') {
    if ((current.rarity ?? 'normal') !== 'normal') {
      return { ok: false, reason: 'transmute_requires_normal', blockedReason: 'Orb of Transmutation requires a Normal item.', action };
    }
    const augment = rollSingleAugment(current, itemLevel, 'magic', rng, []);
    if (!augment.ok) {
      return { ok: false, reason: augment.reason, blockedReason: describeBlockedReason(augment.reason, current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, 'magic', [augment.affix], currentImplicits),
    };
  }

  if (actionId === 'alteration') {
    if ((current.rarity ?? 'normal') !== 'magic') {
      return { ok: false, reason: 'alteration_requires_magic', blockedReason: 'Orb of Alteration requires a Magic item.', action };
    }
    const caps = getAffixCapsForRarity('magic');
    const targetCount = prefixes.length + suffixes.length;
    if (targetCount === 0) {
      return { ok: false, reason: 'no_legal_affix', blockedReason: 'This item has no affixes to reroll.', action };
    }
    // Roll fresh prefix(es) then suffix(es) in same quantity.
    const rolledPrefixes = prefixes.length > 0
      ? rollExplicitSet(current, itemLevel, rng, [], 'prefix', Math.min(prefixes.length, caps.prefix))
      : [];
    const rolledSuffixes = suffixes.length > 0
      ? rollExplicitSet(current, itemLevel, rng, rolledPrefixes, 'suffix', Math.min(suffixes.length, caps.suffix))
      : [];
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, 'magic', [...rolledPrefixes, ...rolledSuffixes], currentImplicits),
    };
  }

  if (actionId === 'chaos_reroll') {
    if ((current.rarity ?? 'normal') !== 'rare') {
      return { ok: false, reason: 'chaos_requires_rare', blockedReason: describeBlockedReason('chaos_requires_rare', current, action), action };
    }
    if (prefixes.length === 0 && suffixes.length === 0) {
      return { ok: false, reason: 'no_legal_affix', blockedReason: 'This item has no affixes to reroll.', action };
    }
    const rareCaps = getAffixCapsForRarity('rare');
    const rolledPrefixes = rollExplicitSet(current, itemLevel, rng, [], 'prefix', rareCaps.prefix);
    const rolledSuffixes = rollExplicitSet(current, itemLevel, rng, rolledPrefixes, 'suffix', rareCaps.suffix);
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, 'rare', [...rolledPrefixes, ...rolledSuffixes], currentImplicits),
    };
  }

  if (actionId === 'annul') {
    const allExplicits = [...prefixes, ...suffixes];
    if (allExplicits.length === 0) {
      return { ok: false, reason: 'no_prefixes', blockedReason: 'This item has no explicit affixes to remove.', action };
    }
    const removeIdx = Math.floor(rng() * allExplicits.length);
    const remaining = allExplicits.filter((_, i) => i !== removeIdx);
    // Rarity downgrades if we strip the last explicit and item was magic.
    const newRarity = remaining.length === 0 && (current.rarity === 'magic') ? 'normal' : (current.rarity ?? 'normal');
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, newRarity, remaining, currentImplicits),
    };
  }

  return { ok: false, reason: 'unknown_action', blockedReason: describeBlockedReason('unknown_action', current, action), action };
}

/**
 * Returns true when the given currency action can legally be applied to `itemDef`.
 * Used by the inventory UI to highlight compatible items when a currency is held.
 * @param {object} itemDef
 * @param {string} currencyAction — e.g. 'transmute', 'augment', 'alteration', 'regal_upgrade', 'annul'
 * @returns {boolean}
 */
export function canApplyCurrencyToItem(itemDef, currencyAction) {
  if (!itemDef || !currencyAction) return false;
  const current = hydrateItemAffixState(cloneItem(itemDef));
  if (current.isUnique) return false;
  if (current.type === 'currency' || current.type === 'skill_gem' || current.type === 'support_gem' || current.type === 'potion') return false;
  const rarity = current.rarity ?? 'normal';
  const allExplicits = Array.isArray(current.explicitAffixes) ? current.explicitAffixes : [];
  const caps = getAffixCapsForRarity(rarity);
  const prefixCount = allExplicits.filter((a) => a?.type === 'prefix').length;
  const suffixCount = allExplicits.filter((a) => a?.type === 'suffix').length;
  const hasOpenSlot = prefixCount < caps.prefix || suffixCount < caps.suffix;
  if (currencyAction === 'transmute') return rarity === 'normal';
  if (currencyAction === 'augment') return rarity === 'magic' && hasOpenSlot;
  if (currencyAction === 'chaos_reroll') return rarity === 'rare' && allExplicits.length > 0;
  if (currencyAction === 'alteration') return rarity === 'magic' && allExplicits.length > 0;
  if (currencyAction === 'regal_upgrade') return rarity === 'magic';
  if (currencyAction === 'annul') return allExplicits.length > 0;
  return false;
}

function isMapCraftingItem(baseItem = {}) {
  return baseItem?.type === 'map_item' || baseItem?.slot === 'map';
}

function buildCraftingExplicitCandidates(baseItem, itemLevel) {
  if (isMapCraftingItem(baseItem)) {
    return MAP_EXPLICIT_CRAFTING_POOL.filter((affix) => isAffixTierUnlocked(itemLevel, affix.tier));
  }
  return buildExplicitCandidates(baseItem, itemLevel);
}
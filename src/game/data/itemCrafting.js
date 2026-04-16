import { getAffixCapsForRarity } from './rarityProfiles.js';
import {
  buildExplicitCandidates,
  buildImplicitCandidates,
  hydrateItemAffixState,
  normalizeAffixForItem,
  rollTierForCandidates,
  RARITY_COLORS,
  weightRollWithRng,
} from './itemGenerator.js';
import { normalizeWeaponItem } from './weaponTypes.js';

export const CRAFTING_ACTIONS = [
  { id: 'reroll_implicits', label: 'Reroll Implicits', description: 'Roll a fresh implicit set from the item base pool.' },
  { id: 'reroll_prefixes', label: 'Reroll Prefixes', description: 'Keep suffixes, replace all prefixes with new rolls.' },
  { id: 'reroll_suffixes', label: 'Reroll Suffixes', description: 'Keep prefixes, replace all suffixes with new rolls.' },
  { id: 'augment', label: 'Augment', description: 'Add one legal explicit affix if there is room.' },
  { id: 'regal_upgrade', label: 'Regal Upgrade', description: 'Upgrade a magic item to rare and add one legal explicit affix.' },
];

const CRAFTING_ACTION_BY_ID = Object.fromEntries(CRAFTING_ACTIONS.map((action) => [action.id, action]));

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
  const candidates = buildExplicitCandidates(baseItem, itemLevel);

  for (let i = 0; i < count; i += 1) {
    const options = candidates.filter((affix) => affix.type === type
      && !blockedGroups.has(affix.group)
      && !blockedFamilies.has(affix.family));
    if (!options.length) break;
    const rolled = pickAffix(options, itemLevel, rng);
    if (!rolled) break;
    chosen.push(normalizeAffixForItem(rolled));
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
  const hydrated = hydrateItemAffixState({
    ...cloneItem(baseItem),
    rarity,
    color: RARITY_COLORS[rarity] ?? baseItem.color,
    explicitAffixes,
    implicitAffixes,
  });
  return normalizeWeaponItem(hydrated);
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
      afterItem: finalizeCraftedItem(current, current.rarity ?? 'normal', [...prefixes, ...suffixes], [normalizeAffixForItem(rolled)]),
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
    const augment = rollSingleAugment(current, itemLevel, current.rarity ?? 'normal', rng, [...prefixes, ...suffixes]);
    if (!augment.ok) {
      return { ok: false, reason: augment.reason, blockedReason: describeBlockedReason(augment.reason, current, action), action };
    }
    return {
      ok: true,
      action,
      beforeItem: current,
      afterItem: finalizeCraftedItem(current, current.rarity ?? 'normal', [...prefixes, ...suffixes, augment.affix], currentImplicits),
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

  return { ok: false, reason: 'unknown_action', blockedReason: describeBlockedReason('unknown_action', current, action), action };
}
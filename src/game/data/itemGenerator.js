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
import {
  AFFIX_BY_ID,
  EXPLICIT_AFFIX_POOL,
  IMPLICIT_AFFIX_POOL,
  affixMatchesItemContext,
  getAffixLevelBracket,
  getTierWeightsForLevelBracket,
  isAffixTierUnlocked,
} from './affixes.js';
import { getAffixCapsForRarity } from './rarityProfiles.js';
import { ITEM_GENERATION_TUNING } from '../content/tuning/index.js';
import { clampAreaLevel } from '../config/scalingConfig.js';
import { normalizeWeaponItem } from './weaponTypes.js';

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
const MULT_STATS = new Set(['damageMult', 'cooldownMult', 'xpMultiplier', 'manaCostMult']);

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

export function mergeAffixStats(base, affixes = []) {
  const result = { ...base };
  for (const affix of affixes) {
    const modifier = affix?.modifier ?? null;
    const statKey = modifier?.statKey ?? affix?.stat;
    const value = modifier?.value ?? affix?.value;
    if (!statKey || value == null) continue;
    const operation = modifier?.operation ?? (MULT_STATS.has(statKey) ? 'multiply' : 'add');
    if (operation === 'multiply') {
      result[statKey] = (result[statKey] ?? 1) * value;
    } else {
      result[statKey] = (result[statKey] ?? 0) + value;
    }
  }
  return result;
}

function weightRoll(candidates = []) {
  return weightRollWithRng(candidates, Math.random);
}

export function weightRollWithRng(candidates = [], rng = Math.random) {
  const total = candidates.reduce((sum, c) => sum + Math.max(0, Number(c.weight ?? 0)), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= Math.max(0, Number(c.weight ?? 0));
    if (roll <= 0) return c;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function buildAffixItemContext(baseDef, itemLevel) {
  const defenseTypes = baseDef.defenseType ? baseDef.defenseType.split('/') : [];
  const levelBracket = getAffixLevelBracket(itemLevel);
  const itemTags = new Set(Array.isArray(baseDef.tags) ? baseDef.tags.filter(Boolean) : []);
  itemTags.add(baseDef.slot);
  itemTags.add(levelBracket);
  if (baseDef.weaponType) {
    itemTags.add(baseDef.weaponType);
    itemTags.add(`${baseDef.weaponType}Weapon`);
  }
  for (const defenseType of defenseTypes) {
    itemTags.add(defenseType);
    itemTags.add(`${defenseType}Defence`);
  }

  return {
    itemLevel,
    levelBracket,
    itemClass: baseDef.slot,
    slot: baseDef.slot,
    weaponType: baseDef.weaponType ?? null,
    defenseTypes,
    tags: [...itemTags],
  };
}

export function buildExplicitCandidates(baseDef, itemLevel) {
  const itemContext = buildAffixItemContext(baseDef, itemLevel);
  return EXPLICIT_AFFIX_POOL.filter((a) => {
    if (!a.slots.includes(baseDef.slot)) return false;
    if (!isAffixTierUnlocked(itemLevel, a.tier)) return false;
    return affixMatchesItemContext(a, itemContext);
  });
}

export function buildImplicitCandidates(baseDef, itemLevel) {
  const itemContext = buildAffixItemContext(baseDef, itemLevel);
  return IMPLICIT_AFFIX_POOL.filter((a) => {
    if (!a.slots.includes(baseDef.slot)) return false;
    if (!isAffixTierUnlocked(itemLevel, a.tier)) return false;
    return affixMatchesItemContext(a, itemContext);
  });
}

export function rollTierForCandidates(candidates = [], itemLevel, rng = Math.random) {
  const bracket = getAffixLevelBracket(itemLevel);
  const weights = getTierWeightsForLevelBracket(bracket);
  const tierCandidates = Object.entries(weights)
    .filter(([tier, weight]) => weight > 0 && candidates.some((candidate) => candidate.tier === tier))
    .map(([tier, weight]) => ({ tier, weight }));
  const selected = weightRollWithRng(tierCandidates, rng);
  return selected?.tier ?? null;
}

export function normalizeAffixForItem(affix) {
  const resolved = typeof affix === 'string' ? (AFFIX_BY_ID[affix] ?? null) : affix;
  if (!resolved) return null;
  return {
    id: resolved.id,
    kind: resolved.kind ?? 'explicit',
    type: resolved.type,
    family: resolved.family,
    group: resolved.group,
    label: resolved.label,
    stat: resolved.modifier?.statKey ?? resolved.stat,
    value: resolved.modifier?.value ?? resolved.value,
    tier: resolved.tier,
    minItemLevel: resolved.minItemLevel,
    goldValue: resolved.goldValue,
    weight: resolved.weight,
    tags: resolved.tags,
    pool: resolved.pool,
    modifier: resolved.modifier,
  };
}

function splitAffixSets(itemDef = {}) {
  const explicit = Array.isArray(itemDef.explicitAffixes)
    ? itemDef.explicitAffixes
    : (itemDef.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') !== 'implicit');
  const implicit = Array.isArray(itemDef.implicitAffixes)
    ? itemDef.implicitAffixes
    : (itemDef.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') === 'implicit');
  return { explicit, implicit };
}

export function hydrateItemAffixState(itemDef = {}) {
  const baseStats = itemDef.baseStats ?? itemDef.stats ?? {};
  const { explicit, implicit } = splitAffixSets(itemDef);
  const explicitAffixes = explicit.map(normalizeAffixForItem).filter(Boolean);
  const implicitAffixes = implicit.map(normalizeAffixForItem).filter(Boolean);
  const affixes = [...implicitAffixes, ...explicitAffixes];
  const stats = mergeAffixStats(baseStats, affixes);

  return {
    ...itemDef,
    baseStats,
    explicitAffixes,
    implicitAffixes,
    affixes,
    stats,
  };
}

function rollExplicitAffixes(baseDef, rarity, itemLevel, rng = Math.random) {
  const caps = getAffixCapsForRarity(rarity);
  const candidates = buildExplicitCandidates(baseDef, itemLevel);
  const chosen = [];
  const blockedGroups = new Set();
  const blockedFamilies = new Set();

  for (const type of ['prefix', 'suffix']) {
    const cap = caps[type] ?? 0;
    for (let i = 0; i < cap; i++) {
      const options = candidates.filter((a) =>
        a.type === type
        && !blockedGroups.has(a.group)
        && !blockedFamilies.has(a.family)
      );
      if (!options.length) break;
      const chosenTier = rollTierForCandidates(options, itemLevel, rng);
      const tierOptions = chosenTier
        ? options.filter((candidate) => candidate.tier === chosenTier)
        : options;
      const roll = weightRollWithRng(tierOptions, rng);
      if (!roll) break;
      chosen.push(roll);
      blockedGroups.add(roll.group);
      blockedFamilies.add(roll.family);
    }
  }

  return chosen;
}

function rollImplicitAffixes(baseDef, itemLevel, rng = Math.random) {
  const fixed = Array.isArray(baseDef.implicitAffixes) ? baseDef.implicitAffixes : [];
  if (fixed.length > 0) {
    return fixed.filter(Boolean);
  }

  const options = buildImplicitCandidates(baseDef, itemLevel);
  if (!options.length) return [];
  const chosenTier = rollTierForCandidates(options, itemLevel, rng);
  const tierOptions = chosenTier
    ? options.filter((candidate) => candidate.tier === chosenTier)
    : options;
  const rolled = weightRollWithRng(tierOptions, rng);
  return rolled ? [rolled] : [];
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
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  // Unique items bypass the affix roller entirely
  if (baseDef.isUnique) {
    const hydrated = hydrateItemAffixState({
      ...baseDef,
      uid:       crypto.randomUUID(),
      rarity:    'unique',
      color:     UNIQUE_COLOR,
      baseColor: baseDef.color,
      itemLevel,
      explicitAffixes: [],
      implicitAffixes: baseDef.implicitAffixes ?? [],
      baseStats: baseDef.stats,
    });
    return normalizeWeaponItem(hydrated);
  }

  const explicitAffixes = rollExplicitAffixes(baseDef, rarity, itemLevel, rng).map(normalizeAffixForItem);
  const implicitAffixes = rollImplicitAffixes(baseDef, itemLevel, rng).map(normalizeAffixForItem);
  const affixes = [...implicitAffixes, ...explicitAffixes];
  const statsWithImplicits = mergeAffixStats(baseDef.stats ?? {}, implicitAffixes);
  const finalStats = mergeAffixStats(statsWithImplicits, explicitAffixes);

  const generated = hydrateItemAffixState({
    ...baseDef,
    uid:       crypto.randomUUID(),
    rarity,
    // Override color with rarity tier color so HUD slots reflect rarity visually
    color:     RARITY_COLORS[rarity],
    // Preserve original item color for possible future icon use
    baseColor: baseDef.color,
    itemLevel,
    affixes,
    explicitAffixes,
    implicitAffixes,
    stats: finalStats,
    baseStats: baseDef.stats,
  });

  return normalizeWeaponItem(generated);
}

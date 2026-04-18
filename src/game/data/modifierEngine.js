import { resolveWeaponType } from './weaponTypes.js';
import {
  ITEM_MULTIPLY_PLAYER_KEYS,
  ITEM_STAT_KEY_TO_PLAYER_KEY,
  PASSIVE_STAT_KEYS,
} from './statKeys.js';

const DEFAULT_LAYER = 100;

export const MODIFIER_LAYERS = {
  passiveTree: 100,
  itemBase: 200,
  itemAffix: 220,
  uniqueItem: 250,
};

const PASSIVE_MULT_KEYS = new Set([
  'moveSpeedMult',
  'manaCostMult',
  'xpMultiplier',
  'potionEffectMult',
  'potionDurationMult',
  'potionChargeGainMult',
]);

const BONUS_BASELINES = {
  castSpeed: 0,
  attackSpeed: 0,
  moveSpeedMult: 1,
  manaCostMult: 1,
  xpMultiplier: 1,
  potionEffectMult: 1,
  potionDurationMult: 1,
  potionChargeGainMult: 1,
  potionMaxChargesMult: 1,
  potionChargesPerUseMult: 1,
  incomingDamageMult: 1,
  damageBuff: 1,
};

const EXTRA_BONUS_KEYS = [
  'morePhysicalDamage',
  'moreBlazeDamage',
  'moreThunderDamage',
  'moreFrostDamage',
  'moreHolyDamage',
  'moreUnholyDamage',
];

const BONUS_KEYS = [...new Set([...PASSIVE_STAT_KEYS, ...EXTRA_BONUS_KEYS])];

const SCOPED_SKILL_RULES = [
  { statKey: 'increasedDamageWithAttackSkills', out: 'damageInc', requiresTag: ['Attack'] },
  { statKey: 'increasedDamageWithSpellSkills', out: 'damageInc', requiresTag: ['Spell'] },
  { statKey: 'increasedDamageWithBowSkills', out: 'damageInc', requiresTag: ['Attack'], requiresWeaponType: ['bow'] },

  { statKey: 'increasedDamageWithSword', out: 'damageInc', requiresTag: ['Attack'], requiresWeaponType: ['sword'] },
  { statKey: 'increasedDamageWithAxe', out: 'damageInc', requiresTag: ['Attack'], requiresWeaponType: ['axe'] },
  { statKey: 'increasedDamageWithBow', out: 'damageInc', requiresTag: ['Attack'], requiresWeaponType: ['bow'] },
  { statKey: 'increasedDamageWithLance', out: 'damageInc', requiresTag: ['Attack'], requiresWeaponType: ['lance'] },
  { statKey: 'increasedDamageWithWand', out: 'damageInc', requiresWeaponType: ['wand'] },
  { statKey: 'increasedDamageWithTome', out: 'damageInc', requiresWeaponType: ['tome'] },

  { statKey: 'increasedAttackSpeedWithAttackSkills', out: 'attackSpeedInc', requiresTag: ['Attack'] },
  { statKey: 'increasedAttackSpeedWithBow', out: 'attackSpeedInc', requiresTag: ['Attack'], requiresWeaponType: ['bow'] },
  { statKey: 'increasedAttackSpeedWithWand', out: 'attackSpeedInc', requiresTag: ['Attack'], requiresWeaponType: ['wand'] },
  { statKey: 'increasedCastSpeedWithSpellSkills', out: 'castSpeedInc', requiresTag: ['Spell'] },
];

function listEquippedWeaponTypes(player) {
  const equipped = new Set();
  const mainhand = player?.equipment?.mainhand;
  const offhand = player?.equipment?.offhand;
  const defs = [mainhand?.def ?? mainhand ?? null, offhand?.def ?? offhand ?? null];

  for (const def of defs) {
    const weaponType = resolveWeaponType(def);
    if (weaponType) equipped.add(weaponType);
  }

  return [...equipped];
}

export function evaluateModifierCondition(modifier = {}, context = {}) {
  const requiredTags = Array.isArray(modifier.requiresTag) ? modifier.requiresTag : [];
  const requiredWeaponTypes = Array.isArray(modifier.requiresWeaponType) ? modifier.requiresWeaponType : [];
  const tags = Array.isArray(context.tags) ? context.tags : [];
  const equippedWeaponTypes = Array.isArray(context.equippedWeaponTypes)
    ? context.equippedWeaponTypes
    : [];

  if (requiredTags.length > 0 && !requiredTags.every((tag) => tags.includes(tag))) return false;
  if (requiredWeaponTypes.length > 0 && !requiredWeaponTypes.some((type) => equippedWeaponTypes.includes(type))) return false;
  return true;
}

export function resolveScopedSkillBonuses(player, skill) {
  const tags = Array.isArray(skill?.tags) ? skill.tags : [];
  const equippedWeaponTypes = listEquippedWeaponTypes(player);
  const context = { tags, equippedWeaponTypes };
  const out = {
    damageInc: 0,
    attackSpeedInc: 0,
    castSpeedInc: 0,
  };

  for (const rule of SCOPED_SKILL_RULES) {
    if (!evaluateModifierCondition(rule, context)) continue;
    const value = Number(player?.[rule.statKey] ?? 0);
    if (!Number.isFinite(value) || value === 0) continue;
    out[rule.out] += value;
  }

  return out;
}

function nextModifierOrder(player) {
  player._modifierSequence = (player._modifierSequence ?? 0) + 1;
  return player._modifierSequence;
}

function ensureModifierState(player) {
  if (!player._activeModifierSnapshots) player._activeModifierSnapshots = new Map();
  if (!player._modifierSequence) player._modifierSequence = 0;
}

function sortedModifiers(modifiers = []) {
  return [...modifiers].sort((a, b) => {
    const layerDiff = (a.layer ?? DEFAULT_LAYER) - (b.layer ?? DEFAULT_LAYER);
    if (layerDiff !== 0) return layerDiff;
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.statKey ?? '').localeCompare(String(b.statKey ?? ''));
  });
}

function applyOne(player, modifier) {
  const target = modifier.target ?? 'player';
  const operation = modifier.operation ?? 'add';

  if (target === 'autoSkillDamage') {
    for (const skill of player.autoSkills ?? []) {
      skill.damage = Math.round(skill.damage * modifier.value);
    }
    return;
  }

  if (target === 'autoSkillCooldown') {
    for (const skill of player.autoSkills ?? []) {
      skill.cooldown *= modifier.value;
    }
    return;
  }

  const statKey = modifier.statKey;
  if (!statKey) return;

  if (operation === 'multiply') {
    const before = player[statKey] ?? 1;
    player[statKey] = before * modifier.value;
  } else {
    player[statKey] = (player[statKey] ?? 0) + modifier.value;
  }

  if (statKey === 'maxHealth') {
    player.health = Math.min(player.health ?? 0, Math.max(1, player.maxHealth ?? 1));
  }
  if (statKey === 'maxMana') {
    player.mana = Math.min(player.mana ?? 0, Math.max(0, player.maxMana ?? 0));
  }
  if (statKey === 'maxEnergyShield') {
    player.energyShield = Math.min(player.energyShield ?? 0, Math.max(0, player.maxEnergyShield ?? 0));
  }
}

function revertOne(player, modifier) {
  const target = modifier.target ?? 'player';
  const operation = modifier.operation ?? 'add';

  if (target === 'autoSkillDamage') {
    for (const skill of player.autoSkills ?? []) {
      skill.damage = Math.round(skill.damage / modifier.value);
    }
    return;
  }

  if (target === 'autoSkillCooldown') {
    for (const skill of player.autoSkills ?? []) {
      skill.cooldown /= modifier.value;
    }
    return;
  }

  const statKey = modifier.statKey;
  if (!statKey) return;

  if (operation === 'multiply') {
    player[statKey] = (player[statKey] ?? 1) / modifier.value;
  } else {
    player[statKey] = (player[statKey] ?? 0) - modifier.value;
  }

  if (statKey === 'maxHealth') {
    player.health = Math.min(player.health ?? 0, Math.max(1, player.maxHealth ?? 1));
  }
  if (statKey === 'maxMana') {
    player.mana = Math.min(player.mana ?? 0, Math.max(0, player.maxMana ?? 0));
  }
  if (statKey === 'maxEnergyShield') {
    player.energyShield = Math.min(player.energyShield ?? 0, Math.max(0, player.maxEnergyShield ?? 0));
  }
}

export function applyModifierSet(player, modifiers = [], source = {}) {
  if (!player || !Array.isArray(modifiers) || modifiers.length === 0) return null;

  ensureModifierState(player);

  const ordered = sortedModifiers(modifiers).map((mod) => ({
    ...mod,
    layer: mod.layer ?? DEFAULT_LAYER,
    order: mod.order ?? nextModifierOrder(player),
  }));

  for (const modifier of ordered) {
    applyOne(player, modifier);
  }

  const snapshot = {
    id: source.id ?? `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceKind: source.kind ?? 'unknown',
    sourceLabel: source.label ?? source.id ?? 'Unknown Source',
    entries: ordered,
  };

  player._activeModifierSnapshots.set(snapshot.id, snapshot);
  return snapshot;
}

export function removeModifierSet(player, snapshot) {
  if (!player || !snapshot?.entries?.length) return;

  ensureModifierState(player);

  for (let i = snapshot.entries.length - 1; i >= 0; i--) {
    revertOne(player, snapshot.entries[i]);
  }

  if (snapshot.id) player._activeModifierSnapshots.delete(snapshot.id);
}

export function buildPassiveModifiersFromStats(stats = {}, sourceMeta = {}) {
  const out = [];
  for (const [statKey, value] of Object.entries(stats)) {
    if (value == null) continue;
    const isMult = PASSIVE_MULT_KEYS.has(statKey);
    out.push({
      statKey,
      value: isMult ? (1 + value) : value,
      operation: isMult ? 'multiply' : 'add',
      target: 'player',
      layer: sourceMeta.layer ?? MODIFIER_LAYERS.passiveTree,
    });
  }
  return out;
}

export function buildItemModifiersFromStats(stats = {}, sourceMeta = {}) {
  const out = [];
  for (const [rawKey, rawValue] of Object.entries(stats)) {
    if (rawValue == null) continue;

    if (rawKey === 'damageMult') {
      out.push({
        statKey: 'damageMult',
        value: rawValue,
        operation: 'multiply',
        target: 'autoSkillDamage',
        layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemBase,
      });
      continue;
    }

    if (rawKey === 'cooldownMult') {
      out.push({
        statKey: 'cooldownMult',
        value: rawValue,
        operation: 'multiply',
        target: 'autoSkillCooldown',
        layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemBase,
      });
      continue;
    }

    const statKey = ITEM_STAT_KEY_TO_PLAYER_KEY[rawKey] ?? rawKey;
    const isMult = ITEM_MULTIPLY_PLAYER_KEYS.has(rawKey);

    out.push({
      statKey,
      value: rawValue,
      operation: isMult ? 'multiply' : 'add',
      target: 'player',
      layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemBase,
    });
  }
  return out;
}

export function buildAffixModifiersFromAffixes(affixes = [], sourceMeta = {}) {
  const out = [];
  for (const affix of affixes) {
    if (!affix) continue;
    const rawKey = affix.modifier?.statKey ?? affix.stat;
    const rawValue = affix.modifier?.value ?? affix.value;
    if (!rawKey || rawValue == null) continue;

    if (rawKey === 'damageMult') {
      out.push({
        statKey: 'damageMult',
        value: rawValue,
        operation: 'multiply',
        target: 'autoSkillDamage',
        layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemAffix,
      });
      continue;
    }

    if (rawKey === 'cooldownMult') {
      out.push({
        statKey: 'cooldownMult',
        value: rawValue,
        operation: 'multiply',
        target: 'autoSkillCooldown',
        layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemAffix,
      });
      continue;
    }

    const statKey = ITEM_STAT_KEY_TO_PLAYER_KEY[rawKey] ?? rawKey;
    const operation = affix.modifier?.operation
      ?? (ITEM_MULTIPLY_PLAYER_KEYS.has(rawKey) ? 'multiply' : 'add');

    out.push({
      statKey,
      value: rawValue,
      operation,
      target: affix.modifier?.target ?? 'player',
      layer: sourceMeta.layer ?? MODIFIER_LAYERS.itemAffix,
    });
  }
  return out;
}

function makeSourceGroupLabel(sourceKind) {
  const labels = {
    passiveTree: 'Passive Tree',
    keystone: 'Keystone',
    itemBase: 'Item Base',
    itemExplicit: 'Item Explicit',
    itemImplicit: 'Item Implicit',
    uniqueItem: 'Unique',
  };
  return labels[sourceKind] ?? sourceKind;
}

export function summarizeActiveModifiers(player) {
  const snapshots = [...(player?._activeModifierSnapshots?.values?.() ?? [])];
  const byStat = new Map();
  const byKind = new Map();

  for (const snap of snapshots) {
    const kindBucket = byKind.get(snap.sourceKind) ?? [];
    kindBucket.push({
      sourceLabel: snap.sourceLabel,
      entryCount: snap.entries?.length ?? 0,
    });
    byKind.set(snap.sourceKind, kindBucket);

    for (const entry of snap.entries ?? []) {
      const statKey = entry.statKey ?? 'unknown';
      const bucket = byStat.get(statKey) ?? [];
      bucket.push({
        sourceKind: snap.sourceKind,
        sourceLabel: snap.sourceLabel,
        operation: entry.operation,
        value: entry.value,
        target: entry.target,
        layer: entry.layer ?? DEFAULT_LAYER,
      });
      byStat.set(statKey, bucket);
    }
  }

  const statBreakdown = [...byStat.entries()]
    .map(([statKey, sources]) => ({
      statKey,
      sourceCount: sources.length,
      sources: sources.sort((a, b) => (a.layer ?? DEFAULT_LAYER) - (b.layer ?? DEFAULT_LAYER)),
    }))
    .sort((a, b) => a.statKey.localeCompare(b.statKey));

  const sourceGroups = [...byKind.entries()]
    .map(([sourceKind, sources]) => ({
      sourceKind,
      label: makeSourceGroupLabel(sourceKind),
      sourceCount: sources.length,
      sources,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    activeSourceCount: snapshots.length,
    statBreakdown,
    sourceGroups,
  };
}

export function summarizeCharacterBonuses(player) {
  if (!player) return { bonusCount: 0, bonuses: [] };

  const bonuses = [];
  for (const statKey of BONUS_KEYS) {
    const value = Number(player[statKey]);
    if (!Number.isFinite(value)) continue;

    const baseline = BONUS_BASELINES[statKey] ?? 0;
    if (Math.abs(value - baseline) <= 1e-9) continue;

    bonuses.push({
      statKey,
      baseline,
      value,
      delta: value - baseline,
      mode: baseline === 1 ? 'multiply' : 'add',
    });
  }

  bonuses.sort((a, b) => a.statKey.localeCompare(b.statKey));
  return {
    bonusCount: bonuses.length,
    bonuses,
  };
}

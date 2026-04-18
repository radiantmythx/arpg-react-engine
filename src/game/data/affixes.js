/**
 * Affix pool — all procedural modifiers that can roll on generated items.
 *
 * Each affix specifies:
 *   id     — unique string
 *   type   — 'prefix' | 'suffix'
 *   slots  — array of slot types this affix is eligible for
 *   stat   — the stat key applied via PassiveItem.apply()
 *   value  — numeric value (multiplier for mult stats, flat addend for additive stats)
 *   label  — human-readable display string shown in the item popup
 *
 * Multiplicative stats: damageMult, cooldownMult, xpMultiplier
 *   value is a multiplier (e.g. 1.10 = +10%)
 *
 * Additive stats: speedFlat, maxHealthFlat, healthRegenPerS, pickupRadiusFlat
 *   value is a flat addend
 *
 * Mana stats:
 *   maxManaFlat, manaRegenPerS are additive; manaCostMult is multiplicative.
 */
import { SCALING_CONFIG, clampAreaLevel } from '../config/scalingConfig.js';

// Numeric tiers: 1 (best — strongest rolls, highest ilvl required)
//              → 8 (weakest — smallest rolls, always available)
export const AFFIX_TIERS = [1, 2, 3, 4, 5, 6, 7, 8];
export const AFFIX_KINDS = ['explicit', 'implicit'];
export const AFFIX_LEVEL_BRACKETS = ['early', 'mid', 'late', 'endgame'];

// Backward-compat map for legacy string tier names (map mod pool, old saves)
const LEGACY_TIER_MAP = { minor: 8, major: 6, advanced: 4, high: 2, pinnacle: 1 };

const TIER_TAGS = new Set(); // Numeric tiers are not string pool tags
const POOL_TAG_BY_DEFENSE = {
  armor: 'armorDefence',
  evasion: 'evasionDefence',
  energyShield: 'energyShieldDefence',
};
const POOL_TAG_BY_WEAPON = {
  sword: 'swordWeapon',
  axe: 'axeWeapon',
  bow: 'bowWeapon',
  lance: 'lanceWeapon',
  wand: 'wandWeapon',
  staff: 'staffWeapon',
  tome: 'tomeWeapon',
  shield: 'shieldWeapon',
};

// Tier selection weights by level bracket.
// Keys are numeric tiers (8 = weakest/most common, 1 = best/rarest).
// Higher weight = more likely to roll at that bracket.
const DEFAULT_TIER_WEIGHTS_BY_BRACKET = {
  early:   { 8: 100, 7: 40,  6: 5,   5: 0,  4: 0,  3: 0,  2: 0, 1: 0 },
  mid:     { 8: 40,  7: 80,  6: 60,  5: 25, 4: 5,  3: 0,  2: 0, 1: 0 },
  late:    { 8: 10,  7: 30,  6: 45,  5: 55, 4: 50, 3: 20, 2: 5, 1: 0 },
  endgame: { 8: 0,   7: 5,   6: 15,  5: 30, 4: 55, 3: 60, 2: 45, 1: 20 },
};

// Min item level required to access each numeric tier
const AFFIX_TIER_GATES = { 1: 75, 2: 60, 3: 50, 4: 40, 5: 30, 6: 20, 7: 10, 8: 1 };

// Accepts numeric tier (1-8) or legacy string ('minor','major', etc.)
export function affixTierGate(tier) {
  const numericTier = typeof tier === 'string' ? (LEGACY_TIER_MAP[tier] ?? 0) : tier;
  return AFFIX_TIER_GATES[numericTier] ?? Number.POSITIVE_INFINITY;
}

export function isAffixTierUnlocked(itemLevel, tier) {
  return clampAreaLevel(itemLevel) >= affixTierGate(tier);
}

export function unlockedAffixTiers(itemLevel) {
  return AFFIX_TIERS.filter((tier) => isAffixTierUnlocked(itemLevel, tier));
}

export function getAffixLevelBracket(itemLevel) {
  const level = clampAreaLevel(itemLevel);
  if (level >= 75) return 'endgame';
  if (level >= 45) return 'late';
  if (level >= 20) return 'mid';
  return 'early';
}

export function getTierWeightsForLevelBracket(levelBracket) {
  return DEFAULT_TIER_WEIGHTS_BY_BRACKET[levelBracket] ?? DEFAULT_TIER_WEIGHTS_BY_BRACKET.early;
}

function inferAffixTier(id = '') {
  // New convention: id ends with _t1 .. _t8
  const match = id.match(/_t(\d+)$/);
  if (match) return Number(match[1]);
  // Legacy string suffix fallback
  if (id.startsWith('more_')) return 1;
  if (id.includes('_pinnacle')) return 1;
  if (id.includes('_epic') || id.includes('_high')) return 2;
  if (id.includes('_advanced')) return 4;
  if (id.includes('_major')) return 6;
  if (id.includes('_minor')) return 8;
  return 5;
}

function inferGoldValue(tier = 5) {
  const numericTier = typeof tier === 'string' ? (LEGACY_TIER_MAP[tier] ?? 5) : tier;
  const map = { 1: 20, 2: 15, 3: 12, 4: 10, 5: 8, 6: 6, 7: 4, 8: 2 };
  return map[numericTier] ?? 8;
}

function inferWeight(tier = 5) {
  const numericTier = typeof tier === 'string' ? (LEGACY_TIER_MAP[tier] ?? 5) : tier;
  // tier 1 = rarest (low weight); tier 8 = most common (high weight)
  const map = { 1: 8, 2: 14, 3: 22, 4: 35, 5: 50, 6: 65, 7: 80, 8: 100 };
  return map[numericTier] ?? 35;
}

// ─── Label helpers ───────────────────────────────────────────────────────────
// Used to generate human-readable affix labels from a rolled numeric value.
const L = {
  flat:   (noun) => (v) => `+${v} ${noun}`,
  mult:   (noun) => (v) => `+${Math.round((v - 1) * 100)}% ${noun}`,
  reduct: (noun) => (v) => `-${Math.round((1 - v) * 100)}% ${noun}`,
  pct:    (noun) => (v) => `+${Math.round(v * 100)}% ${noun}`,
};

/**
 * Expand a multi-tier affix family into individual tier entries.
 * Each entry gets id = `${id}_t${tier}` and inherits all shared fields.
 * @param {{ id: string, labelFn: Function, tiers: {tier:number, min:number, max:number}[], ...rest }} def
 */
function defineAffixFamily({ id, labelFn, tiers, ...shared }) {
  return tiers.map(({ tier, min, max, ...tierOverrides }) => ({
    ...shared,
    id: `${id}_t${tier}`,
    tier,
    min,
    max,
    labelFn,
    ...tierOverrides,
  }));
}

function inferFamily(def = {}) {
  if (typeof def.family === 'string' && def.family) return def.family;
  if (typeof def.stat === 'string' && def.stat) return def.stat;
  const id = String(def.id ?? 'affix').toLowerCase();
  return id.replace(/_(minor|major|advanced|high|pinnacle|epic)$/i, '');
}

function inferGroup(def = {}, family = '') {
  if (typeof def.group === 'string' && def.group) return def.group;
  const scope = Array.isArray(def.slots) && def.slots.length ? def.slots.join('|') : 'global';
  return `${family}:${scope}`;
}

function inferWeaponTypes(def = {}, family = '') {
  if (Array.isArray(def.weaponTypes)) return [...new Set(def.weaponTypes.filter(Boolean))];
  const lowerFamily = String(family ?? '').toLowerCase();
  if (lowerFamily.includes('bow')) return ['bow'];
  if (lowerFamily.includes('wand')) return ['wand'];
  if (lowerFamily.includes('sword')) return ['sword'];
  if (lowerFamily.includes('axe')) return ['axe'];
  if (lowerFamily.includes('lance')) return ['lance'];
  if (lowerFamily.includes('tome')) return ['tome'];
  if (lowerFamily.includes('shield')) return ['shield'];
  return [];
}

function inferPoolTags(def = {}, kind = 'explicit', family = '', weaponTypes = []) {
  const tags = new Set(Array.isArray(def.poolTags) ? def.poolTags.filter(Boolean) : []);
  tags.add(kind);
  tags.add(def.type ?? 'prefix');
  if (family) tags.add(family);

  const stat = String(def.stat ?? '').toLowerCase();
  const id = String(def.id ?? '').toLowerCase();
  if (stat.includes('damage') || id.includes('damage') || id.startsWith('wpn_') || id.startsWith('flat_') || id.startsWith('inc_') || id.startsWith('more_')) {
    tags.add('damage');
  }
  if (stat.includes('resistance') || id.includes('_resist_')) tags.add('resistance');
  if (stat.includes('mana')) tags.add('mana');
  if (stat.includes('health') || stat.includes('regen')) tags.add('life');
  if (stat.includes('armor')) tags.add('armor');
  if (stat.includes('evasion')) tags.add('evasion');
  if (stat.includes('shield')) tags.add('energyShield');
  if (stat.includes('blaze') || id.includes('blaze')) tags.add('blaze');
  if (stat.includes('thunder') || id.includes('thunder')) tags.add('thunder');
  if (stat.includes('frost') || id.includes('frost')) tags.add('frost');
  if (stat.includes('holy') || id.includes('holy')) tags.add('holy');
  if (stat.includes('unholy') || id.includes('unholy')) tags.add('unholy');
  if (stat.includes('physical') || id.includes('physical')) tags.add('physical');

  for (const defenseType of def.defenseTypes ?? []) {
    tags.add(POOL_TAG_BY_DEFENSE[defenseType] ?? defenseType);
  }
  for (const weaponType of weaponTypes) {
    tags.add(POOL_TAG_BY_WEAPON[weaponType] ?? weaponType);
  }

  return [...tags].filter(Boolean);
}

function normalizePool(def = {}, tier = 'advanced', family = '', kind = 'explicit') {
  const weaponTypes = inferWeaponTypes(def, family);
  const poolTags = inferPoolTags(def, kind, family, weaponTypes);
  return {
    itemClasses: Array.isArray(def.itemClasses) && def.itemClasses.length > 0
      ? [...new Set(def.itemClasses.filter(Boolean))]
      : [...new Set((def.slots ?? []).filter(Boolean))],
    weaponTypes,
    defenseTypes: Array.isArray(def.defenseTypes) ? [...new Set(def.defenseTypes.filter(Boolean))] : [],
    tags: poolTags,
    levelBrackets: Array.isArray(def.levelBrackets) && def.levelBrackets.length > 0
      ? [...new Set(def.levelBrackets.filter(Boolean))]
      : AFFIX_LEVEL_BRACKETS.filter((bracket) => getTierWeightsForLevelBracket(bracket)[tier] > 0),
  };
}

function normalizeModifier(def) {
  if (def.modifier && typeof def.modifier === 'object') {
    return {
      statKey: def.modifier.statKey ?? def.stat,
      operation: def.modifier.operation ?? 'add',
      value: def.modifier.value ?? def.value,
      target: def.modifier.target ?? 'player',
      requiresTag: Array.isArray(def.modifier.requiresTag) ? [...def.modifier.requiresTag] : [],
      requiresWeaponType: Array.isArray(def.modifier.requiresWeaponType) ? [...def.modifier.requiresWeaponType] : [],
    };
  }

  const statKey = def.stat;
  const value = def.value;
  const isMult = typeof value === 'number' && (statKey === 'damageMult' || statKey === 'cooldownMult' || statKey === 'xpMultiplier' || statKey === 'manaCostMult');
  return {
    statKey,
    operation: isMult ? 'multiply' : 'add',
    value,
    target: 'player',
    requiresTag: [],
    requiresWeaponType: [],
  };
}

function enrichAffix(def) {
  const tier = def.tier ?? inferAffixTier(def.id);
  const kind = AFFIX_KINDS.includes(def.kind) ? def.kind : 'explicit';
  const family = inferFamily(def);
  const group = inferGroup(def, family);
  const pool = normalizePool(def, tier, family, kind);

  // Support both fixed-value (legacy/implicit) and ranged (new) affixes
  const defMin = def.min ?? def.value ?? 0;
  const defMax = def.max ?? def.value ?? 0;
  const midValue = (defMin + defMax) / 2;

  // Compute a fallback label for pool display (uses midpoint; instances use rolled value)
  const labelFn = def.labelFn ?? null;
  const label = def.label ?? (labelFn ? labelFn(midValue) : `${def.stat}: ${defMin}–${defMax}`);

  return {
    ...def,
    kind,
    family,
    group,
    tier,
    min: defMin,
    max: defMax,
    value: midValue,   // midpoint; actual rolled value is on item instances
    labelFn,
    label,
    minItemLevel: Math.max(1, Math.floor(def.minItemLevel ?? affixTierGate(tier))),
    goldValue: def.goldValue ?? inferGoldValue(tier),
    weight: def.weight ?? inferWeight(tier),
    tags: def.tags ?? [kind, def.type, family],
    pool,
    modifier: normalizeModifier({ ...def, value: midValue }),
  };
}

const RAW_AFFIX_POOL = [
  // ─── Weapon: damage / cooldown prefixes ─────────────────────────────────
  ...defineAffixFamily({
    id: 'wpn_dmg', type: 'prefix', slots: ['weapon'], stat: 'damageMult',
    labelFn: L.mult('damage'),
    tiers: [
      { tier: 1, min: 1.40, max: 1.52 },
      { tier: 3, min: 1.26, max: 1.35 },
      { tier: 6, min: 1.16, max: 1.24 },
      { tier: 8, min: 1.06, max: 1.12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'wpn_cd', type: 'prefix', slots: ['weapon'], stat: 'cooldownMult',
    labelFn: L.reduct('cooldown length'),
    tiers: [
      { tier: 1, min: 0.66, max: 0.76 },
      { tier: 3, min: 0.76, max: 0.83 },
      { tier: 6, min: 0.82, max: 0.88 },
      { tier: 8, min: 0.88, max: 0.92 },
    ],
  }),
  ...defineAffixFamily({
    id: 'wpn_bow_dmg', type: 'prefix', slots: ['weapon'], weaponTypes: ['bow'],
    stat: 'increasedDamageWithBow', labelFn: L.pct('damage with Bows'),
    tiers: [
      { tier: 1, min: 0.30, max: 0.40 },
      { tier: 3, min: 0.22, max: 0.30 },
      { tier: 6, min: 0.14, max: 0.22 },
      { tier: 8, min: 0.07, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'wpn_wand_aspd', type: 'prefix', slots: ['weapon'], weaponTypes: ['wand'],
    stat: 'increasedAttackSpeedWithWand', labelFn: L.pct('Attack Speed with Wands'),
    tiers: [
      { tier: 1, min: 0.25, max: 0.36 },
      { tier: 3, min: 0.18, max: 0.26 },
      { tier: 6, min: 0.12, max: 0.20 },
      { tier: 8, min: 0.06, max: 0.13 },
    ],
  }),
  // ─── Weapon: suffixes ─────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'wpn_speed', type: 'suffix', slots: ['weapon'], stat: 'speedFlat',
    labelFn: L.flat('movement speed'),
    tiers: [
      { tier: 1, min: 38, max: 52 },
      { tier: 3, min: 26, max: 38 },
      { tier: 6, min: 16, max: 26 },
      { tier: 8, min: 8,  max: 16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'wpn_hp', type: 'suffix', slots: ['weapon'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 55, max: 80 },
      { tier: 3, min: 36, max: 55 },
      { tier: 6, min: 20, max: 36 },
      { tier: 8, min: 10, max: 20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'wpn_xp', type: 'suffix', slots: ['weapon'], stat: 'xpMultiplier',
    labelFn: L.mult('XP gain'),
    tiers: [
      { tier: 1, min: 1.35, max: 1.50 },
      { tier: 3, min: 1.22, max: 1.32 },
      { tier: 6, min: 1.11, max: 1.20 },
      { tier: 8, min: 1.05, max: 1.12 },
    ],
  }),
  // ─── Armor: all-type prefixes ──────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'arm_hp', type: 'prefix', slots: ['armor'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 125, max: 155 },
      { tier: 3, min: 72,  max: 90  },
      { tier: 6, min: 44,  max: 58  },
      { tier: 8, min: 25,  max: 36  },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_regen', type: 'prefix', slots: ['armor'], stat: 'healthRegenPerS',
    labelFn: L.flat('Life regen/s'),
    tiers: [
      { tier: 1, min: 7, max: 12 },
      { tier: 3, min: 5, max: 8  },
      { tier: 6, min: 3, max: 5  },
      { tier: 8, min: 1, max: 3  },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_mana', type: 'prefix', slots: ['armor'], stat: 'maxManaFlat',
    labelFn: L.flat('max Mana'),
    tiers: [
      { tier: 1, min: 70, max: 95 },
      { tier: 3, min: 48, max: 65 },
      { tier: 6, min: 28, max: 44 },
      { tier: 8, min: 14, max: 25 },
    ],
  }),
  // ─── Armor: suffixes ──────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'arm_speed', type: 'suffix', slots: ['armor'], stat: 'speedFlat',
    labelFn: L.flat('movement speed'),
    tiers: [
      { tier: 1, min: 38, max: 52 },
      { tier: 3, min: 24, max: 36 },
      { tier: 6, min: 11, max: 20 },
      { tier: 8, min: 5,  max: 12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_pickup', type: 'suffix', slots: ['armor'], stat: 'pickupRadiusFlat',
    labelFn: L.flat('pickup radius'),
    tiers: [
      { tier: 1, min: 44, max: 62 },
      { tier: 3, min: 28, max: 42 },
      { tier: 6, min: 15, max: 26 },
      { tier: 8, min: 8,  max: 15 },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_xp', type: 'suffix', slots: ['armor'], stat: 'xpMultiplier',
    labelFn: L.mult('XP gain'),
    tiers: [
      { tier: 1, min: 1.28, max: 1.42 },
      { tier: 3, min: 1.16, max: 1.26 },
      { tier: 6, min: 1.06, max: 1.15 },
      { tier: 8, min: 1.02, max: 1.08 },
    ],
  }),
  // ─── Armor: defense-type prefixes ─────────────────────────────────────────
  ...defineAffixFamily({
    id: 'arm_armor_def', type: 'prefix', slots: ['armor'], defenseTypes: ['armor'],
    stat: 'armorFlat', labelFn: L.flat('Armour'),
    tiers: [
      { tier: 1, min: 90,  max: 120 },
      { tier: 3, min: 55,  max: 80  },
      { tier: 6, min: 28,  max: 44  },
      { tier: 8, min: 16,  max: 24  },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_evasion_def', type: 'prefix', slots: ['armor'], defenseTypes: ['evasion'],
    stat: 'evasionFlat', labelFn: L.flat('Evasion'),
    tiers: [
      { tier: 1, min: 95,  max: 130 },
      { tier: 3, min: 60,  max: 85  },
      { tier: 6, min: 32,  max: 46  },
      { tier: 8, min: 18,  max: 28  },
    ],
  }),
  ...defineAffixFamily({
    id: 'arm_es_def', type: 'prefix', slots: ['armor'], defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat', labelFn: L.flat('Energy Shield'),
    tiers: [
      { tier: 1, min: 110, max: 150 },
      { tier: 3, min: 60,  max: 85  },
      { tier: 6, min: 17,  max: 25  },
      { tier: 8, min: 10,  max: 16  },
    ],
  }),
  // ─── Jewelry: prefixes ────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'jew_xp', type: 'prefix', slots: ['jewelry'], stat: 'xpMultiplier',
    labelFn: L.mult('XP gain'),
    tiers: [
      { tier: 1, min: 1.44, max: 1.60 },
      { tier: 3, min: 1.30, max: 1.42 },
      { tier: 6, min: 1.20, max: 1.31 },
      { tier: 8, min: 1.11, max: 1.20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_speed', type: 'prefix', slots: ['jewelry'], stat: 'speedFlat',
    labelFn: L.flat('movement speed'),
    tiers: [
      { tier: 1, min: 48, max: 65 },
      { tier: 3, min: 30, max: 44 },
      { tier: 6, min: 20, max: 31 },
      { tier: 8, min: 10, max: 19 },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_mana', type: 'prefix', slots: ['jewelry'], stat: 'maxManaFlat',
    labelFn: L.flat('max Mana'),
    tiers: [
      { tier: 1, min: 80,  max: 110 },
      { tier: 3, min: 52,  max: 72  },
      { tier: 6, min: 36,  max: 55  },
      { tier: 8, min: 18,  max: 34  },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_spell', type: 'prefix', slots: ['jewelry'],
    stat: 'increasedDamageWithSpellSkills', labelFn: L.pct('Spell Skill Damage'),
    tiers: [
      { tier: 1, min: 0.26, max: 0.36 },
      { tier: 3, min: 0.18, max: 0.26 },
      { tier: 6, min: 0.10, max: 0.18 },
      { tier: 8, min: 0.05, max: 0.11 },
    ],
  }),
  // ─── Jewelry: suffixes ────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'jew_pickup', type: 'suffix', slots: ['jewelry'], stat: 'pickupRadiusFlat',
    labelFn: L.flat('pickup radius'),
    tiers: [
      { tier: 1, min: 52, max: 72 },
      { tier: 3, min: 32, max: 50 },
      { tier: 6, min: 20, max: 32 },
      { tier: 8, min: 10, max: 20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_dmg', type: 'suffix', slots: ['jewelry'], stat: 'damageMult',
    labelFn: L.mult('damage'),
    tiers: [
      { tier: 1, min: 1.28, max: 1.42 },
      { tier: 3, min: 1.16, max: 1.26 },
      { tier: 6, min: 1.06, max: 1.14 },
      { tier: 8, min: 1.02, max: 1.07 },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_hp', type: 'suffix', slots: ['jewelry'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 52, max: 72 },
      { tier: 3, min: 34, max: 50 },
      { tier: 6, min: 20, max: 32 },
      { tier: 8, min: 10, max: 20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_manaregen', type: 'suffix', slots: ['jewelry'], stat: 'manaRegenPerS',
    labelFn: L.flat('Mana regen/s'),
    tiers: [
      { tier: 1, min: 7, max: 12 },
      { tier: 3, min: 4, max: 7  },
      { tier: 6, min: 2, max: 4  },
      { tier: 8, min: 1, max: 2  },
    ],
  }),
  ...defineAffixFamily({
    id: 'jew_manacost', type: 'suffix', slots: ['jewelry'], stat: 'manaCostMult',
    labelFn: L.reduct('Mana Costs'),
    tiers: [
      { tier: 1, min: 0.68, max: 0.80 },
      { tier: 3, min: 0.78, max: 0.87 },
      { tier: 6, min: 0.86, max: 0.94 },
      { tier: 8, min: 0.92, max: 0.97 },
    ],
  }),
  // ─── Helmet: prefixes ─────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'helm_hp', type: 'prefix', slots: ['helmet'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 80,  max: 110 },
      { tier: 3, min: 48,  max: 70  },
      { tier: 6, min: 30,  max: 46  },
      { tier: 8, min: 18,  max: 30  },
    ],
  }),
  ...defineAffixFamily({
    id: 'helm_xp', type: 'prefix', slots: ['helmet'], stat: 'xpMultiplier',
    labelFn: L.mult('XP gain'),
    tiers: [
      { tier: 1, min: 1.28, max: 1.42 },
      { tier: 3, min: 1.16, max: 1.26 },
      { tier: 6, min: 1.08, max: 1.18 },
      { tier: 8, min: 1.04, max: 1.12 },
    ],
  }),
  // ─── Helmet: suffixes ─────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'helm_xp_suf', type: 'suffix', slots: ['helmet'], stat: 'xpMultiplier',
    labelFn: L.mult('XP gain'),
    tiers: [
      { tier: 1, min: 1.22, max: 1.34 },
      { tier: 3, min: 1.14, max: 1.23 },
      { tier: 6, min: 1.06, max: 1.14 },
      { tier: 8, min: 1.03, max: 1.09 },
    ],
  }),
  ...defineAffixFamily({
    id: 'helm_pickup', type: 'suffix', slots: ['helmet'], stat: 'pickupRadiusFlat',
    labelFn: L.flat('pickup radius'),
    tiers: [
      { tier: 1, min: 42, max: 58 },
      { tier: 3, min: 28, max: 40 },
      { tier: 6, min: 18, max: 28 },
      { tier: 8, min: 10, max: 18 },
    ],
  }),
  ...defineAffixFamily({
    id: 'helm_regen', type: 'suffix', slots: ['helmet'], stat: 'healthRegenPerS',
    labelFn: L.flat('Life regen/s'),
    tiers: [
      { tier: 1, min: 5, max: 9 },
      { tier: 3, min: 3, max: 6 },
      { tier: 6, min: 2, max: 4 },
      { tier: 8, min: 1, max: 2 },
    ],
  }),
  // ─── Helmet: defense-type prefixes ────────────────────────────────────────
  ...defineAffixFamily({
    id: 'helm_armor_def', type: 'prefix', slots: ['helmet'], defenseTypes: ['armor'],
    stat: 'armorFlat', labelFn: L.flat('Armour'),
    tiers: [
      { tier: 1, min: 55, max: 80 },
      { tier: 3, min: 34, max: 50 },
      { tier: 6, min: 14, max: 22 },
      { tier: 8, min: 8,  max: 14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'helm_evasion_def', type: 'prefix', slots: ['helmet'], defenseTypes: ['evasion'],
    stat: 'evasionFlat', labelFn: L.flat('Evasion'),
    tiers: [
      { tier: 1, min: 60, max: 88 },
      { tier: 3, min: 36, max: 54 },
      { tier: 6, min: 16, max: 24 },
      { tier: 8, min: 8,  max: 15 },
    ],
  }),
  ...defineAffixFamily({
    id: 'helm_es_def', type: 'prefix', slots: ['helmet'], defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat', labelFn: L.flat('Energy Shield'),
    tiers: [
      { tier: 1, min: 48, max: 70 },
      { tier: 3, min: 25, max: 38 },
      { tier: 6, min: 9,  max: 16 },
      { tier: 8, min: 5,  max: 9  },
    ],
  }),
  // ─── Boots: prefixes ──────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'boot_speed', type: 'prefix', slots: ['boots'], stat: 'speedFlat',
    labelFn: L.flat('movement speed'),
    tiers: [
      { tier: 1, min: 48, max: 65 },
      { tier: 3, min: 35, max: 50 },
      { tier: 6, min: 20, max: 32 },
      { tier: 8, min: 10, max: 20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'boot_pickup', type: 'prefix', slots: ['boots'], stat: 'pickupRadiusFlat',
    labelFn: L.flat('pickup radius'),
    tiers: [
      { tier: 1, min: 42, max: 58 },
      { tier: 3, min: 28, max: 40 },
      { tier: 6, min: 16, max: 26 },
      { tier: 8, min: 8,  max: 16 },
    ],
  }),
  // ─── Boots: suffixes ──────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'boot_pickup_suf', type: 'suffix', slots: ['boots'], stat: 'pickupRadiusFlat',
    labelFn: L.flat('pickup radius'),
    tiers: [
      { tier: 1, min: 42, max: 58 },
      { tier: 3, min: 28, max: 40 },
      { tier: 6, min: 15, max: 26 },
      { tier: 8, min: 8,  max: 16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'boot_vitality', type: 'suffix', slots: ['boots'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 52, max: 72 },
      { tier: 3, min: 32, max: 48 },
      { tier: 6, min: 16, max: 26 },
      { tier: 8, min: 8,  max: 16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'boot_regen', type: 'suffix', slots: ['boots'], stat: 'healthRegenPerS',
    labelFn: L.flat('Life regen/s'),
    tiers: [
      { tier: 1, min: 4, max: 7 },
      { tier: 3, min: 2, max: 4 },
      { tier: 6, min: 1, max: 3 },
      { tier: 8, min: 1, max: 2 },
    ],
  }),
  // ─── Boots: defense-type prefixes ─────────────────────────────────────────
  ...defineAffixFamily({
    id: 'boot_armor_def', type: 'prefix', slots: ['boots'], defenseTypes: ['armor'],
    stat: 'armorFlat', labelFn: L.flat('Armour'),
    tiers: [
      { tier: 1, min: 42, max: 60 },
      { tier: 3, min: 26, max: 38 },
      { tier: 6, min: 10, max: 18 },
      { tier: 8, min: 6,  max: 12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'boot_evasion_def', type: 'prefix', slots: ['boots'], defenseTypes: ['evasion'],
    stat: 'evasionFlat', labelFn: L.flat('Evasion'),
    tiers: [
      { tier: 1, min: 45, max: 65 },
      { tier: 3, min: 28, max: 40 },
      { tier: 6, min: 11, max: 19 },
      { tier: 8, min: 6,  max: 12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'boot_es_def', type: 'prefix', slots: ['boots'], defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat', labelFn: L.flat('Energy Shield'),
    tiers: [
      { tier: 1, min: 35, max: 52 },
      { tier: 3, min: 20, max: 32 },
      { tier: 6, min: 7,  max: 13 },
      { tier: 8, min: 4,  max: 8  },
    ],
  }),
  // ─── Offhand: prefixes ────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'off_cd', type: 'prefix', slots: ['offhand'], stat: 'cooldownMult',
    labelFn: L.reduct('cooldown length'),
    tiers: [
      { tier: 1, min: 0.66, max: 0.76 },
      { tier: 3, min: 0.75, max: 0.82 },
      { tier: 6, min: 0.82, max: 0.88 },
      { tier: 8, min: 0.88, max: 0.92 },
    ],
  }),
  ...defineAffixFamily({
    id: 'off_dmg', type: 'prefix', slots: ['offhand'], stat: 'damageMult',
    labelFn: L.mult('damage'),
    tiers: [
      { tier: 1, min: 1.28, max: 1.40 },
      { tier: 3, min: 1.18, max: 1.28 },
      { tier: 6, min: 1.10, max: 1.20 },
      { tier: 8, min: 1.05, max: 1.13 },
    ],
  }),
  // ─── Offhand: suffixes ────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'off_speed', type: 'suffix', slots: ['offhand'], stat: 'speedFlat',
    labelFn: L.flat('movement speed'),
    tiers: [
      { tier: 1, min: 38, max: 52 },
      { tier: 3, min: 26, max: 38 },
      { tier: 6, min: 16, max: 26 },
      { tier: 8, min: 8,  max: 16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'off_hp', type: 'suffix', slots: ['offhand'], stat: 'maxHealthFlat',
    labelFn: L.flat('max Life'),
    tiers: [
      { tier: 1, min: 60, max: 85 },
      { tier: 3, min: 38, max: 56 },
      { tier: 6, min: 24, max: 38 },
      { tier: 8, min: 12, max: 22 },
    ],
  }),
  ...defineAffixFamily({
    id: 'off_regen', type: 'suffix', slots: ['offhand'], stat: 'healthRegenPerS',
    labelFn: L.flat('Life regen/s'),
    tiers: [
      { tier: 1, min: 5, max: 9 },
      { tier: 3, min: 3, max: 5 },
      { tier: 6, min: 1, max: 3 },
      { tier: 8, min: 1, max: 2 },
    ],
  }),
  // ─── Offhand: defense-type prefixes ───────────────────────────────────────
  ...defineAffixFamily({
    id: 'off_armor_def', type: 'prefix', slots: ['offhand'], defenseTypes: ['armor'],
    stat: 'armorFlat', labelFn: L.flat('Armour'),
    tiers: [
      { tier: 1, min: 65, max: 95 },
      { tier: 3, min: 40, max: 58 },
      { tier: 6, min: 20, max: 30 },
      { tier: 8, min: 12, max: 20 },
    ],
  }),
  ...defineAffixFamily({
    id: 'off_evasion_def', type: 'prefix', slots: ['offhand'], defenseTypes: ['evasion'],
    stat: 'evasionFlat', labelFn: L.flat('Evasion'),
    tiers: [
      { tier: 1, min: 72,  max: 105 },
      { tier: 3, min: 44,  max: 64  },
      { tier: 6, min: 22,  max: 34  },
      { tier: 8, min: 12,  max: 22  },
    ],
  }),
  ...defineAffixFamily({
    id: 'off_es_def', type: 'prefix', slots: ['offhand'], defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat', labelFn: L.flat('Energy Shield'),
    tiers: [
      { tier: 1, min: 65, max: 95 },
      { tier: 3, min: 38, max: 55 },
      { tier: 6, min: 14, max: 22 },
      { tier: 8, min: 8,  max: 14 },
    ],
  }),
  // ─── Melee reach ──────────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'melee_range', type: 'prefix', slots: ['weapon'],
    weaponTypes: ['sword', 'axe', 'lance', 'staff'],
    stat: 'meleeStrikeRange', labelFn: L.pct('melee strike range'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.55 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.18, max: 0.30 },
      { tier: 8, min: 0.08, max: 0.20 },
    ],
  }),
  // ─── Elemental: Physical ──────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_physical', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatPhysicalDamage', labelFn: L.flat('flat Physical Damage'),
    tiers: [
      { tier: 1, min: 35, max: 55 },
      { tier: 3, min: 22, max: 35 },
      { tier: 6, min: 14, max: 22 },
      { tier: 8, min: 6,  max: 12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_physical', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedPhysicalDamage', labelFn: L.pct('increased Physical Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_physical', type: 'suffix', slots: ['weapon'],
    stat: 'morePhysicalDamage', labelFn: L.pct('more Physical Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  // ─── Elemental: Blaze ─────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_blaze', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatBlazeDamage', labelFn: L.flat('flat Blaze Damage'),
    tiers: [
      { tier: 1, min: 38, max: 58 },
      { tier: 3, min: 24, max: 38 },
      { tier: 6, min: 15, max: 25 },
      { tier: 8, min: 7,  max: 14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_blaze', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedBlazeDamage', labelFn: L.pct('increased Blaze Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_blaze', type: 'suffix', slots: ['weapon'],
    stat: 'moreBlazeDamage', labelFn: L.pct('more Blaze Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'resist_blaze', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'],
    stat: 'blazeResistance', labelFn: L.pct('Blaze Resistance'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.56 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.15 },
    ],
  }),
  // ─── Elemental: Thunder ───────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_thunder', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatThunderDamage', labelFn: L.flat('flat Thunder Damage'),
    tiers: [
      { tier: 1, min: 32, max: 50 },
      { tier: 3, min: 20, max: 32 },
      { tier: 6, min: 12, max: 20 },
      { tier: 8, min: 5,  max: 10 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_thunder', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedThunderDamage', labelFn: L.pct('increased Thunder Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_thunder', type: 'suffix', slots: ['weapon'],
    stat: 'moreThunderDamage', labelFn: L.pct('more Thunder Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'resist_thunder', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'],
    stat: 'thunderResistance', labelFn: L.pct('Thunder Resistance'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.56 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.15 },
    ],
  }),
  // ─── Elemental: Frost ─────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_frost', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatFrostDamage', labelFn: L.flat('flat Frost Damage'),
    tiers: [
      { tier: 1, min: 35, max: 55 },
      { tier: 3, min: 22, max: 35 },
      { tier: 6, min: 13, max: 23 },
      { tier: 8, min: 6,  max: 12 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_frost', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedFrostDamage', labelFn: L.pct('increased Frost Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_frost', type: 'suffix', slots: ['weapon'],
    stat: 'moreFrostDamage', labelFn: L.pct('more Frost Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'resist_frost', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'],
    stat: 'frostResistance', labelFn: L.pct('Frost Resistance'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.56 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.15 },
    ],
  }),
  // ─── Elemental: Holy ──────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_holy', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatHolyDamage', labelFn: L.flat('flat Holy Damage'),
    tiers: [
      { tier: 1, min: 38, max: 62 },
      { tier: 3, min: 24, max: 38 },
      { tier: 6, min: 14, max: 24 },
      { tier: 8, min: 7,  max: 14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_holy', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedHolyDamage', labelFn: L.pct('increased Holy Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_holy', type: 'suffix', slots: ['weapon'],
    stat: 'moreHolyDamage', labelFn: L.pct('more Holy Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'resist_holy', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'],
    stat: 'holyResistance', labelFn: L.pct('Holy Resistance'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.56 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.15 },
    ],
  }),
  // ─── Elemental: Unholy ────────────────────────────────────────────────────
  ...defineAffixFamily({
    id: 'flat_unholy', type: 'prefix', slots: ['weapon', 'jewelry'],
    stat: 'flatUnholyDamage', labelFn: L.flat('flat Unholy Damage'),
    tiers: [
      { tier: 1, min: 36, max: 58 },
      { tier: 3, min: 22, max: 36 },
      { tier: 6, min: 14, max: 22 },
      { tier: 8, min: 7,  max: 14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'inc_unholy', type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'],
    stat: 'increasedUnholyDamage', labelFn: L.pct('increased Unholy Damage'),
    tiers: [
      { tier: 1, min: 0.36, max: 0.50 },
      { tier: 3, min: 0.26, max: 0.36 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.16 },
    ],
  }),
  ...defineAffixFamily({
    id: 'more_unholy', type: 'suffix', slots: ['weapon'],
    stat: 'moreUnholyDamage', labelFn: L.pct('more Unholy Damage'),
    tiers: [
      { tier: 1, min: 0.12, max: 0.20 },
      { tier: 3, min: 0.08, max: 0.14 },
    ],
  }),
  ...defineAffixFamily({
    id: 'resist_unholy', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'],
    stat: 'unholyResistance', labelFn: L.pct('Unholy Resistance'),
    tiers: [
      { tier: 1, min: 0.40, max: 0.56 },
      { tier: 3, min: 0.30, max: 0.42 },
      { tier: 6, min: 0.16, max: 0.26 },
      { tier: 8, min: 0.08, max: 0.15 },
    ],
  }),
];


const RAW_IMPLICIT_AFFIX_POOL = [
  {
    id: 'implicit_weapon_edge',
    kind: 'implicit',
    type: 'prefix',
    family: 'weapon_edge',
    group: 'implicit_weapon_edge',
    slots: ['weapon'],
    stat: 'damageMult',
    tier: 6,
    min: 1.04, max: 1.08,
    labelFn: L.mult('damage'),
  },
  {
    id: 'implicit_armor_guard',
    kind: 'implicit',
    type: 'prefix',
    family: 'armor_guard',
    group: 'implicit_armor_guard',
    slots: ['armor', 'helmet', 'boots', 'offhand'],
    stat: 'maxHealthFlat',
    tier: 8,
    min: 8, max: 14,
    labelFn: L.flat('maximum Life'),
  },
  {
    id: 'implicit_jewelry_focus',
    kind: 'implicit',
    type: 'prefix',
    family: 'jewelry_focus',
    group: 'implicit_jewelry_focus',
    slots: ['jewelry'],
    stat: 'xpMultiplier',
    tier: 8,
    min: 1.02, max: 1.05,
    labelFn: L.mult('experience gain'),
  },
];


export const EXPLICIT_AFFIX_POOL = RAW_AFFIX_POOL.map((def) => enrichAffix({ ...def, kind: def.kind ?? 'explicit' }));
export const IMPLICIT_AFFIX_POOL = RAW_IMPLICIT_AFFIX_POOL.map(enrichAffix);
export const ALL_AFFIX_POOL = [...EXPLICIT_AFFIX_POOL, ...IMPLICIT_AFFIX_POOL];
export const AFFIX_POOL = EXPLICIT_AFFIX_POOL;
export const AFFIX_BY_ID = Object.fromEntries(ALL_AFFIX_POOL.map((a) => [a.id, a]));

export function affixMatchesItemContext(affix, itemContext = {}) {
  if (!affix?.pool) return false;

  const itemClass = itemContext.itemClass ?? itemContext.slot ?? null;
  const itemTags = Array.isArray(itemContext.tags) ? itemContext.tags : [];
  const levelBracket = itemContext.levelBracket ?? getAffixLevelBracket(itemContext.itemLevel ?? 1);
  const defenseTypes = Array.isArray(itemContext.defenseTypes) ? itemContext.defenseTypes : [];
  const weaponType = itemContext.weaponType ?? null;

  if (affix.minItemLevel != null && clampAreaLevel(itemContext.itemLevel ?? 1) < affix.minItemLevel) return false;
  if (itemClass && affix.pool.itemClasses.length > 0 && !affix.pool.itemClasses.includes(itemClass)) return false;
  if (weaponType && affix.pool.weaponTypes.length > 0 && !affix.pool.weaponTypes.includes(weaponType)) return false;
  if (affix.pool.defenseTypes.length > 0 && !affix.pool.defenseTypes.some((dt) => defenseTypes.includes(dt))) return false;
  if (affix.pool.levelBrackets.length > 0 && !affix.pool.levelBrackets.includes(levelBracket)) return false;
  if (itemTags.length > 0 && affix.pool.tags.length > 0) {
    const hasOverlap = affix.pool.tags.some((tag) => itemTags.includes(tag));
    const requiresContextTag = affix.pool.tags.some((tag) => !AFFIX_KINDS.includes(tag) && tag !== affix.type && tag !== affix.family && tag !== 'damage' && tag !== 'life' && tag !== 'mana' && tag !== 'resistance' && tag !== 'armor' && tag !== 'evasion' && tag !== 'energyShield');
    if (requiresContextTag && !hasOverlap) return false;
  }
  return true;
}

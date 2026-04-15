/**
 * supports.js — Phase 12.5, Support Gem System
 *
 * Each entry in SUPPORT_POOL describes one support gem.
 *
 * Shape:
 *   id              — unique string key
 *   name            — display name
 *   icon            — emoji or short glyph
 *   description     — single-line tooltip text
 *   color           — gem colour used in the socket UI
 *   requiredTags    — skill must have ALL of these tags to accept the gem
 *   incompatibleTags— skill must have NONE of these tags
 *   modify(stats, skill) — called by SkillDef.computedStats() — mutates stats in-place
 *   onActivate(player, entities, engine, skill) — optional; called after the skill fires
 */

import { SUPPORT_TUNING } from '../content/tuning/index.js';
import { SCALING_CONFIG } from '../config/scalingConfig.js';

function clampSupportLevel(level) {
  return Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
}

function lerpByLevel(range = [1, 1], level = 1) {
  const [a = 1, b = 1] = Array.isArray(range) ? range : [1, 1];
  const t = (clampSupportLevel(level) - 1) / 19;
  return a + (b - a) * t;
}

function supportCategoryById(id) {
  const throughput = new Set(['pierce', 'fork', 'chain', 'gmp', 'spell_echo', 'spell_cascade', 'controlled_destruction', 'concentrated_effect', 'increased_aoe']);
  const ailment = new Set(['deadly_ailments', 'swift_affliction', 'hypothermia', 'vile_toxins', 'burning_damage']);
  if (throughput.has(id)) return 'throughput';
  if (ailment.has(id)) return 'ailment';
  return 'utility';
}

function identityForKey(key) {
  if (/mult|factor/i.test(key) || key === '_speedMult' || key === '_rangeMult') return 1;
  return 0;
}

function applySupportEffectCurve(stats, before, curve) {
  const keys = new Set([...Object.keys(before), ...Object.keys(stats)]);
  for (const key of keys) {
    if (key === 'manaCostMult') continue;
    const afterValue = stats[key];
    if (!Number.isFinite(afterValue)) continue;
    const start = Number.isFinite(before[key]) ? before[key] : identityForKey(key);
    stats[key] = start + (afterValue - start) * curve;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _spellEchoActivate(player, entities, engine, skill) {
  // Delay a second identical activation by 0.15 s at 90% damage
  const originalCd  = skill.cooldown;
  const originalBase = { ...skill.base };

  setTimeout(() => {
    if (!player || !entities || !engine) return;
    const prevDmg = skill.base.damage;
    skill.base.damage = Math.round((prevDmg ?? 0) * 0.9);
    skill.activate(player, entities, engine);
    skill.base.damage = prevDmg;
    // Don't restart cooldown from the echo
    skill._timer = originalCd;
  }, 150);
  void originalBase; // suppress lint
}

function _spellCascadeActivate(player, entities, engine, skill) {
  // Fire two extra copies offset ±60 px perpendicular to facing
  const px = player.facingY !== 0 ? player.facingY : 0;
  const py = -player.facingX;
  const offsets = [-60, 60];
  for (const off of offsets) {
    const ox = player.x + px * off;
    const oy = player.y + py * off;
    const savedX = player.x;
    const savedY = player.y;
    player.x = ox;
    player.y = oy;
    const prevDmg = skill.base.damage;
    skill.base.damage = Math.round(prevDmg * 0.8);
    skill.activate(player, entities, engine);
    skill.base.damage = prevDmg;
    skill._timer = skill.cooldown; // suppress the cascade's own cooldown restart
    player.x = savedX;
    player.y = savedY;
  }
}

// ─── Support Pool ─────────────────────────────────────────────────────────────
export const SUPPORT_POOL = [

  // ── Projectile Supports ─────────────────────────────────────────────────
  {
    id:               'pierce',
    name:             'Pierce',
    icon:             '→',
    description:      'Supported skills pierce 2 additional enemies.',
    color:            '#74b9ff',
    requiredTags:     ['Projectile'],
    incompatibleTags: [],
    modify(stats) {
      stats._pierce = (stats._pierce ?? 0) + 2;
    },
  },
  {
    id:               'fork',
    name:             'Fork',
    icon:             'Y',
    description:      'Projectiles fork into 2 on first hit. -20% damage.',
    color:            '#55efc4',
    requiredTags:     ['Projectile'],
    incompatibleTags: ['Chain'],
    modify(stats) {
      stats._forks   = (stats._forks ?? 0) + 1;
      stats.damage   = Math.round((stats.damage ?? 1) * 0.80);
    },
  },
  {
    id:               'chain',
    name:             'Chain',
    icon:             '⛓',
    description:      'Projectiles chain to 2 additional enemies. -25% damage per hop.',
    color:            '#a29bfe',
    requiredTags:     ['Projectile'],
    incompatibleTags: ['Fork'],
    modify(stats) {
      stats._chains  = (stats._chains ?? 0) + 2;
      stats.damage   = Math.round((stats.damage ?? 1) * 0.75);
    },
  },
  {
    id:               'gmp',
    name:             'Greater Multiple Projectiles',
    icon:             '≡',
    description:      '+4 extra projectiles in a spread. -30% damage each.',
    color:            '#fd79a8',
    requiredTags:     ['Projectile'],
    incompatibleTags: [],
    modify(stats) {
      stats._extraProjectiles = (stats._extraProjectiles ?? 0) + 4;
      stats.damage = Math.round((stats.damage ?? 1) * 0.70);
    },
  },
  {
    id:               'faster_projectiles',
    name:             'Faster Projectiles',
    icon:             '»',
    description:      'Projectiles travel 80% faster and 40% further.',
    color:            '#74b9ff',
    requiredTags:     ['Projectile'],
    incompatibleTags: [],
    modify(stats) {
      stats._speedMult   = (stats._speedMult ?? 1) * 1.80;
      stats._rangeMult   = (stats._rangeMult ?? 1) * 1.40;
    },
  },

  // ── Spell Supports ──────────────────────────────────────────────────────
  {
    id:               'spell_echo',
    name:             'Spell Echo',
    icon:             '↻',
    description:      'Spell fires twice; the second cast is delayed 0.15 s at 90% damage.',
    color:            '#a29bfe',
    requiredTags:     ['Spell'],
    incompatibleTags: ['Channelling'],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 0.90);
    },
    onActivate: _spellEchoActivate,
  },
  {
    id:               'spell_cascade',
    name:             'Spell Cascade',
    icon:             '⫶',
    description:      'Fires in 3 locations: target and ±60 px offsets. -20% each.',
    color:            '#55efc4',
    requiredTags:     ['Spell', 'AoE'],
    incompatibleTags: ['Channelling'],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 0.80);
    },
    onActivate: _spellCascadeActivate,
  },
  {
    id:               'controlled_destruction',
    name:             'Controlled Destruction',
    icon:             '💥',
    description:      '+40% more Spell Damage. -100% crit chance.',
    color:            '#e17055',
    requiredTags:     ['Spell'],
    incompatibleTags: [],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 1.40);
    },
  },

  // ── AoE Supports ────────────────────────────────────────────────────────
  {
    id:               'concentrated_effect',
    name:             'Concentrated Effect',
    icon:             '◎',
    description:      '+40% AoE damage. -35% AoE radius.',
    color:            '#fdcb6e',
    requiredTags:     ['AoE'],
    incompatibleTags: [],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 1.40);
      for (const key of ['radius', 'pillarRadius', 'meleeRadius', 'impactRadius', 'afterRadius']) {
        if (stats[key] != null) stats[key] = Math.round(stats[key] * 0.65);
      }
    },
  },
  {
    id:               'increased_aoe',
    name:             'Increased Area of Effect',
    icon:             '○',
    description:      '+40% AoE radius. -15% damage.',
    color:            '#74b9ff',
    requiredTags:     ['AoE'],
    incompatibleTags: [],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 0.85);
      for (const key of ['radius', 'pillarRadius', 'meleeRadius', 'impactRadius', 'afterRadius']) {
        if (stats[key] != null) stats[key] = Math.round(stats[key] * 1.40);
      }
    },
  },

  // ── Damage Addition Supports ────────────────────────────────────────────
  {
    id:               'added_blaze',
    name:             'Added Blaze Damage',
    icon:             '🔥',
    description:      '+14 added Blaze damage per hit. Skill gains Blaze tag.',
    color:            '#e17055',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats, skill) {
      stats.damage = (stats.damage ?? 0) + 14;
      if (!skill.tags.includes('Blaze')) skill._tempTags = [...(skill._tempTags ?? []), 'Blaze'];
    },
  },
  {
    id:               'added_frost',
    name:             'Added Frost Damage',
    icon:             '❄️',
    description:      '+11 added Frost damage. +10% base Chill chance. Skill gains Frost tag.',
    color:            '#74b9ff',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats, skill) {
      stats.damage = (stats.damage ?? 0) + 11;
      stats._extraChillChance = (stats._extraChillChance ?? 0) + 0.10;
      if (!skill.tags.includes('Frost')) skill._tempTags = [...(skill._tempTags ?? []), 'Frost'];
    },
  },
  {
    id:               'added_thunder',
    name:             'Added Thunder Damage',
    icon:             '⚡',
    description:      '+14 added Thunder damage (high variance). +5% Shock chance. Skill gains Thunder tag.',
    color:            '#fdcb6e',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats, skill) {
      const variance = Math.round((Math.random() - 0.5) * 16);
      stats.damage = (stats.damage ?? 0) + 14 + variance;
      stats._extraShockChance = (stats._extraShockChance ?? 0) + 0.05;
      if (!skill.tags.includes('Thunder')) skill._tempTags = [...(skill._tempTags ?? []), 'Thunder'];
    },
  },
  {
    id:               'added_unholy',
    name:             'Added Unholy Damage',
    icon:             '☠',
    description:      '+14 added Unholy damage. Skill gains Unholy tag.',
    color:            '#6c5ce7',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats, skill) {
      stats.damage = (stats.damage ?? 0) + 14;
      if (!skill.tags.includes('Unholy')) skill._tempTags = [...(skill._tempTags ?? []), 'Unholy'];
    },
  },
  {
    id:               'life_tap',
    name:             'Life Tap',
    icon:             '💉',
    description:      'Costs 10% max HP on activation. +25% more damage.',
    color:            '#d63031',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats.damage = Math.round((stats.damage ?? 1) * 1.25);
    },
    onActivate(player) {
      if (player.health > player.maxHealth * 0.15) {
        player.health -= player.maxHealth * 0.10;
      }
    },
  },

  // ── Ailment Supports ────────────────────────────────────────────────────
  {
    id:               'deadly_ailments',
    name:             'Deadly Ailments',
    icon:             '☣',
    description:      '+60% ailment damage from supported skills. -10% hit damage.',
    color:            '#55efc4',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats.damage      = Math.round((stats.damage ?? 1) * 0.90);
      stats._ailmentDmgMult = (stats._ailmentDmgMult ?? 1) * 1.60;
    },
  },
  {
    id:               'swift_affliction',
    name:             'Swift Affliction',
    icon:             '⏩',
    description:      '+50% ailment damage; -30% ailment duration.',
    color:            '#fd79a8',
    requiredTags:     ['Duration'],
    incompatibleTags: [],
    modify(stats) {
      stats._ailmentDmgMult  = (stats._ailmentDmgMult ?? 1) * 1.50;
      stats._ailmentDurMult  = (stats._ailmentDurMult ?? 1) * 0.70;
    },
  },
  {
    id:               'hypothermia',
    name:             'Hypothermia',
    icon:             '🥶',
    description:      '+30% more damage against Chilled or Frozen enemies.',
    color:            '#74b9ff',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats._vsChilledMult = (stats._vsChilledMult ?? 1) * 1.30;
    },
  },
  {
    id:               'vile_toxins',
    name:             'Vile Toxins',
    icon:             '🧪',
    description:      '+8% more damage per Poison stack on enemy (max ×8).',
    color:            '#55efc4',
    requiredTags:     ['Unholy'],
    incompatibleTags: [],
    modify(stats) {
      stats._vileStacks = 8; // runtime code in CollisionSystem reads this
    },
  },
  {
    id:               'burning_damage',
    name:             'Burning Damage',
    icon:             '🔥',
    description:      '+30% more Burning (Ignite DoT) damage.',
    color:            '#e17055',
    requiredTags:     ['Blaze'],
    incompatibleTags: [],
    modify(stats) {
      stats._burningMult = (stats._burningMult ?? 1) * 1.30;
    },
  },

  // ── On-Hit Supports ─────────────────────────────────────────────────────
  {
    id:               'life_leech',
    name:             'Life Leech',
    icon:             '♥',
    description:      'Recover HP equal to 2% of damage dealt per hit.',
    color:            '#d63031',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats._lifeLeech = (stats._lifeLeech ?? 0) + 0.02;
    },
  },
  {
    id:               'culling_strike',
    name:             'Culling Strike',
    icon:             '✂',
    description:      'Instantly kill enemies at ≤10% HP.',
    color:            '#b2bec3',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats._cullingStrike = true;
    },
  },
  {
    id:               'momentum',
    name:             'Momentum',
    icon:             '▶',
    description:      '+5% more damage per successive hit on the same enemy (max ×5).',
    color:            '#fdcb6e',
    requiredTags:     [],
    incompatibleTags: [],
    modify(stats) {
      stats._momentum = true;
    },
  },

  // ── Placement / Trigger Supports ────────────────────────────────────────
  {
    id:               'trap',
    name:             'Trap',
    icon:             '⚙',
    description:      'Throws a trap that triggers on 60 px proximity after a 0.5 s arming delay.',
    color:            '#636e72',
    requiredTags:     [],
    incompatibleTags: ['Movement', 'Minion', 'Channelling'],
    modify(stats) {
      stats._trapArmDelay = 0.5;
      stats._trapRadius   = 60;
    },
  },

  // ── Duration Supports ────────────────────────────────────────────────────
  {
    id:               'increased_duration',
    name:             'Increased Duration',
    icon:             '⏱',
    description:      '+50% skill effect duration.',
    color:            '#a29bfe',
    requiredTags:     ['Duration'],
    incompatibleTags: [],
    modify(stats) {
      if (stats.duration != null) stats.duration = stats.duration * 1.50;
      // Buff timers handled by skills themselves reading this stat key
    },
  },
  {
    id:               'less_duration',
    name:             'Less Duration',
    icon:             '⏳',
    description:      '-40% duration. +30% more damage.',
    color:            '#e17055',
    requiredTags:     ['Duration'],
    incompatibleTags: [],
    modify(stats) {
      if (stats.duration != null) stats.duration = stats.duration * 0.60;
      stats.damage = Math.round((stats.damage ?? 1) * 1.30);
    },
  },
];

/** Lookup map keyed by support id. */
export const SUPPORT_MAP = Object.fromEntries(SUPPORT_POOL.map((s) => [s.id, s]));

/**
 * Build a live support instance from a plain support-gem itemDef.
 * Returns a SkillSupport-compatible object: { id, name, modify, onActivate }.
 * @param {object} gemItemDef — must have { gemId } field
 * @returns {object|null}
 */
export function makeSupportInstance(gemItemDef) {
  const gemId = gemItemDef?.gemId ?? gemItemDef?.id ?? null;
  const def = SUPPORT_MAP[gemId];
  if (!def) return null;
  const category = supportCategoryById(def.id);
  const categoryCurve = SCALING_CONFIG.gem.support[category] ?? SCALING_CONFIG.gem.support.utility;
  const manaMult = SUPPORT_TUNING.manaCostMultiplierBySupportId?.[def.id]
    ?? SUPPORT_TUNING.defaultManaCostMultiplier
    ?? 1;
  const normalizedItemDef = {
    type: 'support_gem',
    slot: 'support_gem',
    rarity: 'magic',
    gridW: 1,
    gridH: 1,
    gemId: def.id,
    id: gemItemDef?.id ?? def.id,
    name: gemItemDef?.name ?? `${def.name} Support`,
    icon: gemItemDef?.icon ?? def.icon ?? '◆',
    level: gemItemDef?.level ?? 1,
    maxLevel: gemItemDef?.maxLevel ?? 20,
    stackable: false,
    ...(gemItemDef ?? {}),
    gemId: def.id,
  };
  return {
    id:           def.id,
    name:         def.name,
    icon:         def.icon ?? '◆',
    modify: (stats, skill) => {
      const supportLevel = skill?.level ?? gemItemDef?.level ?? 1;
      const effectCurve = lerpByLevel(categoryCurve.effectRange, supportLevel);
      const manaCurve = lerpByLevel(categoryCurve.manaMult, supportLevel);
      const before = { ...stats };
      stats.manaCostMult = (stats.manaCostMult ?? 1) * manaMult * manaCurve;
      if (def.modify) def.modify.call(def, stats, skill);
      applySupportEffectCurve(stats, before, effectCurve);
    },
    onActivate:   def.onActivate?.bind(def) ?? null,
    requiredTags: def.requiredTags,
    incompatibleTags: def.incompatibleTags,
    _itemDef:     normalizedItemDef, // back-reference so we can retrieve it when unsocketing
  };
}

/**
 * Returns true if a support gem is compatible with a given skill.
 * @param {object} supportDef — entry from SUPPORT_POOL
 * @param {string[]} skillTags
 */
export function isSupportCompatible(supportDef, skillTags) {
  for (const req of supportDef.requiredTags ?? []) {
    if (!skillTags.includes(req)) return false;
  }
  for (const bad of supportDef.incompatibleTags ?? []) {
    if (skillTags.includes(bad)) return false;
  }
  return true;
}

/** Build a 1x1 inventory support-gem item from a support definition. */
export function createSupportGemItem(supportDef) {
  const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `support_gem_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  return {
    uid,
    id: `support_gem_${supportDef.id}`,
    type: 'support_gem',
    gemId: supportDef.id,
    level: 1,
    maxLevel: 20,
    name: `${supportDef.name} Support`,
    rarity: 'magic',
    slot: 'gem',
    gridW: 1,
    gridH: 1,
    gemIcon: supportDef.icon ?? '◆',
    description: supportDef.description,
    affixes: [],
  };
}

/**
 * characters.js — Phase 7 character definitions.
 *
 * Each character has:
 *   id              — unique string key, also used as localStorage unlock token
 *   name            — display name
 *   tagline         — short descriptor shown on the card
 *   lore            — flavour text shown on the card
 *   startingSkill   — key into runtime skill config / AUTO_SKILL_REGISTRY in Player.js
 *   baseStats       — overrides for PLAYER.MAX_HEALTH, PLAYER.MAX_MANA and PLAYER.SPEED
 *   bonusStats      — permanent passive bonuses applied at run start (same keys as applyStats)
 *   treeStartNodes  — pre-allocated passive tree node IDs (free, no point cost)
 *   unlockCondition — null = always unlocked; { type, value } for in-run achievement
 *   unlockHint      — human-readable unlock description shown on locked cards
 *   color           — accent hex used in the UI
 *   icon            — emoji icon shown on the card
 *
 * Unlock condition types:
 *   'survive'  — engine.elapsed >= value (seconds)
 *   'kills'    — engine.kills   >= value
 */

export const CHARACTERS = [
  // ── Sage ──────────────────────────────────────────────────────────────────
  {
    id:             'sage',
    name:           'Sage',
    tagline:        'Arcane Scholar',
    lore:           'A master of destructive magic. Frail, but devastating when the right tree is chosen.',
    startingSkill: 'MAGIC_BOLT',
    baseStats:      { maxHealth: 80, speed: 180, maxMana: 120 },
    bonusStats:     { xpMultiplier: 1.15 },   // +15% experience gained
    // Tree starting position: Sage's Gate — slot 24 (240°, Lightning-aligned).
    treeStartNodes: ['r2s24'],
    unlockCondition: null,                       // always unlocked
    unlockHint:     'Available from the start.',
    color:          '#3498db',
    icon:           '⚡',
  },

  // ── Rogue ──────────────────────────────────────────────────────────────────
  {
    id:             'rogue',
    name:           'Rogue',
    tagline:        'Shadow Runner',
    lore:           'Slippery and fast. Hard to catch, harder to contain. Vanishes before they see her coming.',
    startingSkill: 'SWIFT_ARROW',
    baseStats:      { maxHealth: 70, speed: 220, maxMana: 85 },
    bonusStats:     { pickupRadiusFlat: 20 },  // +20 pickup radius
    // Tree starting position: Rogue's Gate — slot 12 (120°, Cold-aligned).
    treeStartNodes: ['r2s12'],
    unlockCondition: { type: 'survive', value: 300 }, // survive 5 minutes
    unlockHint:      'Survive 5 minutes in a single run.',
    color:           '#2ecc71',
    icon:            '🗡',
  },

  // ── Warrior ──────────────────────────────────────────────────────────────
  {
    id:             'warrior',
    name:           'Warrior',
    tagline:        'Unstoppable Force',
    lore:           'An immovable wall of steel and resolve. Slow, but nothing keeps him down for long.',
    startingSkill: 'MELEE_STRIKE',
    baseStats:      { maxHealth: 140, speed: 140, maxMana: 105 },
    bonusStats:     { healthRegenPerS: 2 },    // +2 HP/s passive regen
    // Tree starting position: Warrior's Gate — slot 0 (0°, Blaze-aligned).
    treeStartNodes: ['r2s00'],
    unlockCondition: { type: 'kills', value: 200 }, // kill 200 enemies
    unlockHint:      'Kill 200 enemies in a single run.',
    color:           '#e74c3c',
    icon:            '🛡',
  },
];

/** O(1) lookup by id. */
export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

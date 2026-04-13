/**
 * passiveTree.js — Radial-grid passive tree data + stat helpers.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  HOW TO ADD NEW NODES  (read this before touching the NODES section)     │
 * │                                                                          │
 * │  1. PICK COORDINATES                                                     │
 * │     All nodes live on a polar grid: ring (0–5) and slot (0–31).         │
 * │     ID format: r{ring}s{slot:02d}  e.g.  r3s04                          │
 * │                                                                          │
 * │     Ring slot counts & degree spacing:                                   │
 * │       ring 0 →  8 slots, 45°   apart  (hub)                             │
 * │       ring 1 → 16 slots, 22.5° apart  (inner minor)                     │
 * │       ring 2 → 32 slots, 11.25° apart (class start gates)               │
 * │       ring 3 → 32 slots, 11.25° apart (minor branch)                    │
 * │       ring 4 → 32 slots, 11.25° apart (notable)                         │
 * │       ring 5 → 32 slots, 11.25° apart (outer / keystone)                │
 * │                                                                          │
 * │     Slot 0 = 0° (right). Increases clockwise.                           │
 * │     Class starts: Warrior r2s00 (0°), Rogue r2s11 (≈123°),             │
 * │                   Sage r2s21 (≈236°)                                    │
 * │                                                                          │
 * │  2. CHOOSE A TYPE                                                        │
 * │     'minor'    — small incremental bonus, small circle                  │
 * │     'notable'  — named meaningful bonus, large circle                   │
 * │     'keystone' — build-defining modifier, star shape                    │
 * │     'start'    — class gate, allocated free at character select         │
 * │     'hub'      — central shared node                                    │
 * │                                                                          │
 * │  3. WRITE THE STATS OBJECT                                               │
 * │     Use only keys from STAT_KEYS below. All values are additive deltas. │
 * │     Multiplicative stats use fractional addends:                         │
 * │       moveSpeedMult: 0.10 means "+10% move speed"                       │
 * │       castSpeed:     0.10 means "+10% cast speed" (added to base 1.0)   │
 * │                                                                          │
 * │  4. DECLARE CONNECTIONS ON BOTH ENDS                                     │
 * │     Add the new node's ID to each neighbour's `connections` array.      │
 * │     Add each neighbour's ID to the new node's `connections` array.      │
 * │     Valid connection patterns:                                           │
 * │       Arc  — same ring, slot differs by 1 (wraps at max slot)           │
 * │       Spoke — same slot, ring differs by 1                              │
 * │                                                                          │
 * │  5. VERIFY                                                               │
 * │     Run `npm run dev` and open the Passive Tree screen.                 │
 * │     The node should appear in the correct position with visible arcs.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// STAT KEYS — the exhaustive list of player properties a node may modify.
// applyStats / removeStats handle all of these.
// ─────────────────────────────────────────────────────────────────────────────
export const STAT_KEYS = [
  // Core vitals
  'maxHealth', 'maxMana', 'maxEnergyShield',
  // Regen
  'healthRegenPerS', 'manaRegenPerS',
  // Defense
  'totalArmor', 'totalEvasion',
  // Resistances (fractional, e.g. 0.10 = +10%)
  'blazeResistance', 'thunderResistance', 'frostResistance',
  'holyResistance', 'unholyResistance',
  // Multiplicative speed modifiers (fractional addends)
  'moveSpeedMult', 'castSpeed', 'attackSpeed', 'manaCostMult',
  // Skill damage bonuses (fractional addends)
  'spellDamage', 'attackDamage', 'aoeDamage',
  // Flat elemental damage
  'flatBlazeDamage', 'flatThunderDamage', 'flatFrostDamage',
  'flatHolyDamage', 'flatUnholyDamage', 'flatPhysicalDamage',
  // Increased elemental damage (fractional addend)
  'increasedBlazeDamage', 'increasedThunderDamage', 'increasedFrostDamage',
  'increasedHolyDamage', 'increasedUnholyDamage', 'increasedPhysicalDamage',
  // Penetration
  'blazePenetration', 'thunderPenetration', 'frostPenetration',
  'holyPenetration', 'unholyPenetration', 'physicalPenetration',
  // Utility
  'xpMultiplier', 'pickupRadiusBonus', 'projectileCountBonus',
  // Potion
  'potionEffectMult', 'potionDurationMult', 'potionChargeGainMult',
];

// ─────────────────────────────────────────────────────────────────────────────
// applyStats — applies a stat delta to the player; returns a snapshot for undo.
//
// For additive stats (most of them): snapshot records exactly the delta applied.
// For multiplicative stats (castSpeed, attackSpeed, moveSpeedMult,
//   manaCostMult, xpMultiplier, potionEffectMult, potionDurationMult,
//   potionChargeGainMult): the delta is multiplied in, snapshot stores it so
//   removeStats can divide it back out.
// ─────────────────────────────────────────────────────────────────────────────
const MULT_KEYS = new Set([
  'castSpeed', 'attackSpeed', 'moveSpeedMult', 'manaCostMult',
  'xpMultiplier', 'potionEffectMult', 'potionDurationMult', 'potionChargeGainMult',
]);

/**
 * Apply a stats object to the player. Returns a snapshot that can be passed to
 * removeStats to perfectly reverse the effect.
 * @param {object} player
 * @param {object} stats
 * @returns {object} snapshot
 */
export function applyStats(player, stats) {
  if (!stats || !player) return {};
  const snapshot = {};
  for (const [key, value] of Object.entries(stats)) {
    if (value == null) continue;
    if (MULT_KEYS.has(key)) {
      const before = player[key] ?? 1;
      player[key] = before * (1 + value);
      snapshot[key] = value; // store the fractional addend
    } else {
      player[key] = (player[key] ?? 0) + value;
      snapshot[key] = value;
    }
    // Heal up to new max when max vitals increase
    if (key === 'maxHealth')       player.health       = Math.min(player.health ?? 0, player.maxHealth);
    if (key === 'maxMana')         player.mana         = Math.min(player.mana   ?? 0, player.maxMana);
    if (key === 'maxEnergyShield') player.energyShield = Math.min(player.energyShield ?? 0, player.maxEnergyShield);
  }
  return snapshot;
}

/**
 * Reverse a previously applied snapshot.
 * @param {object} player
 * @param {object} snapshot
 */
export function removeStats(player, snapshot) {
  if (!snapshot || !player) return;
  for (const [key, value] of Object.entries(snapshot)) {
    if (value == null) continue;
    if (MULT_KEYS.has(key)) {
      player[key] = (player[key] ?? 1) / (1 + value);
    } else {
      player[key] = (player[key] ?? 0) - value;
    }
    // Clamp vitals after removal
    if (key === 'maxHealth')       player.health       = Math.min(player.health ?? 0, Math.max(1, player.maxHealth));
    if (key === 'maxMana')         player.mana         = Math.min(player.mana   ?? 0, Math.max(0, player.maxMana));
    if (key === 'maxEnergyShield') player.energyShield = Math.min(player.energyShield ?? 0, Math.max(0, player.maxEnergyShield));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODES
//
// Each entry: {
//   id:          string   — matches the key (format: r{ring}s{slot:02d})
//   label:       string   — display name
//   type:        'hub' | 'start' | 'minor' | 'notable' | 'keystone'
//   section:     'warrior' | 'rogue' | 'sage' | 'shared'
//   ring:        number   — 0–5
//   slot:        number   — 0–(slotsInRing-1)
//   stats:       object   — keys from STAT_KEYS, additive deltas
//   connections: string[] — IDs of directly connected nodes (bidirectional)
//   description: string   — human-readable tooltip text
// }
//
// RING SLOT COUNTS (for reference when adding nodes):
//   ring 0 →  8 slots   (45°   apart)   hub
//   ring 1 → 16 slots   (22.5° apart)   inner minor  [used in Phase 4]
//   ring 2 → 32 slots   (11.25° apart)  class start gates
//   ring 3 → 32 slots   (11.25° apart)  minor branches
//   ring 4 → 32 slots   (11.25° apart)  notables
//   ring 5 → 32 slots   (11.25° apart)  outer / keystones
// ─────────────────────────────────────────────────────────────────────────────
const NODES = [

  // ══════════════════════════════════════════════════════════════════════════
  //  WARRIOR SECTION  —  Fire · Strength · Armor
  //  Center: slot 0 (0°).  22 nodes spanning slots ~29–03 across all rings.
  //  Section color (renderer): ember-orange #e8722a
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r2s00', label: "Warrior's Gate",
    type: 'start', section: 'warrior', ring: 2, slot: 0,
    stats: {},
    connections: ['r3s00', 'r1s00'],
    description: 'Starting node for the Warrior. Also connects to the hub via Life\'s Crossing.',
  },
  // ── Ring 3 ──
  {
    id: 'r3s29', label: 'Iron Vein',
    type: 'minor', section: 'warrior', ring: 3, slot: 29,
    stats: { maxHealth: 20, totalArmor: 5 },
    connections: ['r3s30', 'r4s29'],
    description: '+20 maximum health. +5 armor.',
  },
  {
    id: 'r3s30', label: 'Forge Blood',
    type: 'minor', section: 'warrior', ring: 3, slot: 30,
    stats: { healthRegenPerS: 1.5, flatBlazeDamage: 6 },
    connections: ['r3s29', 'r3s31', 'r4s30'],
    description: '+1.5 HP/s regeneration. +6 flat fire damage.',
  },
  {
    id: 'r3s31', label: 'Smoldering Blood',
    type: 'minor', section: 'warrior', ring: 3, slot: 31,
    stats: { healthRegenPerS: 1.5, flatBlazeDamage: 6 },
    connections: ['r3s30', 'r3s00', 'r4s31'],
    description: '+1.5 HP/s regeneration. +6 flat fire damage.',
  },
  {
    id: 'r3s00', label: 'Thick Hide',
    type: 'minor', section: 'warrior', ring: 3, slot: 0,
    stats: { maxHealth: 25, totalArmor: 8 },
    connections: ['r2s00', 'r3s31', 'r3s01', 'r4s00'],
    description: '+25 maximum health. +8 armor.',
  },
  {
    id: 'r3s01', label: 'Ember Coils',
    type: 'minor', section: 'warrior', ring: 3, slot: 1,
    stats: { flatBlazeDamage: 12, increasedBlazeDamage: 0.06 },
    connections: ['r3s00', 'r3s02', 'r4s01'],
    description: '+12 flat fire damage. +6% increased fire damage.',
  },
  {
    id: 'r3s02', label: 'Charred Hide',
    type: 'minor', section: 'warrior', ring: 3, slot: 2,
    stats: { totalArmor: 10, blazeResistance: 0.05 },
    connections: ['r3s01', 'r3s03', 'r4s02'],
    description: '+10 armor. +5% fire resistance.',
  },
  {
    id: 'r3s03', label: 'Blaze Mark',
    type: 'minor', section: 'warrior', ring: 3, slot: 3,
    stats: { flatBlazeDamage: 10, increasedBlazeDamage: 0.06 },
    connections: ['r3s02', 'r3s04', 'r4s03'],
    description: '+10 flat fire damage. +6% increased fire damage.',
  },
  // ── Ring 4 ──
  {
    id: 'r4s29', label: 'Cinder Guard',
    type: 'minor', section: 'warrior', ring: 4, slot: 29,
    stats: { totalArmor: 12, blazeResistance: 0.05 },
    connections: ['r3s29', 'r4s30', 'r5s29'],
    description: '+12 armor. +5% fire resistance.',
  },
  {
    id: 'r4s30', label: 'Molten Core',
    type: 'notable', section: 'warrior', ring: 4, slot: 30,
    stats: { maxHealth: 35, flatBlazeDamage: 10, increasedBlazeDamage: 0.08 },
    connections: ['r3s30', 'r4s29', 'r4s31'],
    description: '+35 maximum health. +10 flat fire damage. +8% increased fire damage.',
  },
  {
    id: 'r4s31', label: 'Forge-Born',
    type: 'minor', section: 'warrior', ring: 4, slot: 31,
    stats: { maxHealth: 20, totalArmor: 8 },
    connections: ['r3s31', 'r4s30', 'r4s00', 'r5s31'],
    description: '+20 maximum health. +8 armor.',
  },
  {
    id: 'r4s00', label: 'Ironclad',
    type: 'notable', section: 'warrior', ring: 4, slot: 0,
    stats: { maxHealth: 55, totalArmor: 22 },
    connections: ['r3s00', 'r4s31', 'r4s01', 'r5s00'],
    description: '+55 maximum health. +22 armor. Built for endurance.',
  },
  {
    id: 'r4s01', label: 'Blazeheart',
    type: 'notable', section: 'warrior', ring: 4, slot: 1,
    stats: { flatBlazeDamage: 22, increasedBlazeDamage: 0.14 },
    connections: ['r3s01', 'r4s00', 'r4s02', 'r5s01'],
    description: '+22 flat fire damage. +14% increased fire damage. The furnace burns within.',
  },
  {
    id: 'r4s02', label: 'Blaze Brand',
    type: 'minor', section: 'warrior', ring: 4, slot: 2,
    stats: { flatBlazeDamage: 12, increasedBlazeDamage: 0.08 },
    connections: ['r3s02', 'r4s01', 'r4s03', 'r5s02'],
    description: '+12 flat fire damage. +8% increased fire damage.',
  },
  {
    id: 'r4s03', label: 'Scorched Earth',
    type: 'notable', section: 'warrior', ring: 4, slot: 3,
    stats: { flatBlazeDamage: 18, aoeDamage: 0.12, increasedBlazeDamage: 0.08 },
    connections: ['r3s03', 'r4s02', 'r5s03'],
    description: '+18 flat fire damage. +12% AoE damage. +8% increased fire damage. Leave nothing but ash.',
  },
  // ── Ring 5 ──
  {
    id: 'r5s29', label: 'Volcanic',
    type: 'minor', section: 'warrior', ring: 5, slot: 29,
    stats: { flatBlazeDamage: 18, increasedBlazeDamage: 0.08 },
    connections: ['r4s29', 'r5s30'],
    description: '+18 flat fire damage. +8% increased fire damage.',
  },
  {
    id: 'r5s30', label: 'Ashforged',
    type: 'minor', section: 'warrior', ring: 5, slot: 30,
    stats: { maxHealth: 25, totalArmor: 8, flatBlazeDamage: 5 },
    connections: ['r5s29', 'r5s31'],
    description: '+25 maximum health. +8 armor. +5 flat fire damage.',
  },
  {
    id: 'r5s31', label: 'Undying Flame',
    type: 'minor', section: 'warrior', ring: 5, slot: 31,
    stats: { maxHealth: 20, healthRegenPerS: 1.0 },
    connections: ['r5s30', 'r4s31', 'r5s00'],
    description: '+20 maximum health. +1 HP/s regeneration.',
  },
  {
    id: 'r5s00', label: "Pyre's Dominion",
    type: 'keystone', section: 'warrior', ring: 5, slot: 0,
    stats: { maxHealth: 40, totalArmor: 15, flatBlazeDamage: 15, increasedBlazeDamage: 0.10 },
    connections: ['r4s00', 'r5s31', 'r5s01'],
    description: 'Every 2s erupts in a fire nova hitting all enemies within 280px. +40 max HP. +15 armor. +15 flat fire.',
  },
  {
    id: 'r5s01', label: "Inferno's Edge",
    type: 'minor', section: 'warrior', ring: 5, slot: 1,
    stats: { flatBlazeDamage: 18, increasedBlazeDamage: 0.08 },
    connections: ['r4s01', 'r5s00', 'r5s02'],
    description: '+18 flat fire damage. +8% increased fire damage.',
  },
  {
    id: 'r5s02', label: 'Searing Brand',
    type: 'minor', section: 'warrior', ring: 5, slot: 2,
    stats: { flatBlazeDamage: 15, increasedBlazeDamage: 0.06 },
    connections: ['r4s02', 'r5s01', 'r5s03'],
    description: '+15 flat fire damage. +6% increased fire damage.',
  },
  {
    id: 'r5s03', label: "Pyre's Wake",
    type: 'minor', section: 'warrior', ring: 5, slot: 3,
    stats: { flatBlazeDamage: 18, increasedBlazeDamage: 0.10 },
    connections: ['r4s03', 'r5s02'],
    description: '+18 flat fire damage. +10% increased fire damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SHARED — Cross-section bridge (Warrior → Rogue)
  //  Slots 4–7 in ring 3 (45°–78.75°). Cost: 4 shared points to cross.
  //  Section color (renderer): soft-gold #c8a84b
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r3s04', label: 'Emberglass',
    type: 'minor', section: 'shared', ring: 3, slot: 4,
    stats: { maxHealth: 10, flatBlazeDamage: 5, flatFrostDamage: 4 },
    connections: ['r3s03', 'r3s05'],
    description: '+10 HP. +5 flat fire damage. +4 flat cold damage. The elements begrudgingly coexist.',
  },
  {
    id: 'r3s05', label: 'Shard of Halves',
    type: 'notable', section: 'shared', ring: 3, slot: 5,
    stats: { maxHealth: 18, flatBlazeDamage: 7, flatFrostDamage: 7, moveSpeedMult: 0.04 },
    connections: ['r3s04', 'r3s06'],
    description: '+18 HP. +7 flat fire & cold damage each. +4% move speed. A soul split between two worlds.',
  },
  {
    id: 'r3s06', label: 'Frostburn Mantle',
    type: 'minor', section: 'shared', ring: 3, slot: 6,
    stats: { maxHealth: 8, flatFrostDamage: 6, flatBlazeDamage: 6 },
    connections: ['r3s05', 'r3s07'],
    description: '+8 HP. +6 flat cold damage. +6 flat fire damage.',
  },
  {
    id: 'r3s07', label: 'Cold Hearth',
    type: 'minor', section: 'shared', ring: 3, slot: 7,
    stats: { maxHealth: 10, flatFrostDamage: 8, flatBlazeDamage: 5 },
    connections: ['r3s06', 'r3s08'],
    description: '+10 HP. +8 flat cold damage. +5 flat fire damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ROGUE SECTION  —  Cold · Speed · Regen
  //  Center: slot 11 (123.75°).  22 nodes spanning slots ~08–14 across rings.
  //  Section color (renderer): ice-blue #4ab8d8
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r2s11', label: "Rogue's Gate",
    type: 'start', section: 'rogue', ring: 2, slot: 11,
    stats: {},
    connections: ['r3s11'],
    description: 'Starting node for the Rogue. Grants access to the cold and speed paths.',
  },
  // ── Ring 3 ──
  {
    id: 'r3s08', label: 'Shadow Veil',
    type: 'minor', section: 'rogue', ring: 3, slot: 8,
    stats: { totalEvasion: 80, healthRegenPerS: 0.8 },
    connections: ['r2s08', 'r3s07', 'r3s09', 'r4s08'],
    description: '+80 evasion. +0.8 HP/s. Also reachable from the Warrior-Rogue cross-section bridge.',
  },
  {
    id: 'r3s09', label: 'Crisp Air',
    type: 'minor', section: 'rogue', ring: 3, slot: 9,
    stats: { frostResistance: 0.05, flatFrostDamage: 6 },
    connections: ['r3s08', 'r3s10', 'r4s09'],
    description: '+5% cold resistance. +6 flat cold damage.',
  },
  {
    id: 'r3s10', label: 'Frostfoot',
    type: 'minor', section: 'rogue', ring: 3, slot: 10,
    stats: { moveSpeedMult: 0.06, frostResistance: 0.05 },
    connections: ['r3s09', 'r3s11', 'r4s10'],
    description: '+6% movement speed. +5% cold resistance.',
  },
  {
    id: 'r3s11', label: 'Shiver Step',
    type: 'minor', section: 'rogue', ring: 3, slot: 11,
    stats: { moveSpeedMult: 0.08, flatFrostDamage: 8 },
    connections: ['r2s11', 'r3s10', 'r3s12', 'r4s11'],
    description: '+8% movement speed. +8 flat cold damage.',
  },
  {
    id: 'r3s12', label: 'Cold Reflex',
    type: 'minor', section: 'rogue', ring: 3, slot: 12,
    stats: { attackSpeed: 0.08, flatFrostDamage: 6 },
    connections: ['r3s11', 'r3s13', 'r4s12'],
    description: '+8% attack speed. +6 flat cold damage.',
  },
  {
    id: 'r3s13', label: 'Chill Vein',
    type: 'minor', section: 'rogue', ring: 3, slot: 13,
    stats: { healthRegenPerS: 1.2, frostResistance: 0.06 },
    connections: ['r3s12', 'r3s14', 'r4s13'],
    description: '+1.2 HP/s regeneration. +6% cold resistance.',
  },
  {
    id: 'r3s14', label: 'Cold Trail',
    type: 'minor', section: 'rogue', ring: 3, slot: 14,
    stats: { frostResistance: 0.04, flatFrostDamage: 6 },
    connections: ['r3s13', 'r4s14'],
    description: '+4% cold resistance. +6 flat cold damage.',
  },
  // ── Ring 4 ──
  {
    id: 'r4s08', label: 'Blizzard Step',
    type: 'notable', section: 'rogue', ring: 4, slot: 8,
    stats: { moveSpeedMult: 0.10, flatFrostDamage: 14, increasedFrostDamage: 0.06 },
    connections: ['r3s08', 'r4s09', 'r5s08'],
    description: '+10% movement speed. +14 flat cold damage. +6% increased cold damage.',
  },
  {
    id: 'r4s09', label: 'Gelid Reflex',
    type: 'minor', section: 'rogue', ring: 4, slot: 9,
    stats: { attackSpeed: 0.07, flatFrostDamage: 5 },
    connections: ['r3s09', 'r4s08', 'r4s10', 'r5s09'],
    description: '+7% attack speed. +5 flat cold damage.',
  },
  {
    id: 'r4s10', label: 'Windstep',
    type: 'notable', section: 'rogue', ring: 4, slot: 10,
    stats: { moveSpeedMult: 0.12, healthRegenPerS: 1.5 },
    connections: ['r3s10', 'r4s09', 'r4s11', 'r5s10'],
    description: '+12% movement speed. +1.5 HP/s regeneration. Always in motion.',
  },
  {
    id: 'r4s11', label: 'Frostbite',
    type: 'notable', section: 'rogue', ring: 4, slot: 11,
    stats: { flatFrostDamage: 20, increasedFrostDamage: 0.14, frostResistance: 0.06 },
    connections: ['r3s11', 'r4s10', 'r4s12', 'r5s11'],
    description: '+20 flat cold damage. +14% increased cold damage. +6% cold resistance.',
  },
  {
    id: 'r4s12', label: 'Swift Killer',
    type: 'minor', section: 'rogue', ring: 4, slot: 12,
    stats: { attackSpeed: 0.10, flatFrostDamage: 10 },
    connections: ['r3s12', 'r4s11', 'r4s13', 'r5s12'],
    description: '+10% attack speed. +10 flat cold damage.',
  },
  {
    id: 'r4s13', label: 'Frozen Reflex',
    type: 'minor', section: 'rogue', ring: 4, slot: 13,
    stats: { attackSpeed: 0.08, moveSpeedMult: 0.05 },
    connections: ['r3s13', 'r4s12', 'r4s14', 'r5s13'],
    description: '+8% attack speed. +5% movement speed.',
  },
  {
    id: 'r4s14', label: 'Frostweave',
    type: 'notable', section: 'rogue', ring: 4, slot: 14,
    stats: { attackSpeed: 0.08, flatFrostDamage: 16, increasedFrostDamage: 0.08 },
    connections: ['r3s14', 'r4s13', 'r5s14'],
    description: '+8% attack speed. +16 flat cold damage. +8% increased cold damage.',
  },
  // ── Ring 5 ──
  {
    id: 'r5s08', label: 'Deep Freeze',
    type: 'minor', section: 'rogue', ring: 5, slot: 8,
    stats: { flatFrostDamage: 16, increasedFrostDamage: 0.08 },
    connections: ['r4s08', 'r5s09'],
    description: '+16 flat cold damage. +8% increased cold damage.',
  },
  {
    id: 'r5s09', label: 'Hypothermia',
    type: 'minor', section: 'rogue', ring: 5, slot: 9,
    stats: { moveSpeedMult: 0.06, flatFrostDamage: 10 },
    connections: ['r5s08', 'r4s09', 'r5s10'],
    description: '+6% movement speed. +10 flat cold damage.',
  },
  {
    id: 'r5s10', label: 'Arctic Wind',
    type: 'minor', section: 'rogue', ring: 5, slot: 10,
    stats: { moveSpeedMult: 0.10, flatFrostDamage: 8 },
    connections: ['r5s09', 'r4s10', 'r5s11'],
    description: '+10% movement speed. +8 flat cold damage.',
  },
  {
    id: 'r5s11', label: 'Ghost Step',
    type: 'keystone', section: 'rogue', ring: 5, slot: 11,
    stats: { moveSpeedMult: 0.18, flatFrostDamage: 12, attackSpeed: 0.10 },
    connections: ['r4s11', 'r5s10', 'r5s12'],
    description: 'Move speed scales 0→+40% as HP drops to 10%. +18% speed. +12 flat cold. +10% attack speed.',
  },
  {
    id: 'r5s12', label: 'Shatter',
    type: 'minor', section: 'rogue', ring: 5, slot: 12,
    stats: { flatFrostDamage: 18, increasedFrostDamage: 0.10 },
    connections: ['r4s12', 'r5s11', 'r5s13'],
    description: '+18 flat cold damage. +10% increased cold damage.',
  },
  {
    id: 'r5s13', label: 'Shattered Bone',
    type: 'minor', section: 'rogue', ring: 5, slot: 13,
    stats: { flatFrostDamage: 15, increasedFrostDamage: 0.08 },
    connections: ['r5s12', 'r4s13', 'r5s14'],
    description: '+15 flat cold damage. +8% increased cold damage.',
  },
  {
    id: 'r5s14', label: "Winter's Edge",
    type: 'minor', section: 'rogue', ring: 5, slot: 14,
    stats: { flatFrostDamage: 18, increasedFrostDamage: 0.10 },
    connections: ['r4s14', 'r5s13'],
    description: '+18 flat cold damage. +10% increased cold damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SAGE SECTION  —  Lightning · Mana · Cast Speed
  //  Center: slot 21 (236.25°).  22 nodes spanning slots ~18–24 across rings.
  //  Section color (renderer): lightning-gold #f0d050
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r2s21', label: "Sage's Gate",
    type: 'start', section: 'sage', ring: 2, slot: 21,
    stats: {},
    connections: ['r3s21'],
    description: 'Starting node for the Sage. Grants access to the lightning and mana paths.',
  },
  // ── Ring 3 ──
  {
    id: 'r3s18', label: 'Leyline Tap',
    type: 'minor', section: 'sage', ring: 3, slot: 18,
    stats: { maxMana: 12, flatThunderDamage: 6 },
    connections: ['r3s19', 'r4s18'],
    description: '+12 maximum mana. +6 flat lightning damage.',
  },
  {
    id: 'r3s19', label: 'Static Field',
    type: 'minor', section: 'sage', ring: 3, slot: 19,
    stats: { flatThunderDamage: 8, manaRegenPerS: 0.6 },
    connections: ['r3s18', 'r3s20', 'r4s19'],
    description: '+8 flat lightning damage. +0.6 mana/s regeneration.',
  },
  {
    id: 'r3s20', label: 'Charged Mind',
    type: 'minor', section: 'sage', ring: 3, slot: 20,
    stats: { maxMana: 18, manaRegenPerS: 0.8 },
    connections: ['r3s19', 'r3s21', 'r4s20'],
    description: '+18 maximum mana. +0.8 mana/s regeneration.',
  },
  {
    id: 'r3s21', label: 'Spark Touch',
    type: 'minor', section: 'sage', ring: 3, slot: 21,
    stats: { flatThunderDamage: 10, maxMana: 15 },
    connections: ['r2s21', 'r3s20', 'r3s22', 'r4s21'],
    description: '+10 flat lightning damage. +15 maximum mana.',
  },
  {
    id: 'r3s22', label: 'Arc Surge',
    type: 'minor', section: 'sage', ring: 3, slot: 22,
    stats: { castSpeed: 0.07, flatThunderDamage: 8 },
    connections: ['r3s21', 'r3s23', 'r4s22'],
    description: '+7% cast speed. +8 flat lightning damage.',
  },
  {
    id: 'r3s23', label: 'Mana Flow',
    type: 'minor', section: 'sage', ring: 3, slot: 23,
    stats: { maxMana: 22, manaRegenPerS: 1.0 },
    connections: ['r3s22', 'r3s24', 'r4s23'],
    description: '+22 maximum mana. +1.0 mana/s regeneration.',
  },
  {
    id: 'r3s24', label: 'Shock Web',
    type: 'minor', section: 'sage', ring: 3, slot: 24,
    stats: { flatThunderDamage: 10, manaRegenPerS: 0.8 },
    connections: ['r2s24', 'r3s23', 'r4s24'],
    description: '+10 flat lightning damage. +0.8 mana/s. Also reachable from Earthen Will hub.',
  },
  // ── Ring 4 ──
  {
    id: 'r4s18', label: 'Conductor',
    type: 'notable', section: 'sage', ring: 4, slot: 18,
    stats: { maxMana: 35, flatThunderDamage: 12, increasedThunderDamage: 0.08 },
    connections: ['r3s18', 'r4s19', 'r5s18'],
    description: '+35 maximum mana. +12 flat lightning damage. +8% increased lightning damage.',
  },
  {
    id: 'r4s19', label: 'Surge Vent',
    type: 'minor', section: 'sage', ring: 4, slot: 19,
    stats: { castSpeed: 0.06, flatThunderDamage: 8 },
    connections: ['r3s19', 'r4s18', 'r4s20', 'r5s19'],
    description: '+6% cast speed. +8 flat lightning damage.',
  },
  {
    id: 'r4s20', label: 'Arcane Reservoir',
    type: 'notable', section: 'sage', ring: 4, slot: 20,
    stats: { maxMana: 45, manaRegenPerS: 2.5 },
    connections: ['r3s20', 'r4s19', 'r4s21', 'r5s20'],
    description: '+45 maximum mana. +2.5 mana/s regeneration. The well runs deep.',
  },
  {
    id: 'r4s21', label: 'Stormcaller',
    type: 'notable', section: 'sage', ring: 4, slot: 21,
    stats: { flatThunderDamage: 22, increasedThunderDamage: 0.14, castSpeed: 0.10 },
    connections: ['r3s21', 'r4s20', 'r4s22', 'r5s21'],
    description: '+22 flat lightning damage. +14% increased lightning damage. +10% cast speed.',
  },
  {
    id: 'r4s22', label: 'Tempest Mind',
    type: 'minor', section: 'sage', ring: 4, slot: 22,
    stats: { castSpeed: 0.08, maxMana: 20 },
    connections: ['r3s22', 'r4s21', 'r4s23', 'r5s22'],
    description: '+8% cast speed. +20 maximum mana.',
  },
  {
    id: 'r4s23', label: 'Overcharged',
    type: 'minor', section: 'sage', ring: 4, slot: 23,
    stats: { flatThunderDamage: 12, manaRegenPerS: 1.2 },
    connections: ['r3s23', 'r4s22', 'r4s24', 'r5s23'],
    description: '+12 flat lightning damage. +1.2 mana/s regeneration.',
  },
  {
    id: 'r4s24', label: 'Tempest Coil',
    type: 'notable', section: 'sage', ring: 4, slot: 24,
    stats: { maxMana: 20, flatThunderDamage: 16, increasedThunderDamage: 0.10 },
    connections: ['r3s24', 'r4s23', 'r5s24'],
    description: '+20 maximum mana. +16 flat lightning damage. +10% increased lightning damage.',
  },
  // ── Ring 5 ──
  {
    id: 'r5s18', label: 'Ball Lightning',
    type: 'minor', section: 'sage', ring: 5, slot: 18,
    stats: { flatThunderDamage: 14, increasedThunderDamage: 0.10 },
    connections: ['r4s18', 'r5s19'],
    description: '+14 flat lightning damage. +10% increased lightning damage.',
  },
  {
    id: 'r5s19', label: 'Voltaic',
    type: 'minor', section: 'sage', ring: 5, slot: 19,
    stats: { castSpeed: 0.08, flatThunderDamage: 10 },
    connections: ['r5s18', 'r4s19', 'r5s20'],
    description: '+8% cast speed. +10 flat lightning damage.',
  },
  {
    id: 'r5s20', label: 'Lightning Rod',
    type: 'minor', section: 'sage', ring: 5, slot: 20,
    stats: { flatThunderDamage: 12, increasedThunderDamage: 0.08 },
    connections: ['r5s19', 'r4s20', 'r5s21'],
    description: '+12 flat lightning damage. +8% increased lightning damage.',
  },
  {
    id: 'r5s21', label: 'Overload',
    type: 'keystone', section: 'sage', ring: 5, slot: 21,
    stats: { flatThunderDamage: 18, castSpeed: 0.15, maxMana: 35 },
    connections: ['r4s21', 'r5s20', 'r5s22'],
    description: 'Every 5th primary skill cast triggers a free lightning nova. +18 flat lightning. +15% cast. +35 mana.',
  },
  {
    id: 'r5s22', label: 'Chain Lightning',
    type: 'minor', section: 'sage', ring: 5, slot: 22,
    stats: { flatThunderDamage: 18, increasedThunderDamage: 0.10 },
    connections: ['r4s22', 'r5s21', 'r5s23'],
    description: '+18 flat lightning damage. +10% increased lightning damage.',
  },
  {
    id: 'r5s23', label: 'Bifurcate',
    type: 'minor', section: 'sage', ring: 5, slot: 23,
    stats: { flatThunderDamage: 12, increasedThunderDamage: 0.08, castSpeed: 0.05 },
    connections: ['r5s22', 'r4s23', 'r5s24'],
    description: '+12 flat lightning damage. +8% increased lightning damage. +5% cast speed.',
  },
  {
    id: 'r5s24', label: 'Storm Surge',
    type: 'minor', section: 'sage', ring: 5, slot: 24,
    stats: { flatThunderDamage: 18, increasedThunderDamage: 0.10 },
    connections: ['r4s24', 'r5s23'],
    description: '+18 flat lightning damage. +10% increased lightning damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  HUB NODES  —  Shared utility  (ring 0, 45° spacing)
  //  Each hub node is now wired outward via a ring-1 bridge node.
  //  Vitality (0°)  → r1s00 → r2s00 (Warrior Gate)
  //  Clarity  (90°) → r1s04 → r2s08 → r3s08 (Rogue left branch)
  //  Resilience (180°) → r1s08  (anchor, no outward class path yet)
  //  Earthen Will (270°) → r1s12 → r2s24 → r3s24 (Sage right branch)
  //  Section color (renderer): soft-gold #c8a84b
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r0s00', label: 'Vitality',
    type: 'hub', section: 'shared', ring: 0, slot: 0,
    stats: { maxHealth: 25, healthRegenPerS: 1.0 },
    connections: ['r1s00'],
    description: '+25 maximum health. +1 HP/s regeneration. The heart of endurance.',
  },
  {
    id: 'r0s02', label: 'Clarity',
    type: 'hub', section: 'shared', ring: 0, slot: 2,
    stats: { maxMana: 25, manaRegenPerS: 1.5 },
    connections: ['r1s04'],
    description: '+25 maximum mana. +1.5 mana/s regeneration. A quiet mind flows freely.',
  },
  {
    id: 'r0s04', label: 'Resilience',
    type: 'hub', section: 'shared', ring: 0, slot: 4,
    stats: { totalArmor: 12, totalEvasion: 12 },
    connections: ['r1s08'],
    description: '+12 armor. +12 evasion. Hard to hurt, harder to stop.',
  },
  {
    id: 'r0s06', label: 'Earthen Will',
    type: 'hub', section: 'shared', ring: 0, slot: 6,
    stats: { maxHealth: 15, maxMana: 15, healthRegenPerS: 0.5 },
    connections: ['r1s12'],
    description: '+15 max health. +15 max mana. +0.5 HP/s regeneration.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SHARED — Hub ring-1 bridge nodes (one per hub, 4 nodes)
  //  Each sits at the same angular position as its hub node.
  //    r1s00 at  0°  — Vitality  → Warrior Gate
  //    r1s04 at 90°  — Clarity   → Crossroads → Rogue left
  //    r1s08 at 180° — Resilience (anchor for future expansion)
  //    r1s12 at 270° — Earthen Will → Sage right entry
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r1s00', label: "Life's Crossing",
    type: 'minor', section: 'shared', ring: 1, slot: 0,
    stats: { maxHealth: 15, healthRegenPerS: 0.5 },
    connections: ['r0s00', 'r2s00'],
    description: '+15 max health. +0.5 HP/s regen. Bridges the Vitality hub to the Warrior Gate.',
  },
  {
    id: 'r1s04', label: 'Mana Veil',
    type: 'minor', section: 'shared', ring: 1, slot: 4,
    stats: { maxMana: 12, manaRegenPerS: 0.6 },
    connections: ['r0s02', 'r2s08'],
    description: '+12 max mana. +0.6 mana/s regen. Bridges Clarity into the Crossroads cross-class path.',
  },
  {
    id: 'r1s08', label: 'Steel Heart',
    type: 'minor', section: 'shared', ring: 1, slot: 8,
    stats: { totalArmor: 8, totalEvasion: 6 },
    connections: ['r0s04'],
    description: '+8 armor. +6 evasion. Channels the Resilience hub\'s defensive energy.',
  },
  {
    id: 'r1s12', label: 'Spirit Root',
    type: 'minor', section: 'shared', ring: 1, slot: 12,
    stats: { maxHealth: 10, maxMana: 8 },
    connections: ['r0s06', 'r2s24'],
    description: '+10 max health. +8 max mana. Channels Earthen Will into the Sage right branch.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SHARED — Ring-2 cross-hub transit nodes
  //    r2s08 at 90°  — Mana Veil (r1s04) → Shadow Veil (r3s08, Rogue left)
  //    r2s24 at 270° — Spirit Root (r1s12) → Shock Web (r3s24, Sage right)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r2s08', label: 'Crossroads',
    type: 'minor', section: 'shared', ring: 2, slot: 8,
    stats: { maxHealth: 12, maxMana: 10 },
    connections: ['r1s04', 'r3s08'],
    description: '+12 max health. +10 max mana. Where the Clarity hub path meets the Rogue\'s left wing.',
  },
  {
    id: 'r2s24', label: 'Earthen Transit',
    type: 'minor', section: 'shared', ring: 2, slot: 24,
    stats: { maxMana: 10, maxHealth: 8 },
    connections: ['r1s12', 'r3s24'],
    description: '+10 max mana. +8 max health. Where the Earthen Will hub path meets the Sage\'s right wing.',
  },
];

/**
 * Flat lookup map: nodeId → node object.
 * All code outside this file should use TREE_NODE_MAP rather than NODES.
 */
export const TREE_NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]));

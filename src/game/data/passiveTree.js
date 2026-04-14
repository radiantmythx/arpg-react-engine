
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

// ─────────────────────────────────────────────────────────────────────────────
// NODES
//
// Each entry: {
//   id:          string   — matches the key (format: r{ring}s{slot:02d})
//   label:       string   — display name
//   type:        'hub' | 'start' | 'minor' | 'notable' | 'keystone'
//   section:     'warrior' | 'rogue' | 'sage' | 'shared'
//   ring:        number   — 0–5
//   slot:        number   — 0–35 (rings 2–5); 0–15 (ring 1); 0–7 (ring 0)
//   stats:       object   — keys from STAT_KEYS, additive deltas
//   connections: string[] — IDs of directly connected nodes (bidirectional)
//   description: string   — human-readable tooltip text
// }
//
// RING SLOT COUNTS (36-slot era):
//   ring 0 →  8 slots   (45°  apart)   hub
//   ring 1 → 16 slots   (22.5° apart)  inner minor
//   ring 2 → 36 slots   (10°  apart)   class start gates
//   ring 3 → 36 slots   (10°  apart)   minor branches         [E2P4–E2P6]
//   ring 4 → 36 slots   (10°  apart)   notables               [E2P5–E2P6]
//   ring 5 → 36 slots   (10°  apart)   outer / keystones      [E2P7]
// ─────────────────────────────────────────────────────────────────────────────
const NODES = [

  // ══════════════════════════════════════════════════════════════════════════
  //  CLASS START NODES  —  Ring 2, 36-slot era  (E2P3 scaffold)
  //
  //  Grid: 36 slots × 10° each. Three classes at exact 120° intervals.
  //    Warrior r2s00 =   0°  (slot  0)
  //    Rogue   r2s12 = 120°  (slot 12)
  //    Sage    r2s24 = 240°  (slot 24)
  //
  //  Section layout per ring (3–5):
  //    slots 00–07  Warrior section  (8 nodes)
  //    slots 08–11  W→R bridge       (4 nodes)
  //    slots 12–19  Rogue section    (8 nodes)
  //    slots 20–23  R→S bridge       (4 nodes)
  //    slots 24–31  Sage section     (8 nodes)
  //    slots 32–35  S→W bridge       (4 nodes)
  //
  //  Rings 3–5 are scaffolded in E2P4–E2P6. Ring 5 keystones in E2P7.
  //  All placeholder stats replaced with themed values in E2P8.
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r2s00', label: "Forge of Kings",
    type: 'start', section: 'warrior', ring: 2, slot: 0,
    stats: {},
    connections: ['r1s00', 'r3s00', 'r2s34', 'r2s02'],
    description: 'The Warrior\'s threshold. Born in fire, hardened by iron. Each step forward is a conquest.',
  },
  {
    id: 'r2s12', label: "Shadowfall Step",
    type: 'start', section: 'rogue', ring: 2, slot: 12,
    stats: {},
    connections: ['r1s12', 'r3s12', 'r2s10', 'r2s14'],
    description: 'The Rogue\'s threshold. Swift as frost, invisible as shadow. Strike before they see you coming.',
  },
  {
    id: 'r2s24', label: "Eye of the Storm",
    type: 'start', section: 'sage', ring: 2, slot: 24,
    stats: {},
    connections: ['r1s24', 'r3s24', 'r2s22', 'r2s26'],
    description: 'The Sage\'s threshold. Clarity is power. The storm obeys those who understand its nature.',
  },

  //  r2 midpoint nodes (3 new, at s06/s18/s30 — accessible only via r3 spoke E2P8.2)
  //  These nodes sit at the "midpoints" between class gates and create natural arc breaks.
  //  Players must traverse the r3 highway to reach them; they do NOT arc-connect to gates.
  {
    id: 'r2s06', label: 'Ember Frost Nexus',
    type: 'minor', section: 'shared', ring: 2, slot: 6,
    stats: { flatBlazeDamage: 3, flatFrostDamage: 3 },
    connections: ['r3s06'],
    description: '+3 flat fire damage. +3 flat cold damage. Where warrior and rogue paths almost meet.',
  },
  {
    id: 'r2s18', label: 'Cold Thunder Nexus',
    type: 'minor', section: 'shared', ring: 2, slot: 18,
    stats: { flatFrostDamage: 3, flatThunderDamage: 3 },
    connections: ['r3s18'],
    description: '+3 flat cold damage. +3 flat lightning damage. Where rogue and sage paths almost meet.',
  },
  {
    id: 'r2s30', label: 'Thunder Blaze Nexus',
    type: 'minor', section: 'shared', ring: 2, slot: 30,
    stats: { flatThunderDamage: 3, flatBlazeDamage: 3 },
    connections: ['r3s30'],
    description: '+3 flat lightning damage. +3 flat fire damage. Where sage and warrior paths almost meet.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  r2 CLASS-SECTION SIDE NODES  (E2P8.2 — 4 nodes per gate, arc arms)
  //  Each gate arcs 2 nodes left (CCW) and 2 nodes right (CW).
  //  Arc chains stop before the midpoints, creating natural arc breaks.
  //  All cost 5 pts / 0g refund (ring 2 minor).
  //
  //  Warrior arms  left: s34→s32   right: s02→s04
  //  Rogue arms    left: s10→s08   right: s14→s16
  //  Sage arms     left: s22→s20   right: s26→s28
  //  All 18 r2 nodes sit at even slots (0,2,4,...,34) = 20° gaps throughout.
  // ══════════════════════════════════════════════════════════════════════════

  //  ── Warrior arms ─────────────────────────────────────────────────────────
  {
    id: 'r2s34', label: 'Cinder Flank',
    type: 'minor', section: 'warrior', ring: 2, slot: 34,
    stats: { flatBlazeDamage: 2, maxHealth: 10 },
    connections: ['r2s00', 'r2s32'],
    description: '+2 flat blaze damage. +10 max health. Warrior\'s left flank smolders from the gate.',
  },
  {
    id: 'r2s32', label: 'Ember Root',
    type: 'minor', section: 'warrior', ring: 2, slot: 32,
    stats: { flatBlazeDamage: 4, healthRegenPerS: 0.5 },
    connections: ['r2s34'],
    description: '+4 flat blaze damage. +0.5 HP/s regen. Deepest left root of Warrior\'s Gate.',
  },
  {
    id: 'r2s02', label: 'Forge Flank',
    type: 'minor', section: 'warrior', ring: 2, slot: 2,
    stats: { flatBlazeDamage: 3 },
    connections: ['r2s00', 'r2s04'],
    description: '+3 flat fire damage. Warrior\'s right flank blazes from the gate.',
  },
  {
    id: 'r2s04', label: 'Pyre Root',
    type: 'minor', section: 'warrior', ring: 2, slot: 4,
    stats: { flatBlazeDamage: 5, totalArmor: 5 },
    connections: ['r2s02'],
    description: '+5 flat fire damage. +5 armor. Deepest right root of Warrior\'s Gate.',
  },

  //  ── Rogue arms ───────────────────────────────────────────────────────────
  {
    id: 'r2s10', label: 'Frost Flank',
    type: 'minor', section: 'rogue', ring: 2, slot: 10,
    stats: { flatFrostDamage: 2, moveSpeedMult: 0.02 },
    connections: ['r2s12', 'r2s08'],
    description: '+2 flat frost damage. +2% move speed. Rogue\'s left flank chills from the gate.',
  },
  {
    id: 'r2s08', label: 'Shadow Root',
    type: 'minor', section: 'rogue', ring: 2, slot: 8,
    stats: { flatFrostDamage: 3, moveSpeedMult: 0.02 },
    connections: ['r2s10'],
    description: '+3 flat cold damage. +2% move speed. Deepest left root of Rogue\'s Gate.',
  },
  {
    id: 'r2s14', label: 'Chill Flank',
    type: 'minor', section: 'rogue', ring: 2, slot: 14,
    stats: { flatFrostDamage: 3 },
    connections: ['r2s12', 'r2s16'],
    description: '+3 flat cold damage. Rogue\'s right flank chills from the gate.',
  },
  {
    id: 'r2s16', label: 'Frost Root',
    type: 'minor', section: 'rogue', ring: 2, slot: 16,
    stats: { flatFrostDamage: 5, attackSpeed: 0.03 },
    connections: ['r2s14'],
    description: '+5 flat cold damage. +3% attack speed. Deepest right root of Rogue\'s Gate.',
  },

  //  ── Sage arms ────────────────────────────────────────────────────────────
  {
    id: 'r2s22', label: 'Storm Flank',
    type: 'minor', section: 'sage', ring: 2, slot: 22,
    stats: { flatThunderDamage: 2, maxMana: 8 },
    connections: ['r2s24', 'r2s20'],
    description: '+2 flat thunder damage. +8 max mana. Sage\'s left flank crackles from the gate.',
  },
  {
    id: 'r2s20', label: 'Surge Root',
    type: 'minor', section: 'sage', ring: 2, slot: 20,
    stats: { flatThunderDamage: 4, manaRegenPerS: 0.5 },
    connections: ['r2s22'],
    description: '+4 flat thunder damage. +0.5 mana/s regen. Deepest left root of Sage\'s Gate.',
  },
  {
    id: 'r2s26', label: 'Arc Flank',
    type: 'minor', section: 'sage', ring: 2, slot: 26,
    stats: { flatThunderDamage: 3 },
    connections: ['r2s24', 'r2s28'],
    description: '+3 flat lightning damage. Sage\'s right flank arcs from the gate.',
  },
  {
    id: 'r2s28', label: 'Thunder Root',
    type: 'minor', section: 'sage', ring: 2, slot: 28,
    stats: { flatThunderDamage: 5, castSpeed: 0.03 },
    connections: ['r2s26'],
    description: '+5 flat lightning damage. +3% cast speed. Deepest right root of Sage\'s Gate.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  HUB NODE  —  Central anchor  (ring 0, single node at 0°)
  //  Vitality → spokes outward to 3 r1 triplet centers (r1s00, r1s12, r1s24)
  //  Section color (renderer): soft-gold #c8a84b
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'r0s00', label: 'Vitality',
    type: 'hub', section: 'shared', ring: 0, slot: 0,
    stats: { maxHealth: 25, healthRegenPerS: 1.0 },
    connections: ['r1s00', 'r1s12', 'r1s24'],
    description: '+25 maximum health. +1 HP/s regeneration. The heart of endurance.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 1 — Inner bridge ring  (9 nodes, 3 triplets × 3 classes)
  //  r1 uses 36 slots (10° each) matching r2+ for perfect 120° tri-symmetry.
  //  Each triplet center spokes inward → r0s00 and outward → class gate.
  //  Flanks sit ±4 slots (40°) from center — 9 nodes perfectly evenly spaced.
  //  All nodes cost 5 pts / 0g refund (ring 1 minor).
  //
  //  Warrior triplet (  0°):  r1s32 — r1s00 — r1s04   center r1s00 → r2s00
  //  Rogue   triplet (120°):  r1s08 — r1s12 — r1s16   center r1s12 → r2s12
  //  Sage    triplet (240°):  r1s20 — r1s24 — r1s28   center r1s24 → r2s24
  //  Arc: s00↔s04↔s08↔s12↔s16↔s20↔s24↔s28↔s32↔s00 (40° gaps throughout)
  // ══════════════════════════════════════════════════════════════════════════

  //  ── Warrior triplet  (r1s32, r1s00, r1s04) ───────────────────────────────
  {
    id: 'r1s00', label: "Life's Crossing",
    type: 'minor', section: 'shared', ring: 1, slot: 0,
    stats: { maxHealth: 15, healthRegenPerS: 0.5 },
    connections: ['r0s00', 'r2s00', 'r1s04', 'r1s32'],
    description: '+15 max health. +0.5 HP/s regen. Bridges the central hub to the Warrior Gate.',
  },
  {
    id: 'r1s04', label: 'Ember Bridge',
    type: 'minor', section: 'shared', ring: 1, slot: 4,
    stats: { maxHealth: 10, flatBlazeDamage: 1 },
    connections: ['r1s00', 'r1s08'],
    description: '+10 max health. +1 flat fire damage. Where the warrior\'s warmth reaches outward.',
  },
  {
    id: 'r1s32', label: 'Dusk Ward',
    type: 'minor', section: 'shared', ring: 1, slot: 32,
    stats: { maxHealth: 10, healthRegenPerS: 0.3 },
    connections: ['r1s28', 'r1s00'],
    description: '+10 max health. +0.3 HP/s regen. The last ember before the gate.',
  },

  //  ── Rogue triplet  (r1s08, r1s12, r1s16) ────────────────────────────────
  {
    id: 'r1s08', label: 'Frost Approach',
    type: 'minor', section: 'shared', ring: 1, slot: 8,
    stats: { moveSpeedMult: 0.02, maxHealth: 8 },
    connections: ['r1s04', 'r1s12'],
    description: '+2% move speed. +8 max health. The cold path narrows toward shadow.',
  },
  {
    id: 'r1s12', label: 'Mist Gate',
    type: 'minor', section: 'shared', ring: 1, slot: 12,
    stats: { maxMana: 12, moveSpeedMult: 0.02 },
    connections: ['r0s00', 'r2s12', 'r1s08', 'r1s16'],
    description: '+12 max mana. +2% move speed. Bridges the central hub to the Rogue Gate.',
  },
  {
    id: 'r1s16', label: 'Chill Reach',
    type: 'minor', section: 'shared', ring: 1, slot: 16,
    stats: { flatFrostDamage: 1, moveSpeedMult: 0.01 },
    connections: ['r1s12', 'r1s20'],
    description: '+1 flat frost damage. +1% move speed. Cold seeps outward from the Rogue gate.',
  },

  //  ── Sage triplet  (r1s20, r1s24, r1s28) ─────────────────────────────────
  {
    id: 'r1s20', label: 'Thunder Approach',
    type: 'minor', section: 'shared', ring: 1, slot: 20,
    stats: { maxMana: 8, manaRegenPerS: 0.3 },
    connections: ['r1s16', 'r1s24'],
    description: '+8 max mana. +0.3 mana/s regen. Lightning stirs in the deep inner ring.',
  },
  {
    id: 'r1s24', label: 'Clarity',
    type: 'minor', section: 'shared', ring: 1, slot: 24,
    stats: { maxMana: 15, manaRegenPerS: 0.5 },
    connections: ['r0s00', 'r2s24', 'r1s20', 'r1s28'],
    description: '+15 max mana. +0.5 mana/s regen. Bridges the central hub to the Sage Gate.',
  },
  {
    id: 'r1s28', label: 'Arc Return',
    type: 'minor', section: 'shared', ring: 1, slot: 28,
    stats: { maxMana: 8, flatThunderDamage: 1 },
    connections: ['r1s24', 'r1s32'],
    description: '+8 max mana. +1 flat thunder damage. The sage\'s current curves back toward the warrior.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 3 — Scaffold  (E2P4, first 18 of 36 nodes)
  //
  //  Placeholder stats only — themed final values assigned in E2P8.
  //    Warrior nodes  → maxHealth (+20 per minor)
  //    Rogue nodes    → moveSpeedMult (+0.05 per minor)
  //    Sage nodes     → maxMana (+15 per minor)
  //    Bridge nodes   → mix of the two adjacent class placeholder stats
  //
  //  Strands added this phase:
  //    Warrior Strand A   r3s00–r3s03   (4 minors, arc chain from gate)
  //    W→R bridge entry   r3s08–r3s09   (2 bridge minors, arc pair)
  //    Rogue Strand A     r3s12–r3s15   (4 minors, arc chain from gate)
  //    R→S bridge entry   r3s20–r3s21   (2 bridge minors, arc pair)
  //    Sage Strand A      r3s24–r3s27   (4 minors, arc chain from gate)
  //    S→W bridge entry   r3s32–r3s33   (2 bridge minors, arc pair)
  //
  //  Bridge arcs are isolated until E2P6 fills Strand B (slots 04–07 etc.)
  //  and arcs them into the bridge zone.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Strand A  (r3s00–r3s03) ──────────────────────────────────────
  {
    id: 'r3s00', label: 'Forge Path I',
    type: 'minor', section: 'warrior', ring: 3, slot: 0,
    stats: { flatBlazeDamage: 2 },
    connections: ['r2s00', 'r3s01', 'r3s35', 'r4s00', 'r3as00', 'r3bs00'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s01', label: 'Forge Path II',
    type: 'minor', section: 'warrior', ring: 3, slot: 1,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s00', 'r3s02'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s02', label: 'Forge Path III',
    type: 'minor', section: 'warrior', ring: 3, slot: 2,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s01', 'r3s03'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s03', label: 'Forge Path IV',
    type: 'minor', section: 'warrior', ring: 3, slot: 3,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s02', 'r3s04'],
    description: '+2 flat blaze damage.',
  },

  // ── W→R Bridge  (r3s08–r3s11) — Blaze meets Frost ───────────────────────
  {
    id: 'r3s08', label: 'Cinder Frost I',
    type: 'minor', section: 'shared', ring: 3, slot: 8,
    stats: { flatBlazeDamage: 1, flatFrostDamage: 1 },
    connections: ['r3s07', 'r3s09'],
    description: '+1 flat blaze damage. +1 flat frost damage.',
  },
  {
    id: 'r3s09', label: 'Cinder Frost II',
    type: 'minor', section: 'shared', ring: 3, slot: 9,
    stats: { flatBlazeDamage: 1, flatFrostDamage: 1 },
    connections: ['r3s08', 'r3s10'],
    description: '+1 flat blaze damage. +1 flat frost damage.',
  },
  {
    id: 'r3s10', label: 'Cinder Frost III',
    type: 'minor', section: 'shared', ring: 3, slot: 10,
    stats: { flatBlazeDamage: 1, flatFrostDamage: 1 },
    connections: ['r3s09', 'r3s11'],
    description: '+1 flat blaze damage. +1 flat frost damage.',
  },
  {
    id: 'r3s11', label: 'Cinder Frost IV',
    type: 'minor', section: 'shared', ring: 3, slot: 11,
    stats: { flatBlazeDamage: 1, flatFrostDamage: 1 },
    connections: ['r3s10', 'r3s12'],
    description: '+1 flat blaze damage. +1 flat frost damage.',
  },

  // ── Rogue Strand A  (r3s12–r3s15) ───────────────────────────────────────
  {
    id: 'r3s12', label: 'Frost Path I',
    type: 'minor', section: 'rogue', ring: 3, slot: 12,
    stats: { flatFrostDamage: 2 },
    connections: ['r2s12', 'r3s11', 'r3s13', 'r4s12', 'r3as12', 'r3bs12'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s13', label: 'Frost Path II',
    type: 'minor', section: 'rogue', ring: 3, slot: 13,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s12', 'r3s14'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s14', label: 'Frost Path III',
    type: 'minor', section: 'rogue', ring: 3, slot: 14,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s13', 'r3s15'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s15', label: 'Frost Path IV',
    type: 'minor', section: 'rogue', ring: 3, slot: 15,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s14', 'r3s16'],
    description: '+2 flat frost damage.',
  },

  // ── R→S Bridge  (r3s20–r3s23) — Frost meets Thunder ─────────────────────
  {
    id: 'r3s20', label: 'Glacial Arc I',
    type: 'minor', section: 'shared', ring: 3, slot: 20,
    stats: { flatFrostDamage: 1, flatThunderDamage: 1 },
    connections: ['r3s19', 'r3s21'],
    description: '+1 flat frost damage. +1 flat thunder damage.',
  },
  {
    id: 'r3s21', label: 'Glacial Arc II',
    type: 'minor', section: 'shared', ring: 3, slot: 21,
    stats: { flatFrostDamage: 1, flatThunderDamage: 1 },
    connections: ['r3s20', 'r3s22'],
    description: '+1 flat frost damage. +1 flat thunder damage.',
  },
  {
    id: 'r3s22', label: 'Glacial Arc III',
    type: 'minor', section: 'shared', ring: 3, slot: 22,
    stats: { flatFrostDamage: 1, flatThunderDamage: 1 },
    connections: ['r3s21', 'r3s23'],
    description: '+1 flat frost damage. +1 flat thunder damage.',
  },
  {
    id: 'r3s23', label: 'Glacial Arc IV',
    type: 'minor', section: 'shared', ring: 3, slot: 23,
    stats: { flatFrostDamage: 1, flatThunderDamage: 1 },
    connections: ['r3s22', 'r3s24'],
    description: '+1 flat frost damage. +1 flat thunder damage.',
  },

  // ── Sage Strand A  (r3s24–r3s27) ────────────────────────────────────────
  {
    id: 'r3s24', label: 'Thunder Path I',
    type: 'minor', section: 'sage', ring: 3, slot: 24,
    stats: { flatThunderDamage: 2 },
    connections: ['r2s24', 'r3s23', 'r3s25', 'r4s24', 'r3as24', 'r3bs24'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s25', label: 'Thunder Path II',
    type: 'minor', section: 'sage', ring: 3, slot: 25,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s24', 'r3s26'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s26', label: 'Thunder Path III',
    type: 'minor', section: 'sage', ring: 3, slot: 26,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s25', 'r3s27'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s27', label: 'Thunder Path IV',
    type: 'minor', section: 'sage', ring: 3, slot: 27,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s26', 'r3s28'],
    description: '+2 flat thunder damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 4 — Scaffold  (E2P5, first 18 of 36 nodes)
  //
  //  Same slot columns as the ring-3 scaffold. All nodes are 'minor' type;
  //  node types (notable) and themed stats assigned in E2P8.
  //  Placeholder stat philosophy mirrors ring 3 but scaled up:
  //    Warrior nodes  → maxHealth (+25 per minor)
  //    Rogue nodes    → moveSpeedMult (+0.06 per minor)
  //    Sage nodes     → maxMana (+20 per minor)
  //    Bridge nodes   → mix of adjacent class placeholder stats
  //
  //  Each node connects via spoke to the matching ring-3 column node.
  //  Arc chains within each strand are bidirectional.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Branch  (r4s00–r4s05) ─────────────────────────────────────
  {
    id: 'r4s00', label: 'Forge Ember I',
    type: 'minor', section: 'warrior', ring: 4, slot: 0,
    stats: { flatBlazeDamage: 3 },
    connections: ['r3s00', 'r4s01', 'r5s00', 'r4as00', 'r4bs00'],
    description: '+3 flat blaze damage.',
  },
  {
    id: 'r4s01', label: 'Forge Ember II',
    type: 'minor', section: 'warrior', ring: 4, slot: 1,
    stats: { flatBlazeDamage: 3 },
    connections: ['r4s00', 'r4s02'],
    description: '+3 flat blaze damage.',
  },
  {
    id: 'r4s02', label: 'Forge Ember III',
    type: 'minor', section: 'warrior', ring: 4, slot: 2,
    stats: { flatBlazeDamage: 3 },
    connections: ['r4s01', 'r4s03'],
    description: '+3 flat blaze damage.',
  },
  {
    id: 'r4s03', label: 'Forge Ember IV',
    type: 'minor', section: 'warrior', ring: 4, slot: 3,
    stats: { flatBlazeDamage: 3 },
    connections: ['r4s02', 'r4s04'],
    description: '+3 flat blaze damage.',
  },

  // ── W→R Bridge inner nodes  (r4s08–r4s09) ───────────────────────────────
  {
    id: 'r4s08', label: 'Iron Crossing III',
    type: 'minor', section: 'shared', ring: 4, slot: 8,
    stats: { flatPhysicalDamage: 3 },
    connections: ['r4s09'],
    description: '+3 flat physical damage.',
  },
  {
    id: 'r4s09', label: 'Iron Crossing IV',
    type: 'minor', section: 'shared', ring: 4, slot: 9,
    stats: { flatPhysicalDamage: 3 },
    connections: ['r4s08', 'r4s10'],
    description: '+3 flat physical damage.',
  },

  // ── Rogue Branch  (r4s12–r4s17) ──────────────────────────────────────────
  {
    id: 'r4s12', label: 'Frost Fang I',
    type: 'minor', section: 'rogue', ring: 4, slot: 12,
    stats: { flatFrostDamage: 3 },
    connections: ['r3s12', 'r4s13', 'r5s12', 'r4as12', 'r4bs12'],
    description: '+3 flat frost damage.',
  },
  {
    id: 'r4s13', label: 'Frost Fang II',
    type: 'minor', section: 'rogue', ring: 4, slot: 13,
    stats: { flatFrostDamage: 3 },
    connections: ['r4s12', 'r4s14'],
    description: '+3 flat frost damage.',
  },
  {
    id: 'r4s14', label: 'Frost Fang III',
    type: 'minor', section: 'rogue', ring: 4, slot: 14,
    stats: { flatFrostDamage: 3 },
    connections: ['r4s13', 'r4s15'],
    description: '+3 flat frost damage.',
  },
  {
    id: 'r4s15', label: 'Frost Fang IV',
    type: 'minor', section: 'rogue', ring: 4, slot: 15,
    stats: { flatFrostDamage: 3 },
    connections: ['r4s14', 'r4s16'],
    description: '+3 flat frost damage.',
  },

  // ── R→S Bridge inner nodes  (r4s20–r4s21) ───────────────────────────────
  {
    id: 'r4s20', label: 'Void Drift III',
    type: 'minor', section: 'shared', ring: 4, slot: 20,
    stats: { flatUnholyDamage: 3 },
    connections: ['r4s21'],
    description: '+3 flat unholy damage.',
  },
  {
    id: 'r4s21', label: 'Void Drift IV',
    type: 'minor', section: 'shared', ring: 4, slot: 21,
    stats: { flatUnholyDamage: 3 },
    connections: ['r4s20', 'r4s22'],
    description: '+3 flat unholy damage.',
  },

  // ── Sage Branch  (r4s24–r4s29) ───────────────────────────────────────────
  {
    id: 'r4s24', label: 'Arc Surge I',
    type: 'minor', section: 'sage', ring: 4, slot: 24,
    stats: { flatThunderDamage: 3 },
    connections: ['r3s24', 'r4s25', 'r5s24', 'r4as24', 'r4bs24'],
    description: '+3 flat thunder damage.',
  },
  {
    id: 'r4s25', label: 'Arc Surge II',
    type: 'minor', section: 'sage', ring: 4, slot: 25,
    stats: { flatThunderDamage: 3 },
    connections: ['r4s24', 'r4s26'],
    description: '+3 flat thunder damage.',
  },
  {
    id: 'r4s26', label: 'Arc Surge III',
    type: 'minor', section: 'sage', ring: 4, slot: 26,
    stats: { flatThunderDamage: 3 },
    connections: ['r4s25', 'r4s27'],
    description: '+3 flat thunder damage.',
  },
  {
    id: 'r4s27', label: 'Arc Surge IV',
    type: 'minor', section: 'sage', ring: 4, slot: 27,
    stats: { flatThunderDamage: 3 },
    connections: ['r4s26', 'r4s28'],
    description: '+3 flat thunder damage.',
  },

  // ── S→W Bridge inner nodes  (r4s32–r4s33) ───────────────────────────────
  {
    id: 'r4s32', label: 'Sacred Crossing III',
    type: 'minor', section: 'shared', ring: 4, slot: 32,
    stats: { flatHolyDamage: 3 },
    connections: ['r4s33'],
    description: '+3 flat holy damage.',
  },
  {
    id: 'r4s33', label: 'Sacred Crossing IV',
    type: 'minor', section: 'shared', ring: 4, slot: 33,
    stats: { flatHolyDamage: 3 },
    connections: ['r4s32', 'r4s34'],
    description: '+3 flat holy damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 3 — Strand B + Bridge completion  (E2P6, remaining 18 of 36)
  //
  //  Adds Strand B for each class (slots 04–07, 16–19, 28–31) and
  //  completes each bridge zone (slots 10–11, 22–23, 34–35).
  //  Bridge midpoints (slots 10, 22, 34) promoted to 'notable' type.
  //  This phase closes all arc gaps, making the ring fully traversable.
  //
  //  Bridge connectivity after this phase:
  //    r3s07 → r3s08 (Warrior Strand B → W→R bridge entry)
  //    r3s11 → r3s12 (W→R bridge exit → Rogue Strand A start)
  //    r3s19 → r3s20 (Rogue Strand B → R→S bridge entry)
  //    r3s23 → r3s24 (R→S bridge exit → Sage Strand A start)
  //    r3s31 → r3s32 (Sage Strand B → S→W bridge entry)
  //    r3s35 → r3s00 (S→W bridge exit → Warrior Strand A start, wraparound)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Strand B  (r3s04–r3s07) ────────────────────────────────────
  {
    id: 'r3s04', label: 'Forge Path V',
    type: 'minor', section: 'warrior', ring: 3, slot: 4,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s03', 'r3s05'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s05', label: 'Forge Path VI',
    type: 'minor', section: 'warrior', ring: 3, slot: 5,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s04', 'r3s06'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s06', label: 'Forge Path VII',
    type: 'minor', section: 'warrior', ring: 3, slot: 6,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s05', 'r3s07', 'r4s06', 'r2s06', 'r3as06', 'r3bs06'],
    description: '+2 flat blaze damage.',
  },
  {
    id: 'r3s07', label: 'Forge Path VIII',
    type: 'minor', section: 'warrior', ring: 3, slot: 7,
    stats: { flatBlazeDamage: 2 },
    connections: ['r3s06', 'r3s08'],
    description: '+2 flat blaze damage.',
  },

  // ── Rogue Strand B  (r3s16–r3s19) ───────────────────────────────────────
  {
    id: 'r3s16', label: 'Frost Path V',
    type: 'minor', section: 'rogue', ring: 3, slot: 16,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s15', 'r3s17'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s17', label: 'Frost Path VI',
    type: 'minor', section: 'rogue', ring: 3, slot: 17,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s16', 'r3s18'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s18', label: 'Frost Path VII',
    type: 'minor', section: 'rogue', ring: 3, slot: 18,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s17', 'r3s19', 'r4s18', 'r2s18', 'r3as18', 'r3bs18'],
    description: '+2 flat frost damage.',
  },
  {
    id: 'r3s19', label: 'Frost Path VIII',
    type: 'minor', section: 'rogue', ring: 3, slot: 19,
    stats: { flatFrostDamage: 2 },
    connections: ['r3s18', 'r3s20'],
    description: '+2 flat frost damage.',
  },

  // ── Sage Strand B  (r3s28–r3s31) ────────────────────────────────────────
  {
    id: 'r3s28', label: 'Thunder Path V',
    type: 'minor', section: 'sage', ring: 3, slot: 28,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s27', 'r3s29'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s29', label: 'Thunder Path VI',
    type: 'minor', section: 'sage', ring: 3, slot: 29,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s28', 'r3s30'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s30', label: 'Thunder Path VII',
    type: 'minor', section: 'sage', ring: 3, slot: 30,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s29', 'r3s31', 'r4s30', 'r2s30', 'r3as30', 'r3bs30'],
    description: '+2 flat thunder damage.',
  },
  {
    id: 'r3s31', label: 'Thunder Path VIII',
    type: 'minor', section: 'sage', ring: 3, slot: 31,
    stats: { flatThunderDamage: 2 },
    connections: ['r3s30', 'r3s32'],
    description: '+2 flat thunder damage.',
  },

  // ── S→W Bridge  (r3s32–r3s35) — Thunder meets Blaze ─────────────────────
  {
    id: 'r3s32', label: 'Arc Ember I',
    type: 'minor', section: 'shared', ring: 3, slot: 32,
    stats: { flatThunderDamage: 1, flatBlazeDamage: 1 },
    connections: ['r3s31', 'r3s33'],
    description: '+1 flat thunder damage. +1 flat blaze damage.',
  },
  {
    id: 'r3s33', label: 'Arc Ember II',
    type: 'minor', section: 'shared', ring: 3, slot: 33,
    stats: { flatThunderDamage: 1, flatBlazeDamage: 1 },
    connections: ['r3s32', 'r3s34'],
    description: '+1 flat thunder damage. +1 flat blaze damage.',
  },
  {
    id: 'r3s34', label: 'Arc Ember III',
    type: 'minor', section: 'shared', ring: 3, slot: 34,
    stats: { flatThunderDamage: 1, flatBlazeDamage: 1 },
    connections: ['r3s33', 'r3s35'],
    description: '+1 flat thunder damage. +1 flat blaze damage.',
  },
  {
    id: 'r3s35', label: 'Arc Ember IV',
    type: 'minor', section: 'shared', ring: 3, slot: 35,
    stats: { flatThunderDamage: 1, flatBlazeDamage: 1 },
    connections: ['r3s34', 'r3s00'],
    description: '+1 flat thunder damage. +1 flat blaze damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 3a — Inner Elemental Spur Branches  (E2P8.7.6)
  //
  //  6 elemental-damage stubs branching inward clockwise of r3 connector nodes.
  //  Rendered between r2 (240px) and r3 (350px) via radiusOverride: 295.
  //  ring: 3 → cost 1 pt / 25g refund (matches parent connector).
  //  Each stub: entry node (clockwise offset from connector) → 3 minors → 1 notable.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior r3a spur (clockwise of r3s00, slots 1→5) ─────────────────────
  {
    id: 'r3as00', label: 'Ember Focus I',
    type: 'minor', section: 'warrior', ring: 3, slot: 1, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.04 },
    connections: ['r3s00', 'r3as01'],
    description: '+4% increased blaze damage. Inner spur clockwise of Warrior connector.',
  },
  {
    id: 'r3as01', label: 'Ember Focus II',
    type: 'minor', section: 'warrior', ring: 3, slot: 2, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.04 },
    connections: ['r3as00', 'r3as02'],
    description: '+4% increased blaze damage.',
  },
  {
    id: 'r3as02', label: 'Ember Focus III',
    type: 'minor', section: 'warrior', ring: 3, slot: 3, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.04 },
    connections: ['r3as01', 'r3as03'],
    description: '+4% increased blaze damage.',
  },
  {
    id: 'r3as03', label: 'Ember Focus IV',
    type: 'minor', section: 'warrior', ring: 3, slot: 4, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.04 },
    connections: ['r3as02', 'r3as04'],
    description: '+4% increased blaze damage.',
  },
  {
    id: 'r3as04', label: 'Cinder Ascendancy',
    type: 'notable', section: 'warrior', ring: 3, slot: 5, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.12, flatBlazeDamage: 2 },
    connections: ['r3as03'],
    description: '+12% increased blaze damage. +2 flat blaze damage.',
  },

  // ── W→R Bridge r3a spur (clockwise of r3s06, slots 7→11) ─────────────────
  {
    id: 'r3as06', label: 'Cinderfrost Focus I',
    type: 'minor', section: 'shared', ring: 3, slot: 7, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.02, increasedFrostDamage: 0.02 },
    connections: ['r3s06', 'r3as07'],
    description: '+2% increased blaze damage. +2% increased frost damage. Inner spur clockwise of W-R connector.',
  },
  {
    id: 'r3as07', label: 'Cinderfrost Focus II',
    type: 'minor', section: 'shared', ring: 3, slot: 8, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.02, increasedFrostDamage: 0.02 },
    connections: ['r3as06', 'r3as08'],
    description: '+2% increased blaze damage. +2% increased frost damage.',
  },
  {
    id: 'r3as08', label: 'Cinderfrost Focus III',
    type: 'minor', section: 'shared', ring: 3, slot: 9, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.02, increasedFrostDamage: 0.02 },
    connections: ['r3as07', 'r3as09'],
    description: '+2% increased blaze damage. +2% increased frost damage.',
  },
  {
    id: 'r3as09', label: 'Cinderfrost Focus IV',
    type: 'minor', section: 'shared', ring: 3, slot: 10, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.02, increasedFrostDamage: 0.02 },
    connections: ['r3as08', 'r3as10'],
    description: '+2% increased blaze damage. +2% increased frost damage.',
  },
  {
    id: 'r3as10', label: 'Cinderfrost Conflux',
    type: 'notable', section: 'shared', ring: 3, slot: 11, radiusOverride: 295,
    stats: { increasedBlazeDamage: 0.08, increasedFrostDamage: 0.08 },
    connections: ['r3as09'],
    description: '+8% increased blaze damage. +8% increased frost damage.',
  },

  // ── Rogue r3a spur (clockwise of r3s12, slots 13→17) ──────────────────────
  {
    id: 'r3as12', label: 'Rime Focus I',
    type: 'minor', section: 'rogue', ring: 3, slot: 13, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.04 },
    connections: ['r3s12', 'r3as13'],
    description: '+4% increased frost damage. Inner spur clockwise of Rogue connector.',
  },
  {
    id: 'r3as13', label: 'Rime Focus II',
    type: 'minor', section: 'rogue', ring: 3, slot: 14, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.04 },
    connections: ['r3as12', 'r3as14'],
    description: '+4% increased frost damage.',
  },
  {
    id: 'r3as14', label: 'Rime Focus III',
    type: 'minor', section: 'rogue', ring: 3, slot: 15, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.04 },
    connections: ['r3as13', 'r3as15'],
    description: '+4% increased frost damage.',
  },
  {
    id: 'r3as15', label: 'Rime Focus IV',
    type: 'minor', section: 'rogue', ring: 3, slot: 16, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.04 },
    connections: ['r3as14', 'r3as16'],
    description: '+4% increased frost damage.',
  },
  {
    id: 'r3as16', label: 'Whiteout Crest',
    type: 'notable', section: 'rogue', ring: 3, slot: 17, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.12, flatFrostDamage: 2 },
    connections: ['r3as15'],
    description: '+12% increased frost damage. +2 flat frost damage.',
  },

  // ── R→S Bridge r3a spur (clockwise of r3s18, slots 19→23) ─────────────────
  {
    id: 'r3as18', label: 'Stormfrost Focus I',
    type: 'minor', section: 'shared', ring: 3, slot: 19, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.02, increasedThunderDamage: 0.02 },
    connections: ['r3s18', 'r3as19'],
    description: '+2% increased frost damage. +2% increased thunder damage. Inner spur clockwise of R-S connector.',
  },
  {
    id: 'r3as19', label: 'Stormfrost Focus II',
    type: 'minor', section: 'shared', ring: 3, slot: 20, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.02, increasedThunderDamage: 0.02 },
    connections: ['r3as18', 'r3as20'],
    description: '+2% increased frost damage. +2% increased thunder damage.',
  },
  {
    id: 'r3as20', label: 'Stormfrost Focus III',
    type: 'minor', section: 'shared', ring: 3, slot: 21, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.02, increasedThunderDamage: 0.02 },
    connections: ['r3as19', 'r3as21'],
    description: '+2% increased frost damage. +2% increased thunder damage.',
  },
  {
    id: 'r3as21', label: 'Stormfrost Focus IV',
    type: 'minor', section: 'shared', ring: 3, slot: 22, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.02, increasedThunderDamage: 0.02 },
    connections: ['r3as20', 'r3as22'],
    description: '+2% increased frost damage. +2% increased thunder damage.',
  },
  {
    id: 'r3as22', label: 'Tempest Rime',
    type: 'notable', section: 'shared', ring: 3, slot: 23, radiusOverride: 295,
    stats: { increasedFrostDamage: 0.08, increasedThunderDamage: 0.08 },
    connections: ['r3as21'],
    description: '+8% increased frost damage. +8% increased thunder damage.',
  },

  // ── Sage r3a spur (clockwise of r3s24, slots 25→29) ───────────────────────
  {
    id: 'r3as24', label: 'Volt Focus I',
    type: 'minor', section: 'sage', ring: 3, slot: 25, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.04 },
    connections: ['r3s24', 'r3as25'],
    description: '+4% increased thunder damage. Inner spur clockwise of Sage connector.',
  },
  {
    id: 'r3as25', label: 'Volt Focus II',
    type: 'minor', section: 'sage', ring: 3, slot: 26, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.04 },
    connections: ['r3as24', 'r3as26'],
    description: '+4% increased thunder damage.',
  },
  {
    id: 'r3as26', label: 'Volt Focus III',
    type: 'minor', section: 'sage', ring: 3, slot: 27, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.04 },
    connections: ['r3as25', 'r3as27'],
    description: '+4% increased thunder damage.',
  },
  {
    id: 'r3as27', label: 'Volt Focus IV',
    type: 'minor', section: 'sage', ring: 3, slot: 28, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.04 },
    connections: ['r3as26', 'r3as28'],
    description: '+4% increased thunder damage.',
  },
  {
    id: 'r3as28', label: 'Storm Crown',
    type: 'notable', section: 'sage', ring: 3, slot: 29, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.12, flatThunderDamage: 2 },
    connections: ['r3as27'],
    description: '+12% increased thunder damage. +2 flat thunder damage.',
  },

  // ── S→W Bridge r3a spur (clockwise of r3s30, slots 31→35) ─────────────────
  {
    id: 'r3as30', label: 'Stormember Focus I',
    type: 'minor', section: 'shared', ring: 3, slot: 31, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.02, increasedBlazeDamage: 0.02 },
    connections: ['r3s30', 'r3as31'],
    description: '+2% increased thunder damage. +2% increased blaze damage. Inner spur clockwise of S-W connector.',
  },
  {
    id: 'r3as31', label: 'Stormember Focus II',
    type: 'minor', section: 'shared', ring: 3, slot: 32, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.02, increasedBlazeDamage: 0.02 },
    connections: ['r3as30', 'r3as32'],
    description: '+2% increased thunder damage. +2% increased blaze damage.',
  },
  {
    id: 'r3as32', label: 'Stormember Focus III',
    type: 'minor', section: 'shared', ring: 3, slot: 33, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.02, increasedBlazeDamage: 0.02 },
    connections: ['r3as31', 'r3as33'],
    description: '+2% increased thunder damage. +2% increased blaze damage.',
  },
  {
    id: 'r3as33', label: 'Stormember Focus IV',
    type: 'minor', section: 'shared', ring: 3, slot: 34, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.02, increasedBlazeDamage: 0.02 },
    connections: ['r3as32', 'r3as34'],
    description: '+2% increased thunder damage. +2% increased blaze damage.',
  },
  {
    id: 'r3as34', label: 'Crown of Sparks',
    type: 'notable', section: 'shared', ring: 3, slot: 35, radiusOverride: 295,
    stats: { increasedThunderDamage: 0.08, increasedBlazeDamage: 0.08 },
    connections: ['r3as33'],
    description: '+8% increased thunder damage. +8% increased blaze damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 3b — Outer Elemental Spur Branches  (E2P8.7.6)
  //
  //  6 elemental-damage stubs branching outward clockwise of r3 connector nodes.
  //  Rendered between r3 (350px) and r4 (570px) via radiusOverride: 423.
  //  ring: 3 → cost 1 pt / 25g refund (matches parent connector).
  //  Each stub: entry node (clockwise offset from connector) → 3 minors → 1 notable.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior r3b spur (clockwise of r3s00, slots 1→5) ─────────────────────
  {
    id: 'r3bs00', label: 'Inferno Focus I',
    type: 'minor', section: 'warrior', ring: 3, slot: 1, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r3s00', 'r3bs01'],
    description: '+5% increased blaze damage. Outer spur clockwise of Warrior connector.',
  },
  {
    id: 'r3bs01', label: 'Inferno Focus II',
    type: 'minor', section: 'warrior', ring: 3, slot: 2, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r3bs00', 'r3bs02'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r3bs02', label: 'Inferno Focus III',
    type: 'minor', section: 'warrior', ring: 3, slot: 3, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r3bs01', 'r3bs03'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r3bs03', label: 'Inferno Focus IV',
    type: 'minor', section: 'warrior', ring: 3, slot: 4, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r3bs02', 'r3bs04'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r3bs04', label: 'Pyroclast Apex',
    type: 'notable', section: 'warrior', ring: 3, slot: 5, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.15, flatBlazeDamage: 3 },
    connections: ['r3bs03'],
    description: '+15% increased blaze damage. +3 flat blaze damage.',
  },

  // ── W→R Bridge r3b spur (clockwise of r3s06, slots 7→11) ─────────────────
  {
    id: 'r3bs06', label: 'Infernal Rime I',
    type: 'minor', section: 'shared', ring: 3, slot: 7, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.025, increasedFrostDamage: 0.025 },
    connections: ['r3s06', 'r3bs07'],
    description: '+2.5% increased blaze damage. +2.5% increased frost damage. Outer spur clockwise of W-R connector.',
  },
  {
    id: 'r3bs07', label: 'Infernal Rime II',
    type: 'minor', section: 'shared', ring: 3, slot: 8, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.025, increasedFrostDamage: 0.025 },
    connections: ['r3bs06', 'r3bs08'],
    description: '+2.5% increased blaze damage. +2.5% increased frost damage.',
  },
  {
    id: 'r3bs08', label: 'Infernal Rime III',
    type: 'minor', section: 'shared', ring: 3, slot: 9, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.025, increasedFrostDamage: 0.025 },
    connections: ['r3bs07', 'r3bs09'],
    description: '+2.5% increased blaze damage. +2.5% increased frost damage.',
  },
  {
    id: 'r3bs09', label: 'Infernal Rime IV',
    type: 'minor', section: 'shared', ring: 3, slot: 10, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.025, increasedFrostDamage: 0.025 },
    connections: ['r3bs08', 'r3bs10'],
    description: '+2.5% increased blaze damage. +2.5% increased frost damage.',
  },
  {
    id: 'r3bs10', label: 'Ashfrost Pinnacle',
    type: 'notable', section: 'shared', ring: 3, slot: 11, radiusOverride: 423,
    stats: { increasedBlazeDamage: 0.1, increasedFrostDamage: 0.1 },
    connections: ['r3bs09'],
    description: '+10% increased blaze damage. +10% increased frost damage.',
  },

  // ── Rogue r3b spur (clockwise of r3s12, slots 13→17) ──────────────────────
  {
    id: 'r3bs12', label: 'Glacier Focus I',
    type: 'minor', section: 'rogue', ring: 3, slot: 13, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r3s12', 'r3bs13'],
    description: '+5% increased frost damage. Outer spur clockwise of Rogue connector.',
  },
  {
    id: 'r3bs13', label: 'Glacier Focus II',
    type: 'minor', section: 'rogue', ring: 3, slot: 14, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r3bs12', 'r3bs14'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r3bs14', label: 'Glacier Focus III',
    type: 'minor', section: 'rogue', ring: 3, slot: 15, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r3bs13', 'r3bs15'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r3bs15', label: 'Glacier Focus IV',
    type: 'minor', section: 'rogue', ring: 3, slot: 16, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r3bs14', 'r3bs16'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r3bs16', label: 'Absolute Zero',
    type: 'notable', section: 'rogue', ring: 3, slot: 17, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.15, flatFrostDamage: 3 },
    connections: ['r3bs15'],
    description: '+15% increased frost damage. +3 flat frost damage.',
  },

  // ── R→S Bridge r3b spur (clockwise of r3s18, slots 19→23) ─────────────────
  {
    id: 'r3bs18', label: 'Hailstorm Focus I',
    type: 'minor', section: 'shared', ring: 3, slot: 19, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.025, increasedThunderDamage: 0.025 },
    connections: ['r3s18', 'r3bs19'],
    description: '+2.5% increased frost damage. +2.5% increased thunder damage. Outer spur clockwise of R-S connector.',
  },
  {
    id: 'r3bs19', label: 'Hailstorm Focus II',
    type: 'minor', section: 'shared', ring: 3, slot: 20, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.025, increasedThunderDamage: 0.025 },
    connections: ['r3bs18', 'r3bs20'],
    description: '+2.5% increased frost damage. +2.5% increased thunder damage.',
  },
  {
    id: 'r3bs20', label: 'Hailstorm Focus III',
    type: 'minor', section: 'shared', ring: 3, slot: 21, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.025, increasedThunderDamage: 0.025 },
    connections: ['r3bs19', 'r3bs21'],
    description: '+2.5% increased frost damage. +2.5% increased thunder damage.',
  },
  {
    id: 'r3bs21', label: 'Hailstorm Focus IV',
    type: 'minor', section: 'shared', ring: 3, slot: 22, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.025, increasedThunderDamage: 0.025 },
    connections: ['r3bs20', 'r3bs22'],
    description: '+2.5% increased frost damage. +2.5% increased thunder damage.',
  },
  {
    id: 'r3bs22', label: 'Polar Tempest',
    type: 'notable', section: 'shared', ring: 3, slot: 23, radiusOverride: 423,
    stats: { increasedFrostDamage: 0.1, increasedThunderDamage: 0.1 },
    connections: ['r3bs21'],
    description: '+10% increased frost damage. +10% increased thunder damage.',
  },

  // ── Sage r3b spur (clockwise of r3s24, slots 25→29) ───────────────────────
  {
    id: 'r3bs24', label: 'Tempest Focus I',
    type: 'minor', section: 'sage', ring: 3, slot: 25, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r3s24', 'r3bs25'],
    description: '+5% increased thunder damage. Outer spur clockwise of Sage connector.',
  },
  {
    id: 'r3bs25', label: 'Tempest Focus II',
    type: 'minor', section: 'sage', ring: 3, slot: 26, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r3bs24', 'r3bs26'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r3bs26', label: 'Tempest Focus III',
    type: 'minor', section: 'sage', ring: 3, slot: 27, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r3bs25', 'r3bs27'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r3bs27', label: 'Tempest Focus IV',
    type: 'minor', section: 'sage', ring: 3, slot: 28, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r3bs26', 'r3bs28'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r3bs28', label: 'Skybreaker Throne',
    type: 'notable', section: 'sage', ring: 3, slot: 29, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.15, flatThunderDamage: 3 },
    connections: ['r3bs27'],
    description: '+15% increased thunder damage. +3 flat thunder damage.',
  },

  // ── S→W Bridge r3b spur (clockwise of r3s30, slots 31→35) ─────────────────
  {
    id: 'r3bs30', label: 'Stormfire Focus I',
    type: 'minor', section: 'shared', ring: 3, slot: 31, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.025, increasedBlazeDamage: 0.025 },
    connections: ['r3s30', 'r3bs31'],
    description: '+2.5% increased thunder damage. +2.5% increased blaze damage. Outer spur clockwise of S-W connector.',
  },
  {
    id: 'r3bs31', label: 'Stormfire Focus II',
    type: 'minor', section: 'shared', ring: 3, slot: 32, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.025, increasedBlazeDamage: 0.025 },
    connections: ['r3bs30', 'r3bs32'],
    description: '+2.5% increased thunder damage. +2.5% increased blaze damage.',
  },
  {
    id: 'r3bs32', label: 'Stormfire Focus III',
    type: 'minor', section: 'shared', ring: 3, slot: 33, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.025, increasedBlazeDamage: 0.025 },
    connections: ['r3bs31', 'r3bs33'],
    description: '+2.5% increased thunder damage. +2.5% increased blaze damage.',
  },
  {
    id: 'r3bs33', label: 'Stormfire Focus IV',
    type: 'minor', section: 'shared', ring: 3, slot: 34, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.025, increasedBlazeDamage: 0.025 },
    connections: ['r3bs32', 'r3bs34'],
    description: '+2.5% increased thunder damage. +2.5% increased blaze damage.',
  },
  {
    id: 'r3bs34', label: 'Solar Tempest',
    type: 'notable', section: 'shared', ring: 3, slot: 35, radiusOverride: 423,
    stats: { increasedThunderDamage: 0.1, increasedBlazeDamage: 0.1 },
    connections: ['r3bs33'],
    description: '+10% increased thunder damage. +10% increased blaze damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 4 — Strand B + Bridge completion  (E2P6, remaining 18 of 36)
  //
  //  Mirrors ring 3 layout. Bridge midpoints (slots 10, 22, 34) are notable.
  //  Spokes connect each r4 node down to its matching r3 column node.
  //  Arc exits: r4s07→r4s08, r4s11→r4s12, r4s19→r4s20, r4s23→r4s24, r4s31→r4s32, r4s35→r4s00.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Branch cap + W→R Bridge entry  (r4s04–r4s07) ───────────────────
  {
    id: 'r4s04', label: 'Forge Ember V',
    type: 'minor', section: 'warrior', ring: 4, slot: 4,
    stats: { flatBlazeDamage: 3 },
    connections: ['r4s03', 'r4s05'],
    description: '+3 flat blaze damage.',
  },
  {
    id: 'r4s05', label: "Pyre's Edge",
    type: 'notable', section: 'warrior', ring: 4, slot: 5,
    stats: { flatBlazeDamage: 6, maxHealth: 25 },
    connections: ['r4s04'],
    description: '+6 flat blaze damage. +25 max health.',
  },
  {
    id: 'r4s06', label: 'Iron Crossing I',
    type: 'minor', section: 'shared', ring: 4, slot: 6,
    stats: { flatPhysicalDamage: 3 },
    connections: ['r3s06', 'r4s07', 'r5s06', 'r4as06', 'r4bs06'],
    description: '+3 flat physical damage.',
  },
  {
    id: 'r4s07', label: 'Iron Crossing II',
    type: 'minor', section: 'shared', ring: 4, slot: 7,
    stats: { flatPhysicalDamage: 3 },
    connections: ['r4s06', 'r4s08'],
    description: '+3 flat physical damage.',
  },

  // ── W→R Bridge midpoint + exit  (r4s10–r4s11) ──────────────────────────
  {
    id: 'r4s10', label: 'Iron Crossing V',
    type: 'minor', section: 'shared', ring: 4, slot: 10,
    stats: { flatPhysicalDamage: 3 },
    connections: ['r4s09', 'r4s11'],
    description: '+3 flat physical damage.',
  },
  {
    id: 'r4s11', label: 'Iron Bulwark',
    type: 'notable', section: 'shared', ring: 4, slot: 11,
    stats: { flatPhysicalDamage: 6, totalArmor: 15 },
    connections: ['r4s10'],
    description: '+6 flat physical damage. +15 total armor.',
  },

  // ── Rogue Branch cap + R→S Bridge entry  (r4s16–r4s19) ───────────────────
  {
    id: 'r4s16', label: 'Frost Fang V',
    type: 'minor', section: 'rogue', ring: 4, slot: 16,
    stats: { flatFrostDamage: 3 },
    connections: ['r4s15', 'r4s17'],
    description: '+3 flat frost damage.',
  },
  {
    id: 'r4s17', label: "Winter's Bite",
    type: 'notable', section: 'rogue', ring: 4, slot: 17,
    stats: { flatFrostDamage: 6, moveSpeedMult: 0.05 },
    connections: ['r4s16'],
    description: '+6 flat frost damage. +5% move speed.',
  },
  {
    id: 'r4s18', label: 'Void Drift I',
    type: 'minor', section: 'shared', ring: 4, slot: 18,
    stats: { flatUnholyDamage: 3 },
    connections: ['r3s18', 'r4s19', 'r5s18', 'r4as18', 'r4bs18'],
    description: '+3 flat unholy damage.',
  },
  {
    id: 'r4s19', label: 'Void Drift II',
    type: 'minor', section: 'shared', ring: 4, slot: 19,
    stats: { flatUnholyDamage: 3 },
    connections: ['r4s18', 'r4s20'],
    description: '+3 flat unholy damage.',
  },

  // ── R→S Bridge midpoint + exit  (r4s22–r4s23) ──────────────────────────
  {
    id: 'r4s22', label: 'Void Drift V',
    type: 'minor', section: 'shared', ring: 4, slot: 22,
    stats: { flatUnholyDamage: 3 },
    connections: ['r4s21', 'r4s23'],
    description: '+3 flat unholy damage.',
  },
  {
    id: 'r4s23', label: 'Void Convergence',
    type: 'notable', section: 'shared', ring: 4, slot: 23,
    stats: { flatUnholyDamage: 6, manaRegenPerS: 0.4 },
    connections: ['r4s22'],
    description: '+6 flat unholy damage. +0.4 mana regen/s.',
  },

  // ── Sage Branch cap + S→W Bridge entry  (r4s28–r4s31) ───────────────────
  {
    id: 'r4s28', label: 'Arc Surge V',
    type: 'minor', section: 'sage', ring: 4, slot: 28,
    stats: { flatThunderDamage: 3 },
    connections: ['r4s27', 'r4s29'],
    description: '+3 flat thunder damage.',
  },
  {
    id: 'r4s29', label: 'Overcharged',
    type: 'notable', section: 'sage', ring: 4, slot: 29,
    stats: { flatThunderDamage: 6, manaRegenPerS: 0.5 },
    connections: ['r4s28'],
    description: '+6 flat thunder damage. +0.5 mana regen/s.',
  },
  {
    id: 'r4s30', label: 'Sacred Crossing I',
    type: 'minor', section: 'shared', ring: 4, slot: 30,
    stats: { flatHolyDamage: 3 },
    connections: ['r3s30', 'r4s31', 'r5s30', 'r4as30', 'r4bs30'],
    description: '+3 flat holy damage.',
  },
  {
    id: 'r4s31', label: 'Sacred Crossing II',
    type: 'minor', section: 'shared', ring: 4, slot: 31,
    stats: { flatHolyDamage: 3 },
    connections: ['r4s30', 'r4s32'],
    description: '+3 flat holy damage.',
  },

  // ── S→W Bridge midpoint + exit  (r4s34–r4s35) ──────────────────────────
  {
    id: 'r4s34', label: 'Sacred Crossing V',
    type: 'minor', section: 'shared', ring: 4, slot: 34,
    stats: { flatHolyDamage: 3 },
    connections: ['r4s33', 'r4s35'],
    description: '+3 flat holy damage.',
  },
  {
    id: 'r4s35', label: 'Divine Embrace',
    type: 'notable', section: 'shared', ring: 4, slot: 35,
    stats: { flatHolyDamage: 6, maxHealth: 20 },
    connections: ['r4s34'],
    description: '+6 flat holy damage. +20 max health.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 5 — Scaffold  (E2P7, all 36 nodes)
  //
  //  Same 36-slot section layout as rings 3–4.
  //  Placeholder stat scaling (replaced in E2P8):
  //    Warrior nodes  → maxHealth (+30 per minor)
  //    Rogue nodes    → moveSpeedMult (+0.07 per minor)
  //    Sage nodes     → maxMana (+25 per minor)
  //    Bridge nodes   → mix of adjacent class placeholder stats
  //
  //  Stub keystones (runtime effects + drawbacks added in E2P8):
  //    r5s07 — Pyre's Dominion (Warrior)
  //    r5s19 — Ghost Step (Rogue)
  //    r5s31 — Overload (Sage)
  //
  //  Spokes to ring 4 at centerpoints only: r5s00↔r4s00, r5s12↔r4s12, r5s24↔r4s24
  //  Wraparound arc: r5s35 → r5s00
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Strand A  (r5s00–r5s03) ────────────────────────────────────
  {
    id: 'r5s00', label: 'Cinderheart I',
    type: 'minor', section: 'warrior', ring: 5, slot: 0,
    stats: { flatBlazeDamage: 4 },
    connections: ['r4s00', 'r5s01', 'r6s00', 'r5as00', 'r5bs00'],
    description: '+4 flat blaze damage.',
  },
  {
    id: 'r5s01', label: 'Cinderheart II',
    type: 'minor', section: 'warrior', ring: 5, slot: 1,
    stats: { flatBlazeDamage: 4 },
    connections: ['r5s00', 'r5s02'],
    description: '+4 flat blaze damage.',
  },
  {
    id: 'r5s02', label: 'Cinderheart III',
    type: 'minor', section: 'warrior', ring: 5, slot: 2,
    stats: { flatBlazeDamage: 4 },
    connections: ['r5s01', 'r5s03'],
    description: '+4 flat blaze damage.',
  },
  {
    id: 'r5s03', label: 'Cinderheart IV',
    type: 'minor', section: 'warrior', ring: 5, slot: 3,
    stats: { flatBlazeDamage: 4 },
    connections: ['r5s02', 'r5s04'],
    description: '+4 flat blaze damage.',
  },

  // ── Warrior Strand B  (r5s04–r5s06) + Keystone  (r5s07) ────────────────
  {
    id: 'r5s05', label: "Forge Lord's Peak",
    type: 'keystone', section: 'warrior', ring: 5, slot: 5,
    stats: { flatBlazeDamage: 7, maxHealth: 30 },
    connections: ['r5s04'],
    description: '+7 flat blaze damage. +30 max health.',
  },
  {
    id: 'r5s04', label: 'Cinderheart V',
    type: 'minor', section: 'warrior', ring: 5, slot: 4,
    stats: { flatBlazeDamage: 4 },
    connections: ['r5s03', 'r5s05'],
    description: '+4 flat blaze damage.',
  },
  {
    id: 'r5s06', label: 'Blazepath',
    type: 'minor', section: 'warrior', ring: 5, slot: 6,
    stats: { flatBlazeDamage: 4 },
    connections: ['r4s06', 'r5s07', 'r6s06', 'r5as06', 'r5bs06'],
    description: '+4 flat blaze damage.',
  },
  {
    id: 'r5s07', label: "Pyre's Dominion",
    type: 'minor', section: 'warrior', ring: 5, slot: 7,
    stats: { flatBlazeDamage: 4 },
    connections: ['r5s06', 'r5s08'],
    description: '+4 flat blaze damage.',
  },

  // ── W→R Bridge  (r5s08–r5s11) ───────────────────────────────────────────
  {
    id: 'r5s08', label: 'Iron Tempest I',
    type: 'minor', section: 'shared', ring: 5, slot: 8,
    stats: { flatPhysicalDamage: 4 },
    connections: ['r5s07', 'r5s09'],
    description: '+4 flat physical damage.',
  },
  {
    id: 'r5s09', label: 'Iron Tempest II',
    type: 'minor', section: 'shared', ring: 5, slot: 9,
    stats: { flatPhysicalDamage: 4 },
    connections: ['r5s08', 'r5s10'],
    description: '+4 flat physical damage.',
  },
  {
    id: 'r5s10', label: 'Iron Tempest III',
    type: 'minor', section: 'shared', ring: 5, slot: 10,
    stats: { flatPhysicalDamage: 4 },
    connections: ['r5s09', 'r5s11'],
    description: '+4 flat physical damage.',
  },
  {
    id: 'r5s11', label: 'Ironclad Bastion',
    type: 'keystone', section: 'shared', ring: 5, slot: 11,
    stats: { flatPhysicalDamage: 7, totalArmor: 20 },
    connections: ['r5s10'],
    description: '+7 flat physical damage. +20 total armor.',
  },

  // ── Rogue Strand A  (r5s12–r5s15) ───────────────────────────────────────
  {
    id: 'r5s12', label: 'Reaver Chill I',
    type: 'minor', section: 'rogue', ring: 5, slot: 12,
    stats: { flatFrostDamage: 4 },
    connections: ['r4s12', 'r5s13', 'r6s12', 'r5as12', 'r5bs12'],
    description: '+4 flat frost damage.',
  },
  {
    id: 'r5s13', label: 'Reaver Chill II',
    type: 'minor', section: 'rogue', ring: 5, slot: 13,
    stats: { flatFrostDamage: 4 },
    connections: ['r5s12', 'r5s14'],
    description: '+4 flat frost damage.',
  },
  {
    id: 'r5s14', label: 'Reaver Chill III',
    type: 'minor', section: 'rogue', ring: 5, slot: 14,
    stats: { flatFrostDamage: 4 },
    connections: ['r5s13', 'r5s15'],
    description: '+4 flat frost damage.',
  },
  {
    id: 'r5s15', label: 'Reaver Chill IV',
    type: 'minor', section: 'rogue', ring: 5, slot: 15,
    stats: { flatFrostDamage: 4 },
    connections: ['r5s14', 'r5s16'],
    description: '+4 flat frost damage.',
  },

  // ── Rogue Strand B  (r5s16–r5s18) + Keystone  (r5s19) ──────────────────
  {
    id: 'r5s16', label: 'Reaver Chill V',
    type: 'minor', section: 'rogue', ring: 5, slot: 16,
    stats: { flatFrostDamage: 4 },
    connections: ['r5s15', 'r5s17'],
    description: '+4 flat frost damage.',
  },
  {
    id: 'r5s17', label: "Blizzard's Edge",
    type: 'keystone', section: 'rogue', ring: 5, slot: 17,
    stats: { flatFrostDamage: 7, moveSpeedMult: 0.06 },
    connections: ['r5s16'],
    description: '+7 flat frost damage. +6% move speed.',
  },
  {
    id: 'r5s18', label: 'Shadowstep',
    type: 'minor', section: 'rogue', ring: 5, slot: 18,
    stats: { flatFrostDamage: 4 },
    connections: ['r4s18', 'r5s19', 'r6s18', 'r5as18', 'r5bs18'],
    description: '+4 flat frost damage.',
  },
  {
    id: 'r5s19', label: 'Ghost Step',
    type: 'minor', section: 'rogue', ring: 5, slot: 19,
    stats: { flatFrostDamage: 4 },
    connections: ['r5s18', 'r5s20'],
    description: '+4 flat frost damage.',
  },

  // ── R→S Bridge  (r5s20–r5s23) ───────────────────────────────────────────
  {
    id: 'r5s20', label: 'Cursed Current I',
    type: 'minor', section: 'shared', ring: 5, slot: 20,
    stats: { flatUnholyDamage: 4 },
    connections: ['r5s19', 'r5s21'],
    description: '+4 flat unholy damage.',
  },
  {
    id: 'r5s21', label: 'Cursed Current II',
    type: 'minor', section: 'shared', ring: 5, slot: 21,
    stats: { flatUnholyDamage: 4 },
    connections: ['r5s20', 'r5s22'],
    description: '+4 flat unholy damage.',
  },
  {
    id: 'r5s22', label: 'Cursed Current III',
    type: 'minor', section: 'shared', ring: 5, slot: 22,
    stats: { flatUnholyDamage: 4 },
    connections: ['r5s21', 'r5s23'],
    description: '+4 flat unholy damage.',
  },
  {
    id: 'r5s23', label: 'Void Confluence',
    type: 'keystone', section: 'shared', ring: 5, slot: 23,
    stats: { flatUnholyDamage: 7, manaRegenPerS: 0.5 },
    connections: ['r5s22'],
    description: '+7 flat unholy damage. +0.5 mana regen/s.',
  },

  // ── Sage Strand A  (r5s24–r5s27) ────────────────────────────────────────
  {
    id: 'r5s24', label: 'Stormweave I',
    type: 'minor', section: 'sage', ring: 5, slot: 24,
    stats: { flatThunderDamage: 4 },
    connections: ['r4s24', 'r5s25', 'r6s24', 'r5as24', 'r5bs24'],
    description: '+4 flat thunder damage.',
  },
  {
    id: 'r5s25', label: 'Stormweave II',
    type: 'minor', section: 'sage', ring: 5, slot: 25,
    stats: { flatThunderDamage: 4 },
    connections: ['r5s24', 'r5s26'],
    description: '+4 flat thunder damage.',
  },
  {
    id: 'r5s26', label: 'Stormweave III',
    type: 'minor', section: 'sage', ring: 5, slot: 26,
    stats: { flatThunderDamage: 4 },
    connections: ['r5s25', 'r5s27'],
    description: '+4 flat thunder damage.',
  },
  {
    id: 'r5s27', label: 'Stormweave IV',
    type: 'minor', section: 'sage', ring: 5, slot: 27,
    stats: { flatThunderDamage: 4 },
    connections: ['r5s26', 'r5s28'],
    description: '+4 flat thunder damage.',
  },

  // ── Sage Strand B  (r5s28–r5s30) + Keystone  (r5s31) ───────────────────
  {
    id: 'r5s28', label: 'Stormweave V',
    type: 'minor', section: 'sage', ring: 5, slot: 28,
    stats: { flatThunderDamage: 4 },
    connections: ['r5s27', 'r5s29'],
    description: '+4 flat thunder damage.',
  },
  {
    id: 'r5s29', label: 'Lightning Crown',
    type: 'keystone', section: 'sage', ring: 5, slot: 29,
    stats: { flatThunderDamage: 7, manaRegenPerS: 0.6 },
    connections: ['r5s28'],
    description: '+7 flat thunder damage. +0.6 mana regen/s.',
  },
  {
    id: 'r5s30', label: 'Thunderpath',
    type: 'minor', section: 'sage', ring: 5, slot: 30,
    stats: { flatThunderDamage: 4 },
    connections: ['r4s30', 'r5s31', 'r6s30', 'r5as30', 'r5bs30'],
    description: '+4 flat thunder damage.',
  },
  {
    id: 'r5s31', label: 'Overload',
    type: 'minor', section: 'sage', ring: 5, slot: 31,
    stats: { flatThunderDamage: 4 },
    connections: ['r5s30', 'r5s32'],
    description: '+4 flat thunder damage.',
  },

  // ── S→W Bridge  (r5s32–r5s35) ───────────────────────────────────────────
  {
    id: 'r5s32', label: 'Solar Crossing I',
    type: 'minor', section: 'shared', ring: 5, slot: 32,
    stats: { flatHolyDamage: 4 },
    connections: ['r5s31', 'r5s33'],
    description: '+4 flat holy damage.',
  },
  {
    id: 'r5s33', label: 'Solar Crossing II',
    type: 'minor', section: 'shared', ring: 5, slot: 33,
    stats: { flatHolyDamage: 4 },
    connections: ['r5s32', 'r5s34'],
    description: '+4 flat holy damage.',
  },
  {
    id: 'r5s34', label: 'Solar Crossing III',
    type: 'minor', section: 'shared', ring: 5, slot: 34,
    stats: { flatHolyDamage: 4 },
    connections: ['r5s33', 'r5s35'],
    description: '+4 flat holy damage.',
  },
  {
    id: 'r5s35', label: 'Radiant Aegis',
    type: 'keystone', section: 'shared', ring: 5, slot: 35,
    stats: { flatHolyDamage: 7, maxHealth: 25 },
    connections: ['r5s34'],
    description: '+7 flat holy damage. +25 max health.,'
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 5a — Inner Damage-Domain Spur Branches  (E2P8.7.7)
  //
  //  6 increased-damage stubs branching inward clockwise of r5 connector nodes.
  //  Rendered between r4 (570px) and r5 (790px) via radiusOverride: 717.
  //  ring: 5 → cost 3 pts / 75g refund (matches parent connector).
  //  Each stub: entry node (clockwise offset from connector) → 3 minors → 1 notable.
  //  Domains covered: blaze, physical, frost, unholy, thunder, holy.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Blaze spur (clockwise of r5s00, slots 1→5) ───────────────────────────
  {
    id: 'r5as00', label: 'Ember Doctrine I',
    type: 'minor', section: 'warrior', ring: 5, slot: 1, radiusOverride: 717,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r5s00', 'r5as01'],
    description: '+5% increased blaze damage. Inner spur clockwise of r5s00.',
  },
  {
    id: 'r5as01', label: 'Ember Doctrine II',
    type: 'minor', section: 'warrior', ring: 5, slot: 2, radiusOverride: 717,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r5as00', 'r5as02'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r5as02', label: 'Ember Doctrine III',
    type: 'minor', section: 'warrior', ring: 5, slot: 3, radiusOverride: 717,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r5as01', 'r5as03'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r5as03', label: 'Ember Doctrine IV',
    type: 'minor', section: 'warrior', ring: 5, slot: 4, radiusOverride: 717,
    stats: { increasedBlazeDamage: 0.05 },
    connections: ['r5as02', 'r5as04'],
    description: '+5% increased blaze damage.',
  },
  {
    id: 'r5as04', label: 'Pyroclast Creed',
    type: 'notable', section: 'warrior', ring: 5, slot: 5, radiusOverride: 717,
    stats: { increasedBlazeDamage: 0.14, flatBlazeDamage: 2 },
    connections: ['r5as03'],
    description: '+14% increased blaze damage. +2 flat blaze damage.',
  },

  // ── Physical spur (clockwise of r5s06, slots 7→11) ───────────────────────
  {
    id: 'r5as06', label: 'Impact Doctrine I',
    type: 'minor', section: 'shared', ring: 5, slot: 7, radiusOverride: 717,
    stats: { increasedPhysicalDamage: 0.05 },
    connections: ['r5s06', 'r5as07'],
    description: '+5% increased physical damage. Inner spur clockwise of r5s06.',
  },
  {
    id: 'r5as07', label: 'Impact Doctrine II',
    type: 'minor', section: 'shared', ring: 5, slot: 8, radiusOverride: 717,
    stats: { increasedPhysicalDamage: 0.05 },
    connections: ['r5as06', 'r5as08'],
    description: '+5% increased physical damage.',
  },
  {
    id: 'r5as08', label: 'Impact Doctrine III',
    type: 'minor', section: 'shared', ring: 5, slot: 9, radiusOverride: 717,
    stats: { increasedPhysicalDamage: 0.05 },
    connections: ['r5as07', 'r5as09'],
    description: '+5% increased physical damage.',
  },
  {
    id: 'r5as09', label: 'Impact Doctrine IV',
    type: 'minor', section: 'shared', ring: 5, slot: 10, radiusOverride: 717,
    stats: { increasedPhysicalDamage: 0.05 },
    connections: ['r5as08', 'r5as10'],
    description: '+5% increased physical damage.',
  },
  {
    id: 'r5as10', label: 'Titanic Momentum',
    type: 'notable', section: 'shared', ring: 5, slot: 11, radiusOverride: 717,
    stats: { increasedPhysicalDamage: 0.14, flatPhysicalDamage: 2 },
    connections: ['r5as09'],
    description: '+14% increased physical damage. +2 flat physical damage.',
  },

  // ── Frost spur (clockwise of r5s12, slots 13→17) ─────────────────────────
  {
    id: 'r5as12', label: 'Rime Doctrine I',
    type: 'minor', section: 'rogue', ring: 5, slot: 13, radiusOverride: 717,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r5s12', 'r5as13'],
    description: '+5% increased frost damage. Inner spur clockwise of r5s12.',
  },
  {
    id: 'r5as13', label: 'Rime Doctrine II',
    type: 'minor', section: 'rogue', ring: 5, slot: 14, radiusOverride: 717,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r5as12', 'r5as14'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r5as14', label: 'Rime Doctrine III',
    type: 'minor', section: 'rogue', ring: 5, slot: 15, radiusOverride: 717,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r5as13', 'r5as15'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r5as15', label: 'Rime Doctrine IV',
    type: 'minor', section: 'rogue', ring: 5, slot: 16, radiusOverride: 717,
    stats: { increasedFrostDamage: 0.05 },
    connections: ['r5as14', 'r5as16'],
    description: '+5% increased frost damage.',
  },
  {
    id: 'r5as16', label: 'Winter Mandate',
    type: 'notable', section: 'rogue', ring: 5, slot: 17, radiusOverride: 717,
    stats: { increasedFrostDamage: 0.14, flatFrostDamage: 2 },
    connections: ['r5as15'],
    description: '+14% increased frost damage. +2 flat frost damage.',
  },

  // ── Unholy spur (clockwise of r5s18, slots 19→23) ────────────────────────
  {
    id: 'r5as18', label: 'Void Doctrine I',
    type: 'minor', section: 'shared', ring: 5, slot: 19, radiusOverride: 717,
    stats: { increasedUnholyDamage: 0.05 },
    connections: ['r5s18', 'r5as19'],
    description: '+5% increased unholy damage. Inner spur clockwise of r5s18.',
  },
  {
    id: 'r5as19', label: 'Void Doctrine II',
    type: 'minor', section: 'shared', ring: 5, slot: 20, radiusOverride: 717,
    stats: { increasedUnholyDamage: 0.05 },
    connections: ['r5as18', 'r5as20'],
    description: '+5% increased unholy damage.',
  },
  {
    id: 'r5as20', label: 'Void Doctrine III',
    type: 'minor', section: 'shared', ring: 5, slot: 21, radiusOverride: 717,
    stats: { increasedUnholyDamage: 0.05 },
    connections: ['r5as19', 'r5as21'],
    description: '+5% increased unholy damage.',
  },
  {
    id: 'r5as21', label: 'Void Doctrine IV',
    type: 'minor', section: 'shared', ring: 5, slot: 22, radiusOverride: 717,
    stats: { increasedUnholyDamage: 0.05 },
    connections: ['r5as20', 'r5as22'],
    description: '+5% increased unholy damage.',
  },
  {
    id: 'r5as22', label: 'Abyssal Decree',
    type: 'notable', section: 'shared', ring: 5, slot: 23, radiusOverride: 717,
    stats: { increasedUnholyDamage: 0.14, flatUnholyDamage: 2 },
    connections: ['r5as21'],
    description: '+14% increased unholy damage. +2 flat unholy damage.',
  },

  // ── Thunder spur (clockwise of r5s24, slots 25→29) ───────────────────────
  {
    id: 'r5as24', label: 'Storm Doctrine I',
    type: 'minor', section: 'sage', ring: 5, slot: 25, radiusOverride: 717,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r5s24', 'r5as25'],
    description: '+5% increased thunder damage. Inner spur clockwise of r5s24.',
  },
  {
    id: 'r5as25', label: 'Storm Doctrine II',
    type: 'minor', section: 'sage', ring: 5, slot: 26, radiusOverride: 717,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r5as24', 'r5as26'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r5as26', label: 'Storm Doctrine III',
    type: 'minor', section: 'sage', ring: 5, slot: 27, radiusOverride: 717,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r5as25', 'r5as27'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r5as27', label: 'Storm Doctrine IV',
    type: 'minor', section: 'sage', ring: 5, slot: 28, radiusOverride: 717,
    stats: { increasedThunderDamage: 0.05 },
    connections: ['r5as26', 'r5as28'],
    description: '+5% increased thunder damage.',
  },
  {
    id: 'r5as28', label: 'Skybinder Oath',
    type: 'notable', section: 'sage', ring: 5, slot: 29, radiusOverride: 717,
    stats: { increasedThunderDamage: 0.14, flatThunderDamage: 2 },
    connections: ['r5as27'],
    description: '+14% increased thunder damage. +2 flat thunder damage.',
  },

  // ── Holy spur (clockwise of r5s30, slots 31→35) ──────────────────────────
  {
    id: 'r5as30', label: 'Radiant Doctrine I',
    type: 'minor', section: 'shared', ring: 5, slot: 31, radiusOverride: 717,
    stats: { increasedHolyDamage: 0.05 },
    connections: ['r5s30', 'r5as31'],
    description: '+5% increased holy damage. Inner spur clockwise of r5s30.',
  },
  {
    id: 'r5as31', label: 'Radiant Doctrine II',
    type: 'minor', section: 'shared', ring: 5, slot: 32, radiusOverride: 717,
    stats: { increasedHolyDamage: 0.05 },
    connections: ['r5as30', 'r5as32'],
    description: '+5% increased holy damage.',
  },
  {
    id: 'r5as32', label: 'Radiant Doctrine III',
    type: 'minor', section: 'shared', ring: 5, slot: 33, radiusOverride: 717,
    stats: { increasedHolyDamage: 0.05 },
    connections: ['r5as31', 'r5as33'],
    description: '+5% increased holy damage.',
  },
  {
    id: 'r5as33', label: 'Radiant Doctrine IV',
    type: 'minor', section: 'shared', ring: 5, slot: 34, radiusOverride: 717,
    stats: { increasedHolyDamage: 0.05 },
    connections: ['r5as32', 'r5as34'],
    description: '+5% increased holy damage.',
  },
  {
    id: 'r5as34', label: 'Sanctified Covenant',
    type: 'notable', section: 'shared', ring: 5, slot: 35, radiusOverride: 717,
    stats: { increasedHolyDamage: 0.14, flatHolyDamage: 2 },
    connections: ['r5as33'],
    description: '+14% increased holy damage. +2 flat holy damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 5b — Outer Damage-Domain Spur Branches  (E2P8.7.7)
  //
  //  6 increased-damage stubs branching outward clockwise of r5 connector nodes.
  //  Rendered between r5 (790px) and r6 (1010px) via radiusOverride: 863.
  //  ring: 5 → cost 3 pts / 75g refund (matches parent connector).
  //  Each stub: entry node (clockwise offset from connector) → 3 minors → 1 notable.
  //  Domains covered: blaze, physical, frost, unholy, thunder, holy.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Blaze spur (clockwise of r5s00, slots 1→5) ───────────────────────────
  {
    id: 'r5bs00', label: 'Inferno Creed I',
    type: 'minor', section: 'warrior', ring: 5, slot: 1, radiusOverride: 863,
    stats: { increasedBlazeDamage: 0.06 },
    connections: ['r5s00', 'r5bs01'],
    description: '+6% increased blaze damage. Outer spur clockwise of r5s00.',
  },
  {
    id: 'r5bs01', label: 'Inferno Creed II',
    type: 'minor', section: 'warrior', ring: 5, slot: 2, radiusOverride: 863,
    stats: { increasedBlazeDamage: 0.06 },
    connections: ['r5bs00', 'r5bs02'],
    description: '+6% increased blaze damage.',
  },
  {
    id: 'r5bs02', label: 'Inferno Creed III',
    type: 'minor', section: 'warrior', ring: 5, slot: 3, radiusOverride: 863,
    stats: { increasedBlazeDamage: 0.06 },
    connections: ['r5bs01', 'r5bs03'],
    description: '+6% increased blaze damage.',
  },
  {
    id: 'r5bs03', label: 'Inferno Creed IV',
    type: 'minor', section: 'warrior', ring: 5, slot: 4, radiusOverride: 863,
    stats: { increasedBlazeDamage: 0.06 },
    connections: ['r5bs02', 'r5bs04'],
    description: '+6% increased blaze damage.',
  },
  {
    id: 'r5bs04', label: 'Flame Sovereignty',
    type: 'notable', section: 'warrior', ring: 5, slot: 5, radiusOverride: 863,
    stats: { increasedBlazeDamage: 0.18, flatBlazeDamage: 3 },
    connections: ['r5bs03'],
    description: '+18% increased blaze damage. +3 flat blaze damage.',
  },

  // ── Physical spur (clockwise of r5s06, slots 7→11) ───────────────────────
  {
    id: 'r5bs06', label: 'Colossus Creed I',
    type: 'minor', section: 'shared', ring: 5, slot: 7, radiusOverride: 863,
    stats: { increasedPhysicalDamage: 0.06 },
    connections: ['r5s06', 'r5bs07'],
    description: '+6% increased physical damage. Outer spur clockwise of r5s06.',
  },
  {
    id: 'r5bs07', label: 'Colossus Creed II',
    type: 'minor', section: 'shared', ring: 5, slot: 8, radiusOverride: 863,
    stats: { increasedPhysicalDamage: 0.06 },
    connections: ['r5bs06', 'r5bs08'],
    description: '+6% increased physical damage.',
  },
  {
    id: 'r5bs08', label: 'Colossus Creed III',
    type: 'minor', section: 'shared', ring: 5, slot: 9, radiusOverride: 863,
    stats: { increasedPhysicalDamage: 0.06 },
    connections: ['r5bs07', 'r5bs09'],
    description: '+6% increased physical damage.',
  },
  {
    id: 'r5bs09', label: 'Colossus Creed IV',
    type: 'minor', section: 'shared', ring: 5, slot: 10, radiusOverride: 863,
    stats: { increasedPhysicalDamage: 0.06 },
    connections: ['r5bs08', 'r5bs10'],
    description: '+6% increased physical damage.',
  },
  {
    id: 'r5bs10', label: 'Anvil Imperative',
    type: 'notable', section: 'shared', ring: 5, slot: 11, radiusOverride: 863,
    stats: { increasedPhysicalDamage: 0.18, flatPhysicalDamage: 3 },
    connections: ['r5bs09'],
    description: '+18% increased physical damage. +3 flat physical damage.',
  },

  // ── Frost spur (clockwise of r5s12, slots 13→17) ─────────────────────────
  {
    id: 'r5bs12', label: 'Glacier Creed I',
    type: 'minor', section: 'rogue', ring: 5, slot: 13, radiusOverride: 863,
    stats: { increasedFrostDamage: 0.06 },
    connections: ['r5s12', 'r5bs13'],
    description: '+6% increased frost damage. Outer spur clockwise of r5s12.',
  },
  {
    id: 'r5bs13', label: 'Glacier Creed II',
    type: 'minor', section: 'rogue', ring: 5, slot: 14, radiusOverride: 863,
    stats: { increasedFrostDamage: 0.06 },
    connections: ['r5bs12', 'r5bs14'],
    description: '+6% increased frost damage.',
  },
  {
    id: 'r5bs14', label: 'Glacier Creed III',
    type: 'minor', section: 'rogue', ring: 5, slot: 15, radiusOverride: 863,
    stats: { increasedFrostDamage: 0.06 },
    connections: ['r5bs13', 'r5bs15'],
    description: '+6% increased frost damage.',
  },
  {
    id: 'r5bs15', label: 'Glacier Creed IV',
    type: 'minor', section: 'rogue', ring: 5, slot: 16, radiusOverride: 863,
    stats: { increasedFrostDamage: 0.06 },
    connections: ['r5bs14', 'r5bs16'],
    description: '+6% increased frost damage.',
  },
  {
    id: 'r5bs16', label: 'Permafrost Edict',
    type: 'notable', section: 'rogue', ring: 5, slot: 17, radiusOverride: 863,
    stats: { increasedFrostDamage: 0.18, flatFrostDamage: 3 },
    connections: ['r5bs15'],
    description: '+18% increased frost damage. +3 flat frost damage.',
  },

  // ── Unholy spur (clockwise of r5s18, slots 19→23) ────────────────────────
  {
    id: 'r5bs18', label: 'Abyss Creed I',
    type: 'minor', section: 'shared', ring: 5, slot: 19, radiusOverride: 863,
    stats: { increasedUnholyDamage: 0.06 },
    connections: ['r5s18', 'r5bs19'],
    description: '+6% increased unholy damage. Outer spur clockwise of r5s18.',
  },
  {
    id: 'r5bs19', label: 'Abyss Creed II',
    type: 'minor', section: 'shared', ring: 5, slot: 20, radiusOverride: 863,
    stats: { increasedUnholyDamage: 0.06 },
    connections: ['r5bs18', 'r5bs20'],
    description: '+6% increased unholy damage.',
  },
  {
    id: 'r5bs20', label: 'Abyss Creed III',
    type: 'minor', section: 'shared', ring: 5, slot: 21, radiusOverride: 863,
    stats: { increasedUnholyDamage: 0.06 },
    connections: ['r5bs19', 'r5bs21'],
    description: '+6% increased unholy damage.',
  },
  {
    id: 'r5bs21', label: 'Abyss Creed IV',
    type: 'minor', section: 'shared', ring: 5, slot: 22, radiusOverride: 863,
    stats: { increasedUnholyDamage: 0.06 },
    connections: ['r5bs20', 'r5bs22'],
    description: '+6% increased unholy damage.',
  },
  {
    id: 'r5bs22', label: 'Profane Verdict',
    type: 'notable', section: 'shared', ring: 5, slot: 23, radiusOverride: 863,
    stats: { increasedUnholyDamage: 0.18, flatUnholyDamage: 3 },
    connections: ['r5bs21'],
    description: '+18% increased unholy damage. +3 flat unholy damage.',
  },

  // ── Thunder spur (clockwise of r5s24, slots 25→29) ───────────────────────
  {
    id: 'r5bs24', label: 'Tempest Creed I',
    type: 'minor', section: 'sage', ring: 5, slot: 25, radiusOverride: 863,
    stats: { increasedThunderDamage: 0.06 },
    connections: ['r5s24', 'r5bs25'],
    description: '+6% increased thunder damage. Outer spur clockwise of r5s24.',
  },
  {
    id: 'r5bs25', label: 'Tempest Creed II',
    type: 'minor', section: 'sage', ring: 5, slot: 26, radiusOverride: 863,
    stats: { increasedThunderDamage: 0.06 },
    connections: ['r5bs24', 'r5bs26'],
    description: '+6% increased thunder damage.',
  },
  {
    id: 'r5bs26', label: 'Tempest Creed III',
    type: 'minor', section: 'sage', ring: 5, slot: 27, radiusOverride: 863,
    stats: { increasedThunderDamage: 0.06 },
    connections: ['r5bs25', 'r5bs27'],
    description: '+6% increased thunder damage.',
  },
  {
    id: 'r5bs27', label: 'Tempest Creed IV',
    type: 'minor', section: 'sage', ring: 5, slot: 28, radiusOverride: 863,
    stats: { increasedThunderDamage: 0.06 },
    connections: ['r5bs26', 'r5bs28'],
    description: '+6% increased thunder damage.',
  },
  {
    id: 'r5bs28', label: 'Storm Dominion',
    type: 'notable', section: 'sage', ring: 5, slot: 29, radiusOverride: 863,
    stats: { increasedThunderDamage: 0.18, flatThunderDamage: 3 },
    connections: ['r5bs27'],
    description: '+18% increased thunder damage. +3 flat thunder damage.',
  },

  // ── Holy spur (clockwise of r5s30, slots 31→35) ──────────────────────────
  {
    id: 'r5bs30', label: 'Sanctum Creed I',
    type: 'minor', section: 'shared', ring: 5, slot: 31, radiusOverride: 863,
    stats: { increasedHolyDamage: 0.06 },
    connections: ['r5s30', 'r5bs31'],
    description: '+6% increased holy damage. Outer spur clockwise of r5s30.',
  },
  {
    id: 'r5bs31', label: 'Sanctum Creed II',
    type: 'minor', section: 'shared', ring: 5, slot: 32, radiusOverride: 863,
    stats: { increasedHolyDamage: 0.06 },
    connections: ['r5bs30', 'r5bs32'],
    description: '+6% increased holy damage.',
  },
  {
    id: 'r5bs32', label: 'Sanctum Creed III',
    type: 'minor', section: 'shared', ring: 5, slot: 33, radiusOverride: 863,
    stats: { increasedHolyDamage: 0.06 },
    connections: ['r5bs31', 'r5bs33'],
    description: '+6% increased holy damage.',
  },
  {
    id: 'r5bs33', label: 'Sanctum Creed IV',
    type: 'minor', section: 'shared', ring: 5, slot: 34, radiusOverride: 863,
    stats: { increasedHolyDamage: 0.06 },
    connections: ['r5bs32', 'r5bs34'],
    description: '+6% increased holy damage.',
  },
  {
    id: 'r5bs34', label: 'Solar Canon',
    type: 'notable', section: 'shared', ring: 5, slot: 35, radiusOverride: 863,
    stats: { increasedHolyDamage: 0.18, flatHolyDamage: 3 },
    connections: ['r5bs33'],
    description: '+18% increased holy damage. +3 flat holy damage.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 6 — Deep Endgame  (E2P7, all 36 nodes)
  //
  //  Ring 6 = strong minors + second-tier notables. No keystones.
  //  Placeholder stat scaling:
  //    Warrior nodes  → maxHealth (+35 per minor; notables: +50 HP + 1 HP/s)
  //    Rogue nodes    → moveSpeedMult (+0.08 per minor; notables: +0.12 spd + 0.08 atkSpd)
  //    Sage nodes     → maxMana (+30 per minor; notables: +45 mana + 1.5 mana/s)
  //    Bridge nodes   → mix of adjacent class placeholder stats
  //
  //  Spokes to ring 5 at centerpoints only: r6s00↔r5s00, r6s12↔r5s12, r6s24↔r5s24
  //  Spokes to ring 7 at centerpoints only: r6s00↔r7s00, r6s12↔r7s12, r6s24↔r7s24
  //  Wraparound arc: r6s35 → r6s00
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior Strand A  (r6s00–r6s03) ────────────────────────────────────
  {
    id: 'r6s00', label: 'Ironwall I',
    type: 'minor', section: 'warrior', ring: 6, slot: 0,
    stats: { totalArmor: 5 },
    connections: ['r5s00', 'r6s01', 'r7s00', 'r6as00', 'r6bs00'],
    description: '+5 total armor.',
  },
  {
    id: 'r6s01', label: 'Ironwall II',
    type: 'minor', section: 'warrior', ring: 6, slot: 1,
    stats: { totalArmor: 5 },
    connections: ['r6s00', 'r6s02'],
    description: '+5 total armor.',
  },
  {
    id: 'r6s02', label: 'Ironwall III',
    type: 'minor', section: 'warrior', ring: 6, slot: 2,
    stats: { totalArmor: 5 },
    connections: ['r6s01', 'r6s03'],
    description: '+5 total armor.',
  },
  {
    id: 'r6s03', label: 'Ironwall IV',
    type: 'minor', section: 'warrior', ring: 6, slot: 3,
    stats: { totalArmor: 5 },
    connections: ['r6s02', 'r6s04'],
    description: '+5 total armor.',
  },
  {
    id: 'r6s04', label: 'Ironwall V',
    type: 'minor', section: 'warrior', ring: 6, slot: 4,
    stats: { totalArmor: 5 },
    connections: ['r6s03', 'r6s05'],
    description: '+5 total armor.',
  },
  {
    id: 'r6s05', label: 'Fortress Heart',
    type: 'notable', section: 'warrior', ring: 6, slot: 5,
    stats: { totalArmor: 12, healthRegenPerS: 1.5 },
    connections: ['r6s04'],
    description: '+12 total armor. +1.5 health regen/s.',
  },
  {
    id: 'r6s06', label: 'Stone-frost I',
    type: 'minor', section: 'shared', ring: 6, slot: 6,
    stats: { totalArmor: 4, healthRegenPerS: 0.5 },
    connections: ['r5s06', 'r6s07', 'r7s06', 'r6as06', 'r6bs06'],
    description: '+4 total armor. +0.5 health regen/s.',
  },
  {
    id: 'r6s07', label: 'Stone-frost II',
    type: 'minor', section: 'shared', ring: 6, slot: 7,
    stats: { totalArmor: 4, healthRegenPerS: 0.5 },
    connections: ['r6s06', 'r6s08'],
    description: '+4 total armor. +0.5 health regen/s.',
  },

  // ── W→R Bridge  (r6s08–r6s11) ───────────────────────────────────────────
  {
    id: 'r6s08', label: 'Stone-frost III',
    type: 'minor', section: 'shared', ring: 6, slot: 8,
    stats: { totalArmor: 4, healthRegenPerS: 0.5 },
    connections: ['r6s07', 'r6s09'],
    description: '+4 total armor. +0.5 health regen/s.',
  },
  {
    id: 'r6s09', label: 'Stone-frost IV',
    type: 'minor', section: 'shared', ring: 6, slot: 9,
    stats: { totalArmor: 4, healthRegenPerS: 0.5 },
    connections: ['r6s08', 'r6s10'],
    description: '+4 total armor. +0.5 health regen/s.',
  },
  {
    id: 'r6s10', label: 'Stone-frost V',
    type: 'minor', section: 'shared', ring: 6, slot: 10,
    stats: { totalArmor: 4, healthRegenPerS: 0.5 },
    connections: ['r6s09', 'r6s11'],
    description: '+4 total armor. +0.5 health regen/s.',
  },
  {
    id: 'r6s11', label: 'Bulwark Crown',
    type: 'notable', section: 'shared', ring: 6, slot: 11,
    stats: { totalArmor: 8, healthRegenPerS: 1.2 },
    connections: ['r6s10'],
    description: '+8 total armor. +1.2 health regen/s.',
  },

  // ── Rogue Strand A  (r6s12–r6s15) ───────────────────────────────────────
  {
    id: 'r6s12', label: 'Verdant Flow I',
    type: 'minor', section: 'rogue', ring: 6, slot: 12,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r5s12', 'r6s13', 'r7s12', 'r6as12', 'r6bs12'],
    description: '+0.8 health regen/s.',
  },
  {
    id: 'r6s13', label: 'Verdant Flow II',
    type: 'minor', section: 'rogue', ring: 6, slot: 13,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r6s12', 'r6s14'],
    description: '+0.8 health regen/s.',
  },
  {
    id: 'r6s14', label: 'Verdant Flow III',
    type: 'minor', section: 'rogue', ring: 6, slot: 14,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r6s13', 'r6s15'],
    description: '+0.8 health regen/s.',
  },
  {
    id: 'r6s15', label: 'Verdant Flow IV',
    type: 'minor', section: 'rogue', ring: 6, slot: 15,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r6s14', 'r6s16'],
    description: '+0.8 health regen/s.',
  },

  // ── Rogue Strand B + notable terminus  (r6s16–r6s19) ────────────────────
  {
    id: 'r6s16', label: 'Verdant Flow V',
    type: 'minor', section: 'rogue', ring: 6, slot: 16,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r6s15', 'r6s17'],
    description: '+0.8 health regen/s.',
  },
  {
    id: 'r6s17', label: 'Second Wind',
    type: 'notable', section: 'rogue', ring: 6, slot: 17,
    stats: { healthRegenPerS: 1.8, moveSpeedMult: 0.04 },
    connections: ['r6s16'],
    description: '+1.8 health regen/s. +4% move speed.',
  },
  {
    id: 'r6s18', label: 'Lifestorm I',
    type: 'minor', section: 'shared', ring: 6, slot: 18,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.3 },
    connections: ['r5s18', 'r6s19', 'r7s18', 'r6as18', 'r6bs18'],
    description: '+0.5 health regen/s. +0.3 mana regen/s.',
  },
  {
    id: 'r6s19', label: 'Lifestorm II',
    type: 'minor', section: 'shared', ring: 6, slot: 19,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.3 },
    connections: ['r6s18', 'r6s20'],
    description: '+0.5 health regen/s. +0.3 mana regen/s.',
  },

  // ── R→S Bridge  (r6s20–r6s23) ───────────────────────────────────────────
  {
    id: 'r6s20', label: 'Lifestorm III',
    type: 'minor', section: 'shared', ring: 6, slot: 20,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.3 },
    connections: ['r6s19', 'r6s21'],
    description: '+0.5 health regen/s. +0.3 mana regen/s.',
  },
  {
    id: 'r6s21', label: 'Lifestorm IV',
    type: 'minor', section: 'shared', ring: 6, slot: 21,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.3 },
    connections: ['r6s20', 'r6s22'],
    description: '+0.5 health regen/s. +0.3 mana regen/s.',
  },
  {
    id: 'r6s22', label: 'Lifestorm V',
    type: 'minor', section: 'shared', ring: 6, slot: 22,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.3 },
    connections: ['r6s21', 'r6s23'],
    description: '+0.5 health regen/s. +0.3 mana regen/s.',
  },
  {
    id: 'r6s23', label: 'Convergent Tide',
    type: 'notable', section: 'shared', ring: 6, slot: 23,
    stats: { healthRegenPerS: 1.2, manaRegenPerS: 0.6 },
    connections: ['r6s22'],
    description: '+1.2 health regen/s. +0.6 mana regen/s.',
  },

  // ── Sage Strand A  (r6s24–r6s27) ────────────────────────────────────────
  {
    id: 'r6s24', label: 'Wellspring I',
    type: 'minor', section: 'sage', ring: 6, slot: 24,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r5s24', 'r6s25', 'r7s24', 'r6as24', 'r6bs24'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r6s25', label: 'Wellspring II',
    type: 'minor', section: 'sage', ring: 6, slot: 25,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r6s24', 'r6s26'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r6s26', label: 'Wellspring III',
    type: 'minor', section: 'sage', ring: 6, slot: 26,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r6s25', 'r6s27'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r6s27', label: 'Wellspring IV',
    type: 'minor', section: 'sage', ring: 6, slot: 27,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r6s26', 'r6s28'],
    description: '+0.5 mana regen/s.',
  },

  // ── Sage Strand B + notable terminus  (r6s28–r6s31) ─────────────────────
  {
    id: 'r6s28', label: 'Wellspring V',
    type: 'minor', section: 'sage', ring: 6, slot: 28,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r6s27', 'r6s29'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r6s29', label: 'Eternal Fount',
    type: 'notable', section: 'sage', ring: 6, slot: 29,
    stats: { manaRegenPerS: 1.2, maxMana: 30 },
    connections: ['r6s28'],
    description: '+1.2 mana regen/s. +30 max mana.',
  },
  {
    id: 'r6s30', label: 'Bastion Flow I',
    type: 'minor', section: 'shared', ring: 6, slot: 30,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r5s30', 'r6s31', 'r7s30', 'r6as30', 'r6bs30'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r6s31', label: 'Bastion Flow II',
    type: 'minor', section: 'shared', ring: 6, slot: 31,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r6s30', 'r6s32'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },

  // ── S→W Bridge  (r6s32–r6s35) ───────────────────────────────────────────
  {
    id: 'r6s32', label: 'Bastion Flow III',
    type: 'minor', section: 'shared', ring: 6, slot: 32,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r6s31', 'r6s33'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r6s33', label: 'Bastion Flow IV',
    type: 'minor', section: 'shared', ring: 6, slot: 33,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r6s32', 'r6s34'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r6s34', label: 'Bastion Flow V',
    type: 'minor', section: 'shared', ring: 6, slot: 34,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r6s33', 'r6s35'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r6s35', label: 'Sanctified Ground',
    type: 'notable', section: 'shared', ring: 6, slot: 35,
    stats: { manaRegenPerS: 0.7, totalArmor: 8 },
    connections: ['r6s34'],
    description: '+0.7 mana regen/s. +8 total armor.',
  },


  // ══════════════════════════════════════════════════════════════════════════
  //  RING 6 SPUR BRANCHES — r6a (inner, radius 937) + r6b (outer, radius 1083)
  //
  //  Defense-themed stubs off the 6 r6 connector nodes.
  //  Main stats: totalArmor, totalEvasion, maxEnergyShield
  //  Bonus splashes: moveSpeedMult, attackSpeed, castSpeed
  //
  //  Branch anatomy: 4 minors → 1 notable cap (dead-end)
  //  Slots progress clockwise from connector (slot+1 through slot+5)
  // ══════════════════════════════════════════════════════════════════════════

  // ── r6a — Armor branch (clockwise of r6s00, slots 1–5) ───────────────────
  { id: 'r6as00', label: 'Scale Hide I',    type: 'minor',   section: 'warrior', ring: 6, slot: 1,  radiusOverride: 937,  stats: { totalArmor: 5 },                             connections: ['r6s00', 'r6as01'], description: '+5 armor. Inner armor spur off r6s00.' },
  { id: 'r6as01', label: 'Scale Hide II',   type: 'minor',   section: 'warrior', ring: 6, slot: 2,  radiusOverride: 937,  stats: { totalArmor: 5 },                             connections: ['r6as00', 'r6as02'], description: '+5 armor.' },
  { id: 'r6as02', label: 'Scale Hide III',  type: 'minor',   section: 'warrior', ring: 6, slot: 3,  radiusOverride: 937,  stats: { totalArmor: 5 },                             connections: ['r6as01', 'r6as03'], description: '+5 armor.' },
  { id: 'r6as03', label: 'Scale Hide IV',   type: 'minor',   section: 'warrior', ring: 6, slot: 4,  radiusOverride: 937,  stats: { totalArmor: 5 },                             connections: ['r6as02', 'r6as04'], description: '+5 armor.' },
  { id: 'r6as04', label: 'Forge Dominion',  type: 'notable', section: 'warrior', ring: 6, slot: 5,  radiusOverride: 937,  stats: { totalArmor: 14, moveSpeedMult: 0.05 },        connections: ['r6as03'], description: '+14 armor, +5% movement speed. The fortress walks.' },

  // ── r6a — Armor+Evasion branch (clockwise of r6s06, slots 7–11) ──────────
  { id: 'r6as06', label: 'Stone Veil I',    type: 'minor',   section: 'shared',  ring: 6, slot: 7,  radiusOverride: 937,  stats: { totalArmor: 3, totalEvasion: 4 },             connections: ['r6s06', 'r6as07'], description: '+3 armor, +4 evasion. Inner hybrid spur off r6s06.' },
  { id: 'r6as07', label: 'Stone Veil II',   type: 'minor',   section: 'shared',  ring: 6, slot: 8,  radiusOverride: 937,  stats: { totalArmor: 3, totalEvasion: 4 },             connections: ['r6as06', 'r6as08'], description: '+3 armor, +4 evasion.' },
  { id: 'r6as08', label: 'Stone Veil III',  type: 'minor',   section: 'shared',  ring: 6, slot: 9,  radiusOverride: 937,  stats: { totalArmor: 3, totalEvasion: 4 },             connections: ['r6as07', 'r6as09'], description: '+3 armor, +4 evasion.' },
  { id: 'r6as09', label: 'Stone Veil IV',   type: 'minor',   section: 'shared',  ring: 6, slot: 10, radiusOverride: 937,  stats: { totalArmor: 3, totalEvasion: 4 },             connections: ['r6as08', 'r6as10'], description: '+3 armor, +4 evasion.' },
  { id: 'r6as10', label: 'Granite Tempest', type: 'notable', section: 'shared',  ring: 6, slot: 11, radiusOverride: 937,  stats: { totalArmor: 10, totalEvasion: 12 },           connections: ['r6as09'], description: '+10 armor, +12 evasion. Stone and wind, inseparable.' },

  // ── r6a — Evasion branch (clockwise of r6s12, slots 13–17) ──────────────
  { id: 'r6as12', label: 'Silkform I',      type: 'minor',   section: 'rogue',   ring: 6, slot: 13, radiusOverride: 937,  stats: { totalEvasion: 6 },                           connections: ['r6s12', 'r6as13'], description: '+6 evasion. Inner evasion spur off r6s12.' },
  { id: 'r6as13', label: 'Silkform II',     type: 'minor',   section: 'rogue',   ring: 6, slot: 14, radiusOverride: 937,  stats: { totalEvasion: 6 },                           connections: ['r6as12', 'r6as14'], description: '+6 evasion.' },
  { id: 'r6as14', label: 'Silkform III',    type: 'minor',   section: 'rogue',   ring: 6, slot: 15, radiusOverride: 937,  stats: { totalEvasion: 6 },                           connections: ['r6as13', 'r6as15'], description: '+6 evasion.' },
  { id: 'r6as15', label: 'Silkform IV',     type: 'minor',   section: 'rogue',   ring: 6, slot: 16, radiusOverride: 937,  stats: { totalEvasion: 6 },                           connections: ['r6as14', 'r6as16'], description: '+6 evasion.' },
  { id: 'r6as16', label: 'Ghost Veil',      type: 'notable', section: 'rogue',   ring: 6, slot: 17, radiusOverride: 937,  stats: { totalEvasion: 18, attackSpeed: 0.05 },        connections: ['r6as15'], description: '+18 evasion, +5% attack speed. Strikes pass through empty air.' },

  // ── r6a — Evasion+CastSpeed branch (clockwise of r6s18, slots 19–23) ─────
  { id: 'r6as18', label: 'Slip Current I',  type: 'minor',   section: 'shared',  ring: 6, slot: 19, radiusOverride: 937,  stats: { totalEvasion: 4, castSpeed: 0.015 },          connections: ['r6s18', 'r6as19'], description: '+4 evasion, +1.5% cast speed. Inner hybrid spur off r6s18.' },
  { id: 'r6as19', label: 'Slip Current II', type: 'minor',   section: 'shared',  ring: 6, slot: 20, radiusOverride: 937,  stats: { totalEvasion: 4, castSpeed: 0.015 },          connections: ['r6as18', 'r6as20'], description: '+4 evasion, +1.5% cast speed.' },
  { id: 'r6as20', label: 'Slip Current III',type: 'minor',   section: 'shared',  ring: 6, slot: 21, radiusOverride: 937,  stats: { totalEvasion: 4, castSpeed: 0.015 },          connections: ['r6as19', 'r6as21'], description: '+4 evasion, +1.5% cast speed.' },
  { id: 'r6as21', label: 'Slip Current IV', type: 'minor',   section: 'shared',  ring: 6, slot: 22, radiusOverride: 937,  stats: { totalEvasion: 4, castSpeed: 0.015 },          connections: ['r6as20', 'r6as22'], description: '+4 evasion, +1.5% cast speed.' },
  { id: 'r6as22', label: 'Phase Drift',     type: 'notable', section: 'shared',  ring: 6, slot: 23, radiusOverride: 937,  stats: { totalEvasion: 12, castSpeed: 0.04 },           connections: ['r6as21'], description: '+12 evasion, +4% cast speed. Spells escape before the moment they were cast.' },

  // ── r6a — Energy Shield branch (clockwise of r6s24, slots 25–29) ─────────
  { id: 'r6as24', label: 'Crystal Shell I',  type: 'minor',   section: 'sage',    ring: 6, slot: 25, radiusOverride: 937,  stats: { maxEnergyShield: 10 },                       connections: ['r6s24', 'r6as25'], description: '+10 energy shield. Inner shield spur off r6s24.' },
  { id: 'r6as25', label: 'Crystal Shell II', type: 'minor',   section: 'sage',    ring: 6, slot: 26, radiusOverride: 937,  stats: { maxEnergyShield: 10 },                       connections: ['r6as24', 'r6as26'], description: '+10 energy shield.' },
  { id: 'r6as26', label: 'Crystal Shell III',type: 'minor',   section: 'sage',    ring: 6, slot: 27, radiusOverride: 937,  stats: { maxEnergyShield: 10 },                       connections: ['r6as25', 'r6as27'], description: '+10 energy shield.' },
  { id: 'r6as27', label: 'Crystal Shell IV', type: 'minor',   section: 'sage',    ring: 6, slot: 28, radiusOverride: 937,  stats: { maxEnergyShield: 10 },                       connections: ['r6as26', 'r6as28'], description: '+10 energy shield.' },
  { id: 'r6as28', label: 'Crystal Lattice',  type: 'notable', section: 'sage',    ring: 6, slot: 29, radiusOverride: 937,  stats: { maxEnergyShield: 30, castSpeed: 0.04 },       connections: ['r6as27'], description: '+30 energy shield, +4% cast speed. The arcane shell hums with unspoken words.' },

  // ── r6a — Shield+Armor branch (clockwise of r6s30, slots 31–35) ──────────
  { id: 'r6as30', label: 'Voidplate I',     type: 'minor',   section: 'shared',  ring: 6, slot: 31, radiusOverride: 937,  stats: { maxEnergyShield: 7, totalArmor: 3 },          connections: ['r6s30', 'r6as31'], description: '+7 energy shield, +3 armor. Inner hybrid spur off r6s30.' },
  { id: 'r6as31', label: 'Voidplate II',    type: 'minor',   section: 'shared',  ring: 6, slot: 32, radiusOverride: 937,  stats: { maxEnergyShield: 7, totalArmor: 3 },          connections: ['r6as30', 'r6as32'], description: '+7 energy shield, +3 armor.' },
  { id: 'r6as32', label: 'Voidplate III',   type: 'minor',   section: 'shared',  ring: 6, slot: 33, radiusOverride: 937,  stats: { maxEnergyShield: 7, totalArmor: 3 },          connections: ['r6as31', 'r6as33'], description: '+7 energy shield, +3 armor.' },
  { id: 'r6as33', label: 'Voidplate IV',    type: 'minor',   section: 'shared',  ring: 6, slot: 34, radiusOverride: 937,  stats: { maxEnergyShield: 7, totalArmor: 3 },          connections: ['r6as32', 'r6as34'], description: '+7 energy shield, +3 armor.' },
  { id: 'r6as34', label: 'Null Bastion',    type: 'notable', section: 'shared',  ring: 6, slot: 35, radiusOverride: 937,  stats: { maxEnergyShield: 20, totalArmor: 10 },        connections: ['r6as33'], description: '+20 energy shield, +10 armor. Neither flames nor void find purchase here.' },

  // ── r6b — Armor branch (clockwise of r6s00, slots 1–5) ───────────────────
  { id: 'r6bs00', label: 'Iron Carapace I',   type: 'minor',   section: 'warrior', ring: 6, slot: 1,  radiusOverride: 1083, stats: { totalArmor: 7 },                            connections: ['r6s00', 'r6bs01'], description: '+7 armor. Outer armor spur off r6s00.' },
  { id: 'r6bs01', label: 'Iron Carapace II',  type: 'minor',   section: 'warrior', ring: 6, slot: 2,  radiusOverride: 1083, stats: { totalArmor: 7 },                            connections: ['r6bs00', 'r6bs02'], description: '+7 armor.' },
  { id: 'r6bs02', label: 'Iron Carapace III', type: 'minor',   section: 'warrior', ring: 6, slot: 3,  radiusOverride: 1083, stats: { totalArmor: 7 },                            connections: ['r6bs01', 'r6bs03'], description: '+7 armor.' },
  { id: 'r6bs03', label: 'Iron Carapace IV',  type: 'minor',   section: 'warrior', ring: 6, slot: 4,  radiusOverride: 1083, stats: { totalArmor: 7 },                            connections: ['r6bs02', 'r6bs04'], description: '+7 armor.' },
  { id: 'r6bs04', label: 'Ironclad Decree',   type: 'notable', section: 'warrior', ring: 6, slot: 5,  radiusOverride: 1083, stats: { totalArmor: 22, moveSpeedMult: 0.08 },       connections: ['r6bs03'], description: '+22 armor, +8% movement speed. Slow to give ground. Impossible to take it.' },

  // ── r6b — Armor+Evasion branch (clockwise of r6s06, slots 7–11) ──────────
  { id: 'r6bs06', label: 'Stormstone I',      type: 'minor',   section: 'shared',  ring: 6, slot: 7,  radiusOverride: 1083, stats: { totalArmor: 5, totalEvasion: 5 },            connections: ['r6s06', 'r6bs07'], description: '+5 armor, +5 evasion. Outer hybrid spur off r6s06.' },
  { id: 'r6bs07', label: 'Stormstone II',     type: 'minor',   section: 'shared',  ring: 6, slot: 8,  radiusOverride: 1083, stats: { totalArmor: 5, totalEvasion: 5 },            connections: ['r6bs06', 'r6bs08'], description: '+5 armor, +5 evasion.' },
  { id: 'r6bs08', label: 'Stormstone III',    type: 'minor',   section: 'shared',  ring: 6, slot: 9,  radiusOverride: 1083, stats: { totalArmor: 5, totalEvasion: 5 },            connections: ['r6bs07', 'r6bs09'], description: '+5 armor, +5 evasion.' },
  { id: 'r6bs09', label: 'Stormstone IV',     type: 'minor',   section: 'shared',  ring: 6, slot: 10, radiusOverride: 1083, stats: { totalArmor: 5, totalEvasion: 5 },            connections: ['r6bs08', 'r6bs10'], description: '+5 armor, +5 evasion.' },
  { id: 'r6bs10', label: 'Tempest Carapace',  type: 'notable', section: 'shared',  ring: 6, slot: 11, radiusOverride: 1083, stats: { totalArmor: 16, totalEvasion: 18 },          connections: ['r6bs09'], description: '+16 armor, +18 evasion. The storm shapes the stone; the stone weathers the storm.' },

  // ── r6b — Evasion branch (clockwise of r6s12, slots 13–17) ──────────────
  { id: 'r6bs12', label: 'Mirrorform I',      type: 'minor',   section: 'rogue',   ring: 6, slot: 13, radiusOverride: 1083, stats: { totalEvasion: 8 },                          connections: ['r6s12', 'r6bs13'], description: '+8 evasion. Outer evasion spur off r6s12.' },
  { id: 'r6bs13', label: 'Mirrorform II',     type: 'minor',   section: 'rogue',   ring: 6, slot: 14, radiusOverride: 1083, stats: { totalEvasion: 8 },                          connections: ['r6bs12', 'r6bs14'], description: '+8 evasion.' },
  { id: 'r6bs14', label: 'Mirrorform III',    type: 'minor',   section: 'rogue',   ring: 6, slot: 15, radiusOverride: 1083, stats: { totalEvasion: 8 },                          connections: ['r6bs13', 'r6bs15'], description: '+8 evasion.' },
  { id: 'r6bs15', label: 'Mirrorform IV',     type: 'minor',   section: 'rogue',   ring: 6, slot: 16, radiusOverride: 1083, stats: { totalEvasion: 8 },                          connections: ['r6bs14', 'r6bs16'], description: '+8 evasion.' },
  { id: 'r6bs16', label: 'Shattered Mirror',  type: 'notable', section: 'rogue',   ring: 6, slot: 17, radiusOverride: 1083, stats: { totalEvasion: 26, attackSpeed: 0.08 },       connections: ['r6bs15'], description: '+26 evasion, +8% attack speed. The reflection strikes before you do.' },

  // ── r6b — Evasion+CastSpeed branch (clockwise of r6s18, slots 19–23) ─────
  { id: 'r6bs18', label: 'Phase Slip I',      type: 'minor',   section: 'shared',  ring: 6, slot: 19, radiusOverride: 1083, stats: { totalEvasion: 5, castSpeed: 0.02 },           connections: ['r6s18', 'r6bs19'], description: '+5 evasion, +2% cast speed. Outer hybrid spur off r6s18.' },
  { id: 'r6bs19', label: 'Phase Slip II',     type: 'minor',   section: 'shared',  ring: 6, slot: 20, radiusOverride: 1083, stats: { totalEvasion: 5, castSpeed: 0.02 },           connections: ['r6bs18', 'r6bs20'], description: '+5 evasion, +2% cast speed.' },
  { id: 'r6bs20', label: 'Phase Slip III',    type: 'minor',   section: 'shared',  ring: 6, slot: 21, radiusOverride: 1083, stats: { totalEvasion: 5, castSpeed: 0.02 },           connections: ['r6bs19', 'r6bs21'], description: '+5 evasion, +2% cast speed.' },
  { id: 'r6bs21', label: 'Phase Slip IV',     type: 'minor',   section: 'shared',  ring: 6, slot: 22, radiusOverride: 1083, stats: { totalEvasion: 5, castSpeed: 0.02 },           connections: ['r6bs20', 'r6bs22'], description: '+5 evasion, +2% cast speed.' },
  { id: 'r6bs22', label: 'Slip Singularity',  type: 'notable', section: 'shared',  ring: 6, slot: 23, radiusOverride: 1083, stats: { totalEvasion: 18, castSpeed: 0.06 },           connections: ['r6bs21'], description: '+18 evasion, +6% cast speed. To dodge is to cast. To cast is to vanish.' },

  // ── r6b — Energy Shield branch (clockwise of r6s24, slots 25–29) ─────────
  { id: 'r6bs24', label: 'Aether Shell I',    type: 'minor',   section: 'sage',    ring: 6, slot: 25, radiusOverride: 1083, stats: { maxEnergyShield: 14 },                       connections: ['r6s24', 'r6bs25'], description: '+14 energy shield. Outer shield spur off r6s24.' },
  { id: 'r6bs25', label: 'Aether Shell II',   type: 'minor',   section: 'sage',    ring: 6, slot: 26, radiusOverride: 1083, stats: { maxEnergyShield: 14 },                       connections: ['r6bs24', 'r6bs26'], description: '+14 energy shield.' },
  { id: 'r6bs26', label: 'Aether Shell III',  type: 'minor',   section: 'sage',    ring: 6, slot: 27, radiusOverride: 1083, stats: { maxEnergyShield: 14 },                       connections: ['r6bs25', 'r6bs27'], description: '+14 energy shield.' },
  { id: 'r6bs27', label: 'Aether Shell IV',   type: 'minor',   section: 'sage',    ring: 6, slot: 28, radiusOverride: 1083, stats: { maxEnergyShield: 14 },                       connections: ['r6bs26', 'r6bs28'], description: '+14 energy shield.' },
  { id: 'r6bs28', label: 'Aether Mantle',     type: 'notable', section: 'sage',    ring: 6, slot: 29, radiusOverride: 1083, stats: { maxEnergyShield: 42, castSpeed: 0.06 },       connections: ['r6bs27'], description: '+42 energy shield, +6% cast speed. The mantle breathes before you do.' },

  // ── r6b — Shield+Armor branch (clockwise of r6s30, slots 31–35) ──────────
  { id: 'r6bs30', label: 'Bastion Core I',    type: 'minor',   section: 'shared',  ring: 6, slot: 31, radiusOverride: 1083, stats: { maxEnergyShield: 10, totalArmor: 5 },        connections: ['r6s30', 'r6bs31'], description: '+10 energy shield, +5 armor. Outer hybrid spur off r6s30.' },
  { id: 'r6bs31', label: 'Bastion Core II',   type: 'minor',   section: 'shared',  ring: 6, slot: 32, radiusOverride: 1083, stats: { maxEnergyShield: 10, totalArmor: 5 },        connections: ['r6bs30', 'r6bs32'], description: '+10 energy shield, +5 armor.' },
  { id: 'r6bs32', label: 'Bastion Core III',  type: 'minor',   section: 'shared',  ring: 6, slot: 33, radiusOverride: 1083, stats: { maxEnergyShield: 10, totalArmor: 5 },        connections: ['r6bs31', 'r6bs33'], description: '+10 energy shield, +5 armor.' },
  { id: 'r6bs33', label: 'Bastion Core IV',   type: 'minor',   section: 'shared',  ring: 6, slot: 34, radiusOverride: 1083, stats: { maxEnergyShield: 10, totalArmor: 5 },        connections: ['r6bs32', 'r6bs34'], description: '+10 energy shield, +5 armor.' },
  { id: 'r6bs34', label: 'Bastion of Nullity',type: 'notable', section: 'shared',  ring: 6, slot: 35, radiusOverride: 1083, stats: { maxEnergyShield: 30, totalArmor: 15 },       connections: ['r6bs33'], description: '+30 energy shield, +15 armor. Between void and iron — nothing passes.' },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 4a — Inner Spur Branches  (E2P8.7.5)
  //
  //  6 defense-themed stubs branching inward clockwise of r4 connector nodes.
  //  Rendered between r3 (350px) and r4 (570px) via radiusOverride: 497.
  //  ring: 4 → cost 2 pts / 50g refund (matches parent connector).
  //  Each stub: entry node (same slot as connector) → 3 minors → 1 notable.
  //  Arc extends clockwise (increasing slot) — no outward spokes.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior r4a spur (clockwise of r4s00, slots 1→5) ──────────────────────────────
  {
    id: 'r4as00', label: 'Iron Ward I',
    type: 'minor', section: 'warrior', ring: 4, slot: 1, radiusOverride: 497,
    stats: { totalArmor: 6 },
    connections: ['r4s00', 'r4as01'],
    description: '+6 total armor. Inner spur clockwise of Warrior connector.',
  },
  {
    id: 'r4as01', label: 'Iron Ward II',
    type: 'minor', section: 'warrior', ring: 4, slot: 2, radiusOverride: 497,
    stats: { totalArmor: 6 },
    connections: ['r4as00', 'r4as02'],
    description: '+6 total armor.',
  },
  {
    id: 'r4as02', label: 'Iron Ward III',
    type: 'minor', section: 'warrior', ring: 4, slot: 3, radiusOverride: 497,
    stats: { totalArmor: 6 },
    connections: ['r4as01', 'r4as03'],
    description: '+6 total armor.',
  },
  {
    id: 'r4as03', label: 'Iron Ward IV',
    type: 'minor', section: 'warrior', ring: 4, slot: 4, radiusOverride: 497,
    stats: { totalArmor: 6 },
    connections: ['r4as02', 'r4as04'],
    description: '+6 total armor.',
  },
  {
    id: 'r4as04', label: 'Iron Veil',
    type: 'notable', section: 'warrior', ring: 4, slot: 5, radiusOverride: 497,
    stats: { totalArmor: 15, healthRegenPerS: 1.0 },
    connections: ['r4as03'],
    description: '+15 total armor. +1.0 health regen/s.',
  },

  // ── W→R Bridge r4a spur (clockwise of r4s06, slots 7→11) ──────────────────────────
  {
    id: 'r4as06', label: 'Stone-Frost Ward I',
    type: 'minor', section: 'shared', ring: 4, slot: 7, radiusOverride: 497,
    stats: { totalArmor: 4, healthRegenPerS: 0.4 },
    connections: ['r4s06', 'r4as07'],
    description: '+4 total armor. +0.4 health regen/s. Inner spur clockwise of W\u2192R connector.',
  },
  {
    id: 'r4as07', label: 'Stone-Frost Ward II',
    type: 'minor', section: 'shared', ring: 4, slot: 8, radiusOverride: 497,
    stats: { totalArmor: 4, healthRegenPerS: 0.4 },
    connections: ['r4as06', 'r4as08'],
    description: '+4 total armor. +0.4 health regen/s.',
  },
  {
    id: 'r4as08', label: 'Stone-Frost Ward III',
    type: 'minor', section: 'shared', ring: 4, slot: 9, radiusOverride: 497,
    stats: { totalArmor: 4, healthRegenPerS: 0.4 },
    connections: ['r4as07', 'r4as09'],
    description: '+4 total armor. +0.4 health regen/s.',
  },
  {
    id: 'r4as09', label: 'Stone-Frost Ward IV',
    type: 'minor', section: 'shared', ring: 4, slot: 10, radiusOverride: 497,
    stats: { totalArmor: 4, healthRegenPerS: 0.4 },
    connections: ['r4as08', 'r4as10'],
    description: '+4 total armor. +0.4 health regen/s.',
  },
  {
    id: 'r4as10', label: 'Frost Bulwark',
    type: 'notable', section: 'shared', ring: 4, slot: 11, radiusOverride: 497,
    stats: { totalArmor: 10, healthRegenPerS: 1.0 },
    connections: ['r4as09'],
    description: '+10 total armor. +1.0 health regen/s.',
  },

  // ── Rogue r4a spur (clockwise of r4s12, slots 13→17) ───────────────────────────────
  {
    id: 'r4as12', label: 'Verdant Recovery I',
    type: 'minor', section: 'rogue', ring: 4, slot: 13, radiusOverride: 497,
    stats: { healthRegenPerS: 0.7 },
    connections: ['r4s12', 'r4as13'],
    description: '+0.7 health regen/s. Inner spur clockwise of Rogue connector.',
  },
  {
    id: 'r4as13', label: 'Verdant Recovery II',
    type: 'minor', section: 'rogue', ring: 4, slot: 14, radiusOverride: 497,
    stats: { healthRegenPerS: 0.7 },
    connections: ['r4as12', 'r4as14'],
    description: '+0.7 health regen/s.',
  },
  {
    id: 'r4as14', label: 'Verdant Recovery III',
    type: 'minor', section: 'rogue', ring: 4, slot: 15, radiusOverride: 497,
    stats: { healthRegenPerS: 0.7 },
    connections: ['r4as13', 'r4as15'],
    description: '+0.7 health regen/s.',
  },
  {
    id: 'r4as15', label: 'Verdant Recovery IV',
    type: 'minor', section: 'rogue', ring: 4, slot: 16, radiusOverride: 497,
    stats: { healthRegenPerS: 0.7 },
    connections: ['r4as14', 'r4as16'],
    description: '+0.7 health regen/s.',
  },
  {
    id: 'r4as16', label: 'Fleet Recovery',
    type: 'notable', section: 'rogue', ring: 4, slot: 17, radiusOverride: 497,
    stats: { healthRegenPerS: 1.6, moveSpeedMult: 0.03 },
    connections: ['r4as15'],
    description: '+1.6 health regen/s. +3% move speed.',
  },

  // ── R→S Bridge r4a spur (clockwise of r4s18, slots 19→23) ──────────────────────────
  {
    id: 'r4as18', label: 'Dual Current I',
    type: 'minor', section: 'shared', ring: 4, slot: 19, radiusOverride: 497,
    stats: { healthRegenPerS: 0.4, manaRegenPerS: 0.2 },
    connections: ['r4s18', 'r4as19'],
    description: '+0.4 health regen/s. +0.2 mana regen/s. Inner spur clockwise of R\u2192S connector.',
  },
  {
    id: 'r4as19', label: 'Dual Current II',
    type: 'minor', section: 'shared', ring: 4, slot: 20, radiusOverride: 497,
    stats: { healthRegenPerS: 0.4, manaRegenPerS: 0.2 },
    connections: ['r4as18', 'r4as20'],
    description: '+0.4 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4as20', label: 'Dual Current III',
    type: 'minor', section: 'shared', ring: 4, slot: 21, radiusOverride: 497,
    stats: { healthRegenPerS: 0.4, manaRegenPerS: 0.2 },
    connections: ['r4as19', 'r4as21'],
    description: '+0.4 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4as21', label: 'Dual Current IV',
    type: 'minor', section: 'shared', ring: 4, slot: 22, radiusOverride: 497,
    stats: { healthRegenPerS: 0.4, manaRegenPerS: 0.2 },
    connections: ['r4as20', 'r4as22'],
    description: '+0.4 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4as22', label: 'Twin Flow',
    type: 'notable', section: 'shared', ring: 4, slot: 23, radiusOverride: 497,
    stats: { healthRegenPerS: 1.0, manaRegenPerS: 0.5 },
    connections: ['r4as21'],
    description: '+1.0 health regen/s. +0.5 mana regen/s.',
  },

  // ── Sage r4a spur (clockwise of r4s24, slots 25→29) ───────────────────────────────
  {
    id: 'r4as24', label: 'Wellspring I',
    type: 'minor', section: 'sage', ring: 4, slot: 25, radiusOverride: 497,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r4s24', 'r4as25'],
    description: '+0.5 mana regen/s. Inner spur clockwise of Sage connector.',
  },
  {
    id: 'r4as25', label: 'Wellspring II',
    type: 'minor', section: 'sage', ring: 4, slot: 26, radiusOverride: 497,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r4as24', 'r4as26'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r4as26', label: 'Wellspring III',
    type: 'minor', section: 'sage', ring: 4, slot: 27, radiusOverride: 497,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r4as25', 'r4as27'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r4as27', label: 'Wellspring IV',
    type: 'minor', section: 'sage', ring: 4, slot: 28, radiusOverride: 497,
    stats: { manaRegenPerS: 0.5 },
    connections: ['r4as26', 'r4as28'],
    description: '+0.5 mana regen/s.',
  },
  {
    id: 'r4as28', label: 'Arcane Reserve',
    type: 'notable', section: 'sage', ring: 4, slot: 29, radiusOverride: 497,
    stats: { manaRegenPerS: 1.2, maxMana: 25 },
    connections: ['r4as27'],
    description: '+1.2 mana regen/s. +25 max mana.',
  },

  // ── S→W Bridge r4a spur (clockwise of r4s30, slots 31→35) ──────────────────────────
  {
    id: 'r4as30', label: 'Runed Flow I',
    type: 'minor', section: 'shared', ring: 4, slot: 31, radiusOverride: 497,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r4s30', 'r4as31'],
    description: '+0.3 mana regen/s. +3 total armor. Inner spur clockwise of S\u2192W connector.',
  },
  {
    id: 'r4as31', label: 'Runed Flow II',
    type: 'minor', section: 'shared', ring: 4, slot: 32, radiusOverride: 497,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r4as30', 'r4as32'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r4as32', label: 'Runed Flow III',
    type: 'minor', section: 'shared', ring: 4, slot: 33, radiusOverride: 497,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r4as31', 'r4as33'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r4as33', label: 'Runed Flow IV',
    type: 'minor', section: 'shared', ring: 4, slot: 34, radiusOverride: 497,
    stats: { manaRegenPerS: 0.3, totalArmor: 3 },
    connections: ['r4as32', 'r4as34'],
    description: '+0.3 mana regen/s. +3 total armor.',
  },
  {
    id: 'r4as34', label: 'Runed Plating',
    type: 'notable', section: 'shared', ring: 4, slot: 35, radiusOverride: 497,
    stats: { manaRegenPerS: 0.8, totalArmor: 8 },
    connections: ['r4as33'],
    description: '+0.8 mana regen/s. +8 total armor.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 4b — Outer Spur Branches  (E2P8.7.5)
  //
  //  6 defense-themed stubs branching outward clockwise of r4 connector nodes.
  //  Rendered between r4 (570px) and r5 (790px) via radiusOverride: 643.
  //  ring: 4 → cost 2 pts / 50g refund (matches parent connector).
  //  Each stub: entry node (same slot as connector) → 3 minors → 1 notable.
  //  Arc extends clockwise (increasing slot) — no outward spokes.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior r4b spur (clockwise of r4s00, slots 1→5) ──────────────────────────────
  {
    id: 'r4bs00', label: 'Tempered Guard I',
    type: 'minor', section: 'warrior', ring: 4, slot: 1, radiusOverride: 643,
    stats: { totalArmor: 4, maxHealth: 20 },
    connections: ['r4s00', 'r4bs01'],
    description: '+4 total armor. +20 max health. Outer spur clockwise of Warrior connector.',
  },
  {
    id: 'r4bs01', label: 'Tempered Guard II',
    type: 'minor', section: 'warrior', ring: 4, slot: 2, radiusOverride: 643,
    stats: { totalArmor: 4, maxHealth: 20 },
    connections: ['r4bs00', 'r4bs02'],
    description: '+4 total armor. +20 max health.',
  },
  {
    id: 'r4bs02', label: 'Tempered Guard III',
    type: 'minor', section: 'warrior', ring: 4, slot: 3, radiusOverride: 643,
    stats: { totalArmor: 4, maxHealth: 20 },
    connections: ['r4bs01', 'r4bs03'],
    description: '+4 total armor. +20 max health.',
  },
  {
    id: 'r4bs03', label: 'Tempered Guard IV',
    type: 'minor', section: 'warrior', ring: 4, slot: 4, radiusOverride: 643,
    stats: { totalArmor: 4, maxHealth: 20 },
    connections: ['r4bs02', 'r4bs04'],
    description: '+4 total armor. +20 max health.',
  },
  {
    id: 'r4bs04', label: 'Tempered Hide',
    type: 'notable', section: 'warrior', ring: 4, slot: 5, radiusOverride: 643,
    stats: { totalArmor: 10, maxHealth: 50 },
    connections: ['r4bs03'],
    description: '+10 total armor. +50 max health.',
  },

  // ── W→R Bridge r4b spur (clockwise of r4s06, slots 7→11) ──────────────────────────
  {
    id: 'r4bs06', label: 'Warden\'s Guard I',
    type: 'minor', section: 'shared', ring: 4, slot: 7, radiusOverride: 643,
    stats: { healthRegenPerS: 0.6, totalArmor: 3 },
    connections: ['r4s06', 'r4bs07'],
    description: '+0.6 health regen/s. +3 total armor. Outer spur clockwise of W\u2192R connector.',
  },
  {
    id: 'r4bs07', label: 'Warden\'s Guard II',
    type: 'minor', section: 'shared', ring: 4, slot: 8, radiusOverride: 643,
    stats: { healthRegenPerS: 0.6, totalArmor: 3 },
    connections: ['r4bs06', 'r4bs08'],
    description: '+0.6 health regen/s. +3 total armor.',
  },
  {
    id: 'r4bs08', label: 'Warden\'s Guard III',
    type: 'minor', section: 'shared', ring: 4, slot: 9, radiusOverride: 643,
    stats: { healthRegenPerS: 0.6, totalArmor: 3 },
    connections: ['r4bs07', 'r4bs09'],
    description: '+0.6 health regen/s. +3 total armor.',
  },
  {
    id: 'r4bs09', label: 'Warden\'s Guard IV',
    type: 'minor', section: 'shared', ring: 4, slot: 10, radiusOverride: 643,
    stats: { healthRegenPerS: 0.6, totalArmor: 3 },
    connections: ['r4bs08', 'r4bs10'],
    description: '+0.6 health regen/s. +3 total armor.',
  },
  {
    id: 'r4bs10', label: 'Warden\'s Resolve',
    type: 'notable', section: 'shared', ring: 4, slot: 11, radiusOverride: 643,
    stats: { healthRegenPerS: 1.5, totalArmor: 8 },
    connections: ['r4bs09'],
    description: '+1.5 health regen/s. +8 total armor.',
  },

  // ── Rogue r4b spur (clockwise of r4s12, slots 13→17) ───────────────────────────────
  {
    id: 'r4bs12', label: 'Vital Renewal I',
    type: 'minor', section: 'rogue', ring: 4, slot: 13, radiusOverride: 643,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.2 },
    connections: ['r4s12', 'r4bs13'],
    description: '+0.5 health regen/s. +0.2 mana regen/s. Outer spur clockwise of Rogue connector.',
  },
  {
    id: 'r4bs13', label: 'Vital Renewal II',
    type: 'minor', section: 'rogue', ring: 4, slot: 14, radiusOverride: 643,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.2 },
    connections: ['r4bs12', 'r4bs14'],
    description: '+0.5 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs14', label: 'Vital Renewal III',
    type: 'minor', section: 'rogue', ring: 4, slot: 15, radiusOverride: 643,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.2 },
    connections: ['r4bs13', 'r4bs15'],
    description: '+0.5 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs15', label: 'Vital Renewal IV',
    type: 'minor', section: 'rogue', ring: 4, slot: 16, radiusOverride: 643,
    stats: { healthRegenPerS: 0.5, manaRegenPerS: 0.2 },
    connections: ['r4bs14', 'r4bs16'],
    description: '+0.5 health regen/s. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs16', label: 'Vital Surge',
    type: 'notable', section: 'rogue', ring: 4, slot: 17, radiusOverride: 643,
    stats: { healthRegenPerS: 1.2, manaRegenPerS: 0.5 },
    connections: ['r4bs15'],
    description: '+1.2 health regen/s. +0.5 mana regen/s.',
  },

  // ── R→S Bridge r4b spur (clockwise of r4s18, slots 19→23) ──────────────────────────
  {
    id: 'r4bs18', label: 'Tidal Flow I',
    type: 'minor', section: 'shared', ring: 4, slot: 19, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, healthRegenPerS: 0.3 },
    connections: ['r4s18', 'r4bs19'],
    description: '+0.4 mana regen/s. +0.3 health regen/s. Outer spur clockwise of R\u2192S connector.',
  },
  {
    id: 'r4bs19', label: 'Tidal Flow II',
    type: 'minor', section: 'shared', ring: 4, slot: 20, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, healthRegenPerS: 0.3 },
    connections: ['r4bs18', 'r4bs20'],
    description: '+0.4 mana regen/s. +0.3 health regen/s.',
  },
  {
    id: 'r4bs20', label: 'Tidal Flow III',
    type: 'minor', section: 'shared', ring: 4, slot: 21, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, healthRegenPerS: 0.3 },
    connections: ['r4bs19', 'r4bs21'],
    description: '+0.4 mana regen/s. +0.3 health regen/s.',
  },
  {
    id: 'r4bs21', label: 'Tidal Flow IV',
    type: 'minor', section: 'shared', ring: 4, slot: 22, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, healthRegenPerS: 0.3 },
    connections: ['r4bs20', 'r4bs22'],
    description: '+0.4 mana regen/s. +0.3 health regen/s.',
  },
  {
    id: 'r4bs22', label: 'Ebb & Tide',
    type: 'notable', section: 'shared', ring: 4, slot: 23, radiusOverride: 643,
    stats: { manaRegenPerS: 1.0, healthRegenPerS: 0.8 },
    connections: ['r4bs21'],
    description: '+1.0 mana regen/s. +0.8 health regen/s.',
  },

  // ── Sage r4b spur (clockwise of r4s24, slots 25→29) ───────────────────────────────
  {
    id: 'r4bs24', label: 'Deep Well I',
    type: 'minor', section: 'sage', ring: 4, slot: 25, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, maxMana: 15 },
    connections: ['r4s24', 'r4bs25'],
    description: '+0.4 mana regen/s. +15 max mana. Outer spur clockwise of Sage connector.',
  },
  {
    id: 'r4bs25', label: 'Deep Well II',
    type: 'minor', section: 'sage', ring: 4, slot: 26, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, maxMana: 15 },
    connections: ['r4bs24', 'r4bs26'],
    description: '+0.4 mana regen/s. +15 max mana.',
  },
  {
    id: 'r4bs26', label: 'Deep Well III',
    type: 'minor', section: 'sage', ring: 4, slot: 27, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, maxMana: 15 },
    connections: ['r4bs25', 'r4bs27'],
    description: '+0.4 mana regen/s. +15 max mana.',
  },
  {
    id: 'r4bs27', label: 'Deep Well IV',
    type: 'minor', section: 'sage', ring: 4, slot: 28, radiusOverride: 643,
    stats: { manaRegenPerS: 0.4, maxMana: 15 },
    connections: ['r4bs26', 'r4bs28'],
    description: '+0.4 mana regen/s. +15 max mana.',
  },
  {
    id: 'r4bs28', label: 'Deep Reservoir',
    type: 'notable', section: 'sage', ring: 4, slot: 29, radiusOverride: 643,
    stats: { manaRegenPerS: 1.0, maxMana: 40 },
    connections: ['r4bs27'],
    description: '+1.0 mana regen/s. +40 max mana.',
  },

  // ── S→W Bridge r4b spur (clockwise of r4s30, slots 31→35) ──────────────────────────
  {
    id: 'r4bs30', label: 'Warded Path I',
    type: 'minor', section: 'shared', ring: 4, slot: 31, radiusOverride: 643,
    stats: { totalArmor: 4, manaRegenPerS: 0.2 },
    connections: ['r4s30', 'r4bs31'],
    description: '+4 total armor. +0.2 mana regen/s. Outer spur clockwise of S\u2192W connector.',
  },
  {
    id: 'r4bs31', label: 'Warded Path II',
    type: 'minor', section: 'shared', ring: 4, slot: 32, radiusOverride: 643,
    stats: { totalArmor: 4, manaRegenPerS: 0.2 },
    connections: ['r4bs30', 'r4bs32'],
    description: '+4 total armor. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs32', label: 'Warded Path III',
    type: 'minor', section: 'shared', ring: 4, slot: 33, radiusOverride: 643,
    stats: { totalArmor: 4, manaRegenPerS: 0.2 },
    connections: ['r4bs31', 'r4bs33'],
    description: '+4 total armor. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs33', label: 'Warded Path IV',
    type: 'minor', section: 'shared', ring: 4, slot: 34, radiusOverride: 643,
    stats: { totalArmor: 4, manaRegenPerS: 0.2 },
    connections: ['r4bs32', 'r4bs34'],
    description: '+4 total armor. +0.2 mana regen/s.',
  },
  {
    id: 'r4bs34', label: 'Warded Stone',
    type: 'notable', section: 'shared', ring: 4, slot: 35, radiusOverride: 643,
    stats: { totalArmor: 10, manaRegenPerS: 0.6 },
    connections: ['r4bs33'],
    description: '+10 total armor. +0.6 mana regen/s.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 7 — Terminus  (E2P7, all 36 nodes)
  //
  //  Ring 7 = deepest endgame. Three class keystones with meaningful drawbacks.
  //  All other nodes are strong minors building toward those keystones.
  //  No ring beyond ring 7 — no outward spokes from any r7 node.
  //
  //  Placeholder stat scaling:
  //    Warrior → maxHealth (+40 per minor)
  //    Rogue   → moveSpeedMult (+0.09 per minor)
  //    Sage    → maxMana (+35 per minor)
  //    Bridge  → mix of adjacent class stats
  //
  //  Keystones (runtime effects + final drawbacks wired in E2P8):
  //    r7s07 — Immolate     (Warrior): massive fire surge, sacrifices HP regen
  //    r7s19 — Wraith Form  (Rogue):   extreme speed, lose all armor/evasion
  //    r7s31 — Mana Storm   (Sage):    enormous mana pool, +50% mana costs
  //
  //  Spokes from ring 6 at centerpoints only: r7s00↔r6s00, r7s12↔r6s12, r7s24↔r6s24
  //  Wraparound arc: r7s35 → r7s00
  // ══════════════════════════════════════════════════════════════════════════

  // ── Warrior (s00–s05) ─── maxHealth: 45 per node ────────────────────────
  {
    id: 'r7s00', label: 'Iron Vein I',
    type: 'minor', section: 'warrior', ring: 7, slot: 0,
    stats: { maxHealth: 45 },
    connections: ['r6s00', 'r7s01', 'r7s35', 'r8s00', 'r7as00', 'r7bs00'],
    description: '+45 max health. Warrior spoke of the r7 highway.',
  },
  {
    id: 'r7s01', label: 'Iron Vein II',
    type: 'minor', section: 'warrior', ring: 7, slot: 1,
    stats: { maxHealth: 45 },
    connections: ['r7s00', 'r7s02'],
    description: '+45 max health.',
  },
  {
    id: 'r7s02', label: 'Iron Vein III',
    type: 'minor', section: 'warrior', ring: 7, slot: 2,
    stats: { maxHealth: 45 },
    connections: ['r7s01', 'r7s03'],
    description: '+45 max health.',
  },
  {
    id: 'r7s03', label: 'Iron Vein IV',
    type: 'minor', section: 'warrior', ring: 7, slot: 3,
    stats: { maxHealth: 45 },
    connections: ['r7s02', 'r7s04'],
    description: '+45 max health.',
  },
  {
    id: 'r7s04', label: 'Iron Vein V',
    type: 'minor', section: 'warrior', ring: 7, slot: 4,
    stats: { maxHealth: 45 },
    connections: ['r7s03', 'r7s05'],
    description: '+45 max health.',
  },
  {
    id: 'r7s05', label: 'Iron Vein VI',
    type: 'minor', section: 'warrior', ring: 7, slot: 5,
    stats: { maxHealth: 45 },
    connections: ['r7s04', 'r7s06'],
    description: '+45 max health.',
  },

  // ── W→R Bridge (s06–s11) ─── moveSpeedMult: 0.03 per node ──────────────
  {
    id: 'r7s06', label: 'Quickstride I',
    type: 'minor', section: 'shared', ring: 7, slot: 6,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r6s06', 'r7s05', 'r7s07', 'r8s06', 'r7as06', 'r7bs06'],
    description: '+3% movement speed. W→R bridge spoke.',
  },
  {
    id: 'r7s07', label: 'Quickstride II',
    type: 'minor', section: 'shared', ring: 7, slot: 7,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r7s06', 'r7s08'],
    description: '+3% movement speed.',
  },
  {
    id: 'r7s08', label: 'Quickstride III',
    type: 'minor', section: 'shared', ring: 7, slot: 8,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r7s07', 'r7s09'],
    description: '+3% movement speed.',
  },
  {
    id: 'r7s09', label: 'Quickstride IV',
    type: 'minor', section: 'shared', ring: 7, slot: 9,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r7s08', 'r7s10'],
    description: '+3% movement speed.',
  },
  {
    id: 'r7s10', label: 'Quickstride V',
    type: 'minor', section: 'shared', ring: 7, slot: 10,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r7s09', 'r7s11'],
    description: '+3% movement speed.',
  },
  {
    id: 'r7s11', label: 'Quickstride VI',
    type: 'minor', section: 'shared', ring: 7, slot: 11,
    stats: { moveSpeedMult: 0.03 },
    connections: ['r7s10', 'r7s12'],
    description: '+3% movement speed.',
  },

  // ── Rogue (s12–s17) ─── attackSpeed: 0.03 per node ───────────────────────
  {
    id: 'r7s12', label: 'Blade Current I',
    type: 'minor', section: 'rogue', ring: 7, slot: 12,
    stats: { attackSpeed: 0.03 },
    connections: ['r6s12', 'r7s11', 'r7s13', 'r8s12', 'r7as12', 'r7bs12'],
    description: '+3% attack speed. Rogue spoke of the r7 highway.',
  },
  {
    id: 'r7s13', label: 'Blade Current II',
    type: 'minor', section: 'rogue', ring: 7, slot: 13,
    stats: { attackSpeed: 0.03 },
    connections: ['r7s12', 'r7s14'],
    description: '+3% attack speed.',
  },
  {
    id: 'r7s14', label: 'Blade Current III',
    type: 'minor', section: 'rogue', ring: 7, slot: 14,
    stats: { attackSpeed: 0.03 },
    connections: ['r7s13', 'r7s15'],
    description: '+3% attack speed.',
  },
  {
    id: 'r7s15', label: 'Blade Current IV',
    type: 'minor', section: 'rogue', ring: 7, slot: 15,
    stats: { attackSpeed: 0.03 },
    connections: ['r7s14', 'r7s16'],
    description: '+3% attack speed.',
  },
  {
    id: 'r7s16', label: 'Blade Current V',
    type: 'minor', section: 'rogue', ring: 7, slot: 16,
    stats: { attackSpeed: 0.03 },
    connections: ['r7s15', 'r7s17'],
    description: '+3% attack speed.',
  },
  {
    id: 'r7s17', label: 'Blade Current VI',
    type: 'minor', section: 'rogue', ring: 7, slot: 17,
    stats: { attackSpeed: 0.03 },
    connections: ['r7s16', 'r7s18'],
    description: '+3% attack speed.',
  },

  // ── R→S Bridge (s18–s23) ─── castSpeed: 0.03 per node ───────────────────
  {
    id: 'r7s18', label: 'Channel Gust I',
    type: 'minor', section: 'shared', ring: 7, slot: 18,
    stats: { castSpeed: 0.03 },
    connections: ['r6s18', 'r7s17', 'r7s19', 'r8s18', 'r7as18', 'r7bs18'],
    description: '+3% cast speed. R→S bridge spoke.',
  },
  {
    id: 'r7s19', label: 'Channel Gust II',
    type: 'minor', section: 'shared', ring: 7, slot: 19,
    stats: { castSpeed: 0.03 },
    connections: ['r7s18', 'r7s20'],
    description: '+3% cast speed.',
  },
  {
    id: 'r7s20', label: 'Channel Gust III',
    type: 'minor', section: 'shared', ring: 7, slot: 20,
    stats: { castSpeed: 0.03 },
    connections: ['r7s19', 'r7s21'],
    description: '+3% cast speed.',
  },
  {
    id: 'r7s21', label: 'Channel Gust IV',
    type: 'minor', section: 'shared', ring: 7, slot: 21,
    stats: { castSpeed: 0.03 },
    connections: ['r7s20', 'r7s22'],
    description: '+3% cast speed.',
  },
  {
    id: 'r7s22', label: 'Channel Gust V',
    type: 'minor', section: 'shared', ring: 7, slot: 22,
    stats: { castSpeed: 0.03 },
    connections: ['r7s21', 'r7s23'],
    description: '+3% cast speed.',
  },
  {
    id: 'r7s23', label: 'Channel Gust VI',
    type: 'minor', section: 'shared', ring: 7, slot: 23,
    stats: { castSpeed: 0.03 },
    connections: ['r7s22', 'r7s24'],
    description: '+3% cast speed.',
  },

  // ── Sage (s24–s29) ─── manaRegenPerS: 0.6 per node ──────────────────────
  {
    id: 'r7s24', label: 'Wellspring I',
    type: 'minor', section: 'sage', ring: 7, slot: 24,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r6s24', 'r7s23', 'r7s25', 'r8s24', 'r7as24', 'r7bs24'],
    description: '+0.6 Mana/s. Sage spoke of the r7 highway.',
  },
  {
    id: 'r7s25', label: 'Wellspring II',
    type: 'minor', section: 'sage', ring: 7, slot: 25,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r7s24', 'r7s26'],
    description: '+0.6 Mana/s.',
  },
  {
    id: 'r7s26', label: 'Wellspring III',
    type: 'minor', section: 'sage', ring: 7, slot: 26,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r7s25', 'r7s27'],
    description: '+0.6 Mana/s.',
  },
  {
    id: 'r7s27', label: 'Wellspring IV',
    type: 'minor', section: 'sage', ring: 7, slot: 27,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r7s26', 'r7s28'],
    description: '+0.6 Mana/s.',
  },
  {
    id: 'r7s28', label: 'Wellspring V',
    type: 'minor', section: 'sage', ring: 7, slot: 28,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r7s27', 'r7s29'],
    description: '+0.6 Mana/s.',
  },
  {
    id: 'r7s29', label: 'Wellspring VI',
    type: 'minor', section: 'sage', ring: 7, slot: 29,
    stats: { manaRegenPerS: 0.6 },
    connections: ['r7s28', 'r7s30'],
    description: '+0.6 Mana/s.',
  },

  // ── S→W Bridge (s30–s35) ─── healthRegenPerS: 0.8 per node ──────────────
  {
    id: 'r7s30', label: 'Hearthblood I',
    type: 'minor', section: 'shared', ring: 7, slot: 30,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r6s30', 'r7s29', 'r7s31', 'r8s30', 'r7as30', 'r7bs30'],
    description: '+0.8 HP/s. S→W bridge spoke.',
  },
  {
    id: 'r7s31', label: 'Hearthblood II',
    type: 'minor', section: 'shared', ring: 7, slot: 31,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r7s30', 'r7s32'],
    description: '+0.8 HP/s.',
  },
  {
    id: 'r7s32', label: 'Hearthblood III',
    type: 'minor', section: 'shared', ring: 7, slot: 32,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r7s31', 'r7s33'],
    description: '+0.8 HP/s.',
  },
  {
    id: 'r7s33', label: 'Hearthblood IV',
    type: 'minor', section: 'shared', ring: 7, slot: 33,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r7s32', 'r7s34'],
    description: '+0.8 HP/s.',
  },
  {
    id: 'r7s34', label: 'Hearthblood V',
    type: 'minor', section: 'shared', ring: 7, slot: 34,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r7s33', 'r7s35'],
    description: '+0.8 HP/s.',
  },
  {
    id: 'r7s35', label: 'Hearthblood VI',
    type: 'minor', section: 'shared', ring: 7, slot: 35,
    stats: { healthRegenPerS: 0.8 },
    connections: ['r7s34', 'r7s00'],
    description: '+0.8 HP/s. Bridges S→W back to Warrior section.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RING 7 SPUR BRANCHES — r7a (inner, radius 1157) + r7b (outer, radius 1303)
  //
  //  Each of the 6 r7 connector nodes (s00, s06, s12, s18, s24, s30) sprouts
  //  two dead-end branches that float between r6/r7 and r7/r8, matching the
  //  same spur pattern used by r3a/b, r4a/b, and r5a/b.
  //
  //  Branch themes (matching the connector's highway stat):
  //    off s00  (warrior, HP)         → maxHealth
  //    off s06  (bridge, move speed)  → moveSpeedMult
  //    off s12  (rogue, atk speed)    → attackSpeed
  //    off s18  (bridge, cast speed)  → castSpeed
  //    off s24  (sage, mana regen)    → manaRegenPerS / maxMana
  //    off s30  (bridge, HP regen)    → healthRegenPerS / maxHealth
  //
  //  Each branch: 4 minors (ascending slot) → 1 KEYSTONE (dead-end cap).
  //  r7a minor: 4 nodes × base stat | r7b minor: 4 nodes × higher base stat
  //  Keystones are purposely simple here — a full unique-effect pass happens later.
  // ══════════════════════════════════════════════════════════════════════════

  // ── r7a — Health branch (clockwise of r7s00, slots 1–5) ──────────────────
  { id: 'r7as00', label: 'Bloodward I',   type: 'minor',    section: 'warrior', ring: 7, slot: 1,  radiusOverride: 1157, stats: { maxHealth: 40 },                            connections: ['r7s00', 'r7as01'], description: '+40 max health. Inner health spur off r7s00.' },
  { id: 'r7as01', label: 'Bloodward II',  type: 'minor',    section: 'warrior', ring: 7, slot: 2,  radiusOverride: 1157, stats: { maxHealth: 40 },                            connections: ['r7as00', 'r7as02'], description: '+40 max health.' },
  { id: 'r7as02', label: 'Bloodward III', type: 'minor',    section: 'warrior', ring: 7, slot: 3,  radiusOverride: 1157, stats: { maxHealth: 40 },                            connections: ['r7as01', 'r7as03'], description: '+40 max health.' },
  { id: 'r7as03', label: 'Bloodward IV',  type: 'minor',    section: 'warrior', ring: 7, slot: 4,  radiusOverride: 1157, stats: { maxHealth: 40 },                            connections: ['r7as02', 'r7as04'], description: '+40 max health.' },
  { id: 'r7as04', label: 'Ironheart',     type: 'keystone', section: 'warrior', ring: 7, slot: 5,  radiusOverride: 1157, stats: { maxHealth: 120, healthRegenPerS: 2.0 },      connections: ['r7as03'], description: '[Keystone] +120 max health, +2.0 HP/s. You are the wall that does not break.' },

  // ── r7a — Move Speed branch (clockwise of r7s06, slots 7–11) ─────────────
  { id: 'r7as06', label: 'Fleet Step I',   type: 'minor',    section: 'shared',  ring: 7, slot: 7,  radiusOverride: 1157, stats: { moveSpeedMult: 0.03 },                      connections: ['r7s06', 'r7as07'], description: '+3% movement speed. Inner speed spur off r7s06.' },
  { id: 'r7as07', label: 'Fleet Step II',  type: 'minor',    section: 'shared',  ring: 7, slot: 8,  radiusOverride: 1157, stats: { moveSpeedMult: 0.03 },                      connections: ['r7as06', 'r7as08'], description: '+3% movement speed.' },
  { id: 'r7as08', label: 'Fleet Step III', type: 'minor',    section: 'shared',  ring: 7, slot: 9,  radiusOverride: 1157, stats: { moveSpeedMult: 0.03 },                      connections: ['r7as07', 'r7as09'], description: '+3% movement speed.' },
  { id: 'r7as09', label: 'Fleet Step IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 10, radiusOverride: 1157, stats: { moveSpeedMult: 0.03 },                      connections: ['r7as08', 'r7as10'], description: '+3% movement speed.' },
  { id: 'r7as10', label: 'Blur Step',      type: 'keystone', section: 'shared',  ring: 7, slot: 11, radiusOverride: 1157, stats: { moveSpeedMult: 0.14 },                      connections: ['r7as09'], description: '[Keystone] +14% movement speed. Your silhouette becomes a suggestion.' },

  // ── r7a — Attack Speed branch (clockwise of r7s12, slots 13–17) ──────────
  { id: 'r7as12', label: 'Twin Cyclone I',   type: 'minor',    section: 'rogue',   ring: 7, slot: 13, radiusOverride: 1157, stats: { attackSpeed: 0.03 },                      connections: ['r7s12', 'r7as13'], description: '+3% attack speed. Inner speed spur off r7s12.' },
  { id: 'r7as13', label: 'Twin Cyclone II',  type: 'minor',    section: 'rogue',   ring: 7, slot: 14, radiusOverride: 1157, stats: { attackSpeed: 0.03 },                      connections: ['r7as12', 'r7as14'], description: '+3% attack speed.' },
  { id: 'r7as14', label: 'Twin Cyclone III', type: 'minor',    section: 'rogue',   ring: 7, slot: 15, radiusOverride: 1157, stats: { attackSpeed: 0.03 },                      connections: ['r7as13', 'r7as15'], description: '+3% attack speed.' },
  { id: 'r7as15', label: 'Twin Cyclone IV',  type: 'minor',    section: 'rogue',   ring: 7, slot: 16, radiusOverride: 1157, stats: { attackSpeed: 0.03 },                      connections: ['r7as14', 'r7as16'], description: '+3% attack speed.' },
  { id: 'r7as16', label: 'Windmill Arms',    type: 'keystone', section: 'rogue',   ring: 7, slot: 17, radiusOverride: 1157, stats: { attackSpeed: 0.14 },                      connections: ['r7as15'], description: '[Keystone] +14% attack speed. Strikes blur into an unbroken current.' },

  // ── r7a — Cast Speed branch (clockwise of r7s18, slots 19–23) ────────────
  { id: 'r7as18', label: 'Mind Torrent I',   type: 'minor',    section: 'shared',  ring: 7, slot: 19, radiusOverride: 1157, stats: { castSpeed: 0.03 },                        connections: ['r7s18', 'r7as19'], description: '+3% cast speed. Inner cast spur off r7s18.' },
  { id: 'r7as19', label: 'Mind Torrent II',  type: 'minor',    section: 'shared',  ring: 7, slot: 20, radiusOverride: 1157, stats: { castSpeed: 0.03 },                        connections: ['r7as18', 'r7as20'], description: '+3% cast speed.' },
  { id: 'r7as20', label: 'Mind Torrent III', type: 'minor',    section: 'shared',  ring: 7, slot: 21, radiusOverride: 1157, stats: { castSpeed: 0.03 },                        connections: ['r7as19', 'r7as21'], description: '+3% cast speed.' },
  { id: 'r7as21', label: 'Mind Torrent IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 22, radiusOverride: 1157, stats: { castSpeed: 0.03 },                        connections: ['r7as20', 'r7as22'], description: '+3% cast speed.' },
  { id: 'r7as22', label: 'Quickened Mind',   type: 'keystone', section: 'shared',  ring: 7, slot: 23, radiusOverride: 1157, stats: { castSpeed: 0.14, manaRegenPerS: 1.0 },    connections: ['r7as21'], description: '[Keystone] +14% cast speed, +1.0 Mana/s. Thoughts become lightning.' },

  // ── r7a — Mana Regen branch (clockwise of r7s24, slots 25–29) ────────────
  { id: 'r7as24', label: 'Deep Ebb I',   type: 'minor',    section: 'sage',    ring: 7, slot: 25, radiusOverride: 1157, stats: { manaRegenPerS: 0.5 },                        connections: ['r7s24', 'r7as25'], description: '+0.5 Mana/s. Inner mana spur off r7s24.' },
  { id: 'r7as25', label: 'Deep Ebb II',  type: 'minor',    section: 'sage',    ring: 7, slot: 26, radiusOverride: 1157, stats: { manaRegenPerS: 0.5 },                        connections: ['r7as24', 'r7as26'], description: '+0.5 Mana/s.' },
  { id: 'r7as26', label: 'Deep Ebb III', type: 'minor',    section: 'sage',    ring: 7, slot: 27, radiusOverride: 1157, stats: { manaRegenPerS: 0.5 },                        connections: ['r7as25', 'r7as27'], description: '+0.5 Mana/s.' },
  { id: 'r7as27', label: 'Deep Ebb IV',  type: 'minor',    section: 'sage',    ring: 7, slot: 28, radiusOverride: 1157, stats: { manaRegenPerS: 0.5 },                        connections: ['r7as26', 'r7as28'], description: '+0.5 Mana/s.' },
  { id: 'r7as28', label: 'Deep Reserve', type: 'keystone', section: 'sage',    ring: 7, slot: 29, radiusOverride: 1157, stats: { maxMana: 110, manaRegenPerS: 2.0 },           connections: ['r7as27'], description: '[Keystone] +110 max mana, +2.0 Mana/s. The well has no bottom.' },

  // ── r7a — HP Regen branch (clockwise of r7s30, slots 31–35) ─────────────
  { id: 'r7as30', label: 'Vital Surge I',   type: 'minor',    section: 'shared',  ring: 7, slot: 31, radiusOverride: 1157, stats: { healthRegenPerS: 0.7 },                   connections: ['r7s30', 'r7as31'], description: '+0.7 HP/s. Inner regen spur off r7s30.' },
  { id: 'r7as31', label: 'Vital Surge II',  type: 'minor',    section: 'shared',  ring: 7, slot: 32, radiusOverride: 1157, stats: { healthRegenPerS: 0.7 },                   connections: ['r7as30', 'r7as32'], description: '+0.7 HP/s.' },
  { id: 'r7as32', label: 'Vital Surge III', type: 'minor',    section: 'shared',  ring: 7, slot: 33, radiusOverride: 1157, stats: { healthRegenPerS: 0.7 },                   connections: ['r7as31', 'r7as33'], description: '+0.7 HP/s.' },
  { id: 'r7as33', label: 'Vital Surge IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 34, radiusOverride: 1157, stats: { healthRegenPerS: 0.7 },                   connections: ['r7as32', 'r7as34'], description: '+0.7 HP/s.' },
  { id: 'r7as34', label: 'Undying Tide',    type: 'keystone', section: 'shared',  ring: 7, slot: 35, radiusOverride: 1157, stats: { healthRegenPerS: 3.0, maxHealth: 80 },     connections: ['r7as33'], description: '[Keystone] +3.0 HP/s, +80 max health. The tide of life does not recede.' },

  // ── r7b — Health branch (clockwise of r7s00, slots 1–5) ──────────────────
  { id: 'r7bs00', label: 'Rampart I',    type: 'minor',    section: 'warrior', ring: 7, slot: 1,  radiusOverride: 1303, stats: { maxHealth: 50 },                            connections: ['r7s00', 'r7bs01'], description: '+50 max health. Outer health spur off r7s00.' },
  { id: 'r7bs01', label: 'Rampart II',   type: 'minor',    section: 'warrior', ring: 7, slot: 2,  radiusOverride: 1303, stats: { maxHealth: 50 },                            connections: ['r7bs00', 'r7bs02'], description: '+50 max health.' },
  { id: 'r7bs02', label: 'Rampart III',  type: 'minor',    section: 'warrior', ring: 7, slot: 3,  radiusOverride: 1303, stats: { maxHealth: 50 },                            connections: ['r7bs01', 'r7bs03'], description: '+50 max health.' },
  { id: 'r7bs03', label: 'Rampart IV',   type: 'minor',    section: 'warrior', ring: 7, slot: 4,  radiusOverride: 1303, stats: { maxHealth: 50 },                            connections: ['r7bs02', 'r7bs04'], description: '+50 max health.' },
  { id: 'r7bs04', label: 'Worldwall',    type: 'keystone', section: 'warrior', ring: 7, slot: 5,  radiusOverride: 1303, stats: { maxHealth: 200, healthRegenPerS: 3.0 },      connections: ['r7bs03'], description: '[Keystone] +200 max health, +3.0 HP/s. You do not fall. You become the ground.' },

  // ── r7b — Move Speed branch (clockwise of r7s06, slots 7–11) ─────────────
  { id: 'r7bs06', label: 'Phantom Stride I',   type: 'minor',    section: 'shared',  ring: 7, slot: 7,  radiusOverride: 1303, stats: { moveSpeedMult: 0.04 },              connections: ['r7s06', 'r7bs07'], description: '+4% movement speed. Outer speed spur off r7s06.' },
  { id: 'r7bs07', label: 'Phantom Stride II',  type: 'minor',    section: 'shared',  ring: 7, slot: 8,  radiusOverride: 1303, stats: { moveSpeedMult: 0.04 },              connections: ['r7bs06', 'r7bs08'], description: '+4% movement speed.' },
  { id: 'r7bs08', label: 'Phantom Stride III', type: 'minor',    section: 'shared',  ring: 7, slot: 9,  radiusOverride: 1303, stats: { moveSpeedMult: 0.04 },              connections: ['r7bs07', 'r7bs09'], description: '+4% movement speed.' },
  { id: 'r7bs09', label: 'Phantom Stride IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 10, radiusOverride: 1303, stats: { moveSpeedMult: 0.04 },              connections: ['r7bs08', 'r7bs10'], description: '+4% movement speed.' },
  { id: 'r7bs10', label: 'Swift Incarnate',    type: 'keystone', section: 'shared',  ring: 7, slot: 11, radiusOverride: 1303, stats: { moveSpeedMult: 0.20 },              connections: ['r7bs09'], description: '[Keystone] +20% movement speed. You move like intent itself.' },

  // ── r7b — Attack Speed branch (clockwise of r7s12, slots 13–17) ──────────
  { id: 'r7bs12', label: 'Gale Strikes I',   type: 'minor',    section: 'rogue',   ring: 7, slot: 13, radiusOverride: 1303, stats: { attackSpeed: 0.04 },                  connections: ['r7s12', 'r7bs13'], description: '+4% attack speed. Outer attack spur off r7s12.' },
  { id: 'r7bs13', label: 'Gale Strikes II',  type: 'minor',    section: 'rogue',   ring: 7, slot: 14, radiusOverride: 1303, stats: { attackSpeed: 0.04 },                  connections: ['r7bs12', 'r7bs14'], description: '+4% attack speed.' },
  { id: 'r7bs14', label: 'Gale Strikes III', type: 'minor',    section: 'rogue',   ring: 7, slot: 15, radiusOverride: 1303, stats: { attackSpeed: 0.04 },                  connections: ['r7bs13', 'r7bs15'], description: '+4% attack speed.' },
  { id: 'r7bs15', label: 'Gale Strikes IV',  type: 'minor',    section: 'rogue',   ring: 7, slot: 16, radiusOverride: 1303, stats: { attackSpeed: 0.04 },                  connections: ['r7bs14', 'r7bs16'], description: '+4% attack speed.' },
  { id: 'r7bs16', label: "Berserker's Tempo", type: 'keystone', section: 'rogue',   ring: 7, slot: 17, radiusOverride: 1303, stats: { attackSpeed: 0.20 },                 connections: ['r7bs15'], description: "[Keystone] +20% attack speed. The rhythm of violence has no rest." },

  // ── r7b — Cast Speed branch (clockwise of r7s18, slots 19–23) ────────────
  { id: 'r7bs18', label: 'Arcane Gust I',   type: 'minor',    section: 'shared',  ring: 7, slot: 19, radiusOverride: 1303, stats: { castSpeed: 0.04 },                      connections: ['r7s18', 'r7bs19'], description: '+4% cast speed. Outer cast spur off r7s18.' },
  { id: 'r7bs19', label: 'Arcane Gust II',  type: 'minor',    section: 'shared',  ring: 7, slot: 20, radiusOverride: 1303, stats: { castSpeed: 0.04 },                      connections: ['r7bs18', 'r7bs20'], description: '+4% cast speed.' },
  { id: 'r7bs20', label: 'Arcane Gust III', type: 'minor',    section: 'shared',  ring: 7, slot: 21, radiusOverride: 1303, stats: { castSpeed: 0.04 },                      connections: ['r7bs19', 'r7bs21'], description: '+4% cast speed.' },
  { id: 'r7bs21', label: 'Arcane Gust IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 22, radiusOverride: 1303, stats: { castSpeed: 0.04 },                      connections: ['r7bs20', 'r7bs22'], description: '+4% cast speed.' },
  { id: 'r7bs22', label: 'Arcane Cascade',  type: 'keystone', section: 'shared',  ring: 7, slot: 23, radiusOverride: 1303, stats: { castSpeed: 0.20, manaRegenPerS: 1.5 },  connections: ['r7bs21'], description: '[Keystone] +20% cast speed, +1.5 Mana/s. Spells cascade before thought catches up.' },

  // ── r7b — Mana Regen branch (clockwise of r7s24, slots 25–29) ────────────
  { id: 'r7bs24', label: 'Font of Ages I',   type: 'minor',    section: 'sage',    ring: 7, slot: 25, radiusOverride: 1303, stats: { manaRegenPerS: 0.7 },                  connections: ['r7s24', 'r7bs25'], description: '+0.7 Mana/s. Outer mana spur off r7s24.' },
  { id: 'r7bs25', label: 'Font of Ages II',  type: 'minor',    section: 'sage',    ring: 7, slot: 26, radiusOverride: 1303, stats: { manaRegenPerS: 0.7 },                  connections: ['r7bs24', 'r7bs26'], description: '+0.7 Mana/s.' },
  { id: 'r7bs26', label: 'Font of Ages III', type: 'minor',    section: 'sage',    ring: 7, slot: 27, radiusOverride: 1303, stats: { manaRegenPerS: 0.7 },                  connections: ['r7bs25', 'r7bs27'], description: '+0.7 Mana/s.' },
  { id: 'r7bs27', label: 'Font of Ages IV',  type: 'minor',    section: 'sage',    ring: 7, slot: 28, radiusOverride: 1303, stats: { manaRegenPerS: 0.7 },                  connections: ['r7bs26', 'r7bs28'], description: '+0.7 Mana/s.' },
  { id: 'r7bs28', label: 'Boundless Font',   type: 'keystone', section: 'sage',    ring: 7, slot: 29, radiusOverride: 1303, stats: { maxMana: 160, manaRegenPerS: 3.0 },    connections: ['r7bs27'], description: '[Keystone] +160 max mana, +3.0 Mana/s. Power is patience given form.' },

  // ── r7b — HP Regen branch (clockwise of r7s30, slots 31–35) ─────────────
  { id: 'r7bs30', label: 'Stone Vigil I',   type: 'minor',    section: 'shared',  ring: 7, slot: 31, radiusOverride: 1303, stats: { healthRegenPerS: 0.9 },                 connections: ['r7s30', 'r7bs31'], description: '+0.9 HP/s. Outer regen spur off r7s30.' },
  { id: 'r7bs31', label: 'Stone Vigil II',  type: 'minor',    section: 'shared',  ring: 7, slot: 32, radiusOverride: 1303, stats: { healthRegenPerS: 0.9 },                 connections: ['r7bs30', 'r7bs32'], description: '+0.9 HP/s.' },
  { id: 'r7bs32', label: 'Stone Vigil III', type: 'minor',    section: 'shared',  ring: 7, slot: 33, radiusOverride: 1303, stats: { healthRegenPerS: 0.9 },                 connections: ['r7bs31', 'r7bs33'], description: '+0.9 HP/s.' },
  { id: 'r7bs33', label: 'Stone Vigil IV',  type: 'minor',    section: 'shared',  ring: 7, slot: 34, radiusOverride: 1303, stats: { healthRegenPerS: 0.9 },                 connections: ['r7bs32', 'r7bs34'], description: '+0.9 HP/s.' },
  { id: 'r7bs34', label: 'Living Stone',    type: 'keystone', section: 'shared',  ring: 7, slot: 35, radiusOverride: 1303, stats: { healthRegenPerS: 4.5, maxHealth: 120 }, connections: ['r7bs33'], description: '[Keystone] +4.5 HP/s, +120 max health. You regenerate like the earth reclaims stone.' },

  // ══════════════════════════════════════════════════════════════════════════
  //  RINGS 8–10 — Deep Extension  (E2P7 addendum)
  //
  //  All three rings follow the same 36-slot section layout.
  //  Six spine columns run radially from r3 to r10 at slots:
  //    00 (Warrior gate 0°)   06 (Warrior→Rogue 60°)   12 (Rogue gate 120°)
  //    18 (Rogue→Sage 180°)   24 (Sage gate 240°)       30 (Sage→Warrior 300°)
  //  Spoke nodes at each spine column connect inward + outward.
  //  Ring 10 is the terminus — no outward spokes anywhere.
  //
  //  Placeholder stats (E2P8 themed pass):
  //    Ring 8: Warrior +45 HP | Rogue +0.10 spd | Sage +40 mana
  //    Ring 9: Warrior +50 HP | Rogue +0.11 spd | Sage +45 mana
  //    Ring 10: Warrior +55 HP | Rogue +0.12 spd | Sage +50 mana
  //    Bridge nodes: mix of adjacent class stats
  // ══════════════════════════════════════════════════════════════════════════

  // ── RING 8 —— Warrior (r8s00–r8s07) ─────────────────────────────────────
  { id: 'r8s00', label: 'Blaze I',   type: 'minor', section: 'warrior', ring: 8, slot: 0,  stats: { maxHealth: 45 }, connections: ['r7s00', 'r8s01', 'r9s00', 'r8as00', 'r8bs00'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s01', label: 'Blaze II',  type: 'minor', section: 'warrior', ring: 8, slot: 1,  stats: { maxHealth: 45 }, connections: ['r8s00', 'r8s02'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s02', label: 'Blaze III', type: 'minor', section: 'warrior', ring: 8, slot: 2,  stats: { maxHealth: 45 }, connections: ['r8s01', 'r8s03'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s03', label: 'Blaze IV',  type: 'minor', section: 'warrior', ring: 8, slot: 3,  stats: { maxHealth: 45 }, connections: ['r8s02', 'r8s04'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s04', label: 'Blaze V',   type: 'minor', section: 'warrior', ring: 8, slot: 4,  stats: { maxHealth: 45 }, connections: ['r8s03', 'r8s05'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s05', label: 'Blaze VI',  type: 'minor', section: 'warrior', ring: 8, slot: 5,  stats: { maxHealth: 45 }, connections: ['r8s04'], description: '+45 max health. [Placeholder]' },
  { id: 'r8s06', label: 'Blaze VII', type: 'minor', section: 'warrior', ring: 8, slot: 6,  stats: { maxHealth: 45 }, connections: ['r7s06', 'r8s07', 'r9s06', 'r8as06', 'r8bs06'], description: '+45 max health. [Placeholder — 60° spine spoke]' },
  { id: 'r8s07', label: 'Blaze VIII',type: 'minor', section: 'warrior', ring: 8, slot: 7,  stats: { maxHealth: 45 }, connections: ['r8s06', 'r8s08'], description: '+45 max health. [Placeholder]' },

  // ── RING 8 —— W→R Bridge (r8s08–r8s11) ──────────────────────────────────
  { id: 'r8s08', label: 'Deep Bridge I',    type: 'minor',   section: 'shared',  ring: 8, slot: 8,  stats: { maxHealth: 32, maxMana: 26 }, connections: ['r8s07', 'r8s09'], description: '+32 max health. +26 max mana. [Placeholder]' },
  { id: 'r8s09', label: 'Deep Bridge II',   type: 'minor',   section: 'shared',  ring: 8, slot: 9,  stats: { maxHealth: 32, maxMana: 26 }, connections: ['r8s08', 'r8s10'], description: '+32 max health. +26 max mana. [Placeholder]' },
  { id: 'r8s10', label: 'Deep Bridge Core', type: 'notable', section: 'shared',  ring: 8, slot: 10, stats: { maxHealth: 44, maxMana: 36 }, connections: ['r8s09', 'r8s11'], description: '+44 max health. +36 max mana. W→R bridge notable. [Placeholder]' },
  { id: 'r8s11', label: 'Deep Bridge III',  type: 'minor',   section: 'shared',  ring: 8, slot: 11, stats: { maxHealth: 32, maxMana: 26 }, connections: ['r8s10'], description: '+32 max health. +26 max mana. [Placeholder]' },

  // ── RING 8 —— Rogue (r8s12–r8s19) ───────────────────────────────────────
  { id: 'r8s12', label: 'Frost I',   type: 'minor', section: 'rogue', ring: 8, slot: 12, stats: { moveSpeedMult: 0.10 }, connections: ['r7s12', 'r8s13', 'r9s12', 'r8as12', 'r8bs12'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s13', label: 'Frost II',  type: 'minor', section: 'rogue', ring: 8, slot: 13, stats: { moveSpeedMult: 0.10 }, connections: ['r8s12', 'r8s14'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s14', label: 'Frost III', type: 'minor', section: 'rogue', ring: 8, slot: 14, stats: { moveSpeedMult: 0.10 }, connections: ['r8s13', 'r8s15'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s15', label: 'Frost IV',  type: 'minor', section: 'rogue', ring: 8, slot: 15, stats: { moveSpeedMult: 0.10 }, connections: ['r8s14', 'r8s16'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s16', label: 'Frost V',   type: 'minor', section: 'rogue', ring: 8, slot: 16, stats: { moveSpeedMult: 0.10 }, connections: ['r8s15', 'r8s17'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s17', label: 'Frost VI',  type: 'minor', section: 'rogue', ring: 8, slot: 17, stats: { moveSpeedMult: 0.10 }, connections: ['r8s16'], description: '+10% move speed. [Placeholder]' },
  { id: 'r8s18', label: 'Frost VII', type: 'minor', section: 'rogue', ring: 8, slot: 18, stats: { moveSpeedMult: 0.10 }, connections: ['r7s18', 'r8s19', 'r9s18', 'r8as18', 'r8bs18'], description: '+10% move speed. [Placeholder — 180° spine spoke]' },
  { id: 'r8s19', label: 'Frost VIII',type: 'minor', section: 'rogue', ring: 8, slot: 19, stats: { moveSpeedMult: 0.10 }, connections: ['r8s18', 'r8s20'], description: '+10% move speed. [Placeholder]' },

  // ── RING 8 —— R→S Bridge (r8s20–r8s23) ──────────────────────────────────
  { id: 'r8s20', label: 'Deep Cross I',    type: 'minor',   section: 'shared', ring: 8, slot: 20, stats: { moveSpeedMult: 0.07, maxMana: 26 }, connections: ['r8s19', 'r8s21'], description: '+7% move speed. +26 max mana. [Placeholder]' },
  { id: 'r8s21', label: 'Deep Cross II',   type: 'minor',   section: 'shared', ring: 8, slot: 21, stats: { moveSpeedMult: 0.07, maxMana: 26 }, connections: ['r8s20', 'r8s22'], description: '+7% move speed. +26 max mana. [Placeholder]' },
  { id: 'r8s22', label: 'Deep Cross Core', type: 'notable', section: 'shared', ring: 8, slot: 22, stats: { moveSpeedMult: 0.09, maxMana: 36 }, connections: ['r8s21', 'r8s23'], description: '+9% move speed. +36 max mana. R→S bridge notable. [Placeholder]' },
  { id: 'r8s23', label: 'Deep Cross III',  type: 'minor',   section: 'shared', ring: 8, slot: 23, stats: { moveSpeedMult: 0.07, maxMana: 26 }, connections: ['r8s22'], description: '+7% move speed. +26 max mana. [Placeholder]' },

  // ── RING 8 —— Sage (r8s24–r8s31) ────────────────────────────────────────
  { id: 'r8s24', label: 'Arc I',   type: 'minor', section: 'sage', ring: 8, slot: 24, stats: { maxMana: 40 }, connections: ['r7s24', 'r8s25', 'r9s24', 'r8as24', 'r8bs24'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s25', label: 'Arc II',  type: 'minor', section: 'sage', ring: 8, slot: 25, stats: { maxMana: 40 }, connections: ['r8s24', 'r8s26'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s26', label: 'Arc III', type: 'minor', section: 'sage', ring: 8, slot: 26, stats: { maxMana: 40 }, connections: ['r8s25', 'r8s27'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s27', label: 'Arc IV',  type: 'minor', section: 'sage', ring: 8, slot: 27, stats: { maxMana: 40 }, connections: ['r8s26', 'r8s28'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s28', label: 'Arc V',   type: 'minor', section: 'sage', ring: 8, slot: 28, stats: { maxMana: 40 }, connections: ['r8s27', 'r8s29'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s29', label: 'Arc VI',  type: 'minor', section: 'sage', ring: 8, slot: 29, stats: { maxMana: 40 }, connections: ['r8s28'], description: '+40 max mana. [Placeholder]' },
  { id: 'r8s30', label: 'Arc VII', type: 'minor', section: 'sage', ring: 8, slot: 30, stats: { maxMana: 40 }, connections: ['r7s30', 'r8s31', 'r9s30', 'r8as30', 'r8bs30'], description: '+40 max mana. [Placeholder — 300° spine spoke]' },
  { id: 'r8s31', label: 'Arc VIII',type: 'minor', section: 'sage', ring: 8, slot: 31, stats: { maxMana: 40 }, connections: ['r8s30', 'r8s32'], description: '+40 max mana. [Placeholder]' },

  // ── RING 8 —— S→W Bridge (r8s32–r8s35) ──────────────────────────────────
  { id: 'r8s32', label: 'Deep Forge I',    type: 'minor',   section: 'shared', ring: 8, slot: 32, stats: { maxMana: 26, maxHealth: 32 }, connections: ['r8s31', 'r8s33'], description: '+26 max mana. +32 max health. [Placeholder]' },
  { id: 'r8s33', label: 'Deep Forge II',   type: 'minor',   section: 'shared', ring: 8, slot: 33, stats: { maxMana: 26, maxHealth: 32 }, connections: ['r8s32', 'r8s34'], description: '+26 max mana. +32 max health. [Placeholder]' },
  { id: 'r8s34', label: 'Deep Forge Core', type: 'notable', section: 'shared', ring: 8, slot: 34, stats: { maxMana: 36, maxHealth: 44 }, connections: ['r8s33', 'r8s35'], description: '+36 max mana. +44 max health. S→W bridge notable. [Placeholder]' },
  { id: 'r8s35', label: 'Deep Forge III',  type: 'minor',   section: 'shared', ring: 8, slot: 35, stats: { maxMana: 26, maxHealth: 32 }, connections: ['r8s34'], description: '+26 max mana. +32 max health. [Placeholder]' },

  // ── RING 9 —— Warrior (r9s00–r9s07) ─────────────────────────────────────
  { id: 'r9s00', label: 'Inferno I',   type: 'minor', section: 'warrior', ring: 9, slot: 0,  stats: { maxHealth: 50 }, connections: ['r8s00', 'r9s01', 'r10s00', 'r9as00', 'r9bs00'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s01', label: 'Inferno II',  type: 'minor', section: 'warrior', ring: 9, slot: 1,  stats: { maxHealth: 50 }, connections: ['r9s00', 'r9s02'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s02', label: 'Inferno III', type: 'minor', section: 'warrior', ring: 9, slot: 2,  stats: { maxHealth: 50 }, connections: ['r9s01', 'r9s03'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s03', label: 'Inferno IV',  type: 'minor', section: 'warrior', ring: 9, slot: 3,  stats: { maxHealth: 50 }, connections: ['r9s02', 'r9s04'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s04', label: 'Inferno V',   type: 'minor', section: 'warrior', ring: 9, slot: 4,  stats: { maxHealth: 50 }, connections: ['r9s03', 'r9s05'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s05', label: 'Inferno VI',  type: 'minor', section: 'warrior', ring: 9, slot: 5,  stats: { maxHealth: 50 }, connections: ['r9s04'], description: '+50 max health. [Placeholder]' },
  { id: 'r9s06', label: 'Inferno VII', type: 'minor', section: 'warrior', ring: 9, slot: 6,  stats: { maxHealth: 50 }, connections: ['r8s06', 'r9s07', 'r10s06', 'r9as06', 'r9bs06'], description: '+50 max health. [Placeholder — 60° spine spoke]' },
  { id: 'r9s07', label: 'Inferno VIII',type: 'minor', section: 'warrior', ring: 9, slot: 7,  stats: { maxHealth: 50 }, connections: ['r9s06', 'r9s08'], description: '+50 max health. [Placeholder]' },

  // ── RING 9 —— W→R Bridge (r9s08–r9s11) ──────────────────────────────────
  { id: 'r9s08', label: 'Apex Bridge I',    type: 'minor',   section: 'shared', ring: 9, slot: 8,  stats: { maxHealth: 36, maxMana: 30 }, connections: ['r9s07', 'r9s09'], description: '+36 max health. +30 max mana. [Placeholder]' },
  { id: 'r9s09', label: 'Apex Bridge II',   type: 'minor',   section: 'shared', ring: 9, slot: 9,  stats: { maxHealth: 36, maxMana: 30 }, connections: ['r9s08', 'r9s10'], description: '+36 max health. +30 max mana. [Placeholder]' },
  { id: 'r9s10', label: 'Apex Bridge Core', type: 'notable', section: 'shared', ring: 9, slot: 10, stats: { maxHealth: 50, maxMana: 40 }, connections: ['r9s09', 'r9s11'], description: '+50 max health. +40 max mana. W→R bridge notable. [Placeholder]' },
  { id: 'r9s11', label: 'Apex Bridge III',  type: 'minor',   section: 'shared', ring: 9, slot: 11, stats: { maxHealth: 36, maxMana: 30 }, connections: ['r9s10'], description: '+36 max health. +30 max mana. [Placeholder]' },

  // ── RING 9 —— Rogue (r9s12–r9s19) ───────────────────────────────────────
  { id: 'r9s12', label: 'Gale I',   type: 'minor', section: 'rogue', ring: 9, slot: 12, stats: { moveSpeedMult: 0.11 }, connections: ['r8s12', 'r9s13', 'r10s12', 'r9as12', 'r9bs12'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s13', label: 'Gale II',  type: 'minor', section: 'rogue', ring: 9, slot: 13, stats: { moveSpeedMult: 0.11 }, connections: ['r9s12', 'r9s14'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s14', label: 'Gale III', type: 'minor', section: 'rogue', ring: 9, slot: 14, stats: { moveSpeedMult: 0.11 }, connections: ['r9s13', 'r9s15'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s15', label: 'Gale IV',  type: 'minor', section: 'rogue', ring: 9, slot: 15, stats: { moveSpeedMult: 0.11 }, connections: ['r9s14', 'r9s16'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s16', label: 'Gale V',   type: 'minor', section: 'rogue', ring: 9, slot: 16, stats: { moveSpeedMult: 0.11 }, connections: ['r9s15', 'r9s17'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s17', label: 'Gale VI',  type: 'minor', section: 'rogue', ring: 9, slot: 17, stats: { moveSpeedMult: 0.11 }, connections: ['r9s16'], description: '+11% move speed. [Placeholder]' },
  { id: 'r9s18', label: 'Gale VII', type: 'minor', section: 'rogue', ring: 9, slot: 18, stats: { moveSpeedMult: 0.11 }, connections: ['r8s18', 'r9s19', 'r10s18', 'r9as18', 'r9bs18'], description: '+11% move speed. [Placeholder — 180° spine spoke]' },
  { id: 'r9s19', label: 'Gale VIII',type: 'minor', section: 'rogue', ring: 9, slot: 19, stats: { moveSpeedMult: 0.11 }, connections: ['r9s18', 'r9s20'], description: '+11% move speed. [Placeholder]' },

  // ── RING 9 —— R→S Bridge (r9s20–r9s23) ──────────────────────────────────
  { id: 'r9s20', label: 'Apex Cross I',    type: 'minor',   section: 'shared', ring: 9, slot: 20, stats: { moveSpeedMult: 0.08, maxMana: 30 }, connections: ['r9s19', 'r9s21'], description: '+8% move speed. +30 max mana. [Placeholder]' },
  { id: 'r9s21', label: 'Apex Cross II',   type: 'minor',   section: 'shared', ring: 9, slot: 21, stats: { moveSpeedMult: 0.08, maxMana: 30 }, connections: ['r9s20', 'r9s22'], description: '+8% move speed. +30 max mana. [Placeholder]' },
  { id: 'r9s22', label: 'Apex Cross Core', type: 'notable', section: 'shared', ring: 9, slot: 22, stats: { moveSpeedMult: 0.10, maxMana: 40 }, connections: ['r9s21', 'r9s23'], description: '+10% move speed. +40 max mana. R→S bridge notable. [Placeholder]' },
  { id: 'r9s23', label: 'Apex Cross III',  type: 'minor',   section: 'shared', ring: 9, slot: 23, stats: { moveSpeedMult: 0.08, maxMana: 30 }, connections: ['r9s22'], description: '+8% move speed. +30 max mana. [Placeholder]' },

  // ── RING 9 —— Sage (r9s24–r9s31) ────────────────────────────────────────
  { id: 'r9s24', label: 'Bolt I',   type: 'minor', section: 'sage', ring: 9, slot: 24, stats: { maxMana: 45 }, connections: ['r8s24', 'r9s25', 'r10s24', 'r9as24', 'r9bs24'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s25', label: 'Bolt II',  type: 'minor', section: 'sage', ring: 9, slot: 25, stats: { maxMana: 45 }, connections: ['r9s24', 'r9s26'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s26', label: 'Bolt III', type: 'minor', section: 'sage', ring: 9, slot: 26, stats: { maxMana: 45 }, connections: ['r9s25', 'r9s27'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s27', label: 'Bolt IV',  type: 'minor', section: 'sage', ring: 9, slot: 27, stats: { maxMana: 45 }, connections: ['r9s26', 'r9s28'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s28', label: 'Bolt V',   type: 'minor', section: 'sage', ring: 9, slot: 28, stats: { maxMana: 45 }, connections: ['r9s27', 'r9s29'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s29', label: 'Bolt VI',  type: 'minor', section: 'sage', ring: 9, slot: 29, stats: { maxMana: 45 }, connections: ['r9s28'], description: '+45 max mana. [Placeholder]' },
  { id: 'r9s30', label: 'Bolt VII', type: 'minor', section: 'sage', ring: 9, slot: 30, stats: { maxMana: 45 }, connections: ['r8s30', 'r9s31', 'r10s30', 'r9as30', 'r9bs30'], description: '+45 max mana. [Placeholder — 300° spine spoke]' },
  { id: 'r9s31', label: 'Bolt VIII',type: 'minor', section: 'sage', ring: 9, slot: 31, stats: { maxMana: 45 }, connections: ['r9s30', 'r9s32'], description: '+45 max mana. [Placeholder]' },

  // ── RING 9 —— S→W Bridge (r9s32–r9s35) ──────────────────────────────────
  { id: 'r9s32', label: 'Apex Forge I',    type: 'minor',   section: 'shared', ring: 9, slot: 32, stats: { maxMana: 30, maxHealth: 36 }, connections: ['r9s31', 'r9s33'], description: '+30 max mana. +36 max health. [Placeholder]' },
  { id: 'r9s33', label: 'Apex Forge II',   type: 'minor',   section: 'shared', ring: 9, slot: 33, stats: { maxMana: 30, maxHealth: 36 }, connections: ['r9s32', 'r9s34'], description: '+30 max mana. +36 max health. [Placeholder]' },
  { id: 'r9s34', label: 'Apex Forge Core', type: 'notable', section: 'shared', ring: 9, slot: 34, stats: { maxMana: 40, maxHealth: 50 }, connections: ['r9s33', 'r9s35'], description: '+40 max mana. +50 max health. S→W bridge notable. [Placeholder]' },
  { id: 'r9s35', label: 'Apex Forge III',  type: 'minor',   section: 'shared', ring: 9, slot: 35, stats: { maxMana: 30, maxHealth: 36 }, connections: ['r9s34'], description: '+30 max mana. +36 max health. [Placeholder]' },

  // ── RING 10 — Terminus —— Warrior (r10s00–r10s07) ────────────────────────
  { id: 'r10s00', label: 'Cinder Eternal I',   type: 'minor', section: 'warrior', ring: 10, slot: 0,  stats: { maxHealth: 55 }, connections: ['r9s00', 'r10s01', 'r10s35', 'r11s00', 'r10as00', 'r10bs00'], description: '+55 max health. [Placeholder — terminus ring]' },
  { id: 'r10s01', label: 'Cinder Eternal II',  type: 'minor', section: 'warrior', ring: 10, slot: 1,  stats: { maxHealth: 55 }, connections: ['r10s00', 'r10s02'], description: '+55 max health. [Placeholder]' },
  { id: 'r10s02', label: 'Cinder Eternal III', type: 'minor', section: 'warrior', ring: 10, slot: 2,  stats: { maxHealth: 55 }, connections: ['r10s01', 'r10s03'], description: '+55 max health. [Placeholder]' },
  { id: 'r10s03', label: 'Cinder Eternal IV',  type: 'minor', section: 'warrior', ring: 10, slot: 3,  stats: { maxHealth: 55 }, connections: ['r10s02', 'r10s04'], description: '+55 max health. [Placeholder]' },
  { id: 'r10s04', label: 'Cinder Eternal V',   type: 'minor', section: 'warrior', ring: 10, slot: 4,  stats: { maxHealth: 55 }, connections: ['r10s03', 'r10s05'], description: '+55 max health. [Placeholder]' },
  { id: 'r10s05', label: 'Cinder Eternal VI',  type: 'minor', section: 'warrior', ring: 10, slot: 5,  stats: { maxHealth: 55 }, connections: ['r10s04', 'r10s06'], description: '+55 max health. [Placeholder]' },
  { id: 'r10s06', label: 'Cinder Eternal VII', type: 'minor', section: 'warrior', ring: 10, slot: 6,  stats: { maxHealth: 55 }, connections: ['r9s06', 'r10s05', 'r10s07', 'r11s06', 'r10as06', 'r10bs06'], description: '+55 max health. [Placeholder — 60° spine terminus]' },
  { id: 'r10s07', label: 'Cinder Eternal VIII',type: 'minor', section: 'warrior', ring: 10, slot: 7,  stats: { maxHealth: 55 }, connections: ['r10s06', 'r10s08'], description: '+55 max health. [Placeholder]' },

  // ── RING 10 —— W→R Bridge (r10s08–r10s11) ───────────────────────────────
  { id: 'r10s08', label: 'Void Bridge I',    type: 'minor',   section: 'shared', ring: 10, slot: 8,  stats: { maxHealth: 40, maxMana: 34 }, connections: ['r10s07', 'r10s09'], description: '+40 max health. +34 max mana. [Placeholder]' },
  { id: 'r10s09', label: 'Void Bridge II',   type: 'minor',   section: 'shared', ring: 10, slot: 9,  stats: { maxHealth: 40, maxMana: 34 }, connections: ['r10s08', 'r10s10'], description: '+40 max health. +34 max mana. [Placeholder]' },
  { id: 'r10s10', label: 'Void Bridge Core', type: 'notable', section: 'shared', ring: 10, slot: 10, stats: { maxHealth: 55, maxMana: 46 }, connections: ['r10s09', 'r10s11'], description: '+55 max health. +46 max mana. W→R bridge notable. [Placeholder]' },
  { id: 'r10s11', label: 'Void Bridge III',  type: 'minor',   section: 'shared', ring: 10, slot: 11, stats: { maxHealth: 40, maxMana: 34 }, connections: ['r10s10', 'r10s12'], description: '+40 max health. +34 max mana. [Placeholder]' },

  // ── RING 10 —— Rogue (r10s12–r10s19) ────────────────────────────────────
  { id: 'r10s12', label: 'Void Rogue I',   type: 'minor', section: 'rogue', ring: 10, slot: 12, stats: { moveSpeedMult: 0.12 }, connections: ['r9s12', 'r10s11', 'r10s13', 'r11s12', 'r10as12', 'r10bs12'], description: '+12% move speed. [Placeholder — terminus ring]' },
  { id: 'r10s13', label: 'Void Rogue II',  type: 'minor', section: 'rogue', ring: 10, slot: 13, stats: { moveSpeedMult: 0.12 }, connections: ['r10s12', 'r10s14'], description: '+12% move speed. [Placeholder]' },
  { id: 'r10s14', label: 'Void Rogue III', type: 'minor', section: 'rogue', ring: 10, slot: 14, stats: { moveSpeedMult: 0.12 }, connections: ['r10s13', 'r10s15'], description: '+12% move speed. [Placeholder]' },
  { id: 'r10s15', label: 'Void Rogue IV',  type: 'minor', section: 'rogue', ring: 10, slot: 15, stats: { moveSpeedMult: 0.12 }, connections: ['r10s14', 'r10s16'], description: '+12% move speed. [Placeholder]' },
  { id: 'r10s16', label: 'Void Rogue V',   type: 'minor', section: 'rogue', ring: 10, slot: 16, stats: { moveSpeedMult: 0.12 }, connections: ['r10s15', 'r10s17'], description: '+12% move speed. [Placeholder]' },
  { id: 'r10s17', label: 'Void Rogue VI',  type: 'minor', section: 'rogue', ring: 10, slot: 17, stats: { moveSpeedMult: 0.12 }, connections: ['r10s16', 'r10s18'], description: '+12% move speed. [Placeholder]' },
  { id: 'r10s18', label: 'Void Rogue VII', type: 'minor', section: 'rogue', ring: 10, slot: 18, stats: { moveSpeedMult: 0.12 }, connections: ['r9s18', 'r10s17', 'r10s19', 'r11s18', 'r10as18', 'r10bs18'], description: '+12% move speed. [Placeholder — 180° spine terminus]' },
  { id: 'r10s19', label: 'Void Rogue VIII',type: 'minor', section: 'rogue', ring: 10, slot: 19, stats: { moveSpeedMult: 0.12 }, connections: ['r10s18', 'r10s20'], description: '+12% move speed. [Placeholder]' },

  // ── RING 10 —— R→S Bridge (r10s20–r10s23) ───────────────────────────────
  { id: 'r10s20', label: 'Void Cross I',    type: 'minor',   section: 'shared', ring: 10, slot: 20, stats: { moveSpeedMult: 0.09, maxMana: 34 }, connections: ['r10s19', 'r10s21'], description: '+9% move speed. +34 max mana. [Placeholder]' },
  { id: 'r10s21', label: 'Void Cross II',   type: 'minor',   section: 'shared', ring: 10, slot: 21, stats: { moveSpeedMult: 0.09, maxMana: 34 }, connections: ['r10s20', 'r10s22'], description: '+9% move speed. +34 max mana. [Placeholder]' },
  { id: 'r10s22', label: 'Void Cross Core', type: 'notable', section: 'shared', ring: 10, slot: 22, stats: { moveSpeedMult: 0.11, maxMana: 46 }, connections: ['r10s21', 'r10s23'], description: '+11% move speed. +46 max mana. R→S bridge notable. [Placeholder]' },
  { id: 'r10s23', label: 'Void Cross III',  type: 'minor',   section: 'shared', ring: 10, slot: 23, stats: { moveSpeedMult: 0.09, maxMana: 34 }, connections: ['r10s22', 'r10s24'], description: '+9% move speed. +34 max mana. [Placeholder]' },

  // ── RING 10 —— Sage (r10s24–r10s31) ────────────────────────────────────
  { id: 'r10s24', label: 'Void Sage I',   type: 'minor', section: 'sage', ring: 10, slot: 24, stats: { maxMana: 50 }, connections: ['r9s24', 'r10s23', 'r10s25', 'r11s24', 'r10as24', 'r10bs24'], description: '+50 max mana. [Placeholder — terminus ring]' },
  { id: 'r10s25', label: 'Void Sage II',  type: 'minor', section: 'sage', ring: 10, slot: 25, stats: { maxMana: 50 }, connections: ['r10s24', 'r10s26'], description: '+50 max mana. [Placeholder]' },
  { id: 'r10s26', label: 'Void Sage III', type: 'minor', section: 'sage', ring: 10, slot: 26, stats: { maxMana: 50 }, connections: ['r10s25', 'r10s27'], description: '+50 max mana. [Placeholder]' },
  { id: 'r10s27', label: 'Void Sage IV',  type: 'minor', section: 'sage', ring: 10, slot: 27, stats: { maxMana: 50 }, connections: ['r10s26', 'r10s28'], description: '+50 max mana. [Placeholder]' },
  { id: 'r10s28', label: 'Void Sage V',   type: 'minor', section: 'sage', ring: 10, slot: 28, stats: { maxMana: 50 }, connections: ['r10s27', 'r10s29'], description: '+50 max mana. [Placeholder]' },
  { id: 'r10s29', label: 'Void Sage VI',  type: 'minor', section: 'sage', ring: 10, slot: 29, stats: { maxMana: 50 }, connections: ['r10s28', 'r10s30'], description: '+50 max mana. [Placeholder]' },
  { id: 'r10s30', label: 'Void Sage VII', type: 'minor', section: 'sage', ring: 10, slot: 30, stats: { maxMana: 50 }, connections: ['r9s30', 'r10s29', 'r10s31', 'r11s30', 'r10as30', 'r10bs30'], description: '+50 max mana. [Placeholder — 300° spine terminus]' },
  { id: 'r10s31', label: 'Void Sage VIII',type: 'minor', section: 'sage', ring: 10, slot: 31, stats: { maxMana: 50 }, connections: ['r10s30', 'r10s32'], description: '+50 max mana. [Placeholder]' },

  // ── RING 10 —— S→W Bridge (r10s32–r10s35) ───────────────────────────────
  { id: 'r10s32', label: 'Void Forge I',    type: 'minor',   section: 'shared', ring: 10, slot: 32, stats: { maxMana: 34, maxHealth: 40 }, connections: ['r10s31', 'r10s33'], description: '+34 max mana. +40 max health. [Placeholder]' },
  { id: 'r10s33', label: 'Void Forge II',   type: 'minor',   section: 'shared', ring: 10, slot: 33, stats: { maxMana: 34, maxHealth: 40 }, connections: ['r10s32', 'r10s34'], description: '+34 max mana. +40 max health. [Placeholder]' },
  { id: 'r10s34', label: 'Void Forge Core', type: 'notable', section: 'shared', ring: 10, slot: 34, stats: { maxMana: 46, maxHealth: 55 }, connections: ['r10s33', 'r10s35'], description: '+46 max mana. +55 max health. S→W bridge notable. [Placeholder]' },
  { id: 'r10s35', label: 'Void Forge III',  type: 'minor',   section: 'shared', ring: 10, slot: 35, stats: { maxMana: 34, maxHealth: 40 }, connections: ['r10s34', 'r10s00'], description: '+34 max mana. +40 max health. [Placeholder]' },

  // ══════════════════════════════════════════════════════════════════════════
  //  RINGS 11–15 — Deep Extension (E2P7.75)
  //
  //  Highway rings:  r3, r7, r10, r15 — fully arc-connected, free rotation.
  //  Broken rings:   r11, r12, r13, r14 — arcs severed at spoke boundaries.
  //                  Each broken ring has 6 isolated dead-end branches (6 nodes each).
  //  Spoke positions (every 60°): s00, s06, s12, s18, s24, s30
  //  Broken ring spoke node: inward spoke + 1 arc (clockwise into branch) + outward spoke.
  //  Branch terminal node (s05/s11/s17/s23/s29/s35): 1 connection — dead end.
  //  Placeholder stats:  r11 W+60HP R+0.13spd S+55mana
  //                      r12 W+65HP R+0.14spd S+60mana
  //                      r13 W+70HP R+0.15spd S+65mana
  //                      r14 W+75HP R+0.16spd S+70mana
  //                      r15 W+80HP R+0.17spd S+75mana  (terminal highway)
  // ══════════════════════════════════════════════════════════════════════════

  // ── RING 11 — Broken Ring ──────────────────────────────────────────────────
  { id: 'r11s00', label: 'Sear I', type: 'minor', section: 'warrior', ring: 11, slot: 0, stats: { maxHealth: 60 }, connections: ['r10s00', 'r11s01', 'r12s00', 'r11as00', 'r11bs00'], description: '[Placeholder r11]' },
  { id: 'r11s01', label: 'Sear II', type: 'minor', section: 'warrior', ring: 11, slot: 1, stats: { maxHealth: 60 }, connections: ['r11s00', 'r11s02'], description: '[Placeholder r11]' },
  { id: 'r11s02', label: 'Sear III', type: 'minor', section: 'warrior', ring: 11, slot: 2, stats: { maxHealth: 60 }, connections: ['r11s01', 'r11s03'], description: '[Placeholder r11]' },
  { id: 'r11s03', label: 'Sear IV', type: 'minor', section: 'warrior', ring: 11, slot: 3, stats: { maxHealth: 60 }, connections: ['r11s02', 'r11s04'], description: '[Placeholder r11]' },
  { id: 'r11s04', label: 'Sear V', type: 'minor', section: 'warrior', ring: 11, slot: 4, stats: { maxHealth: 60 }, connections: ['r11s03', 'r11s05'], description: '[Placeholder r11]' },
  { id: 'r11s05', label: 'Sear VI', type: 'minor', section: 'warrior', ring: 11, slot: 5, stats: { maxHealth: 60 }, connections: ['r11s04'], description: '[Placeholder r11]' },
  { id: 'r11s06', label: 'Sear VII', type: 'minor', section: 'warrior', ring: 11, slot: 6, stats: { maxHealth: 60 }, connections: ['r10s06', 'r11s07', 'r12s06', 'r11as06', 'r11bs06'], description: '[Placeholder r11]' },
  { id: 'r11s07', label: 'Sear VIII', type: 'minor', section: 'warrior', ring: 11, slot: 7, stats: { maxHealth: 60 }, connections: ['r11s06', 'r11s08'], description: '[Placeholder r11]' },
  { id: 'r11s08', label: 'r11 Bridge I', type: 'minor', section: 'shared', ring: 11, slot: 8, stats: { maxHealth: 38, maxMana: 32 }, connections: ['r11s07', 'r11s09'], description: '[Placeholder r11]' },
  { id: 'r11s09', label: 'r11 Bridge II', type: 'minor', section: 'shared', ring: 11, slot: 9, stats: { maxHealth: 38, maxMana: 32 }, connections: ['r11s08', 'r11s10'], description: '[Placeholder r11]' },
  { id: 'r11s10', label: 'r11 Bridge Core', type: 'notable', section: 'shared', ring: 11, slot: 10, stats: { maxHealth: 52, maxMana: 44 }, connections: ['r11s09', 'r11s11'], description: '[Placeholder r11]' },
  { id: 'r11s11', label: 'r11 Bridge III', type: 'minor', section: 'shared', ring: 11, slot: 11, stats: { maxHealth: 38, maxMana: 32 }, connections: ['r11s10'], description: '[Placeholder r11]' },
  { id: 'r11s12', label: 'Wail I', type: 'minor', section: 'rogue', ring: 11, slot: 12, stats: { moveSpeedMult: 0.13 }, connections: ['r10s12', 'r11s13', 'r12s12', 'r11as12', 'r11bs12'], description: '[Placeholder r11]' },
  { id: 'r11s13', label: 'Wail II', type: 'minor', section: 'rogue', ring: 11, slot: 13, stats: { moveSpeedMult: 0.13 }, connections: ['r11s12', 'r11s14'], description: '[Placeholder r11]' },
  { id: 'r11s14', label: 'Wail III', type: 'minor', section: 'rogue', ring: 11, slot: 14, stats: { moveSpeedMult: 0.13 }, connections: ['r11s13', 'r11s15'], description: '[Placeholder r11]' },
  { id: 'r11s15', label: 'Wail IV', type: 'minor', section: 'rogue', ring: 11, slot: 15, stats: { moveSpeedMult: 0.13 }, connections: ['r11s14', 'r11s16'], description: '[Placeholder r11]' },
  { id: 'r11s16', label: 'Wail V', type: 'minor', section: 'rogue', ring: 11, slot: 16, stats: { moveSpeedMult: 0.13 }, connections: ['r11s15', 'r11s17'], description: '[Placeholder r11]' },
  { id: 'r11s17', label: 'Wail VI', type: 'minor', section: 'rogue', ring: 11, slot: 17, stats: { moveSpeedMult: 0.13 }, connections: ['r11s16'], description: '[Placeholder r11]' },
  { id: 'r11s18', label: 'Wail VII', type: 'minor', section: 'rogue', ring: 11, slot: 18, stats: { moveSpeedMult: 0.13 }, connections: ['r10s18', 'r11s19', 'r12s18', 'r11as18', 'r11bs18'], description: '[Placeholder r11]' },
  { id: 'r11s19', label: 'Wail VIII', type: 'minor', section: 'rogue', ring: 11, slot: 19, stats: { moveSpeedMult: 0.13 }, connections: ['r11s18', 'r11s20'], description: '[Placeholder r11]' },
  { id: 'r11s20', label: 'r11 Cross I', type: 'minor', section: 'shared', ring: 11, slot: 20, stats: { moveSpeedMult: 0.09, maxMana: 32 }, connections: ['r11s19', 'r11s21'], description: '[Placeholder r11]' },
  { id: 'r11s21', label: 'r11 Cross II', type: 'minor', section: 'shared', ring: 11, slot: 21, stats: { moveSpeedMult: 0.09, maxMana: 32 }, connections: ['r11s20', 'r11s22'], description: '[Placeholder r11]' },
  { id: 'r11s22', label: 'r11 Cross Core', type: 'notable', section: 'shared', ring: 11, slot: 22, stats: { moveSpeedMult: 0.12, maxMana: 44 }, connections: ['r11s21', 'r11s23'], description: '[Placeholder r11]' },
  { id: 'r11s23', label: 'r11 Cross III', type: 'minor', section: 'shared', ring: 11, slot: 23, stats: { moveSpeedMult: 0.09, maxMana: 32 }, connections: ['r11s22'], description: '[Placeholder r11]' },
  { id: 'r11s24', label: 'Zap I', type: 'minor', section: 'sage', ring: 11, slot: 24, stats: { maxMana: 55 }, connections: ['r10s24', 'r11s25', 'r12s24', 'r11as24', 'r11bs24'], description: '[Placeholder r11]' },
  { id: 'r11s25', label: 'Zap II', type: 'minor', section: 'sage', ring: 11, slot: 25, stats: { maxMana: 55 }, connections: ['r11s24', 'r11s26'], description: '[Placeholder r11]' },
  { id: 'r11s26', label: 'Zap III', type: 'minor', section: 'sage', ring: 11, slot: 26, stats: { maxMana: 55 }, connections: ['r11s25', 'r11s27'], description: '[Placeholder r11]' },
  { id: 'r11s27', label: 'Zap IV', type: 'minor', section: 'sage', ring: 11, slot: 27, stats: { maxMana: 55 }, connections: ['r11s26', 'r11s28'], description: '[Placeholder r11]' },
  { id: 'r11s28', label: 'Zap V', type: 'minor', section: 'sage', ring: 11, slot: 28, stats: { maxMana: 55 }, connections: ['r11s27', 'r11s29'], description: '[Placeholder r11]' },
  { id: 'r11s29', label: 'Zap VI', type: 'minor', section: 'sage', ring: 11, slot: 29, stats: { maxMana: 55 }, connections: ['r11s28'], description: '[Placeholder r11]' },
  { id: 'r11s30', label: 'Zap VII', type: 'minor', section: 'sage', ring: 11, slot: 30, stats: { maxMana: 55 }, connections: ['r10s30', 'r11s31', 'r12s30', 'r11as30', 'r11bs30'], description: '[Placeholder r11]' },
  { id: 'r11s31', label: 'Zap VIII', type: 'minor', section: 'sage', ring: 11, slot: 31, stats: { maxMana: 55 }, connections: ['r11s30', 'r11s32'], description: '[Placeholder r11]' },
  { id: 'r11s32', label: 'r11 Forge I', type: 'minor', section: 'shared', ring: 11, slot: 32, stats: { maxMana: 32, maxHealth: 38 }, connections: ['r11s31', 'r11s33'], description: '[Placeholder r11]' },
  { id: 'r11s33', label: 'r11 Forge II', type: 'minor', section: 'shared', ring: 11, slot: 33, stats: { maxMana: 32, maxHealth: 38 }, connections: ['r11s32', 'r11s34'], description: '[Placeholder r11]' },
  { id: 'r11s34', label: 'r11 Forge Core', type: 'notable', section: 'shared', ring: 11, slot: 34, stats: { maxMana: 44, maxHealth: 52 }, connections: ['r11s33', 'r11s35'], description: '[Placeholder r11]' },
  { id: 'r11s35', label: 'r11 Forge III', type: 'minor', section: 'shared', ring: 11, slot: 35, stats: { maxMana: 32, maxHealth: 38 }, connections: ['r11s34'], description: '[Placeholder r11]' },

  // ── RING 12 — Broken Ring ──────────────────────────────────────────────────
  { id: 'r12s00', label: 'Char I', type: 'minor', section: 'warrior', ring: 12, slot: 0, stats: { maxHealth: 65 }, connections: ['r11s00', 'r12s01', 'r13s00', 'r12as00', 'r12bs00'], description: '[Placeholder r12]' },
  { id: 'r12s01', label: 'Char II', type: 'minor', section: 'warrior', ring: 12, slot: 1, stats: { maxHealth: 65 }, connections: ['r12s00', 'r12s02'], description: '[Placeholder r12]' },
  { id: 'r12s02', label: 'Char III', type: 'minor', section: 'warrior', ring: 12, slot: 2, stats: { maxHealth: 65 }, connections: ['r12s01', 'r12s03'], description: '[Placeholder r12]' },
  { id: 'r12s03', label: 'Char IV', type: 'minor', section: 'warrior', ring: 12, slot: 3, stats: { maxHealth: 65 }, connections: ['r12s02', 'r12s04'], description: '[Placeholder r12]' },
  { id: 'r12s04', label: 'Char V', type: 'minor', section: 'warrior', ring: 12, slot: 4, stats: { maxHealth: 65 }, connections: ['r12s03', 'r12s05'], description: '[Placeholder r12]' },
  { id: 'r12s05', label: 'Char VI', type: 'minor', section: 'warrior', ring: 12, slot: 5, stats: { maxHealth: 65 }, connections: ['r12s04'], description: '[Placeholder r12]' },
  { id: 'r12s06', label: 'Char VII', type: 'minor', section: 'warrior', ring: 12, slot: 6, stats: { maxHealth: 65 }, connections: ['r11s06', 'r12s07', 'r13s06', 'r12as06', 'r12bs06'], description: '[Placeholder r12]' },
  { id: 'r12s07', label: 'Char VIII', type: 'minor', section: 'warrior', ring: 12, slot: 7, stats: { maxHealth: 65 }, connections: ['r12s06', 'r12s08'], description: '[Placeholder r12]' },
  { id: 'r12s08', label: 'r12 Bridge I', type: 'minor', section: 'shared', ring: 12, slot: 8, stats: { maxHealth: 42, maxMana: 35 }, connections: ['r12s07', 'r12s09'], description: '[Placeholder r12]' },
  { id: 'r12s09', label: 'r12 Bridge II', type: 'minor', section: 'shared', ring: 12, slot: 9, stats: { maxHealth: 42, maxMana: 35 }, connections: ['r12s08', 'r12s10'], description: '[Placeholder r12]' },
  { id: 'r12s10', label: 'r12 Bridge Core', type: 'notable', section: 'shared', ring: 12, slot: 10, stats: { maxHealth: 58, maxMana: 48 }, connections: ['r12s09', 'r12s11'], description: '[Placeholder r12]' },
  { id: 'r12s11', label: 'r12 Bridge III', type: 'minor', section: 'shared', ring: 12, slot: 11, stats: { maxHealth: 42, maxMana: 35 }, connections: ['r12s10'], description: '[Placeholder r12]' },
  { id: 'r12s12', label: 'Rime I', type: 'minor', section: 'rogue', ring: 12, slot: 12, stats: { moveSpeedMult: 0.14 }, connections: ['r11s12', 'r12s13', 'r13s12', 'r12as12', 'r12bs12'], description: '[Placeholder r12]' },
  { id: 'r12s13', label: 'Rime II', type: 'minor', section: 'rogue', ring: 12, slot: 13, stats: { moveSpeedMult: 0.14 }, connections: ['r12s12', 'r12s14'], description: '[Placeholder r12]' },
  { id: 'r12s14', label: 'Rime III', type: 'minor', section: 'rogue', ring: 12, slot: 14, stats: { moveSpeedMult: 0.14 }, connections: ['r12s13', 'r12s15'], description: '[Placeholder r12]' },
  { id: 'r12s15', label: 'Rime IV', type: 'minor', section: 'rogue', ring: 12, slot: 15, stats: { moveSpeedMult: 0.14 }, connections: ['r12s14', 'r12s16'], description: '[Placeholder r12]' },
  { id: 'r12s16', label: 'Rime V', type: 'minor', section: 'rogue', ring: 12, slot: 16, stats: { moveSpeedMult: 0.14 }, connections: ['r12s15', 'r12s17'], description: '[Placeholder r12]' },
  { id: 'r12s17', label: 'Rime VI', type: 'minor', section: 'rogue', ring: 12, slot: 17, stats: { moveSpeedMult: 0.14 }, connections: ['r12s16'], description: '[Placeholder r12]' },
  { id: 'r12s18', label: 'Rime VII', type: 'minor', section: 'rogue', ring: 12, slot: 18, stats: { moveSpeedMult: 0.14 }, connections: ['r11s18', 'r12s19', 'r13s18', 'r12as18', 'r12bs18'], description: '[Placeholder r12]' },
  { id: 'r12s19', label: 'Rime VIII', type: 'minor', section: 'rogue', ring: 12, slot: 19, stats: { moveSpeedMult: 0.14 }, connections: ['r12s18', 'r12s20'], description: '[Placeholder r12]' },
  { id: 'r12s20', label: 'r12 Cross I', type: 'minor', section: 'shared', ring: 12, slot: 20, stats: { moveSpeedMult: 0.1, maxMana: 35 }, connections: ['r12s19', 'r12s21'], description: '[Placeholder r12]' },
  { id: 'r12s21', label: 'r12 Cross II', type: 'minor', section: 'shared', ring: 12, slot: 21, stats: { moveSpeedMult: 0.1, maxMana: 35 }, connections: ['r12s20', 'r12s22'], description: '[Placeholder r12]' },
  { id: 'r12s22', label: 'r12 Cross Core', type: 'notable', section: 'shared', ring: 12, slot: 22, stats: { moveSpeedMult: 0.13, maxMana: 48 }, connections: ['r12s21', 'r12s23'], description: '[Placeholder r12]' },
  { id: 'r12s23', label: 'r12 Cross III', type: 'minor', section: 'shared', ring: 12, slot: 23, stats: { moveSpeedMult: 0.1, maxMana: 35 }, connections: ['r12s22'], description: '[Placeholder r12]' },
  { id: 'r12s24', label: 'Crackle I', type: 'minor', section: 'sage', ring: 12, slot: 24, stats: { maxMana: 60 }, connections: ['r11s24', 'r12s25', 'r13s24', 'r12as24', 'r12bs24'], description: '[Placeholder r12]' },
  { id: 'r12s25', label: 'Crackle II', type: 'minor', section: 'sage', ring: 12, slot: 25, stats: { maxMana: 60 }, connections: ['r12s24', 'r12s26'], description: '[Placeholder r12]' },
  { id: 'r12s26', label: 'Crackle III', type: 'minor', section: 'sage', ring: 12, slot: 26, stats: { maxMana: 60 }, connections: ['r12s25', 'r12s27'], description: '[Placeholder r12]' },
  { id: 'r12s27', label: 'Crackle IV', type: 'minor', section: 'sage', ring: 12, slot: 27, stats: { maxMana: 60 }, connections: ['r12s26', 'r12s28'], description: '[Placeholder r12]' },
  { id: 'r12s28', label: 'Crackle V', type: 'minor', section: 'sage', ring: 12, slot: 28, stats: { maxMana: 60 }, connections: ['r12s27', 'r12s29'], description: '[Placeholder r12]' },
  { id: 'r12s29', label: 'Crackle VI', type: 'minor', section: 'sage', ring: 12, slot: 29, stats: { maxMana: 60 }, connections: ['r12s28'], description: '[Placeholder r12]' },
  { id: 'r12s30', label: 'Crackle VII', type: 'minor', section: 'sage', ring: 12, slot: 30, stats: { maxMana: 60 }, connections: ['r11s30', 'r12s31', 'r13s30', 'r12as30', 'r12bs30'], description: '[Placeholder r12]' },
  { id: 'r12s31', label: 'Crackle VIII', type: 'minor', section: 'sage', ring: 12, slot: 31, stats: { maxMana: 60 }, connections: ['r12s30', 'r12s32'], description: '[Placeholder r12]' },
  { id: 'r12s32', label: 'r12 Forge I', type: 'minor', section: 'shared', ring: 12, slot: 32, stats: { maxMana: 35, maxHealth: 42 }, connections: ['r12s31', 'r12s33'], description: '[Placeholder r12]' },
  { id: 'r12s33', label: 'r12 Forge II', type: 'minor', section: 'shared', ring: 12, slot: 33, stats: { maxMana: 35, maxHealth: 42 }, connections: ['r12s32', 'r12s34'], description: '[Placeholder r12]' },
  { id: 'r12s34', label: 'r12 Forge Core', type: 'notable', section: 'shared', ring: 12, slot: 34, stats: { maxMana: 48, maxHealth: 58 }, connections: ['r12s33', 'r12s35'], description: '[Placeholder r12]' },
  { id: 'r12s35', label: 'r12 Forge III', type: 'minor', section: 'shared', ring: 12, slot: 35, stats: { maxMana: 35, maxHealth: 42 }, connections: ['r12s34'], description: '[Placeholder r12]' },

  // ── RING 13 — Broken Ring ──────────────────────────────────────────────────
  { id: 'r13s00', label: 'Brand I', type: 'minor', section: 'warrior', ring: 13, slot: 0, stats: { maxHealth: 70 }, connections: ['r12s00', 'r13s01', 'r14s00', 'r13as00', 'r13bs00'], description: '[Placeholder r13]' },
  { id: 'r13s01', label: 'Brand II', type: 'minor', section: 'warrior', ring: 13, slot: 1, stats: { maxHealth: 70 }, connections: ['r13s00', 'r13s02'], description: '[Placeholder r13]' },
  { id: 'r13s02', label: 'Brand III', type: 'minor', section: 'warrior', ring: 13, slot: 2, stats: { maxHealth: 70 }, connections: ['r13s01', 'r13s03'], description: '[Placeholder r13]' },
  { id: 'r13s03', label: 'Brand IV', type: 'minor', section: 'warrior', ring: 13, slot: 3, stats: { maxHealth: 70 }, connections: ['r13s02', 'r13s04'], description: '[Placeholder r13]' },
  { id: 'r13s04', label: 'Brand V', type: 'minor', section: 'warrior', ring: 13, slot: 4, stats: { maxHealth: 70 }, connections: ['r13s03', 'r13s05'], description: '[Placeholder r13]' },
  { id: 'r13s05', label: 'Brand VI', type: 'minor', section: 'warrior', ring: 13, slot: 5, stats: { maxHealth: 70 }, connections: ['r13s04'], description: '[Placeholder r13]' },
  { id: 'r13s06', label: 'Brand VII', type: 'minor', section: 'warrior', ring: 13, slot: 6, stats: { maxHealth: 70 }, connections: ['r12s06', 'r13s07', 'r14s06', 'r13as06', 'r13bs06'], description: '[Placeholder r13]' },
  { id: 'r13s07', label: 'Brand VIII', type: 'minor', section: 'warrior', ring: 13, slot: 7, stats: { maxHealth: 70 }, connections: ['r13s06', 'r13s08'], description: '[Placeholder r13]' },
  { id: 'r13s08', label: 'r13 Bridge I', type: 'minor', section: 'shared', ring: 13, slot: 8, stats: { maxHealth: 46, maxMana: 38 }, connections: ['r13s07', 'r13s09'], description: '[Placeholder r13]' },
  { id: 'r13s09', label: 'r13 Bridge II', type: 'minor', section: 'shared', ring: 13, slot: 9, stats: { maxHealth: 46, maxMana: 38 }, connections: ['r13s08', 'r13s10'], description: '[Placeholder r13]' },
  { id: 'r13s10', label: 'r13 Bridge Core', type: 'notable', section: 'shared', ring: 13, slot: 10, stats: { maxHealth: 64, maxMana: 52 }, connections: ['r13s09', 'r13s11'], description: '[Placeholder r13]' },
  { id: 'r13s11', label: 'r13 Bridge III', type: 'minor', section: 'shared', ring: 13, slot: 11, stats: { maxHealth: 46, maxMana: 38 }, connections: ['r13s10'], description: '[Placeholder r13]' },
  { id: 'r13s12', label: 'Squall I', type: 'minor', section: 'rogue', ring: 13, slot: 12, stats: { moveSpeedMult: 0.15 }, connections: ['r12s12', 'r13s13', 'r14s12', 'r13as12', 'r13bs12'], description: '[Placeholder r13]' },
  { id: 'r13s13', label: 'Squall II', type: 'minor', section: 'rogue', ring: 13, slot: 13, stats: { moveSpeedMult: 0.15 }, connections: ['r13s12', 'r13s14'], description: '[Placeholder r13]' },
  { id: 'r13s14', label: 'Squall III', type: 'minor', section: 'rogue', ring: 13, slot: 14, stats: { moveSpeedMult: 0.15 }, connections: ['r13s13', 'r13s15'], description: '[Placeholder r13]' },
  { id: 'r13s15', label: 'Squall IV', type: 'minor', section: 'rogue', ring: 13, slot: 15, stats: { moveSpeedMult: 0.15 }, connections: ['r13s14', 'r13s16'], description: '[Placeholder r13]' },
  { id: 'r13s16', label: 'Squall V', type: 'minor', section: 'rogue', ring: 13, slot: 16, stats: { moveSpeedMult: 0.15 }, connections: ['r13s15', 'r13s17'], description: '[Placeholder r13]' },
  { id: 'r13s17', label: 'Squall VI', type: 'minor', section: 'rogue', ring: 13, slot: 17, stats: { moveSpeedMult: 0.15 }, connections: ['r13s16'], description: '[Placeholder r13]' },
  { id: 'r13s18', label: 'Squall VII', type: 'minor', section: 'rogue', ring: 13, slot: 18, stats: { moveSpeedMult: 0.15 }, connections: ['r12s18', 'r13s19', 'r14s18', 'r13as18', 'r13bs18'], description: '[Placeholder r13]' },
  { id: 'r13s19', label: 'Squall VIII', type: 'minor', section: 'rogue', ring: 13, slot: 19, stats: { moveSpeedMult: 0.15 }, connections: ['r13s18', 'r13s20'], description: '[Placeholder r13]' },
  { id: 'r13s20', label: 'r13 Cross I', type: 'minor', section: 'shared', ring: 13, slot: 20, stats: { moveSpeedMult: 0.1, maxMana: 38 }, connections: ['r13s19', 'r13s21'], description: '[Placeholder r13]' },
  { id: 'r13s21', label: 'r13 Cross II', type: 'minor', section: 'shared', ring: 13, slot: 21, stats: { moveSpeedMult: 0.1, maxMana: 38 }, connections: ['r13s20', 'r13s22'], description: '[Placeholder r13]' },
  { id: 'r13s22', label: 'r13 Cross Core', type: 'notable', section: 'shared', ring: 13, slot: 22, stats: { moveSpeedMult: 0.14, maxMana: 52 }, connections: ['r13s21', 'r13s23'], description: '[Placeholder r13]' },
  { id: 'r13s23', label: 'r13 Cross III', type: 'minor', section: 'shared', ring: 13, slot: 23, stats: { moveSpeedMult: 0.1, maxMana: 38 }, connections: ['r13s22'], description: '[Placeholder r13]' },
  { id: 'r13s24', label: 'Static I', type: 'minor', section: 'sage', ring: 13, slot: 24, stats: { maxMana: 65 }, connections: ['r12s24', 'r13s25', 'r14s24', 'r13as24', 'r13bs24'], description: '[Placeholder r13]' },
  { id: 'r13s25', label: 'Static II', type: 'minor', section: 'sage', ring: 13, slot: 25, stats: { maxMana: 65 }, connections: ['r13s24', 'r13s26'], description: '[Placeholder r13]' },
  { id: 'r13s26', label: 'Static III', type: 'minor', section: 'sage', ring: 13, slot: 26, stats: { maxMana: 65 }, connections: ['r13s25', 'r13s27'], description: '[Placeholder r13]' },
  { id: 'r13s27', label: 'Static IV', type: 'minor', section: 'sage', ring: 13, slot: 27, stats: { maxMana: 65 }, connections: ['r13s26', 'r13s28'], description: '[Placeholder r13]' },
  { id: 'r13s28', label: 'Static V', type: 'minor', section: 'sage', ring: 13, slot: 28, stats: { maxMana: 65 }, connections: ['r13s27', 'r13s29'], description: '[Placeholder r13]' },
  { id: 'r13s29', label: 'Static VI', type: 'minor', section: 'sage', ring: 13, slot: 29, stats: { maxMana: 65 }, connections: ['r13s28'], description: '[Placeholder r13]' },
  { id: 'r13s30', label: 'Static VII', type: 'minor', section: 'sage', ring: 13, slot: 30, stats: { maxMana: 65 }, connections: ['r12s30', 'r13s31', 'r14s30', 'r13as30', 'r13bs30'], description: '[Placeholder r13]' },
  { id: 'r13s31', label: 'Static VIII', type: 'minor', section: 'sage', ring: 13, slot: 31, stats: { maxMana: 65 }, connections: ['r13s30', 'r13s32'], description: '[Placeholder r13]' },
  { id: 'r13s32', label: 'r13 Forge I', type: 'minor', section: 'shared', ring: 13, slot: 32, stats: { maxMana: 38, maxHealth: 46 }, connections: ['r13s31', 'r13s33'], description: '[Placeholder r13]' },
  { id: 'r13s33', label: 'r13 Forge II', type: 'minor', section: 'shared', ring: 13, slot: 33, stats: { maxMana: 38, maxHealth: 46 }, connections: ['r13s32', 'r13s34'], description: '[Placeholder r13]' },
  { id: 'r13s34', label: 'r13 Forge Core', type: 'notable', section: 'shared', ring: 13, slot: 34, stats: { maxMana: 52, maxHealth: 64 }, connections: ['r13s33', 'r13s35'], description: '[Placeholder r13]' },
  { id: 'r13s35', label: 'r13 Forge III', type: 'minor', section: 'shared', ring: 13, slot: 35, stats: { maxMana: 38, maxHealth: 46 }, connections: ['r13s34'], description: '[Placeholder r13]' },

  // ── RING 14 — Broken Ring ──────────────────────────────────────────────────
  { id: 'r14s00', label: 'Magma I', type: 'minor', section: 'warrior', ring: 14, slot: 0, stats: { maxHealth: 75 }, connections: ['r13s00', 'r14s01', 'r15s00', 'r14as00', 'r14bs00'], description: '[Placeholder r14]' },
  { id: 'r14s01', label: 'Magma II', type: 'minor', section: 'warrior', ring: 14, slot: 1, stats: { maxHealth: 75 }, connections: ['r14s00', 'r14s02'], description: '[Placeholder r14]' },
  { id: 'r14s02', label: 'Magma III', type: 'minor', section: 'warrior', ring: 14, slot: 2, stats: { maxHealth: 75 }, connections: ['r14s01', 'r14s03'], description: '[Placeholder r14]' },
  { id: 'r14s03', label: 'Magma IV', type: 'minor', section: 'warrior', ring: 14, slot: 3, stats: { maxHealth: 75 }, connections: ['r14s02', 'r14s04'], description: '[Placeholder r14]' },
  { id: 'r14s04', label: 'Magma V', type: 'minor', section: 'warrior', ring: 14, slot: 4, stats: { maxHealth: 75 }, connections: ['r14s03', 'r14s05'], description: '[Placeholder r14]' },
  { id: 'r14s05', label: 'Magma VI', type: 'minor', section: 'warrior', ring: 14, slot: 5, stats: { maxHealth: 75 }, connections: ['r14s04'], description: '[Placeholder r14]' },
  { id: 'r14s06', label: 'Magma VII', type: 'minor', section: 'warrior', ring: 14, slot: 6, stats: { maxHealth: 75 }, connections: ['r13s06', 'r14s07', 'r15s06', 'r14as06', 'r14bs06'], description: '[Placeholder r14]' },
  { id: 'r14s07', label: 'Magma VIII', type: 'minor', section: 'warrior', ring: 14, slot: 7, stats: { maxHealth: 75 }, connections: ['r14s06', 'r14s08'], description: '[Placeholder r14]' },
  { id: 'r14s08', label: 'r14 Bridge I', type: 'minor', section: 'shared', ring: 14, slot: 8, stats: { maxHealth: 50, maxMana: 41 }, connections: ['r14s07', 'r14s09'], description: '[Placeholder r14]' },
  { id: 'r14s09', label: 'r14 Bridge II', type: 'minor', section: 'shared', ring: 14, slot: 9, stats: { maxHealth: 50, maxMana: 41 }, connections: ['r14s08', 'r14s10'], description: '[Placeholder r14]' },
  { id: 'r14s10', label: 'r14 Bridge Core', type: 'notable', section: 'shared', ring: 14, slot: 10, stats: { maxHealth: 70, maxMana: 56 }, connections: ['r14s09', 'r14s11'], description: '[Placeholder r14]' },
  { id: 'r14s11', label: 'r14 Bridge III', type: 'minor', section: 'shared', ring: 14, slot: 11, stats: { maxHealth: 50, maxMana: 41 }, connections: ['r14s10'], description: '[Placeholder r14]' },
  { id: 'r14s12', label: 'Hail I', type: 'minor', section: 'rogue', ring: 14, slot: 12, stats: { moveSpeedMult: 0.16 }, connections: ['r13s12', 'r14s13', 'r15s12', 'r14as12', 'r14bs12'], description: '[Placeholder r14]' },
  { id: 'r14s13', label: 'Hail II', type: 'minor', section: 'rogue', ring: 14, slot: 13, stats: { moveSpeedMult: 0.16 }, connections: ['r14s12', 'r14s14'], description: '[Placeholder r14]' },
  { id: 'r14s14', label: 'Hail III', type: 'minor', section: 'rogue', ring: 14, slot: 14, stats: { moveSpeedMult: 0.16 }, connections: ['r14s13', 'r14s15'], description: '[Placeholder r14]' },
  { id: 'r14s15', label: 'Hail IV', type: 'minor', section: 'rogue', ring: 14, slot: 15, stats: { moveSpeedMult: 0.16 }, connections: ['r14s14', 'r14s16'], description: '[Placeholder r14]' },
  { id: 'r14s16', label: 'Hail V', type: 'minor', section: 'rogue', ring: 14, slot: 16, stats: { moveSpeedMult: 0.16 }, connections: ['r14s15', 'r14s17'], description: '[Placeholder r14]' },
  { id: 'r14s17', label: 'Hail VI', type: 'minor', section: 'rogue', ring: 14, slot: 17, stats: { moveSpeedMult: 0.16 }, connections: ['r14s16'], description: '[Placeholder r14]' },
  { id: 'r14s18', label: 'Hail VII', type: 'minor', section: 'rogue', ring: 14, slot: 18, stats: { moveSpeedMult: 0.16 }, connections: ['r13s18', 'r14s19', 'r15s18', 'r14as18', 'r14bs18'], description: '[Placeholder r14]' },
  { id: 'r14s19', label: 'Hail VIII', type: 'minor', section: 'rogue', ring: 14, slot: 19, stats: { moveSpeedMult: 0.16 }, connections: ['r14s18', 'r14s20'], description: '[Placeholder r14]' },
  { id: 'r14s20', label: 'r14 Cross I', type: 'minor', section: 'shared', ring: 14, slot: 20, stats: { moveSpeedMult: 0.11, maxMana: 41 }, connections: ['r14s19', 'r14s21'], description: '[Placeholder r14]' },
  { id: 'r14s21', label: 'r14 Cross II', type: 'minor', section: 'shared', ring: 14, slot: 21, stats: { moveSpeedMult: 0.11, maxMana: 41 }, connections: ['r14s20', 'r14s22'], description: '[Placeholder r14]' },
  { id: 'r14s22', label: 'r14 Cross Core', type: 'notable', section: 'shared', ring: 14, slot: 22, stats: { moveSpeedMult: 0.14, maxMana: 56 }, connections: ['r14s21', 'r14s23'], description: '[Placeholder r14]' },
  { id: 'r14s23', label: 'r14 Cross III', type: 'minor', section: 'shared', ring: 14, slot: 23, stats: { moveSpeedMult: 0.11, maxMana: 41 }, connections: ['r14s22'], description: '[Placeholder r14]' },
  { id: 'r14s24', label: 'Tempest I', type: 'minor', section: 'sage', ring: 14, slot: 24, stats: { maxMana: 70 }, connections: ['r13s24', 'r14s25', 'r15s24', 'r14as24', 'r14bs24'], description: '[Placeholder r14]' },
  { id: 'r14s25', label: 'Tempest II', type: 'minor', section: 'sage', ring: 14, slot: 25, stats: { maxMana: 70 }, connections: ['r14s24', 'r14s26'], description: '[Placeholder r14]' },
  { id: 'r14s26', label: 'Tempest III', type: 'minor', section: 'sage', ring: 14, slot: 26, stats: { maxMana: 70 }, connections: ['r14s25', 'r14s27'], description: '[Placeholder r14]' },
  { id: 'r14s27', label: 'Tempest IV', type: 'minor', section: 'sage', ring: 14, slot: 27, stats: { maxMana: 70 }, connections: ['r14s26', 'r14s28'], description: '[Placeholder r14]' },
  { id: 'r14s28', label: 'Tempest V', type: 'minor', section: 'sage', ring: 14, slot: 28, stats: { maxMana: 70 }, connections: ['r14s27', 'r14s29'], description: '[Placeholder r14]' },
  { id: 'r14s29', label: 'Tempest VI', type: 'minor', section: 'sage', ring: 14, slot: 29, stats: { maxMana: 70 }, connections: ['r14s28'], description: '[Placeholder r14]' },
  { id: 'r14s30', label: 'Tempest VII', type: 'minor', section: 'sage', ring: 14, slot: 30, stats: { maxMana: 70 }, connections: ['r13s30', 'r14s31', 'r15s30', 'r14as30', 'r14bs30'], description: '[Placeholder r14]' },
  { id: 'r14s31', label: 'Tempest VIII', type: 'minor', section: 'sage', ring: 14, slot: 31, stats: { maxMana: 70 }, connections: ['r14s30', 'r14s32'], description: '[Placeholder r14]' },
  { id: 'r14s32', label: 'r14 Forge I', type: 'minor', section: 'shared', ring: 14, slot: 32, stats: { maxMana: 41, maxHealth: 50 }, connections: ['r14s31', 'r14s33'], description: '[Placeholder r14]' },
  { id: 'r14s33', label: 'r14 Forge II', type: 'minor', section: 'shared', ring: 14, slot: 33, stats: { maxMana: 41, maxHealth: 50 }, connections: ['r14s32', 'r14s34'], description: '[Placeholder r14]' },
  { id: 'r14s34', label: 'r14 Forge Core', type: 'notable', section: 'shared', ring: 14, slot: 34, stats: { maxMana: 56, maxHealth: 70 }, connections: ['r14s33', 'r14s35'], description: '[Placeholder r14]' },
  { id: 'r14s35', label: 'r14 Forge III', type: 'minor', section: 'shared', ring: 14, slot: 35, stats: { maxMana: 41, maxHealth: 50 }, connections: ['r14s34'], description: '[Placeholder r14]' },

  // ── RING 15 — Terminal Highway ──────────────────────────────────────────────────
  { id: 'r15s00', label: 'Sovereign I', type: 'minor', section: 'warrior', ring: 15, slot: 0, stats: { maxHealth: 80 }, connections: ['r14s00', 'r15s35', 'r15s01', 'r15as00', 'r15bs00'], description: '[Placeholder r15]' },
  { id: 'r15s01', label: 'Sovereign II', type: 'minor', section: 'warrior', ring: 15, slot: 1, stats: { maxHealth: 80 }, connections: ['r15s00', 'r15s02'], description: '[Placeholder r15]' },
  { id: 'r15s02', label: 'Sovereign III', type: 'minor', section: 'warrior', ring: 15, slot: 2, stats: { maxHealth: 80 }, connections: ['r15s01', 'r15s03'], description: '[Placeholder r15]' },
  { id: 'r15s03', label: 'Sovereign IV', type: 'minor', section: 'warrior', ring: 15, slot: 3, stats: { maxHealth: 80 }, connections: ['r15s02', 'r15s04'], description: '[Placeholder r15]' },
  { id: 'r15s04', label: 'Sovereign V', type: 'minor', section: 'warrior', ring: 15, slot: 4, stats: { maxHealth: 80 }, connections: ['r15s03', 'r15s05'], description: '[Placeholder r15]' },
  { id: 'r15s05', label: 'Sovereign VI', type: 'minor', section: 'warrior', ring: 15, slot: 5, stats: { maxHealth: 80 }, connections: ['r15s04', 'r15s06'], description: '[Placeholder r15]' },
  { id: 'r15s06', label: 'Sovereign VII', type: 'minor', section: 'warrior', ring: 15, slot: 6, stats: { maxHealth: 80 }, connections: ['r14s06', 'r15s05', 'r15s07', 'r15as06', 'r15bs06'], description: '[Placeholder r15]' },
  { id: 'r15s07', label: 'Sovereign VIII', type: 'minor', section: 'warrior', ring: 15, slot: 7, stats: { maxHealth: 80 }, connections: ['r15s06', 'r15s08'], description: '[Placeholder r15]' },
  { id: 'r15s08', label: 'Eternal Bridge I', type: 'minor', section: 'shared', ring: 15, slot: 8, stats: { maxHealth: 54, maxMana: 44 }, connections: ['r15s07', 'r15s09'], description: '[Placeholder r15]' },
  { id: 'r15s09', label: 'Eternal Bridge II', type: 'minor', section: 'shared', ring: 15, slot: 9, stats: { maxHealth: 54, maxMana: 44 }, connections: ['r15s08', 'r15s10'], description: '[Placeholder r15]' },
  { id: 'r15s10', label: 'Eternal Bridge III', type: 'notable', section: 'shared', ring: 15, slot: 10, stats: { maxHealth: 76, maxMana: 60 }, connections: ['r15s09', 'r15s11'], description: '[Placeholder r15]' },
  { id: 'r15s11', label: 'Eternal Bridge IV', type: 'minor', section: 'shared', ring: 15, slot: 11, stats: { maxHealth: 54, maxMana: 44 }, connections: ['r15s10', 'r15s12'], description: '[Placeholder r15]' },
  { id: 'r15s12', label: 'Sovereign I', type: 'minor', section: 'rogue', ring: 15, slot: 12, stats: { moveSpeedMult: 0.17 }, connections: ['r14s12', 'r15s11', 'r15s13', 'r15as12', 'r15bs12'], description: '[Placeholder r15]' },
  { id: 'r15s13', label: 'Sovereign II', type: 'minor', section: 'rogue', ring: 15, slot: 13, stats: { moveSpeedMult: 0.17 }, connections: ['r15s12', 'r15s14'], description: '[Placeholder r15]' },
  { id: 'r15s14', label: 'Sovereign III', type: 'minor', section: 'rogue', ring: 15, slot: 14, stats: { moveSpeedMult: 0.17 }, connections: ['r15s13', 'r15s15'], description: '[Placeholder r15]' },
  { id: 'r15s15', label: 'Sovereign IV', type: 'minor', section: 'rogue', ring: 15, slot: 15, stats: { moveSpeedMult: 0.17 }, connections: ['r15s14', 'r15s16'], description: '[Placeholder r15]' },
  { id: 'r15s16', label: 'Sovereign V', type: 'minor', section: 'rogue', ring: 15, slot: 16, stats: { moveSpeedMult: 0.17 }, connections: ['r15s15', 'r15s17'], description: '[Placeholder r15]' },
  { id: 'r15s17', label: 'Sovereign VI', type: 'minor', section: 'rogue', ring: 15, slot: 17, stats: { moveSpeedMult: 0.17 }, connections: ['r15s16', 'r15s18'], description: '[Placeholder r15]' },
  { id: 'r15s18', label: 'Sovereign VII', type: 'minor', section: 'rogue', ring: 15, slot: 18, stats: { moveSpeedMult: 0.17 }, connections: ['r14s18', 'r15s17', 'r15s19', 'r15as18', 'r15bs18'], description: '[Placeholder r15]' },
  { id: 'r15s19', label: 'Sovereign VIII', type: 'minor', section: 'rogue', ring: 15, slot: 19, stats: { moveSpeedMult: 0.17 }, connections: ['r15s18', 'r15s20'], description: '[Placeholder r15]' },
  { id: 'r15s20', label: 'Eternal Cross I', type: 'minor', section: 'shared', ring: 15, slot: 20, stats: { moveSpeedMult: 0.12, maxMana: 44 }, connections: ['r15s19', 'r15s21'], description: '[Placeholder r15]' },
  { id: 'r15s21', label: 'Eternal Cross II', type: 'minor', section: 'shared', ring: 15, slot: 21, stats: { moveSpeedMult: 0.12, maxMana: 44 }, connections: ['r15s20', 'r15s22'], description: '[Placeholder r15]' },
  { id: 'r15s22', label: 'Eternal Cross III', type: 'notable', section: 'shared', ring: 15, slot: 22, stats: { moveSpeedMult: 0.15, maxMana: 60 }, connections: ['r15s21', 'r15s23'], description: '[Placeholder r15]' },
  { id: 'r15s23', label: 'Eternal Cross IV', type: 'minor', section: 'shared', ring: 15, slot: 23, stats: { moveSpeedMult: 0.12, maxMana: 44 }, connections: ['r15s22', 'r15s24'], description: '[Placeholder r15]' },
  { id: 'r15s24', label: 'Sovereign I', type: 'minor', section: 'sage', ring: 15, slot: 24, stats: { maxMana: 75 }, connections: ['r14s24', 'r15s23', 'r15s25', 'r15as24', 'r15bs24'], description: '[Placeholder r15]' },
  { id: 'r15s25', label: 'Sovereign II', type: 'minor', section: 'sage', ring: 15, slot: 25, stats: { maxMana: 75 }, connections: ['r15s24', 'r15s26'], description: '[Placeholder r15]' },
  { id: 'r15s26', label: 'Sovereign III', type: 'minor', section: 'sage', ring: 15, slot: 26, stats: { maxMana: 75 }, connections: ['r15s25', 'r15s27'], description: '[Placeholder r15]' },
  { id: 'r15s27', label: 'Sovereign IV', type: 'minor', section: 'sage', ring: 15, slot: 27, stats: { maxMana: 75 }, connections: ['r15s26', 'r15s28'], description: '[Placeholder r15]' },
  { id: 'r15s28', label: 'Sovereign V', type: 'minor', section: 'sage', ring: 15, slot: 28, stats: { maxMana: 75 }, connections: ['r15s27', 'r15s29'], description: '[Placeholder r15]' },
  { id: 'r15s29', label: 'Sovereign VI', type: 'minor', section: 'sage', ring: 15, slot: 29, stats: { maxMana: 75 }, connections: ['r15s28', 'r15s30'], description: '[Placeholder r15]' },
  { id: 'r15s30', label: 'Sovereign VII', type: 'minor', section: 'sage', ring: 15, slot: 30, stats: { maxMana: 75 }, connections: ['r14s30', 'r15s29', 'r15s31', 'r15as30', 'r15bs30'], description: '[Placeholder r15]' },
  { id: 'r15s31', label: 'Sovereign VIII', type: 'minor', section: 'sage', ring: 15, slot: 31, stats: { maxMana: 75 }, connections: ['r15s30', 'r15s32'], description: '[Placeholder r15]' },
  { id: 'r15s32', label: 'Eternal Forge I', type: 'minor', section: 'shared', ring: 15, slot: 32, stats: { maxMana: 44, maxHealth: 54 }, connections: ['r15s31', 'r15s33'], description: '[Placeholder r15]' },
  { id: 'r15s33', label: 'Eternal Forge II', type: 'minor', section: 'shared', ring: 15, slot: 33, stats: { maxMana: 44, maxHealth: 54 }, connections: ['r15s32', 'r15s34'], description: '[Placeholder r15]' },
  { id: 'r15s34', label: 'Eternal Forge III', type: 'notable', section: 'shared', ring: 15, slot: 34, stats: { maxMana: 60, maxHealth: 76 }, connections: ['r15s33', 'r15s35'], description: '[Placeholder r15]' },
  { id: 'r15s35', label: 'Eternal Forge IV', type: 'minor', section: 'shared', ring: 15, slot: 35, stats: { maxMana: 44, maxHealth: 54 }, connections: ['r15s34', 'r15s00'], description: '[Placeholder r15]' },

  // ══════════════════════════════════════════════════════════════════════
  //  RING 8 SPUR BRANCHES — r8a (radius 1377) + r8b (radius 1523)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r8a — Lifeline spur (clockwise of r8s00, slots 1–5)
  { id: 'r8as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 8, slot: 1, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s00', 'r8as01'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 8, slot: 2, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as00', 'r8as02'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 8, slot: 3, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as01', 'r8as03'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 8, slot: 4, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as02', 'r8as04'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 8, slot: 5, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as03'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Lifeline spur (clockwise of r8s00, slots 1–5)
  { id: 'r8bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 8, slot: 1, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s00', 'r8bs01'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 8, slot: 2, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs00', 'r8bs02'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 8, slot: 3, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs01', 'r8bs03'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 8, slot: 4, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs02', 'r8bs04'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 8, slot: 5, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs03'], description: '+180 max health. [Placeholder notable]' },

  // ── r8a — Deep Current spur (clockwise of r8s06, slots 7–11)
  { id: 'r8as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 8, slot: 7, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s06', 'r8as07'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 8, slot: 8, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as06', 'r8as08'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 8, slot: 9, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as07', 'r8as09'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 8, slot: 10, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as08', 'r8as10'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 8, slot: 11, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as09'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Deep Current spur (clockwise of r8s06, slots 7–11)
  { id: 'r8bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 8, slot: 7, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s06', 'r8bs07'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 8, slot: 8, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs06', 'r8bs08'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 8, slot: 9, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs07', 'r8bs09'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 8, slot: 10, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs08', 'r8bs10'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 8, slot: 11, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs09'], description: '+180 max health. [Placeholder notable]' },

  // ── r8a — Vital Shadow spur (clockwise of r8s12, slots 13–17)
  { id: 'r8as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 8, slot: 13, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s12', 'r8as13'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 8, slot: 14, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as12', 'r8as14'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 8, slot: 15, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as13', 'r8as15'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 8, slot: 16, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as14', 'r8as16'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 8, slot: 17, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as15'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Vital Shadow spur (clockwise of r8s12, slots 13–17)
  { id: 'r8bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 8, slot: 13, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s12', 'r8bs13'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 8, slot: 14, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs12', 'r8bs14'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 8, slot: 15, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs13', 'r8bs15'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 8, slot: 16, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs14', 'r8bs16'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 8, slot: 17, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs15'], description: '+180 max health. [Placeholder notable]' },

  // ── r8a — Lifestream spur (clockwise of r8s18, slots 19–23)
  { id: 'r8as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 8, slot: 19, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s18', 'r8as19'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 8, slot: 20, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as18', 'r8as20'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 8, slot: 21, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as19', 'r8as21'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 8, slot: 22, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as20', 'r8as22'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 8, slot: 23, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as21'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Lifestream spur (clockwise of r8s18, slots 19–23)
  { id: 'r8bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 8, slot: 19, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s18', 'r8bs19'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 8, slot: 20, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs18', 'r8bs20'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 8, slot: 21, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs19', 'r8bs21'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 8, slot: 22, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs20', 'r8bs22'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 8, slot: 23, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs21'], description: '+180 max health. [Placeholder notable]' },

  // ── r8a — Mending Well spur (clockwise of r8s24, slots 25–29)
  { id: 'r8as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 8, slot: 25, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s24', 'r8as25'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 8, slot: 26, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as24', 'r8as26'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 8, slot: 27, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as25', 'r8as27'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 8, slot: 28, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as26', 'r8as28'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 8, slot: 29, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as27'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Mending Well spur (clockwise of r8s24, slots 25–29)
  { id: 'r8bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 8, slot: 25, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s24', 'r8bs25'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 8, slot: 26, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs24', 'r8bs26'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 8, slot: 27, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs25', 'r8bs27'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 8, slot: 28, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs26', 'r8bs28'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 8, slot: 29, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs27'], description: '+180 max health. [Placeholder notable]' },

  // ── r8a — Stone Pulse spur (clockwise of r8s30, slots 31–35)
  { id: 'r8as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 8, slot: 31, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8s30', 'r8as31'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 8, slot: 32, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as30', 'r8as32'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 8, slot: 33, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as31', 'r8as33'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 8, slot: 34, radiusOverride: 1377, stats: { maxHealth: 50 }, connections: ['r8as32', 'r8as34'], description: '+50 max health. [Placeholder]' },
  { id: 'r8as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 8, slot: 35, radiusOverride: 1377, stats: { maxHealth: 150 }, connections: ['r8as33'], description: '+150 max health. [Placeholder notable]' },

  // ── r8b — Stone Pulse spur (clockwise of r8s30, slots 31–35)
  { id: 'r8bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 8, slot: 31, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8s30', 'r8bs31'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 8, slot: 32, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs30', 'r8bs32'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 8, slot: 33, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs31', 'r8bs33'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 8, slot: 34, radiusOverride: 1523, stats: { maxHealth: 60 }, connections: ['r8bs32', 'r8bs34'], description: '+60 max health. [Placeholder]' },
  { id: 'r8bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 8, slot: 35, radiusOverride: 1523, stats: { maxHealth: 180 }, connections: ['r8bs33'], description: '+180 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 9 SPUR BRANCHES — r9a (radius 1597) + r9b (radius 1743)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r9a — Lifeline spur (clockwise of r9s00, slots 1–5)
  { id: 'r9as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 9, slot: 1, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s00', 'r9as01'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 9, slot: 2, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as00', 'r9as02'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 9, slot: 3, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as01', 'r9as03'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 9, slot: 4, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as02', 'r9as04'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 9, slot: 5, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as03'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Lifeline spur (clockwise of r9s00, slots 1–5)
  { id: 'r9bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 9, slot: 1, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s00', 'r9bs01'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 9, slot: 2, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs00', 'r9bs02'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 9, slot: 3, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs01', 'r9bs03'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 9, slot: 4, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs02', 'r9bs04'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 9, slot: 5, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs03'], description: '+198 max health. [Placeholder notable]' },

  // ── r9a — Deep Current spur (clockwise of r9s06, slots 7–11)
  { id: 'r9as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 9, slot: 7, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s06', 'r9as07'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 9, slot: 8, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as06', 'r9as08'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 9, slot: 9, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as07', 'r9as09'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 9, slot: 10, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as08', 'r9as10'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 9, slot: 11, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as09'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Deep Current spur (clockwise of r9s06, slots 7–11)
  { id: 'r9bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 9, slot: 7, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s06', 'r9bs07'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 9, slot: 8, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs06', 'r9bs08'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 9, slot: 9, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs07', 'r9bs09'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 9, slot: 10, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs08', 'r9bs10'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 9, slot: 11, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs09'], description: '+198 max health. [Placeholder notable]' },

  // ── r9a — Vital Shadow spur (clockwise of r9s12, slots 13–17)
  { id: 'r9as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 9, slot: 13, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s12', 'r9as13'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 9, slot: 14, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as12', 'r9as14'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 9, slot: 15, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as13', 'r9as15'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 9, slot: 16, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as14', 'r9as16'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 9, slot: 17, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as15'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Vital Shadow spur (clockwise of r9s12, slots 13–17)
  { id: 'r9bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 9, slot: 13, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s12', 'r9bs13'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 9, slot: 14, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs12', 'r9bs14'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 9, slot: 15, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs13', 'r9bs15'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 9, slot: 16, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs14', 'r9bs16'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 9, slot: 17, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs15'], description: '+198 max health. [Placeholder notable]' },

  // ── r9a — Lifestream spur (clockwise of r9s18, slots 19–23)
  { id: 'r9as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 9, slot: 19, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s18', 'r9as19'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 9, slot: 20, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as18', 'r9as20'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 9, slot: 21, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as19', 'r9as21'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 9, slot: 22, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as20', 'r9as22'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 9, slot: 23, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as21'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Lifestream spur (clockwise of r9s18, slots 19–23)
  { id: 'r9bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 9, slot: 19, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s18', 'r9bs19'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 9, slot: 20, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs18', 'r9bs20'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 9, slot: 21, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs19', 'r9bs21'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 9, slot: 22, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs20', 'r9bs22'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 9, slot: 23, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs21'], description: '+198 max health. [Placeholder notable]' },

  // ── r9a — Mending Well spur (clockwise of r9s24, slots 25–29)
  { id: 'r9as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 9, slot: 25, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s24', 'r9as25'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 9, slot: 26, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as24', 'r9as26'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 9, slot: 27, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as25', 'r9as27'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 9, slot: 28, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as26', 'r9as28'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 9, slot: 29, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as27'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Mending Well spur (clockwise of r9s24, slots 25–29)
  { id: 'r9bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 9, slot: 25, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s24', 'r9bs25'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 9, slot: 26, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs24', 'r9bs26'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 9, slot: 27, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs25', 'r9bs27'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 9, slot: 28, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs26', 'r9bs28'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 9, slot: 29, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs27'], description: '+198 max health. [Placeholder notable]' },

  // ── r9a — Stone Pulse spur (clockwise of r9s30, slots 31–35)
  { id: 'r9as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 9, slot: 31, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9s30', 'r9as31'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 9, slot: 32, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as30', 'r9as32'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 9, slot: 33, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as31', 'r9as33'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 9, slot: 34, radiusOverride: 1597, stats: { maxHealth: 55 }, connections: ['r9as32', 'r9as34'], description: '+55 max health. [Placeholder]' },
  { id: 'r9as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 9, slot: 35, radiusOverride: 1597, stats: { maxHealth: 165 }, connections: ['r9as33'], description: '+165 max health. [Placeholder notable]' },

  // ── r9b — Stone Pulse spur (clockwise of r9s30, slots 31–35)
  { id: 'r9bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 9, slot: 31, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9s30', 'r9bs31'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 9, slot: 32, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs30', 'r9bs32'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 9, slot: 33, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs31', 'r9bs33'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 9, slot: 34, radiusOverride: 1743, stats: { maxHealth: 65 }, connections: ['r9bs32', 'r9bs34'], description: '+65 max health. [Placeholder]' },
  { id: 'r9bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 9, slot: 35, radiusOverride: 1743, stats: { maxHealth: 198 }, connections: ['r9bs33'], description: '+198 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 10 SPUR BRANCHES — r10a (radius 1817) + r10b (radius 1963)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r10a — Lifeline spur (clockwise of r10s00, slots 1–5)
  { id: 'r10as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 10, slot: 1, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s00', 'r10as01'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 10, slot: 2, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as00', 'r10as02'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 10, slot: 3, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as01', 'r10as03'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 10, slot: 4, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as02', 'r10as04'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 10, slot: 5, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as03'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Lifeline spur (clockwise of r10s00, slots 1–5)
  { id: 'r10bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 10, slot: 1, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s00', 'r10bs01'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 10, slot: 2, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs00', 'r10bs02'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 10, slot: 3, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs01', 'r10bs03'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 10, slot: 4, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs02', 'r10bs04'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 10, slot: 5, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs03'], description: '+215 max health. [Placeholder notable]' },

  // ── r10a — Deep Current spur (clockwise of r10s06, slots 7–11)
  { id: 'r10as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 10, slot: 7, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s06', 'r10as07'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 10, slot: 8, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as06', 'r10as08'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 10, slot: 9, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as07', 'r10as09'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 10, slot: 10, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as08', 'r10as10'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 10, slot: 11, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as09'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Deep Current spur (clockwise of r10s06, slots 7–11)
  { id: 'r10bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 10, slot: 7, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s06', 'r10bs07'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 10, slot: 8, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs06', 'r10bs08'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 10, slot: 9, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs07', 'r10bs09'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 10, slot: 10, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs08', 'r10bs10'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 10, slot: 11, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs09'], description: '+215 max health. [Placeholder notable]' },

  // ── r10a — Vital Shadow spur (clockwise of r10s12, slots 13–17)
  { id: 'r10as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 10, slot: 13, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s12', 'r10as13'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 10, slot: 14, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as12', 'r10as14'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 10, slot: 15, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as13', 'r10as15'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 10, slot: 16, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as14', 'r10as16'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 10, slot: 17, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as15'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Vital Shadow spur (clockwise of r10s12, slots 13–17)
  { id: 'r10bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 10, slot: 13, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s12', 'r10bs13'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 10, slot: 14, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs12', 'r10bs14'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 10, slot: 15, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs13', 'r10bs15'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 10, slot: 16, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs14', 'r10bs16'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 10, slot: 17, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs15'], description: '+215 max health. [Placeholder notable]' },

  // ── r10a — Lifestream spur (clockwise of r10s18, slots 19–23)
  { id: 'r10as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 10, slot: 19, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s18', 'r10as19'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 10, slot: 20, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as18', 'r10as20'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 10, slot: 21, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as19', 'r10as21'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 10, slot: 22, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as20', 'r10as22'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 10, slot: 23, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as21'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Lifestream spur (clockwise of r10s18, slots 19–23)
  { id: 'r10bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 10, slot: 19, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s18', 'r10bs19'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 10, slot: 20, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs18', 'r10bs20'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 10, slot: 21, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs19', 'r10bs21'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 10, slot: 22, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs20', 'r10bs22'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 10, slot: 23, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs21'], description: '+215 max health. [Placeholder notable]' },

  // ── r10a — Mending Well spur (clockwise of r10s24, slots 25–29)
  { id: 'r10as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 10, slot: 25, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s24', 'r10as25'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 10, slot: 26, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as24', 'r10as26'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 10, slot: 27, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as25', 'r10as27'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 10, slot: 28, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as26', 'r10as28'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 10, slot: 29, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as27'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Mending Well spur (clockwise of r10s24, slots 25–29)
  { id: 'r10bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 10, slot: 25, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s24', 'r10bs25'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 10, slot: 26, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs24', 'r10bs26'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 10, slot: 27, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs25', 'r10bs27'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 10, slot: 28, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs26', 'r10bs28'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 10, slot: 29, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs27'], description: '+215 max health. [Placeholder notable]' },

  // ── r10a — Stone Pulse spur (clockwise of r10s30, slots 31–35)
  { id: 'r10as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 10, slot: 31, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10s30', 'r10as31'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 10, slot: 32, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as30', 'r10as32'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 10, slot: 33, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as31', 'r10as33'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 10, slot: 34, radiusOverride: 1817, stats: { maxHealth: 60 }, connections: ['r10as32', 'r10as34'], description: '+60 max health. [Placeholder]' },
  { id: 'r10as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 10, slot: 35, radiusOverride: 1817, stats: { maxHealth: 180 }, connections: ['r10as33'], description: '+180 max health. [Placeholder notable]' },

  // ── r10b — Stone Pulse spur (clockwise of r10s30, slots 31–35)
  { id: 'r10bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 10, slot: 31, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10s30', 'r10bs31'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 10, slot: 32, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs30', 'r10bs32'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 10, slot: 33, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs31', 'r10bs33'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 10, slot: 34, radiusOverride: 1963, stats: { maxHealth: 72 }, connections: ['r10bs32', 'r10bs34'], description: '+72 max health. [Placeholder]' },
  { id: 'r10bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 10, slot: 35, radiusOverride: 1963, stats: { maxHealth: 215 }, connections: ['r10bs33'], description: '+215 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 11 SPUR BRANCHES — r11a (radius 2037) + r11b (radius 2183)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r11a — Lifeline spur (clockwise of r11s00, slots 1–5)
  { id: 'r11as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 11, slot: 1, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s00', 'r11as01'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 11, slot: 2, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as00', 'r11as02'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 11, slot: 3, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as01', 'r11as03'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 11, slot: 4, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as02', 'r11as04'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 11, slot: 5, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as03'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Lifeline spur (clockwise of r11s00, slots 1–5)
  { id: 'r11bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 11, slot: 1, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s00', 'r11bs01'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 11, slot: 2, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs00', 'r11bs02'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 11, slot: 3, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs01', 'r11bs03'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 11, slot: 4, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs02', 'r11bs04'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 11, slot: 5, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs03'], description: '+234 max health. [Placeholder notable]' },

  // ── r11a — Deep Current spur (clockwise of r11s06, slots 7–11)
  { id: 'r11as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 11, slot: 7, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s06', 'r11as07'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 11, slot: 8, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as06', 'r11as08'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 11, slot: 9, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as07', 'r11as09'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 11, slot: 10, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as08', 'r11as10'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 11, slot: 11, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as09'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Deep Current spur (clockwise of r11s06, slots 7–11)
  { id: 'r11bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 11, slot: 7, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s06', 'r11bs07'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 11, slot: 8, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs06', 'r11bs08'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 11, slot: 9, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs07', 'r11bs09'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 11, slot: 10, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs08', 'r11bs10'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 11, slot: 11, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs09'], description: '+234 max health. [Placeholder notable]' },

  // ── r11a — Vital Shadow spur (clockwise of r11s12, slots 13–17)
  { id: 'r11as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 11, slot: 13, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s12', 'r11as13'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 11, slot: 14, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as12', 'r11as14'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 11, slot: 15, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as13', 'r11as15'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 11, slot: 16, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as14', 'r11as16'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 11, slot: 17, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as15'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Vital Shadow spur (clockwise of r11s12, slots 13–17)
  { id: 'r11bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 11, slot: 13, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s12', 'r11bs13'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 11, slot: 14, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs12', 'r11bs14'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 11, slot: 15, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs13', 'r11bs15'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 11, slot: 16, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs14', 'r11bs16'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 11, slot: 17, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs15'], description: '+234 max health. [Placeholder notable]' },

  // ── r11a — Lifestream spur (clockwise of r11s18, slots 19–23)
  { id: 'r11as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 11, slot: 19, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s18', 'r11as19'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 11, slot: 20, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as18', 'r11as20'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 11, slot: 21, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as19', 'r11as21'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 11, slot: 22, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as20', 'r11as22'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 11, slot: 23, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as21'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Lifestream spur (clockwise of r11s18, slots 19–23)
  { id: 'r11bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 11, slot: 19, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s18', 'r11bs19'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 11, slot: 20, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs18', 'r11bs20'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 11, slot: 21, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs19', 'r11bs21'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 11, slot: 22, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs20', 'r11bs22'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 11, slot: 23, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs21'], description: '+234 max health. [Placeholder notable]' },

  // ── r11a — Mending Well spur (clockwise of r11s24, slots 25–29)
  { id: 'r11as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 11, slot: 25, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s24', 'r11as25'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 11, slot: 26, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as24', 'r11as26'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 11, slot: 27, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as25', 'r11as27'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 11, slot: 28, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as26', 'r11as28'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 11, slot: 29, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as27'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Mending Well spur (clockwise of r11s24, slots 25–29)
  { id: 'r11bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 11, slot: 25, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s24', 'r11bs25'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 11, slot: 26, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs24', 'r11bs26'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 11, slot: 27, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs25', 'r11bs27'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 11, slot: 28, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs26', 'r11bs28'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 11, slot: 29, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs27'], description: '+234 max health. [Placeholder notable]' },

  // ── r11a — Stone Pulse spur (clockwise of r11s30, slots 31–35)
  { id: 'r11as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 11, slot: 31, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11s30', 'r11as31'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 11, slot: 32, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as30', 'r11as32'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 11, slot: 33, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as31', 'r11as33'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 11, slot: 34, radiusOverride: 2037, stats: { maxHealth: 65 }, connections: ['r11as32', 'r11as34'], description: '+65 max health. [Placeholder]' },
  { id: 'r11as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 11, slot: 35, radiusOverride: 2037, stats: { maxHealth: 195 }, connections: ['r11as33'], description: '+195 max health. [Placeholder notable]' },

  // ── r11b — Stone Pulse spur (clockwise of r11s30, slots 31–35)
  { id: 'r11bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 11, slot: 31, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11s30', 'r11bs31'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 11, slot: 32, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs30', 'r11bs32'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 11, slot: 33, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs31', 'r11bs33'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 11, slot: 34, radiusOverride: 2183, stats: { maxHealth: 78 }, connections: ['r11bs32', 'r11bs34'], description: '+78 max health. [Placeholder]' },
  { id: 'r11bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 11, slot: 35, radiusOverride: 2183, stats: { maxHealth: 234 }, connections: ['r11bs33'], description: '+234 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 12 SPUR BRANCHES — r12a (radius 2257) + r12b (radius 2403)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r12a — Lifeline spur (clockwise of r12s00, slots 1–5)
  { id: 'r12as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 12, slot: 1, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s00', 'r12as01'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 12, slot: 2, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as00', 'r12as02'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 12, slot: 3, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as01', 'r12as03'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 12, slot: 4, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as02', 'r12as04'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 12, slot: 5, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as03'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Lifeline spur (clockwise of r12s00, slots 1–5)
  { id: 'r12bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 12, slot: 1, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s00', 'r12bs01'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 12, slot: 2, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs00', 'r12bs02'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 12, slot: 3, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs01', 'r12bs03'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 12, slot: 4, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs02', 'r12bs04'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 12, slot: 5, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs03'], description: '+252 max health. [Placeholder notable]' },

  // ── r12a — Deep Current spur (clockwise of r12s06, slots 7–11)
  { id: 'r12as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 12, slot: 7, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s06', 'r12as07'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 12, slot: 8, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as06', 'r12as08'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 12, slot: 9, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as07', 'r12as09'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 12, slot: 10, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as08', 'r12as10'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 12, slot: 11, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as09'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Deep Current spur (clockwise of r12s06, slots 7–11)
  { id: 'r12bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 12, slot: 7, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s06', 'r12bs07'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 12, slot: 8, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs06', 'r12bs08'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 12, slot: 9, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs07', 'r12bs09'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 12, slot: 10, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs08', 'r12bs10'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 12, slot: 11, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs09'], description: '+252 max health. [Placeholder notable]' },

  // ── r12a — Vital Shadow spur (clockwise of r12s12, slots 13–17)
  { id: 'r12as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 12, slot: 13, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s12', 'r12as13'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 12, slot: 14, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as12', 'r12as14'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 12, slot: 15, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as13', 'r12as15'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 12, slot: 16, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as14', 'r12as16'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 12, slot: 17, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as15'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Vital Shadow spur (clockwise of r12s12, slots 13–17)
  { id: 'r12bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 12, slot: 13, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s12', 'r12bs13'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 12, slot: 14, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs12', 'r12bs14'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 12, slot: 15, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs13', 'r12bs15'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 12, slot: 16, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs14', 'r12bs16'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 12, slot: 17, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs15'], description: '+252 max health. [Placeholder notable]' },

  // ── r12a — Lifestream spur (clockwise of r12s18, slots 19–23)
  { id: 'r12as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 12, slot: 19, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s18', 'r12as19'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 12, slot: 20, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as18', 'r12as20'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 12, slot: 21, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as19', 'r12as21'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 12, slot: 22, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as20', 'r12as22'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 12, slot: 23, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as21'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Lifestream spur (clockwise of r12s18, slots 19–23)
  { id: 'r12bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 12, slot: 19, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s18', 'r12bs19'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 12, slot: 20, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs18', 'r12bs20'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 12, slot: 21, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs19', 'r12bs21'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 12, slot: 22, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs20', 'r12bs22'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 12, slot: 23, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs21'], description: '+252 max health. [Placeholder notable]' },

  // ── r12a — Mending Well spur (clockwise of r12s24, slots 25–29)
  { id: 'r12as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 12, slot: 25, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s24', 'r12as25'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 12, slot: 26, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as24', 'r12as26'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 12, slot: 27, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as25', 'r12as27'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 12, slot: 28, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as26', 'r12as28'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 12, slot: 29, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as27'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Mending Well spur (clockwise of r12s24, slots 25–29)
  { id: 'r12bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 12, slot: 25, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s24', 'r12bs25'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 12, slot: 26, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs24', 'r12bs26'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 12, slot: 27, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs25', 'r12bs27'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 12, slot: 28, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs26', 'r12bs28'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 12, slot: 29, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs27'], description: '+252 max health. [Placeholder notable]' },

  // ── r12a — Stone Pulse spur (clockwise of r12s30, slots 31–35)
  { id: 'r12as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 12, slot: 31, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12s30', 'r12as31'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 12, slot: 32, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as30', 'r12as32'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 12, slot: 33, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as31', 'r12as33'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 12, slot: 34, radiusOverride: 2257, stats: { maxHealth: 70 }, connections: ['r12as32', 'r12as34'], description: '+70 max health. [Placeholder]' },
  { id: 'r12as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 12, slot: 35, radiusOverride: 2257, stats: { maxHealth: 210 }, connections: ['r12as33'], description: '+210 max health. [Placeholder notable]' },

  // ── r12b — Stone Pulse spur (clockwise of r12s30, slots 31–35)
  { id: 'r12bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 12, slot: 31, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12s30', 'r12bs31'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 12, slot: 32, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs30', 'r12bs32'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 12, slot: 33, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs31', 'r12bs33'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 12, slot: 34, radiusOverride: 2403, stats: { maxHealth: 84 }, connections: ['r12bs32', 'r12bs34'], description: '+84 max health. [Placeholder]' },
  { id: 'r12bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 12, slot: 35, radiusOverride: 2403, stats: { maxHealth: 252 }, connections: ['r12bs33'], description: '+252 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 13 SPUR BRANCHES — r13a (radius 2477) + r13b (radius 2623)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r13a — Lifeline spur (clockwise of r13s00, slots 1–5)
  { id: 'r13as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 13, slot: 1, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s00', 'r13as01'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 13, slot: 2, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as00', 'r13as02'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 13, slot: 3, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as01', 'r13as03'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 13, slot: 4, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as02', 'r13as04'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 13, slot: 5, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as03'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Lifeline spur (clockwise of r13s00, slots 1–5)
  { id: 'r13bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 13, slot: 1, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s00', 'r13bs01'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 13, slot: 2, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs00', 'r13bs02'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 13, slot: 3, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs01', 'r13bs03'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 13, slot: 4, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs02', 'r13bs04'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 13, slot: 5, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs03'], description: '+270 max health. [Placeholder notable]' },

  // ── r13a — Deep Current spur (clockwise of r13s06, slots 7–11)
  { id: 'r13as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 13, slot: 7, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s06', 'r13as07'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 13, slot: 8, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as06', 'r13as08'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 13, slot: 9, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as07', 'r13as09'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 13, slot: 10, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as08', 'r13as10'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 13, slot: 11, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as09'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Deep Current spur (clockwise of r13s06, slots 7–11)
  { id: 'r13bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 13, slot: 7, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s06', 'r13bs07'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 13, slot: 8, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs06', 'r13bs08'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 13, slot: 9, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs07', 'r13bs09'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 13, slot: 10, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs08', 'r13bs10'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 13, slot: 11, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs09'], description: '+270 max health. [Placeholder notable]' },

  // ── r13a — Vital Shadow spur (clockwise of r13s12, slots 13–17)
  { id: 'r13as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 13, slot: 13, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s12', 'r13as13'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 13, slot: 14, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as12', 'r13as14'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 13, slot: 15, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as13', 'r13as15'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 13, slot: 16, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as14', 'r13as16'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 13, slot: 17, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as15'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Vital Shadow spur (clockwise of r13s12, slots 13–17)
  { id: 'r13bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 13, slot: 13, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s12', 'r13bs13'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 13, slot: 14, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs12', 'r13bs14'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 13, slot: 15, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs13', 'r13bs15'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 13, slot: 16, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs14', 'r13bs16'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 13, slot: 17, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs15'], description: '+270 max health. [Placeholder notable]' },

  // ── r13a — Lifestream spur (clockwise of r13s18, slots 19–23)
  { id: 'r13as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 13, slot: 19, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s18', 'r13as19'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 13, slot: 20, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as18', 'r13as20'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 13, slot: 21, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as19', 'r13as21'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 13, slot: 22, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as20', 'r13as22'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 13, slot: 23, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as21'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Lifestream spur (clockwise of r13s18, slots 19–23)
  { id: 'r13bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 13, slot: 19, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s18', 'r13bs19'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 13, slot: 20, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs18', 'r13bs20'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 13, slot: 21, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs19', 'r13bs21'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 13, slot: 22, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs20', 'r13bs22'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 13, slot: 23, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs21'], description: '+270 max health. [Placeholder notable]' },

  // ── r13a — Mending Well spur (clockwise of r13s24, slots 25–29)
  { id: 'r13as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 13, slot: 25, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s24', 'r13as25'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 13, slot: 26, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as24', 'r13as26'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 13, slot: 27, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as25', 'r13as27'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 13, slot: 28, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as26', 'r13as28'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 13, slot: 29, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as27'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Mending Well spur (clockwise of r13s24, slots 25–29)
  { id: 'r13bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 13, slot: 25, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s24', 'r13bs25'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 13, slot: 26, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs24', 'r13bs26'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 13, slot: 27, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs25', 'r13bs27'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 13, slot: 28, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs26', 'r13bs28'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 13, slot: 29, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs27'], description: '+270 max health. [Placeholder notable]' },

  // ── r13a — Stone Pulse spur (clockwise of r13s30, slots 31–35)
  { id: 'r13as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 13, slot: 31, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13s30', 'r13as31'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 13, slot: 32, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as30', 'r13as32'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 13, slot: 33, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as31', 'r13as33'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 13, slot: 34, radiusOverride: 2477, stats: { maxHealth: 75 }, connections: ['r13as32', 'r13as34'], description: '+75 max health. [Placeholder]' },
  { id: 'r13as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 13, slot: 35, radiusOverride: 2477, stats: { maxHealth: 225 }, connections: ['r13as33'], description: '+225 max health. [Placeholder notable]' },

  // ── r13b — Stone Pulse spur (clockwise of r13s30, slots 31–35)
  { id: 'r13bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 13, slot: 31, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13s30', 'r13bs31'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 13, slot: 32, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs30', 'r13bs32'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 13, slot: 33, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs31', 'r13bs33'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 13, slot: 34, radiusOverride: 2623, stats: { maxHealth: 90 }, connections: ['r13bs32', 'r13bs34'], description: '+90 max health. [Placeholder]' },
  { id: 'r13bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 13, slot: 35, radiusOverride: 2623, stats: { maxHealth: 270 }, connections: ['r13bs33'], description: '+270 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 14 SPUR BRANCHES — r14a (radius 2697) + r14b (radius 2843)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r14a — Lifeline spur (clockwise of r14s00, slots 1–5)
  { id: 'r14as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 14, slot: 1, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s00', 'r14as01'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 14, slot: 2, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as00', 'r14as02'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 14, slot: 3, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as01', 'r14as03'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 14, slot: 4, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as02', 'r14as04'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 14, slot: 5, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as03'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Lifeline spur (clockwise of r14s00, slots 1–5)
  { id: 'r14bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 14, slot: 1, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s00', 'r14bs01'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 14, slot: 2, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs00', 'r14bs02'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 14, slot: 3, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs01', 'r14bs03'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 14, slot: 4, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs02', 'r14bs04'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 14, slot: 5, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs03'], description: '+288 max health. [Placeholder notable]' },

  // ── r14a — Deep Current spur (clockwise of r14s06, slots 7–11)
  { id: 'r14as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 14, slot: 7, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s06', 'r14as07'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 14, slot: 8, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as06', 'r14as08'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 14, slot: 9, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as07', 'r14as09'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 14, slot: 10, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as08', 'r14as10'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 14, slot: 11, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as09'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Deep Current spur (clockwise of r14s06, slots 7–11)
  { id: 'r14bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 14, slot: 7, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s06', 'r14bs07'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 14, slot: 8, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs06', 'r14bs08'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 14, slot: 9, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs07', 'r14bs09'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 14, slot: 10, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs08', 'r14bs10'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 14, slot: 11, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs09'], description: '+288 max health. [Placeholder notable]' },

  // ── r14a — Vital Shadow spur (clockwise of r14s12, slots 13–17)
  { id: 'r14as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 14, slot: 13, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s12', 'r14as13'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 14, slot: 14, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as12', 'r14as14'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 14, slot: 15, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as13', 'r14as15'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 14, slot: 16, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as14', 'r14as16'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 14, slot: 17, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as15'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Vital Shadow spur (clockwise of r14s12, slots 13–17)
  { id: 'r14bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 14, slot: 13, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s12', 'r14bs13'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 14, slot: 14, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs12', 'r14bs14'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 14, slot: 15, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs13', 'r14bs15'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 14, slot: 16, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs14', 'r14bs16'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 14, slot: 17, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs15'], description: '+288 max health. [Placeholder notable]' },

  // ── r14a — Lifestream spur (clockwise of r14s18, slots 19–23)
  { id: 'r14as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 14, slot: 19, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s18', 'r14as19'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 14, slot: 20, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as18', 'r14as20'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 14, slot: 21, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as19', 'r14as21'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 14, slot: 22, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as20', 'r14as22'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 14, slot: 23, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as21'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Lifestream spur (clockwise of r14s18, slots 19–23)
  { id: 'r14bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 14, slot: 19, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s18', 'r14bs19'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 14, slot: 20, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs18', 'r14bs20'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 14, slot: 21, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs19', 'r14bs21'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 14, slot: 22, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs20', 'r14bs22'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 14, slot: 23, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs21'], description: '+288 max health. [Placeholder notable]' },

  // ── r14a — Mending Well spur (clockwise of r14s24, slots 25–29)
  { id: 'r14as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 14, slot: 25, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s24', 'r14as25'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 14, slot: 26, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as24', 'r14as26'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 14, slot: 27, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as25', 'r14as27'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 14, slot: 28, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as26', 'r14as28'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 14, slot: 29, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as27'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Mending Well spur (clockwise of r14s24, slots 25–29)
  { id: 'r14bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 14, slot: 25, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s24', 'r14bs25'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 14, slot: 26, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs24', 'r14bs26'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 14, slot: 27, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs25', 'r14bs27'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 14, slot: 28, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs26', 'r14bs28'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 14, slot: 29, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs27'], description: '+288 max health. [Placeholder notable]' },

  // ── r14a — Stone Pulse spur (clockwise of r14s30, slots 31–35)
  { id: 'r14as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 14, slot: 31, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14s30', 'r14as31'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 14, slot: 32, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as30', 'r14as32'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 14, slot: 33, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as31', 'r14as33'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 14, slot: 34, radiusOverride: 2697, stats: { maxHealth: 80 }, connections: ['r14as32', 'r14as34'], description: '+80 max health. [Placeholder]' },
  { id: 'r14as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 14, slot: 35, radiusOverride: 2697, stats: { maxHealth: 240 }, connections: ['r14as33'], description: '+240 max health. [Placeholder notable]' },

  // ── r14b — Stone Pulse spur (clockwise of r14s30, slots 31–35)
  { id: 'r14bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 14, slot: 31, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14s30', 'r14bs31'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 14, slot: 32, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs30', 'r14bs32'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 14, slot: 33, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs31', 'r14bs33'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 14, slot: 34, radiusOverride: 2843, stats: { maxHealth: 96 }, connections: ['r14bs32', 'r14bs34'], description: '+96 max health. [Placeholder]' },
  { id: 'r14bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 14, slot: 35, radiusOverride: 2843, stats: { maxHealth: 288 }, connections: ['r14bs33'], description: '+288 max health. [Placeholder notable]' },
  // ══════════════════════════════════════════════════════════════════════
  //  RING 15 SPUR BRANCHES — r15a (radius 2917) + r15b (radius 3063)
  //  Placeholder: all max health. Themed pass comes later.
  // ══════════════════════════════════════════════════════════════════════

  // ── r15a — Lifeline spur (clockwise of r15s00, slots 1–5)
  { id: 'r15as00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 15, slot: 1, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s00', 'r15as01'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 15, slot: 2, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as00', 'r15as02'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 15, slot: 3, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as01', 'r15as03'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 15, slot: 4, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as02', 'r15as04'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as04', label: 'Lifeline Peak', type: 'notable', section: 'warrior', ring: 15, slot: 5, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as03'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Lifeline spur (clockwise of r15s00, slots 1–5)
  { id: 'r15bs00', label: 'Lifeline I',   type: 'minor',   section: 'warrior', ring: 15, slot: 1, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s00', 'r15bs01'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs01', label: 'Lifeline II',  type: 'minor',   section: 'warrior', ring: 15, slot: 2, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs00', 'r15bs02'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs02', label: 'Lifeline III', type: 'minor',   section: 'warrior', ring: 15, slot: 3, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs01', 'r15bs03'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs03', label: 'Lifeline IV',  type: 'minor',   section: 'warrior', ring: 15, slot: 4, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs02', 'r15bs04'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs04', label: 'Lifeline Apex', type: 'notable', section: 'warrior', ring: 15, slot: 5, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs03'], description: '+324 max health. [Placeholder notable]' },

  // ── r15a — Deep Current spur (clockwise of r15s06, slots 7–11)
  { id: 'r15as06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 15, slot: 7, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s06', 'r15as07'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 15, slot: 8, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as06', 'r15as08'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 15, slot: 9, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as07', 'r15as09'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 15, slot: 10, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as08', 'r15as10'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as10', label: 'Deep Current Peak', type: 'notable', section: 'shared', ring: 15, slot: 11, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as09'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Deep Current spur (clockwise of r15s06, slots 7–11)
  { id: 'r15bs06', label: 'Deep Current I',   type: 'minor',   section: 'shared', ring: 15, slot: 7, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s06', 'r15bs07'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs07', label: 'Deep Current II',  type: 'minor',   section: 'shared', ring: 15, slot: 8, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs06', 'r15bs08'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs08', label: 'Deep Current III', type: 'minor',   section: 'shared', ring: 15, slot: 9, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs07', 'r15bs09'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs09', label: 'Deep Current IV',  type: 'minor',   section: 'shared', ring: 15, slot: 10, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs08', 'r15bs10'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs10', label: 'Deep Current Apex', type: 'notable', section: 'shared', ring: 15, slot: 11, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs09'], description: '+324 max health. [Placeholder notable]' },

  // ── r15a — Vital Shadow spur (clockwise of r15s12, slots 13–17)
  { id: 'r15as12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 15, slot: 13, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s12', 'r15as13'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 15, slot: 14, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as12', 'r15as14'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 15, slot: 15, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as13', 'r15as15'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 15, slot: 16, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as14', 'r15as16'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as16', label: 'Vital Shadow Peak', type: 'notable', section: 'rogue', ring: 15, slot: 17, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as15'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Vital Shadow spur (clockwise of r15s12, slots 13–17)
  { id: 'r15bs12', label: 'Vital Shadow I',   type: 'minor',   section: 'rogue', ring: 15, slot: 13, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s12', 'r15bs13'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs13', label: 'Vital Shadow II',  type: 'minor',   section: 'rogue', ring: 15, slot: 14, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs12', 'r15bs14'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs14', label: 'Vital Shadow III', type: 'minor',   section: 'rogue', ring: 15, slot: 15, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs13', 'r15bs15'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs15', label: 'Vital Shadow IV',  type: 'minor',   section: 'rogue', ring: 15, slot: 16, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs14', 'r15bs16'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs16', label: 'Vital Shadow Apex', type: 'notable', section: 'rogue', ring: 15, slot: 17, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs15'], description: '+324 max health. [Placeholder notable]' },

  // ── r15a — Lifestream spur (clockwise of r15s18, slots 19–23)
  { id: 'r15as18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 15, slot: 19, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s18', 'r15as19'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 15, slot: 20, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as18', 'r15as20'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 15, slot: 21, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as19', 'r15as21'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 15, slot: 22, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as20', 'r15as22'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as22', label: 'Lifestream Peak', type: 'notable', section: 'shared', ring: 15, slot: 23, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as21'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Lifestream spur (clockwise of r15s18, slots 19–23)
  { id: 'r15bs18', label: 'Lifestream I',   type: 'minor',   section: 'shared', ring: 15, slot: 19, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s18', 'r15bs19'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs19', label: 'Lifestream II',  type: 'minor',   section: 'shared', ring: 15, slot: 20, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs18', 'r15bs20'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs20', label: 'Lifestream III', type: 'minor',   section: 'shared', ring: 15, slot: 21, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs19', 'r15bs21'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs21', label: 'Lifestream IV',  type: 'minor',   section: 'shared', ring: 15, slot: 22, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs20', 'r15bs22'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs22', label: 'Lifestream Apex', type: 'notable', section: 'shared', ring: 15, slot: 23, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs21'], description: '+324 max health. [Placeholder notable]' },

  // ── r15a — Mending Well spur (clockwise of r15s24, slots 25–29)
  { id: 'r15as24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 15, slot: 25, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s24', 'r15as25'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 15, slot: 26, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as24', 'r15as26'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 15, slot: 27, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as25', 'r15as27'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 15, slot: 28, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as26', 'r15as28'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as28', label: 'Mending Well Peak', type: 'notable', section: 'sage', ring: 15, slot: 29, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as27'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Mending Well spur (clockwise of r15s24, slots 25–29)
  { id: 'r15bs24', label: 'Mending Well I',   type: 'minor',   section: 'sage', ring: 15, slot: 25, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s24', 'r15bs25'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs25', label: 'Mending Well II',  type: 'minor',   section: 'sage', ring: 15, slot: 26, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs24', 'r15bs26'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs26', label: 'Mending Well III', type: 'minor',   section: 'sage', ring: 15, slot: 27, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs25', 'r15bs27'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs27', label: 'Mending Well IV',  type: 'minor',   section: 'sage', ring: 15, slot: 28, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs26', 'r15bs28'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs28', label: 'Mending Well Apex', type: 'notable', section: 'sage', ring: 15, slot: 29, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs27'], description: '+324 max health. [Placeholder notable]' },

  // ── r15a — Stone Pulse spur (clockwise of r15s30, slots 31–35)
  { id: 'r15as30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 15, slot: 31, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15s30', 'r15as31'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 15, slot: 32, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as30', 'r15as32'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 15, slot: 33, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as31', 'r15as33'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 15, slot: 34, radiusOverride: 2917, stats: { maxHealth: 90 }, connections: ['r15as32', 'r15as34'], description: '+90 max health. [Placeholder]' },
  { id: 'r15as34', label: 'Stone Pulse Peak', type: 'notable', section: 'shared', ring: 15, slot: 35, radiusOverride: 2917, stats: { maxHealth: 270 }, connections: ['r15as33'], description: '+270 max health. [Placeholder notable]' },

  // ── r15b — Stone Pulse spur (clockwise of r15s30, slots 31–35)
  { id: 'r15bs30', label: 'Stone Pulse I',   type: 'minor',   section: 'shared', ring: 15, slot: 31, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15s30', 'r15bs31'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs31', label: 'Stone Pulse II',  type: 'minor',   section: 'shared', ring: 15, slot: 32, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs30', 'r15bs32'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs32', label: 'Stone Pulse III', type: 'minor',   section: 'shared', ring: 15, slot: 33, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs31', 'r15bs33'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs33', label: 'Stone Pulse IV',  type: 'minor',   section: 'shared', ring: 15, slot: 34, radiusOverride: 3063, stats: { maxHealth: 108 }, connections: ['r15bs32', 'r15bs34'], description: '+108 max health. [Placeholder]' },
  { id: 'r15bs34', label: 'Stone Pulse Apex', type: 'notable', section: 'shared', ring: 15, slot: 35, radiusOverride: 3063, stats: { maxHealth: 324 }, connections: ['r15bs33'], description: '+324 max health. [Placeholder notable]' },
];

/**
 * Flat lookup map: nodeId → node object.
 * All code outside this file should use TREE_NODE_MAP rather than NODES.
 */
export const TREE_NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]));






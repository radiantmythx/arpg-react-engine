/**
 * passiveTree.js — Phase 6 Passive Skill Tree
 *
 * 60 nodes organized into 5 zones:
 *   Starting hub  (9)  — centre of the tree, always reachable
 *   Power cluster (14) — right side, damage / cooldown / projectile count
 *   Speed cluster (13) — top, movement speed / cooldown
 *   Tank  cluster (12) — left side, max HP / health regen
 *   Arcane cluster(12) — bottom, XP gain / pickup radius
 *
 * Node types:
 *   minor    — small stat increments (r=10 in SVG)
 *   notable  — larger thematic bonuses (r=16)
 *   keystone — build-defining trade-offs, one per outer cluster (r=22, diamond shape)
 *
 * Stats use the same keys as PassiveItem:
 *   damageMult, cooldownMult, speedFlat, maxHealthFlat,
 *   healthRegenPerS, pickupRadiusFlat, xpMultiplier,
 *   projectileCountBonus (new in Phase 6)
 *
 * SVG coordinate space: 0 0 900 900, origin top-left.
 */

// ─── Shared stat application helpers ────────────────────────────────────────
// These mirror PassiveItem.apply/remove but also handle projectileCountBonus.

/** Apply stats to a player. Returns a snapshot needed for reversal. */
export function applyStats(player, stats) {
  const snap = {};

  if (stats.damageMult !== undefined) {
    for (const w of player.autoSkills) w.damage = Math.round(w.damage * stats.damageMult);
    snap.damageMult = stats.damageMult;
  }
  if (stats.cooldownMult !== undefined) {
    for (const w of player.autoSkills) w.cooldown *= stats.cooldownMult;
    snap.cooldownMult = stats.cooldownMult;
  }
  if (stats.speedFlat !== undefined) {
    player.speed += stats.speedFlat;
    snap.speedFlat = stats.speedFlat;
  }
  if (stats.maxHealthFlat !== undefined) {
    player.maxHealth += stats.maxHealthFlat;
    // Only grant HP when the bonus is positive; negative ones just lower the ceiling.
    if (stats.maxHealthFlat > 0) {
      player.health = Math.min(player.health + stats.maxHealthFlat, player.maxHealth);
    } else {
      player.health = Math.min(player.health, player.maxHealth);
    }
    snap.maxHealthFlat = stats.maxHealthFlat;
  }
  if (stats.healthRegenPerS !== undefined) {
    player.healthRegenPerS = (player.healthRegenPerS ?? 0) + stats.healthRegenPerS;
    snap.healthRegenPerS = stats.healthRegenPerS;
  }
  if (stats.pickupRadiusFlat !== undefined) {
    player.pickupRadiusBonus = (player.pickupRadiusBonus ?? 0) + stats.pickupRadiusFlat;
    snap.pickupRadiusFlat = stats.pickupRadiusFlat;
  }
  if (stats.xpMultiplier !== undefined) {
    player.xpMultiplier = (player.xpMultiplier ?? 1) * stats.xpMultiplier;
    snap.xpMultiplier = stats.xpMultiplier;
  }
  if (stats.projectileCountBonus !== undefined) {
    player.projectileCountBonus = (player.projectileCountBonus ?? 0) + stats.projectileCountBonus;
    snap.projectileCountBonus = stats.projectileCountBonus;
  }
  return snap;
}

/** Reverse a previous applyStats call using its returned snapshot. */
export function removeStats(player, snapshot) {
  if (snapshot.damageMult !== undefined) {
    for (const w of player.autoSkills) w.damage = Math.round(w.damage / snapshot.damageMult);
  }
  if (snapshot.cooldownMult !== undefined) {
    for (const w of player.autoSkills) w.cooldown /= snapshot.cooldownMult;
  }
  if (snapshot.speedFlat !== undefined) player.speed -= snapshot.speedFlat;
  if (snapshot.maxHealthFlat !== undefined) {
    player.maxHealth -= snapshot.maxHealthFlat;
    player.health = Math.min(player.health, player.maxHealth);
  }
  if (snapshot.healthRegenPerS !== undefined) {
    player.healthRegenPerS = (player.healthRegenPerS ?? 0) - snapshot.healthRegenPerS;
  }
  if (snapshot.pickupRadiusFlat !== undefined) {
    player.pickupRadiusBonus = Math.max(0, (player.pickupRadiusBonus ?? 0) - snapshot.pickupRadiusFlat);
  }
  if (snapshot.xpMultiplier !== undefined) {
    player.xpMultiplier = (player.xpMultiplier ?? 1) / snapshot.xpMultiplier;
  }
  if (snapshot.projectileCountBonus !== undefined) {
    player.projectileCountBonus = Math.max(0, (player.projectileCountBonus ?? 0) - snapshot.projectileCountBonus);
  }
}

// ─── Tree node definitions ───────────────────────────────────────────────────

export const PASSIVE_TREE_NODES = [

  // ══════════════════════════════════════════════════════════════════════════
  // STARTING HUB  (1 + 8 = 9 nodes)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'start',
    label: "Exile's Path",
    description: "The beginning of your journey. The first step into the dark.",
    type: 'minor',
    position: { x: 450, y: 450 },
    connections: ['s1', 's2', 's3', 's4', 's5', 's6'],
    stats: {},
  },
  {
    id: 's1',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 450, y: 375 },
    connections: ['start', 's7', 'sp_entry'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 's2',
    label: '+8 Speed',
    description: '8 increased movement speed.',
    type: 'minor',
    position: { x: 510, y: 405 },
    connections: ['start', 's7', 's8'],
    stats: { speedFlat: 8 },
  },
  {
    id: 's3',
    label: '+10 Life',
    description: '10 to maximum life.',
    type: 'minor',
    position: { x: 515, y: 460 },
    connections: ['start', 's8'],
    stats: { maxHealthFlat: 10 },
  },
  {
    id: 's4',
    label: '+5% Experience',
    description: '5% increased experience gained.',
    type: 'minor',
    position: { x: 450, y: 510 },
    connections: ['start', 'ar_entry'],
    stats: { xpMultiplier: 1.05 },
  },
  {
    id: 's5',
    label: '+15 Pickup Radius',
    description: '15 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 390, y: 475 },
    connections: ['start', 'tn_entry'],
    stats: { pickupRadiusFlat: 15 },
  },
  {
    id: 's6',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 385, y: 420 },
    connections: ['start', 'tn_entry'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 's7',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 450, y: 350 },
    connections: ['s1', 's2'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 's8',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 570, y: 432 },
    connections: ['s2', 's3', 'pw_entry'],
    stats: { damageMult: 1.05 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POWER CLUSTER — right side  (14 nodes including keystone)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'pw_entry',
    label: '+8% Damage',
    description: '8% increased weapon damage.',
    type: 'minor',
    position: { x: 620, y: 420 },
    connections: ['s8', 'pw1', 'pw2'],
    stats: { damageMult: 1.08 },
  },
  {
    id: 'pw1',
    label: '+8% Damage',
    description: '8% increased weapon damage.',
    type: 'minor',
    position: { x: 655, y: 368 },
    connections: ['pw_entry', 'pw3', 'pw4'],
    stats: { damageMult: 1.08 },
  },
  {
    id: 'pw2',
    label: '−6% Cooldown',
    description: '6% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 655, y: 450 },
    connections: ['pw_entry', 'pw4', 'pw_n1'],
    stats: { cooldownMult: 0.94 },
  },
  {
    id: 'pw3',
    label: '+8% Damage',
    description: '8% increased weapon damage.',
    type: 'minor',
    position: { x: 690, y: 325 },
    connections: ['pw1', 'pw5'],
    stats: { damageMult: 1.08 },
  },
  {
    id: 'pw4',
    label: '−6% Cooldown',
    description: '6% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 700, y: 400 },
    connections: ['pw1', 'pw2', 'pw5', 'pw6'],
    stats: { cooldownMult: 0.94 },
  },
  {
    id: 'pw_n1',
    label: 'Overwhelming Force',
    description: '20% increased weapon damage. Crush them before they can react.',
    type: 'notable',
    position: { x: 668, y: 490 },
    connections: ['pw2', 'pw4', 'pw_n2'],
    stats: { damageMult: 1.20 },
  },
  {
    id: 'pw5',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 728, y: 348 },
    connections: ['pw3', 'pw4', 'pw7'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'pw6',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 738, y: 420 },
    connections: ['pw4', 'pw_n2', 'pw7', 'pw8'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 'pw_n2',
    label: 'Alacrity',
    description: '16% reduced weapon cooldown. Strike with precision and frequency.',
    type: 'notable',
    position: { x: 710, y: 488 },
    connections: ['pw_n1', 'pw6'],
    stats: { cooldownMult: 0.84 },
  },
  {
    id: 'pw7',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 763, y: 358 },
    connections: ['pw5', 'pw6', 'pw_n3'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'pw8',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 768, y: 438 },
    connections: ['pw6', 'pw_n3'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'pw_n3',
    label: 'Barrage Mode',
    description: 'Fire one additional projectile from all applicable weapons. Aligned in a slight spread.',
    type: 'notable',
    position: { x: 770, y: 392 },
    connections: ['pw7', 'pw8', 'pw9'],
    stats: { projectileCountBonus: 1 },
  },
  {
    id: 'pw9',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 808, y: 383 },
    connections: ['pw_n3', 'pw_ks'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'pw_ks',
    label: 'Bloodrage',
    description: '+80% weapon damage, but −50 maximum life. Power demands sacrifice.',
    type: 'keystone',
    position: { x: 848, y: 375 },
    connections: ['pw9'],
    stats: { damageMult: 1.80, maxHealthFlat: -50 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SPEED CLUSTER — top  (13 nodes including keystone)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'sp_entry',
    label: '+10 Speed',
    description: '10 increased movement speed.',
    type: 'minor',
    position: { x: 435, y: 300 },
    connections: ['s1', 's7', 'sp1', 'sp2'],
    stats: { speedFlat: 10 },
  },
  {
    id: 'sp1',
    label: '+10 Speed',
    description: '10 increased movement speed.',
    type: 'minor',
    position: { x: 375, y: 255 },
    connections: ['sp_entry', 'sp4', 'sp5'],
    stats: { speedFlat: 10 },
  },
  {
    id: 'sp2',
    label: '−6% Cooldown',
    description: '6% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 460, y: 248 },
    connections: ['sp_entry', 'sp5', 'sp6'],
    stats: { cooldownMult: 0.94 },
  },
  {
    id: 'sp3',
    label: '+10 Speed',
    description: '10 increased movement speed.',
    type: 'minor',
    position: { x: 528, y: 260 },
    connections: ['sp2', 'sp6'],
    stats: { speedFlat: 10 },
  },
  {
    id: 'sp4',
    label: '+8 Speed',
    description: '8 increased movement speed.',
    type: 'minor',
    position: { x: 340, y: 205 },
    connections: ['sp1', 'sp_n1'],
    stats: { speedFlat: 8 },
  },
  {
    id: 'sp5',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 427, y: 198 },
    connections: ['sp1', 'sp2', 'sp_n2'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 'sp6',
    label: '+8 Speed',
    description: '8 increased movement speed.',
    type: 'minor',
    position: { x: 515, y: 198 },
    connections: ['sp2', 'sp3', 'sp_n3'],
    stats: { speedFlat: 8 },
  },
  {
    id: 'sp_n1',
    label: 'Phase Run',
    description: '+20 movement speed. Nothing can stop the exile in motion.',
    type: 'notable',
    position: { x: 330, y: 165 },
    connections: ['sp4', 'sp7'],
    stats: { speedFlat: 20 },
  },
  {
    id: 'sp_n2',
    label: 'Windrunner',
    description: '20% reduced all weapon cooldowns. Faster. Always faster.',
    type: 'notable',
    position: { x: 448, y: 158 },
    connections: ['sp5', 'sp7', 'sp8'],
    stats: { cooldownMult: 0.80 },
  },
  {
    id: 'sp_n3',
    label: 'Fleet-Footed',
    description: '+25 movement speed and +15 pickup radius. Every step counts.',
    type: 'notable',
    position: { x: 565, y: 165 },
    connections: ['sp6', 'sp8'],
    stats: { speedFlat: 25, pickupRadiusFlat: 15 },
  },
  {
    id: 'sp7',
    label: '+8 Speed',
    description: '8 increased movement speed.',
    type: 'minor',
    position: { x: 388, y: 128 },
    connections: ['sp_n1', 'sp_n2', 'sp_ks'],
    stats: { speedFlat: 8 },
  },
  {
    id: 'sp8',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 510, y: 128 },
    connections: ['sp_n2', 'sp_n3', 'sp_ks'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 'sp_ks',
    label: 'Elusive',
    description: '+50 movement speed, but −40 maximum life. Evasion demands fragility.',
    type: 'keystone',
    position: { x: 450, y: 95 },
    connections: ['sp7', 'sp8'],
    stats: { speedFlat: 50, maxHealthFlat: -40 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANK CLUSTER — left side  (12 nodes including keystone)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'tn_entry',
    label: '+12 Life',
    description: '12 to maximum life.',
    type: 'minor',
    position: { x: 318, y: 420 },
    connections: ['s5', 's6', 'tn1', 'tn2'],
    stats: { maxHealthFlat: 12 },
  },
  {
    id: 'tn1',
    label: '+10 Life',
    description: '10 to maximum life.',
    type: 'minor',
    position: { x: 272, y: 370 },
    connections: ['tn_entry', 'tn3', 'tn4'],
    stats: { maxHealthFlat: 10 },
  },
  {
    id: 'tn2',
    label: '+1.5 Regen',
    description: '1.5 life regenerated per second.',
    type: 'minor',
    position: { x: 258, y: 445 },
    connections: ['tn_entry', 'tn4', 'tn5'],
    stats: { healthRegenPerS: 1.5 },
  },
  {
    id: 'tn3',
    label: '+10 Life',
    description: '10 to maximum life.',
    type: 'minor',
    position: { x: 232, y: 315 },
    connections: ['tn1', 'tn_n1'],
    stats: { maxHealthFlat: 10 },
  },
  {
    id: 'tn4',
    label: '+1.5 Regen',
    description: '1.5 life regenerated per second.',
    type: 'minor',
    position: { x: 218, y: 390 },
    connections: ['tn1', 'tn2', 'tn_n1', 'tn_n2'],
    stats: { healthRegenPerS: 1.5 },
  },
  {
    id: 'tn5',
    label: '+8 Life',
    description: '8 to maximum life.',
    type: 'minor',
    position: { x: 215, y: 458 },
    connections: ['tn2', 'tn4', 'tn_n2', 'tn_n3'],
    stats: { maxHealthFlat: 8 },
  },
  {
    id: 'tn_n1',
    label: 'Iron Fortress',
    description: '+30 maximum life. Built to endure.',
    type: 'notable',
    position: { x: 190, y: 318 },
    connections: ['tn3', 'tn4', 'tn6'],
    stats: { maxHealthFlat: 30 },
  },
  {
    id: 'tn_n2',
    label: 'Life Tap',
    description: '+3 HP regenerated per second. The body heals itself.',
    type: 'notable',
    position: { x: 175, y: 402 },
    connections: ['tn4', 'tn5', 'tn6', 'tn7'],
    stats: { healthRegenPerS: 3 },
  },
  {
    id: 'tn_n3',
    label: 'Bastion',
    description: '+25 maximum life and +2 HP regenerated per second. Immovable.',
    type: 'notable',
    position: { x: 178, y: 468 },
    connections: ['tn5', 'tn_n2', 'tn7'],
    stats: { maxHealthFlat: 25, healthRegenPerS: 2 },
  },
  {
    id: 'tn6',
    label: '+8 Life',
    description: '8 to maximum life.',
    type: 'minor',
    position: { x: 148, y: 340 },
    connections: ['tn_n1', 'tn_n2', 'tn_ks'],
    stats: { maxHealthFlat: 8 },
  },
  {
    id: 'tn7',
    label: '+1.5 Regen',
    description: '1.5 life regenerated per second.',
    type: 'minor',
    position: { x: 140, y: 425 },
    connections: ['tn_n2', 'tn_n3', 'tn_ks'],
    stats: { healthRegenPerS: 1.5 },
  },
  {
    id: 'tn_ks',
    label: 'Immortal Ambition',
    description: '+150 maximum life, but 30% reduced weapon damage. Safety at great cost.',
    type: 'keystone',
    position: { x: 110, y: 385 },
    connections: ['tn6', 'tn7'],
    stats: { maxHealthFlat: 150, damageMult: 0.70 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ARCANE CLUSTER — bottom  (12 nodes including keystone)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'ar_entry',
    label: '+8% Experience',
    description: '8% increased experience gained.',
    type: 'minor',
    position: { x: 460, y: 562 },
    connections: ['s4', 'ar1', 'ar2'],
    stats: { xpMultiplier: 1.08 },
  },
  {
    id: 'ar1',
    label: '+15 Pickup Radius',
    description: '15 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 398, y: 600 },
    connections: ['ar_entry', 'ar3', 'ar4'],
    stats: { pickupRadiusFlat: 15 },
  },
  {
    id: 'ar2',
    label: '+5% Experience',
    description: '5% increased experience gained.',
    type: 'minor',
    position: { x: 515, y: 600 },
    connections: ['ar_entry', 'ar4', 'ar5'],
    stats: { xpMultiplier: 1.05 },
  },
  {
    id: 'ar3',
    label: '+12 Pickup Radius',
    description: '12 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 365, y: 645 },
    connections: ['ar1', 'ar_n1'],
    stats: { pickupRadiusFlat: 12 },
  },
  {
    id: 'ar4',
    label: '+5% Experience',
    description: '5% increased experience gained.',
    type: 'minor',
    position: { x: 450, y: 650 },
    connections: ['ar1', 'ar2', 'ar_n1', 'ar_n2'],
    stats: { xpMultiplier: 1.05 },
  },
  {
    id: 'ar5',
    label: '+12 Pickup Radius',
    description: '12 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 530, y: 645 },
    connections: ['ar2', 'ar_n2', 'ar_n3'],
    stats: { pickupRadiusFlat: 12 },
  },
  {
    id: 'ar_n1',
    label: 'Arcane Surge',
    description: '+25% experience gained. The arcane flows freely through you.',
    type: 'notable',
    position: { x: 360, y: 692 },
    connections: ['ar3', 'ar4', 'ar6'],
    stats: { xpMultiplier: 1.25 },
  },
  {
    id: 'ar_n2',
    label: 'Gem Hoarder',
    description: '+50 gem and item pickup radius. Nothing escapes your reach.',
    type: 'notable',
    position: { x: 460, y: 702 },
    connections: ['ar4', 'ar5', 'ar6', 'ar7'],
    stats: { pickupRadiusFlat: 50 },
  },
  {
    id: 'ar_n3',
    label: 'Soul Siphon',
    description: '+18% experience gained and +30 pickup radius. Take everything.',
    type: 'notable',
    position: { x: 552, y: 692 },
    connections: ['ar5', 'ar_n2', 'ar7'],
    stats: { xpMultiplier: 1.18, pickupRadiusFlat: 30 },
  },
  {
    id: 'ar6',
    label: '+5% Experience',
    description: '5% increased experience gained.',
    type: 'minor',
    position: { x: 390, y: 738 },
    connections: ['ar_n1', 'ar_n2', 'ar_ks'],
    stats: { xpMultiplier: 1.05 },
  },
  {
    id: 'ar7',
    label: '+15 Pickup Radius',
    description: '15 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 512, y: 738 },
    connections: ['ar_n2', 'ar_n3', 'ar_ks'],
    stats: { pickupRadiusFlat: 15 },
  },
  {
    id: 'ar_ks',
    label: 'Void Pact',
    description: '+100% experience gained, but lose 3 HP per second. Knowledge has its price.',
    type: 'keystone',
    position: { x: 450, y: 782 },
    connections: ['ar6', 'ar7'],
    stats: { xpMultiplier: 2.0, healthRegenPerS: -3 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ARCANE MASTERY CLUSTER — upper-right  (12 nodes including keystone)
  // Focuses on projectile count, damage, and cooldown for spell builds.
  // Entry connects from Power cluster node pw3.
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'am_entry',
    label: '+6% Damage',
    description: '6% increased weapon damage.',
    type: 'minor',
    position: { x: 730, y: 295 },
    connections: ['pw3', 'am1', 'am2'],
    stats: { damageMult: 1.06 },
  },
  {
    id: 'am1',
    label: '+7% Damage',
    description: '7% increased weapon damage.',
    type: 'minor',
    position: { x: 768, y: 258 },
    connections: ['am_entry', 'am3', 'am4'],
    stats: { damageMult: 1.07 },
  },
  {
    id: 'am2',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 695, y: 248 },
    connections: ['am_entry', 'am4', 'am5'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 'am3',
    label: '+7% Damage',
    description: '7% increased weapon damage.',
    type: 'minor',
    position: { x: 808, y: 218 },
    connections: ['am1', 'am_n1'],
    stats: { damageMult: 1.07 },
  },
  {
    id: 'am4',
    label: '+1 Projectile',
    description: 'Fire one additional projectile from all applicable weapons.',
    type: 'minor',
    position: { x: 748, y: 205 },
    connections: ['am1', 'am2', 'am_n1', 'am_n2'],
    stats: { projectileCountBonus: 1 },
  },
  {
    id: 'am5',
    label: '−5% Cooldown',
    description: '5% reduced weapon cooldown.',
    type: 'minor',
    position: { x: 690, y: 162 },
    connections: ['am2', 'am_n2'],
    stats: { cooldownMult: 0.95 },
  },
  {
    id: 'am_n1',
    label: 'Arcane Mastery',
    description: '+22% weapon damage. Your spells carry the weight of mastered arcana.',
    type: 'notable',
    position: { x: 838, y: 182 },
    connections: ['am3', 'am4', 'am6'],
    stats: { damageMult: 1.22 },
  },
  {
    id: 'am_n2',
    label: 'Spellhaste',
    description: '−18% weapon cooldown. Spells flow like breath.',
    type: 'notable',
    position: { x: 762, y: 162 },
    connections: ['am4', 'am5', 'am6', 'am7'],
    stats: { cooldownMult: 0.82 },
  },
  {
    id: 'am6',
    label: '+5% Damage',
    description: '5% increased weapon damage.',
    type: 'minor',
    position: { x: 835, y: 132 },
    connections: ['am_n1', 'am_n2', 'am_ks'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'am7',
    label: '+1 Projectile',
    description: 'Fire one additional projectile from all applicable weapons.',
    type: 'minor',
    position: { x: 755, y: 118 },
    connections: ['am_n2', 'am_n3', 'am_ks'],
    stats: { projectileCountBonus: 1 },
  },
  {
    id: 'am_n3',
    label: 'Echoing Bolts',
    description: '+15% weapon damage and +1 additional projectile. The air crackles with replicated force.',
    type: 'notable',
    position: { x: 692, y: 115 },
    connections: ['am7'],
    stats: { damageMult: 1.15, projectileCountBonus: 1 },
  },
  {
    id: 'am_ks',
    label: 'Spellweave',
    description: 'Fire +2 additional projectiles from all applicable weapons, but −20% weapon damage.',
    type: 'keystone',
    position: { x: 800, y: 80 },
    connections: ['am6', 'am7'],
    stats: { projectileCountBonus: 2, damageMult: 0.80 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BLOOD RITE CLUSTER — lower-left  (10 nodes including keystone)
  // Focuses on life leech, regen, and sustain for aggressive melee builds.
  // Entry connects from Tank cluster node tn7.
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'br_entry',
    label: '+10 Life',
    description: '10 to maximum life.',
    type: 'minor',
    position: { x: 122, y: 468 },
    connections: ['tn7', 'br1', 'br2'],
    stats: { maxHealthFlat: 10 },
  },
  {
    id: 'br1',
    label: '+2 Regen',
    description: '2 life regenerated per second.',
    type: 'minor',
    position: { x: 88, y: 520 },
    connections: ['br_entry', 'br3', 'br4'],
    stats: { healthRegenPerS: 2 },
  },
  {
    id: 'br2',
    label: '+12 Life',
    description: '12 to maximum life.',
    type: 'minor',
    position: { x: 158, y: 522 },
    connections: ['br_entry', 'br4', 'br_n1'],
    stats: { maxHealthFlat: 12 },
  },
  {
    id: 'br3',
    label: '+2 Regen',
    description: '2 life regenerated per second.',
    type: 'minor',
    position: { x: 68, y: 572 },
    connections: ['br1', 'br_n2'],
    stats: { healthRegenPerS: 2 },
  },
  {
    id: 'br4',
    label: '+10 Life',
    description: '10 to maximum life.',
    type: 'minor',
    position: { x: 128, y: 562 },
    connections: ['br1', 'br2', 'br_n1', 'br_n2'],
    stats: { maxHealthFlat: 10 },
  },
  {
    id: 'br_n1',
    label: 'Crimson Feast',
    description: '+35 maximum life. Your veins sing with vital force.',
    type: 'notable',
    position: { x: 162, y: 608 },
    connections: ['br2', 'br4', 'br5'],
    stats: { maxHealthFlat: 35 },
  },
  {
    id: 'br_n2',
    label: 'Sanguine Vigour',
    description: '+5 HP regenerated per second. Wounds close before they are felt.',
    type: 'notable',
    position: { x: 76, y: 622 },
    connections: ['br3', 'br4', 'br5'],
    stats: { healthRegenPerS: 5 },
  },
  {
    id: 'br5',
    label: '+12 Life',
    description: '12 to maximum life.',
    type: 'minor',
    position: { x: 122, y: 668 },
    connections: ['br_n1', 'br_n2', 'br_ks'],
    stats: { maxHealthFlat: 12 },
  },
  {
    id: 'br6',
    label: '+2 Regen',
    description: '2 life regenerated per second.',
    type: 'minor',
    position: { x: 78, y: 712 },
    connections: ['br5', 'br_ks'],
    stats: { healthRegenPerS: 2 },
  },
  {
    id: 'br_ks',
    label: 'Bloodlust',
    description: '+100 maximum life and +8 HP regen/s, but −20% movement speed. Power through pain.',
    type: 'keystone',
    position: { x: 108, y: 755 },
    connections: ['br5', 'br6'],
    stats: { maxHealthFlat: 100, healthRegenPerS: 8, speedFlat: -30 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FORTUNE'S EDGE CLUSTER — lower-right  (8 nodes including keystone)
  // Focuses on XP gain, item quality, and pickup radius.  Entry connects
  // from Arcane cluster node ar_n3.
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'fe_entry',
    label: '+8% Experience',
    description: '8% increased experience gained.',
    type: 'minor',
    position: { x: 608, y: 718 },
    connections: ['ar_n3', 'fe1', 'fe2'],
    stats: { xpMultiplier: 1.08 },
  },
  {
    id: 'fe1',
    label: '+20 Pickup Radius',
    description: '20 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 655, y: 750 },
    connections: ['fe_entry', 'fe_n1'],
    stats: { pickupRadiusFlat: 20 },
  },
  {
    id: 'fe2',
    label: '+8% Experience',
    description: '8% increased experience gained.',
    type: 'minor',
    position: { x: 608, y: 778 },
    connections: ['fe_entry', 'fe_n1', 'fe_n2'],
    stats: { xpMultiplier: 1.08 },
  },
  {
    id: 'fe_n1',
    label: 'Windfall',
    description: '+30% experience gained. Fortune favours the bold exile.',
    type: 'notable',
    position: { x: 700, y: 775 },
    connections: ['fe1', 'fe2', 'fe3', 'fe4'],
    stats: { xpMultiplier: 1.30 },
  },
  {
    id: 'fe3',
    label: '+25 Pickup Radius',
    description: '25 to item and gem pickup radius.',
    type: 'minor',
    position: { x: 742, y: 812 },
    connections: ['fe_n1', 'fe_ks'],
    stats: { pickupRadiusFlat: 25 },
  },
  {
    id: 'fe4',
    label: '+8% Experience',
    description: '8% increased experience gained.',
    type: 'minor',
    position: { x: 660, y: 822 },
    connections: ['fe_n1', 'fe_n2', 'fe_ks'],
    stats: { xpMultiplier: 1.08 },
  },
  {
    id: 'fe_n2',
    label: 'Prospector\'s Luck',
    description: '+20% experience gained and +30 pickup radius. Everything of value is within reach.',
    type: 'notable',
    position: { x: 602, y: 835 },
    connections: ['fe2', 'fe4'],
    stats: { xpMultiplier: 1.20, pickupRadiusFlat: 30 },
  },
  {
    id: 'fe_ks',
    label: 'Treasure Sense',
    description: '+80% experience gained and +100 pickup radius, but −15% weapon damage. Knowledge over brawn.',
    type: 'keystone',
    position: { x: 710, y: 858 },
    connections: ['fe3', 'fe4'],
    stats: { xpMultiplier: 1.80, pickupRadiusFlat: 100, damageMult: 0.85 },
  },
];

/** Quick O(1) lookup by node id. */
export const TREE_NODE_MAP = Object.fromEntries(PASSIVE_TREE_NODES.map((n) => [n.id, n]));

/**
 * Build a de-duplicated edge list from the bidirectional connections in the tree.
 * Each edge is { a: id, b: id } appearing exactly once.
 */
export const TREE_EDGES = (() => {
  const edges = [];
  const seen = new Set();
  for (const node of PASSIVE_TREE_NODES) {
    for (const connId of node.connections) {
      const key = [node.id, connId].sort().join('||');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: node.id, b: connId });
      }
    }
  }
  return edges;
})();

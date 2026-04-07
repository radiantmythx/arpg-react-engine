/**
 * skillTags.js — Phase 12.1
 *
 * Defines the canonical tag system used by every active skill and auto-fire
 * weapon.  Tags drive three orthogonal systems:
 *   1. Support gem compatibility (which supports can be socketed)
 *   2. Passive tree scaling (which nodes apply to this skill)
 *   3. Ailment application (which on-hit status effects the skill can inflict)
 */

// ─── Domain Tags ─────────────────────────────────────────────────────────────
// What the skill fundamentally *is*.

export const TAGS = Object.freeze({
  // Firing method
  SPELL:       'Spell',       // magical origin; scales with spellDamage
  ATTACK:      'Attack',      // weapon-based; scales with attackDamage
  CHANNELLING: 'Channelling', // fires while held; no cooldown; restricts movement

  // Delivery
  PROJECTILE:  'Projectile',  // fires a moving entity; Pierce/Fork/Chain/GMP compatible
  AOE:         'AoE',         // creates a damage zone; Concentrated Effect compatible
  MELEE:       'Melee',       // close-range; +15% implicit damage at ≤80 px

  // Duration / persistence
  DURATION:    'Duration',    // has a timed component (lingering zone, summon, DoT)

  // Special category
  MOVEMENT:    'Movement',    // repositions the player as part of effect
  MINION:      'Minion',      // creates a temporary allied entity
  TOTEM:       'Totem',       // places a stationary entity that auto-fires the skill
  TRIGGER:     'Trigger',     // activates automatically on a condition

  // Damage type (elemental identity)
  FIRE:        'Fire',        // can apply Ignite
  COLD:        'Cold',        // can apply Chill / Freeze
  LIGHTNING:   'Lightning',   // can apply Shock
  PHYSICAL:    'Physical',    // can apply Bleed
  CHAOS:       'Chaos',       // can apply Poison
});

// ─── Ailment Definitions ─────────────────────────────────────────────────────
// Each damage-type tag maps to zero or more ailments it can inflict on hit.
//
// Fields:
//   baseChance   — default probability of applying the ailment per hit (0–1)
//   duration     — base ailment duration in seconds
//   damageFormula — function(hitDamage) returning the per-second DoT damage
//                   (null for non-DoT ailments)
//   stackable    — whether multiple applications of this ailment stack
//   freezeThreshold — (Freeze only) fraction of enemy maxHP the hit must exceed
//
// The active AilmentSystem (Phase 12.9) reads these defs when resolving hits.

export const AILMENT_DEFS = Object.freeze({

  // ─── Fire → Ignite ───────────────────────────────────────────────────────
  Ignite: {
    tag:            TAGS.FIRE,
    baseChance:     0.20,           // 20% chance per hit
    duration:       4,              // 4 s burn
    stackable:      false,          // only one ignite instance active at a time; re-applying refreshes
    damageFormula:  (hit) => hit * 0.40,  // 40% of hit damage / second
  },

  // ─── Cold → Chill ────────────────────────────────────────────────────────
  Chill: {
    tag:            TAGS.COLD,
    baseChance:     0.25,           // 25% chance per hit
    duration:       3,              // 3 s slow
    stackable:      false,
    damageFormula:  null,           // no DoT; reduces enemy speedMult
    speedPenalty:   0.30,           // −30% move speed while chilled
  },

  // ─── Cold → Freeze ───────────────────────────────────────────────────────
  // Freeze supersedes Chill.  Applied by a separate chance roll that only
  // succeeds when the hit is large enough relative to the enemy's max HP.
  Freeze: {
    tag:            TAGS.COLD,
    baseChance:     0.08,           // 8% per hit (additionally gated by threshold)
    duration:       1.5,            // 1.5 s full stun
    stackable:      false,
    damageFormula:  null,
    freezeThreshold: 0.15,          // hit must deal ≥ 15% of enemy maxHP in one instance
  },

  // ─── Lightning → Shock ───────────────────────────────────────────────────
  Shock: {
    tag:            TAGS.LIGHTNING,
    baseChance:     0.20,
    duration:       3,
    stackable:      false,
    damageFormula:  null,
    damageTakenMult: 1.40,          // shocked enemies take 40% more damage from all sources
  },

  // ─── Physical → Bleed ────────────────────────────────────────────────────
  // Bleed only deals damage while the enemy is moving (consistent with PoE).
  Bleed: {
    tag:            TAGS.PHYSICAL,
    baseChance:     0.15,
    duration:       5,
    stackable:      true,           // stacks up to 8 applications
    maxStacks:      8,
    damageFormula:  (hit) => hit * 0.70, // 70% of hit damage/second per stack
    requiresMovement: true,
  },

  // ─── Chaos → Poison ──────────────────────────────────────────────────────
  Poison: {
    tag:            TAGS.CHAOS,
    baseChance:     0.10,
    duration:       6,
    stackable:      true,           // unlimited stacks; each is tracked independently
    maxStacks:      Infinity,
    damageFormula:  (hit) => hit * 0.30, // 30% of hit damage/second per stack
  },
});

// ─── Ailment Chance Sources ───────────────────────────────────────────────────
// Helper: given a player stat object and a skill's tags array, compute the
// final ailment chance for each ailment the skill can inflict.
// Returns a map of  ailmentName → finalChance (0–1).

/**
 * @param {string[]} skillTags
 * @param {object}   player          — must have ailmentChanceBonus?: Record<string,number>
 * @returns {Record<string, number>}  e.g. { Ignite: 0.32, Chill: 0.27 }
 */
export function resolveAilmentChances(skillTags, player) {
  const result = {};
  for (const [ailmentName, def] of Object.entries(AILMENT_DEFS)) {
    if (!skillTags.includes(def.tag)) continue;
    const bonus = player.ailmentChanceBonus?.[ailmentName] ?? 0;
    result[ailmentName] = Math.min(1, def.baseChance + bonus);
  }
  return result;
}

/**
 * Roll ailment chances and apply qualifying ailments to the enemy.
 *
 * @param {string[]} sourceTags  — tags of the skill/weapon that dealt the hit
 * @param {number}   hitDamage   — damage of the triggering hit
 * @param {import('../entities/Enemy.js').Enemy} enemy
 * @param {object}   player      — must have ailmentChanceBonus? field
 */
export function applyAilmentsOnHit(sourceTags, hitDamage, enemy, player) {
  if (!sourceTags || sourceTags.length === 0 || !enemy.active) return;
  const chances = resolveAilmentChances(sourceTags, player ?? {});
  for (const [name, chance] of Object.entries(chances)) {
    if (Math.random() > chance) continue;
    const def = AILMENT_DEFS[name];
    if (!def) continue;
    // Freeze requires a minimum hit magnitude relative to enemy max HP
    if (name === 'Freeze' && hitDamage < def.freezeThreshold * enemy.maxHealth) continue;
    enemy.applyAilment(name, hitDamage, def);
  }
}

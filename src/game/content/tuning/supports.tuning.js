export const SUPPORT_TUNING = {
  // Baseline multiplier applied when a support does not have a specific override.
  defaultManaCostMultiplier: 1.18,

  // Rationale:
  // - Throughput supports (extra projectiles/chains/repeats): highest multipliers.
  // - Area/duration transforms: medium multipliers.
  // - Sustain/utility supports: lower multipliers to stay playable early.
  // - Ailment amplifiers: medium-high, because they scale very well over time.

  // Per-support overrides for mana cost multipliers.
  manaCostMultiplierBySupportId: {
    // Projectile throughput
    pierce: 1.12,
    fork: 1.28,
    chain: 1.32,
    gmp: 1.42,
    faster_projectiles: 1.15,

    // Cast pattern / burst
    spell_echo: 1.36,
    spell_cascade: 1.3,
    controlled_destruction: 1.22,

    // Area shaping
    concentrated_effect: 1.18,
    increased_aoe: 1.16,

    // Flat added damage / conversion-like utility
    added_blaze: 1.14,
    added_frost: 1.14,
    added_thunder: 1.14,
    added_unholy: 1.14,
    life_tap: 1.08,

    // Ailment scaling
    deadly_ailments: 1.22,
    swift_affliction: 1.16,
    hypothermia: 1.16,
    vile_toxins: 1.22,
    burning_damage: 1.16,

    // Sustain / utility
    life_leech: 1.1,
    culling_strike: 1.1,
    momentum: 1.15,

    // Delivery / duration transforms
    trap: 1.2,
    increased_duration: 1.1,
    less_duration: 1.1,
  },

  // Reserved for future aura/reservation systems.
  defaultReservationMultiplier: 1.1,
};
/**
 * PassiveItem
 * A stat-stick equipment item that occupies one of the player's three gear slots.
 *
 * Stats are applied on equip and reversed on unequip using a snapshot of the
 * exact deltas that were written, so even stacked multipliers unwind correctly.
 *
 * Stats supported:
 *   damageMult      — multiplies all weapon damage   (e.g. 1.25 → +25%)
 *   speedFlat       — adds flat px/s to player speed  (e.g. 30)
 *   maxHealthFlat   — adds flat max HP                (e.g. 50)
 *   healthRegenPerS — HP restored per second          (e.g. 3)
 *   cooldownMult    — multiplies weapon cooldowns      (e.g. 0.85 → −15%)
 *   pickupRadiusFlat— adds flat px to pickup radius    (e.g. 40)
 *   xpMultiplier    — multiplies XP gained             (e.g. 1.3 → +30%)
 *   maxManaFlat     — adds flat max mana               (e.g. 45)
 *   manaRegenPerS   — mana restored per second         (e.g. 4)
 *   manaCostMult    — multiplies mana costs            (e.g. 0.9 → −10%)
 *   armorFlat       — adds flat armor (damage reduction) (e.g. 40)
 *   evasionFlat     — adds flat evasion (dodge chance)   (e.g. 45)
 *   energyShieldFlat— adds flat energy shield pool       (e.g. 25)
 */
export class PassiveItem {
  /**
   * @param {{ id, name, description, slot, color, stats }} config
   *   slot  — 'weapon' | 'armor' | 'jewelry'
   *   stats — { statKey: value, ... }
   */
  constructor(config) {
    this.id          = config.id;
    this.name        = config.name;
    this.description = config.description;
    this.slot        = config.slot;
    this.color       = config.color;
    this.stats       = config.stats;
  }

  /**
   * Apply this item's stats to the player.
   * Returns a snapshot object that must be passed to remove() to undo the effect.
   * @param {import('../entities/Player.js').Player} player
   * @returns {object} appliedSnapshot
   */
  apply(player) {
    const snapshot = {};
    const { stats } = this;

    if (stats.damageMult !== undefined) {
      for (const w of player.autoSkills) {
        w.damage = Math.round(w.damage * stats.damageMult);
      }
      snapshot.damageMult = stats.damageMult;
    }
    if (stats.cooldownMult !== undefined) {
      for (const w of player.autoSkills) {
        w.cooldown *= stats.cooldownMult;
      }
      snapshot.cooldownMult = stats.cooldownMult;
    }
    if (stats.speedFlat !== undefined) {
      player.speed += stats.speedFlat;
      snapshot.speedFlat = stats.speedFlat;
    }
    if (stats.maxHealthFlat !== undefined) {
      player.maxHealth += stats.maxHealthFlat;
      player.health = Math.min(player.health + stats.maxHealthFlat, player.maxHealth);
      snapshot.maxHealthFlat = stats.maxHealthFlat;
    }
    if (stats.healthRegenPerS !== undefined) {
      player.healthRegenPerS = (player.healthRegenPerS ?? 0) + stats.healthRegenPerS;
      snapshot.healthRegenPerS = stats.healthRegenPerS;
    }
    if (stats.pickupRadiusFlat !== undefined) {
      player.pickupRadiusBonus = (player.pickupRadiusBonus ?? 0) + stats.pickupRadiusFlat;
      snapshot.pickupRadiusFlat = stats.pickupRadiusFlat;
    }
    if (stats.xpMultiplier !== undefined) {
      player.xpMultiplier = (player.xpMultiplier ?? 1) * stats.xpMultiplier;
      snapshot.xpMultiplier = stats.xpMultiplier;
    }
    if (stats.maxManaFlat !== undefined) {
      player.maxMana = (player.maxMana ?? 0) + stats.maxManaFlat;
      if (stats.maxManaFlat > 0) {
        player.mana = Math.min((player.mana ?? 0) + stats.maxManaFlat, player.maxMana);
      } else {
        player.mana = Math.min(player.mana ?? 0, player.maxMana);
      }
      snapshot.maxManaFlat = stats.maxManaFlat;
    }
    if (stats.manaRegenPerS !== undefined) {
      player.manaRegenPerS = (player.manaRegenPerS ?? 0) + stats.manaRegenPerS;
      snapshot.manaRegenPerS = stats.manaRegenPerS;
    }
    if (stats.manaCostMult !== undefined) {
      player.manaCostMult = (player.manaCostMult ?? 1) * stats.manaCostMult;
      snapshot.manaCostMult = stats.manaCostMult;
    }
    if (stats.armorFlat !== undefined) {
      player.totalArmor = (player.totalArmor ?? 0) + stats.armorFlat;
      snapshot.armorFlat = stats.armorFlat;
    }
    if (stats.evasionFlat !== undefined) {
      player.totalEvasion = (player.totalEvasion ?? 0) + stats.evasionFlat;
      snapshot.evasionFlat = stats.evasionFlat;
    }
    if (stats.energyShieldFlat !== undefined) {
      player.maxEnergyShield = (player.maxEnergyShield ?? 0) + stats.energyShieldFlat;
      player.energyShield = Math.min(
        player.energyShield + stats.energyShieldFlat,
        player.maxEnergyShield,
      );
      snapshot.energyShieldFlat = stats.energyShieldFlat;
    }
    if (stats.potionChargeGainMult !== undefined) {
      player.potionChargeGainMult = (player.potionChargeGainMult ?? 1) * stats.potionChargeGainMult;
      snapshot.potionChargeGainMult = stats.potionChargeGainMult;
    }
    if (stats.potionChargeGainFlat !== undefined) {
      player.potionChargeGainFlat = (player.potionChargeGainFlat ?? 0) + stats.potionChargeGainFlat;
      snapshot.potionChargeGainFlat = stats.potionChargeGainFlat;
    }
    if (stats.potionChargeRegenPerS !== undefined) {
      player.potionChargeRegenPerS = (player.potionChargeRegenPerS ?? 0) + stats.potionChargeRegenPerS;
      snapshot.potionChargeRegenPerS = stats.potionChargeRegenPerS;
    }
    if (stats.potionDurationMult !== undefined) {
      player.potionDurationMult = (player.potionDurationMult ?? 1) * stats.potionDurationMult;
      snapshot.potionDurationMult = stats.potionDurationMult;
    }
    if (stats.potionEffectMult !== undefined) {
      player.potionEffectMult = (player.potionEffectMult ?? 1) * stats.potionEffectMult;
      snapshot.potionEffectMult = stats.potionEffectMult;
    }
    if (stats.potionMaxChargesMult !== undefined) {
      player.potionMaxChargesMult = (player.potionMaxChargesMult ?? 1) * stats.potionMaxChargesMult;
      snapshot.potionMaxChargesMult = stats.potionMaxChargesMult;
    }
    if (stats.potionChargesPerUseMult !== undefined) {
      player.potionChargesPerUseMult = (player.potionChargesPerUseMult ?? 1) * stats.potionChargesPerUseMult;
      snapshot.potionChargesPerUseMult = stats.potionChargesPerUseMult;
    }

    // ── Elemental damage bonuses (flat / increased / more per type) ──────────
    const ELEM_TYPES = ['Physical', 'Blaze', 'Thunder', 'Frost', 'Holy', 'Unholy'];
    for (const elem of ELEM_TYPES) {
      for (const layer of ['flat', 'increased', 'more']) {
        const key = `${layer}${elem}Damage`;
        if (stats[key] !== undefined) {
          player[key] = (player[key] ?? 0) + stats[key];
          snapshot[key] = stats[key];
        }
      }
    }

    // ── Elemental resistances ─────────────────────────────────────────────────
    for (const elem of ['blaze', 'thunder', 'frost', 'holy', 'unholy']) {
      const key = `${elem}Resistance`;
      if (stats[key] !== undefined) {
        player[key] = (player[key] ?? 0) + stats[key];
        snapshot[key] = stats[key];
      }
    }

    // ── Damage type penetration ──────────────────────────────────────────────
    for (const elem of ['physical', 'blaze', 'thunder', 'frost', 'holy', 'unholy']) {
      const key = `${elem}Penetration`;
      if (stats[key] !== undefined) {
        player[key] = (player[key] ?? 0) + stats[key];
        snapshot[key] = stats[key];
      }
    }

    return snapshot;
  }

  /**
   * Reverse the effects of a previous apply() call.
   * @param {import('../entities/Player.js').Player} player
   * @param {object} snapshot — the value returned by apply()
   */
  remove(player, snapshot) {
    if (snapshot.damageMult !== undefined) {
      for (const w of player.autoSkills) {
        w.damage = Math.round(w.damage / snapshot.damageMult);
      }
    }
    if (snapshot.cooldownMult !== undefined) {
      for (const w of player.autoSkills) {
        w.cooldown /= snapshot.cooldownMult;
      }
    }
    if (snapshot.speedFlat !== undefined) {
      player.speed -= snapshot.speedFlat;
    }
    if (snapshot.maxHealthFlat !== undefined) {
      player.maxHealth -= snapshot.maxHealthFlat;
      player.health = Math.min(player.health, player.maxHealth);
    }
    if (snapshot.healthRegenPerS !== undefined) {
      player.healthRegenPerS = Math.max(0, (player.healthRegenPerS ?? 0) - snapshot.healthRegenPerS);
    }
    if (snapshot.pickupRadiusFlat !== undefined) {
      player.pickupRadiusBonus = Math.max(0, (player.pickupRadiusBonus ?? 0) - snapshot.pickupRadiusFlat);
    }
    if (snapshot.xpMultiplier !== undefined) {
      player.xpMultiplier = (player.xpMultiplier ?? 1) / snapshot.xpMultiplier;
    }
    if (snapshot.maxManaFlat !== undefined) {
      player.maxMana = Math.max(0, (player.maxMana ?? 0) - snapshot.maxManaFlat);
      player.mana = Math.min(player.mana ?? 0, player.maxMana);
    }
    if (snapshot.manaRegenPerS !== undefined) {
      player.manaRegenPerS = Math.max(0, (player.manaRegenPerS ?? 0) - snapshot.manaRegenPerS);
    }
    if (snapshot.manaCostMult !== undefined) {
      player.manaCostMult = Math.max(0.1, (player.manaCostMult ?? 1) / snapshot.manaCostMult);
    }
    if (snapshot.armorFlat !== undefined) {
      player.totalArmor = Math.max(0, (player.totalArmor ?? 0) - snapshot.armorFlat);
    }
    if (snapshot.evasionFlat !== undefined) {
      player.totalEvasion = Math.max(0, (player.totalEvasion ?? 0) - snapshot.evasionFlat);
    }
    if (snapshot.energyShieldFlat !== undefined) {
      player.maxEnergyShield = Math.max(0, (player.maxEnergyShield ?? 0) - snapshot.energyShieldFlat);
      player.energyShield = Math.min(player.energyShield, player.maxEnergyShield);
    }
    if (snapshot.potionChargeGainMult !== undefined) {
      player.potionChargeGainMult = Math.max(0, (player.potionChargeGainMult ?? 1) / snapshot.potionChargeGainMult);
    }
    if (snapshot.potionChargeGainFlat !== undefined) {
      player.potionChargeGainFlat = (player.potionChargeGainFlat ?? 0) - snapshot.potionChargeGainFlat;
    }
    if (snapshot.potionChargeRegenPerS !== undefined) {
      player.potionChargeRegenPerS = (player.potionChargeRegenPerS ?? 0) - snapshot.potionChargeRegenPerS;
    }
    if (snapshot.potionDurationMult !== undefined) {
      player.potionDurationMult = Math.max(0, (player.potionDurationMult ?? 1) / snapshot.potionDurationMult);
    }
    if (snapshot.potionEffectMult !== undefined) {
      player.potionEffectMult = Math.max(0, (player.potionEffectMult ?? 1) / snapshot.potionEffectMult);
    }
    if (snapshot.potionMaxChargesMult !== undefined) {
      player.potionMaxChargesMult = Math.max(0, (player.potionMaxChargesMult ?? 1) / snapshot.potionMaxChargesMult);
    }
    if (snapshot.potionChargesPerUseMult !== undefined) {
      player.potionChargesPerUseMult = Math.max(0, (player.potionChargesPerUseMult ?? 1) / snapshot.potionChargesPerUseMult);
    }

    // ── Elemental damage bonuses ───────────────────────────────────────────
    const ELEM_TYPES = ['Physical', 'Blaze', 'Thunder', 'Frost', 'Holy', 'Unholy'];
    for (const elem of ELEM_TYPES) {
      for (const layer of ['flat', 'increased', 'more']) {
        const key = `${layer}${elem}Damage`;
        if (snapshot[key] !== undefined) {
          player[key] = (player[key] ?? 0) - snapshot[key];
        }
      }
    }

    // ── Elemental resistances ────────────────────────────────────────────────
    for (const elem of ['blaze', 'thunder', 'frost', 'holy', 'unholy']) {
      const key = `${elem}Resistance`;
      if (snapshot[key] !== undefined) {
        player[key] = Math.max(0, (player[key] ?? 0) - snapshot[key]);
      }
    }

    // ── Damage type penetration ──────────────────────────────────────────────
    for (const elem of ['physical', 'blaze', 'thunder', 'frost', 'holy', 'unholy']) {
      const key = `${elem}Penetration`;
      if (snapshot[key] !== undefined) {
        player[key] = (player[key] ?? 0) - snapshot[key];
      }
    }
  }
}

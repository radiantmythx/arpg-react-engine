// STAT KEYS and effect application helpers for passive tree nodes.

export const STAT_KEYS = [
  'maxHealth', 'maxMana', 'maxEnergyShield',
  'healthRegenPerS', 'manaRegenPerS',
  'totalArmor', 'totalEvasion',
  'blazeResistance', 'thunderResistance', 'frostResistance',
  'holyResistance', 'unholyResistance',
  'moveSpeedMult', 'castSpeed', 'attackSpeed', 'manaCostMult',
  'spellDamage', 'attackDamage', 'aoeDamage',
  'flatBlazeDamage', 'flatThunderDamage', 'flatFrostDamage',
  'flatHolyDamage', 'flatUnholyDamage', 'flatPhysicalDamage',
  'increasedBlazeDamage', 'increasedThunderDamage', 'increasedFrostDamage',
  'increasedHolyDamage', 'increasedUnholyDamage', 'increasedPhysicalDamage',
  'blazePenetration', 'thunderPenetration', 'frostPenetration',
  'holyPenetration', 'unholyPenetration', 'physicalPenetration',
  'xpMultiplier', 'pickupRadiusBonus', 'projectileCountBonus',
  'potionEffectMult', 'potionDurationMult', 'potionChargeGainMult',
];

const MULT_KEYS = new Set([
  'castSpeed', 'attackSpeed', 'moveSpeedMult', 'manaCostMult',
  'xpMultiplier', 'potionEffectMult', 'potionDurationMult', 'potionChargeGainMult',
]);

export function applyStats(player, stats) {
  if (!stats || !player) return {};
  const snapshot = {};
  for (const [key, value] of Object.entries(stats)) {
    if (value == null) continue;
    if (MULT_KEYS.has(key)) {
      const before = player[key] ?? 1;
      player[key] = before * (1 + value);
      snapshot[key] = value;
    } else {
      player[key] = (player[key] ?? 0) + value;
      snapshot[key] = value;
    }
    if (key === 'maxHealth') player.health = Math.min(player.health ?? 0, player.maxHealth);
    if (key === 'maxMana') player.mana = Math.min(player.mana ?? 0, player.maxMana);
    if (key === 'maxEnergyShield') player.energyShield = Math.min(player.energyShield ?? 0, player.maxEnergyShield);
  }
  return snapshot;
}

export function removeStats(player, snapshot) {
  if (!snapshot || !player) return;
  for (const [key, value] of Object.entries(snapshot)) {
    if (value == null) continue;
    if (MULT_KEYS.has(key)) {
      player[key] = (player[key] ?? 1) / (1 + value);
    } else {
      player[key] = (player[key] ?? 0) - value;
    }
    if (key === 'maxHealth') player.health = Math.min(player.health ?? 0, Math.max(1, player.maxHealth));
    if (key === 'maxMana') player.mana = Math.min(player.mana ?? 0, Math.max(0, player.maxMana));
    if (key === 'maxEnergyShield') player.energyShield = Math.min(player.energyShield ?? 0, Math.max(0, player.maxEnergyShield));
  }
}

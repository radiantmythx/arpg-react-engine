export const SCOPED_STAT_KEYS = [
  'increasedDamageWithSword',
  'increasedDamageWithAxe',
  'increasedDamageWithBow',
  'increasedDamageWithLance',
  'increasedDamageWithWand',
  'increasedDamageWithTome',
  'increasedDamageWithAttackSkills',
  'increasedDamageWithSpellSkills',
  'increasedDamageWithBowSkills',
  'increasedAttackSpeedWithBow',
  'increasedAttackSpeedWithWand',
  'increasedAttackSpeedWithAttackSkills',
  'increasedCastSpeedWithSpellSkills',
];

export const PASSIVE_STAT_KEYS = [
  'maxHealth', 'maxMana', 'maxEnergyShield',
  'healthRegenPerS', 'manaRegenPerS',
  'totalArmor', 'totalEvasion',
  'meleeStrikeRange',
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
  ...SCOPED_STAT_KEYS,
];

export const ITEM_STAT_KEY_TO_PLAYER_KEY = {
  maxHealthFlat: 'maxHealth',
  maxManaFlat: 'maxMana',
  pickupRadiusFlat: 'pickupRadiusBonus',
  armorFlat: 'totalArmor',
  evasionFlat: 'totalEvasion',
  energyShieldFlat: 'maxEnergyShield',
};

export const ITEM_MULTIPLY_PLAYER_KEYS = new Set([
  'manaCostMult',
  'xpMultiplier',
  'potionChargeGainMult',
  'potionDurationMult',
  'potionEffectMult',
  'potionMaxChargesMult',
  'potionChargesPerUseMult',
]);

const BASE_ITEM_STAT_KEYS = new Set([
  'damageMult',
  'cooldownMult',
  'maxHealthFlat',
  'maxManaFlat',
  'healthRegenPerS',
  'manaRegenPerS',
  'manaCostMult',
  'xpMultiplier',
  'speedFlat',
  'pickupRadiusFlat',
  'meleeStrikeRange',
  'armorFlat',
  'evasionFlat',
  'energyShieldFlat',
  'potionChargeGainMult',
  'potionDurationMult',
  'potionEffectMult',
  'potionMaxChargesMult',
  'potionChargesPerUseMult',
  'flatPhysicalDamage',
  'flatBlazeDamage',
  'flatThunderDamage',
  'flatFrostDamage',
  'flatHolyDamage',
  'flatUnholyDamage',
  'increasedPhysicalDamage',
  'increasedBlazeDamage',
  'increasedThunderDamage',
  'increasedFrostDamage',
  'increasedHolyDamage',
  'increasedUnholyDamage',
  'morePhysicalDamage',
  'moreBlazeDamage',
  'moreThunderDamage',
  'moreFrostDamage',
  'moreHolyDamage',
  'moreUnholyDamage',
  'blazeResistance',
  'thunderResistance',
  'frostResistance',
  'holyResistance',
  'unholyResistance',
  ...SCOPED_STAT_KEYS,
]);

export function isKnownPassiveStatKey(statKey) {
  return PASSIVE_STAT_KEYS.includes(statKey);
}

export function isKnownItemStatKey(statKey) {
  return BASE_ITEM_STAT_KEYS.has(statKey) || isKnownPassiveStatKey(statKey);
}
/**
 * Affix pool — all procedural modifiers that can roll on generated items.
 *
 * Each affix specifies:
 *   id     — unique string
 *   type   — 'prefix' | 'suffix'
 *   slots  — array of slot types this affix is eligible for
 *   stat   — the stat key applied via PassiveItem.apply()
 *   value  — numeric value (multiplier for mult stats, flat addend for additive stats)
 *   label  — human-readable display string shown in the item popup
 *
 * Multiplicative stats: damageMult, cooldownMult, xpMultiplier
 *   value is a multiplier (e.g. 1.10 = +10%)
 *
 * Additive stats: speedFlat, maxHealthFlat, healthRegenPerS, pickupRadiusFlat
 *   value is a flat addend
 */
function inferAffixTier(id = '') {
  if (id.includes('_minor')) return 'minor';
  if (id.includes('_major')) return 'major';
  if (id.includes('_epic')) return 'epic';
  if (id.startsWith('more_')) return 'epic';
  return 'major';
}

function inferGoldValue(id = '', tier = 'major') {
  if (id.includes('_resist_')) {
    if (tier === 'minor') return 3;
    if (tier === 'major') return 6;
    return 8;
  }
  if (tier === 'minor') return 2;
  if (tier === 'major') return 5;
  return 8;
}

function inferWeight(tier = 'major') {
  if (tier === 'minor') return 100;
  if (tier === 'major') return 65;
  return 35;
}

function enrichAffix(def) {
  const tier = def.tier ?? inferAffixTier(def.id);
  return {
    ...def,
    tier,
    goldValue: def.goldValue ?? inferGoldValue(def.id, tier),
    weight: def.weight ?? inferWeight(tier),
    tags: def.tags ?? [def.type, tier],
  };
}

const RAW_AFFIX_POOL = [
  // ─── Weapon Prefixes ──────────────────────────────────────────────────────
  {
    id: 'wpn_dmg_minor',
    type: 'prefix',
    slots: ['weapon'],
    stat: 'damageMult',
    value: 1.10,
    label: '+10% weapon damage',
  },
  {
    id: 'wpn_dmg_major',
    type: 'prefix',
    slots: ['weapon'],
    stat: 'damageMult',
    value: 1.20,
    label: '+20% weapon damage',
  },
  {
    id: 'wpn_cd_minor',
    type: 'prefix',
    slots: ['weapon'],
    stat: 'cooldownMult',
    value: 0.90,
    label: '−10% weapon cooldown',
  },
  {
    id: 'wpn_cd_major',
    type: 'prefix',
    slots: ['weapon'],
    stat: 'cooldownMult',
    value: 0.85,
    label: '−15% weapon cooldown',
  },

  // ─── Weapon Suffixes ──────────────────────────────────────────────────────
  {
    id: 'of_haste',
    type: 'suffix',
    slots: ['weapon'],
    stat: 'speedFlat',
    value: 20,
    label: '+20 movement speed',
  },
  {
    id: 'of_warding',
    type: 'suffix',
    slots: ['weapon'],
    stat: 'maxHealthFlat',
    value: 25,
    label: '+25 max HP',
  },
  {
    id: 'of_abundance',
    type: 'suffix',
    slots: ['weapon'],
    stat: 'xpMultiplier',
    value: 1.15,
    label: '+15% XP gain',
  },

  // ─── Armor Prefixes ───────────────────────────────────────────────────────
  {
    id: 'arm_hp_minor',
    type: 'prefix',
    slots: ['armor'],
    stat: 'maxHealthFlat',
    value: 30,
    label: '+30 max HP',
  },
  {
    id: 'arm_hp_major',
    type: 'prefix',
    slots: ['armor'],
    stat: 'maxHealthFlat',
    value: 50,
    label: '+50 max HP',
  },
  {
    id: 'arm_regen_minor',
    type: 'prefix',
    slots: ['armor'],
    stat: 'healthRegenPerS',
    value: 2,
    label: '+2 HP regen/s',
  },
  {
    id: 'arm_regen_major',
    type: 'prefix',
    slots: ['armor'],
    stat: 'healthRegenPerS',
    value: 3,
    label: '+3 HP regen/s',
  },

  // ─── Armor Suffixes ───────────────────────────────────────────────────────
  {
    id: 'of_swiftness',
    type: 'suffix',
    slots: ['armor'],
    stat: 'speedFlat',
    value: 15,
    label: '+15 movement speed',
  },
  {
    id: 'of_plunder',
    type: 'suffix',
    slots: ['armor'],
    stat: 'pickupRadiusFlat',
    value: 20,
    label: '+20 pickup radius',
  },
  {
    id: 'of_knowledge',
    type: 'suffix',
    slots: ['armor'],
    stat: 'xpMultiplier',
    value: 1.10,
    label: '+10% XP gain',
  },

  // ─── Jewelry Prefixes ─────────────────────────────────────────────────────
  {
    id: 'jew_xp_minor',
    type: 'prefix',
    slots: ['jewelry'],
    stat: 'xpMultiplier',
    value: 1.15,
    label: '+15% XP gain',
  },
  {
    id: 'jew_xp_major',
    type: 'prefix',
    slots: ['jewelry'],
    stat: 'xpMultiplier',
    value: 1.25,
    label: '+25% XP gain',
  },
  {
    id: 'jew_speed_minor',
    type: 'prefix',
    slots: ['jewelry'],
    stat: 'speedFlat',
    value: 15,
    label: '+15 movement speed',
  },
  {
    id: 'jew_speed_major',
    type: 'prefix',
    slots: ['jewelry'],
    stat: 'speedFlat',
    value: 25,
    label: '+25 movement speed',
  },

  // ─── Jewelry Suffixes ─────────────────────────────────────────────────────
  {
    id: 'of_the_hunt',
    type: 'suffix',
    slots: ['jewelry'],
    stat: 'pickupRadiusFlat',
    value: 25,
    label: '+25 pickup radius',
  },
  {
    id: 'of_might',
    type: 'suffix',
    slots: ['jewelry'],
    stat: 'damageMult',
    value: 1.10,
    label: '+10% weapon damage',
  },
  {
    id: 'of_fortitude',
    type: 'suffix',
    slots: ['jewelry'],
    stat: 'maxHealthFlat',
    value: 25,
    label: '+25 max HP',
  },

  // ─── Helmet Prefixes ──────────────────────────────────────────────────────
  {
    id: 'helm_hp_minor',
    type: 'prefix',
    slots: ['helmet'],
    stat: 'maxHealthFlat',
    value: 25,
    label: '+25 max HP',
  },
  {
    id: 'helm_hp_major',
    type: 'prefix',
    slots: ['helmet'],
    stat: 'maxHealthFlat',
    value: 40,
    label: '+40 max HP',
  },
  {
    id: 'helm_xp_minor',
    type: 'prefix',
    slots: ['helmet'],
    stat: 'xpMultiplier',
    value: 1.15,
    label: '+15% XP gain',
  },

  // ─── Helmet Suffixes ──────────────────────────────────────────────────────
  {
    id: 'of_clarity',
    type: 'suffix',
    slots: ['helmet'],
    stat: 'xpMultiplier',
    value: 1.10,
    label: '+10% XP gain',
  },
  {
    id: 'of_perception',
    type: 'suffix',
    slots: ['helmet'],
    stat: 'pickupRadiusFlat',
    value: 25,
    label: '+25 pickup radius',
  },
  {
    id: 'of_endurance',
    type: 'suffix',
    slots: ['helmet'],
    stat: 'healthRegenPerS',
    value: 2,
    label: '+2 HP regen/s',
  },

  // ─── Boots Prefixes ───────────────────────────────────────────────────────
  {
    id: 'boot_speed_minor',
    type: 'prefix',
    slots: ['boots'],
    stat: 'speedFlat',
    value: 15,
    label: '+15 movement speed',
  },
  {
    id: 'boot_speed_major',
    type: 'prefix',
    slots: ['boots'],
    stat: 'speedFlat',
    value: 25,
    label: '+25 movement speed',
  },
  {
    id: 'boot_pickup',
    type: 'prefix',
    slots: ['boots'],
    stat: 'pickupRadiusFlat',
    value: 20,
    label: '+20 pickup radius',
  },

  // ─── Boots Suffixes ───────────────────────────────────────────────────────
  {
    id: 'of_ranging',
    type: 'suffix',
    slots: ['boots'],
    stat: 'pickupRadiusFlat',
    value: 20,
    label: '+20 pickup radius',
  },
  {
    id: 'of_vitality',
    type: 'suffix',
    slots: ['boots'],
    stat: 'maxHealthFlat',
    value: 20,
    label: '+20 max HP',
  },
  {
    id: 'of_regeneration',
    type: 'suffix',
    slots: ['boots'],
    stat: 'healthRegenPerS',
    value: 1,
    label: '+1 HP regen/s',
  },

  // ─── Offhand Prefixes ─────────────────────────────────────────────────────
  {
    id: 'off_cd_minor',
    type: 'prefix',
    slots: ['offhand'],
    stat: 'cooldownMult',
    value: 0.90,
    label: '−10% weapon cooldown',
  },
  {
    id: 'off_cd_major',
    type: 'prefix',
    slots: ['offhand'],
    stat: 'cooldownMult',
    value: 0.85,
    label: '−15% weapon cooldown',
  },
  {
    id: 'off_dmg_minor',
    type: 'prefix',
    slots: ['offhand'],
    stat: 'damageMult',
    value: 1.10,
    label: '+10% weapon damage',
  },

  // ─── Offhand Suffixes ─────────────────────────────────────────────────────
  {
    id: 'of_alacrity',
    type: 'suffix',
    slots: ['offhand'],
    stat: 'speedFlat',
    value: 20,
    label: '+20 movement speed',
  },
  {
    id: 'of_shelter',
    type: 'suffix',
    slots: ['offhand'],
    stat: 'maxHealthFlat',
    value: 30,
    label: '+30 max HP',
  },
  {
    id: 'of_mending',
    type: 'suffix',
    slots: ['offhand'],
    stat: 'healthRegenPerS',
    value: 2,
    label: '+2 HP regen/s',
  },

  // ── Phase 10 affixes ──────────────────────────────────────────────────────

  // Weapon — 2 new entries
  {
    id: 'wpn_dmg_epic',
    type: 'prefix',
    slots: ['weapon'],
    stat: 'damageMult',
    value: 1.30,
    label: '+30% weapon damage',
  },
  {
    id: 'of_ruin',
    type: 'suffix',
    slots: ['weapon'],
    stat: 'cooldownMult',
    value: 0.80,
    label: '−20% weapon cooldown',
  },

  // Armor — 2 new entries
  {
    id: 'arm_hp_epic',
    type: 'prefix',
    slots: ['armor'],
    stat: 'maxHealthFlat',
    value: 70,
    label: '+70 max HP',
  },
  {
    id: 'of_resilience',
    type: 'suffix',
    slots: ['armor'],
    stat: 'healthRegenPerS',
    value: 5,
    label: '+5 HP regen/s',
  },

  // Jewelry — 2 new entries
  {
    id: 'jew_xp_epic',
    type: 'prefix',
    slots: ['jewelry'],
    stat: 'xpMultiplier',
    value: 1.35,
    label: '+35% XP gain',
  },
  {
    id: 'of_the_void',
    type: 'suffix',
    slots: ['jewelry'],
    stat: 'pickupRadiusFlat',
    value: 40,
    label: '+40 pickup radius',
  },

  // Helmet — 2 new entries
  {
    id: 'helm_hp_epic',
    type: 'prefix',
    slots: ['helmet'],
    stat: 'maxHealthFlat',
    value: 55,
    label: '+55 max HP',
  },
  {
    id: 'of_foresight',
    type: 'suffix',
    slots: ['helmet'],
    stat: 'xpMultiplier',
    value: 1.20,
    label: '+20% XP gain',
  },

  // Boots — 2 new entries
  {
    id: 'boot_speed_epic',
    type: 'prefix',
    slots: ['boots'],
    stat: 'speedFlat',
    value: 40,
    label: '+40 movement speed',
  },
  {
    id: 'of_the_chase',
    type: 'suffix',
    slots: ['boots'],
    stat: 'pickupRadiusFlat',
    value: 35,
    label: '+35 pickup radius',
  },

  // Offhand — 2 new entries
  {
    id: 'off_cd_epic',
    type: 'prefix',
    slots: ['offhand'],
    stat: 'cooldownMult',
    value: 0.78,
    label: '−22% weapon cooldown',
  },
  {
    id: 'of_dominion',
    type: 'suffix',
    slots: ['offhand'],
    stat: 'damageMult',
    value: 1.18,
    label: '+18% weapon damage',
  },

  // ── Phase 10.5 defense-type affixes ──────────────────────────────────────
  // These only roll on items whose defenseType includes the matching type.
  // The 'defenseTypes' array is checked in itemGenerator alongside 'slots'.

  // Body Armour — armor prefixes
  {
    id: 'arm_armor_minor',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 20,
    label: '+20 armor',
  },
  {
    id: 'arm_armor_major',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 35,
    label: '+35 armor',
  },
  // Body Armour — evasion prefixes
  {
    id: 'arm_evasion_minor',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 22,
    label: '+22 evasion',
  },
  {
    id: 'arm_evasion_major',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 38,
    label: '+38 evasion',
  },
  // Body Armour — energy shield prefixes
  {
    id: 'arm_es_minor',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 12,
    label: '+12 energy shield',
  },
  {
    id: 'arm_es_major',
    type: 'prefix',
    slots: ['armor'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 20,
    label: '+20 energy shield',
  },

  // Helmet — armor prefixes
  {
    id: 'helm_armor_minor',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 10,
    label: '+10 armor',
  },
  {
    id: 'helm_armor_major',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 18,
    label: '+18 armor',
  },
  // Helmet — evasion prefixes
  {
    id: 'helm_evasion_minor',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 11,
    label: '+11 evasion',
  },
  {
    id: 'helm_evasion_major',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 20,
    label: '+20 evasion',
  },
  // Helmet — energy shield prefixes
  {
    id: 'helm_es_minor',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 7,
    label: '+7 energy shield',
  },
  {
    id: 'helm_es_major',
    type: 'prefix',
    slots: ['helmet'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 12,
    label: '+12 energy shield',
  },

  // Boots — armor prefixes
  {
    id: 'boot_armor_minor',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 8,
    label: '+8 armor',
  },
  {
    id: 'boot_armor_major',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 14,
    label: '+14 armor',
  },
  // Boots — evasion prefixes
  {
    id: 'boot_evasion_minor',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 9,
    label: '+9 evasion',
  },
  {
    id: 'boot_evasion_major',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 15,
    label: '+15 evasion',
  },
  // Boots — energy shield prefixes
  {
    id: 'boot_es_minor',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 5,
    label: '+5 energy shield',
  },
  {
    id: 'boot_es_major',
    type: 'prefix',
    slots: ['boots'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 9,
    label: '+9 energy shield',
  },

  // Offhand — armor prefixes
  {
    id: 'off_armor_minor',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 15,
    label: '+15 armor',
  },
  {
    id: 'off_armor_major',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['armor'],
    stat: 'armorFlat',
    value: 25,
    label: '+25 armor',
  },
  // Offhand — evasion prefixes
  {
    id: 'off_evasion_minor',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 16,
    label: '+16 evasion',
  },
  {
    id: 'off_evasion_major',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['evasion'],
    stat: 'evasionFlat',
    value: 28,
    label: '+28 evasion',
  },
  // Offhand — energy shield prefixes
  {
    id: 'off_es_minor',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 10,
    label: '+10 energy shield',
  },
  {
    id: 'off_es_major',
    type: 'prefix',
    slots: ['offhand'],
    defenseTypes: ['energyShield'],
    stat: 'energyShieldFlat',
    value: 18,
    label: '+18 energy shield',
  },

  // ── Elemental Damage Affixes ───────────────────────────────────────────────
  //
  // Three-layer model (PoE-style):
  //   flat     stat: flatXxxDamage      — prefix on weapon/jewelry; adds raw damage per hit
  //   increased stat: increasedXxxDamage — prefix on weapon/armor/jewelry/offhand; additive % pool
  //   more      stat: moreXxxDamage      — suffix on weapon; multiplicative after increased
  //
  // Elemental types: Physical, Blaze, Thunder, Frost, Holy, Unholy
  //
  // Also includes elemental resistance suffixes (reducedDamageTaken from that element).

  // ─── Physical ────────────────────────────────────────────────────────────
  { id: 'flat_physical_minor',     type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatPhysicalDamage',      value: 8,    label: '+8 flat Physical Damage' },
  { id: 'flat_physical_major',     type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatPhysicalDamage',      value: 18,   label: '+18 flat Physical Damage' },
  { id: 'inc_physical_minor',      type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedPhysicalDamage', value: 0.12, label: '+12% increased Physical Damage' },
  { id: 'inc_physical_major',      type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedPhysicalDamage', value: 0.22, label: '+22% increased Physical Damage' },
  { id: 'more_physical',           type: 'suffix', slots: ['weapon'],            stat: 'morePhysicalDamage',      value: 0.10, label: '+10% more Physical Damage' },

  // ─── Blaze ────────────────────────────────────────────────────────────────
  { id: 'flat_blaze_minor',        type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatBlazeDamage',         value: 10,   label: '+10 flat Blaze Damage' },
  { id: 'flat_blaze_major',        type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatBlazeDamage',         value: 20,   label: '+20 flat Blaze Damage' },
  { id: 'inc_blaze_minor',         type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedBlazeDamage',    value: 0.12, label: '+12% increased Blaze Damage' },
  { id: 'inc_blaze_major',         type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedBlazeDamage',    value: 0.22, label: '+22% increased Blaze Damage' },
  { id: 'more_blaze',              type: 'suffix', slots: ['weapon'],            stat: 'moreBlazeDamage',         value: 0.10, label: '+10% more Blaze Damage' },
  { id: 'of_blaze_resist_minor',   type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'blazeResistance', value: 0.12, label: '+12% Blaze Resistance' },
  { id: 'of_blaze_resist_major',   type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'blazeResistance', value: 0.22, label: '+22% Blaze Resistance' },

  // ─── Thunder ──────────────────────────────────────────────────────────────
  { id: 'flat_thunder_minor',      type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatThunderDamage',       value: 6,    label: '+6 flat Thunder Damage' },
  { id: 'flat_thunder_major',      type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatThunderDamage',       value: 16,   label: '+16 flat Thunder Damage' },
  { id: 'inc_thunder_minor',       type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedThunderDamage',  value: 0.12, label: '+12% increased Thunder Damage' },
  { id: 'inc_thunder_major',       type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedThunderDamage',  value: 0.22, label: '+22% increased Thunder Damage' },
  { id: 'more_thunder',            type: 'suffix', slots: ['weapon'],            stat: 'moreThunderDamage',       value: 0.10, label: '+10% more Thunder Damage' },
  { id: 'of_thunder_resist_minor', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'thunderResistance', value: 0.12, label: '+12% Thunder Resistance' },
  { id: 'of_thunder_resist_major', type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'thunderResistance', value: 0.22, label: '+22% Thunder Resistance' },

  // ─── Frost ────────────────────────────────────────────────────────────────
  { id: 'flat_frost_minor',        type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatFrostDamage',         value: 9,    label: '+9 flat Frost Damage' },
  { id: 'flat_frost_major',        type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatFrostDamage',         value: 18,   label: '+18 flat Frost Damage' },
  { id: 'inc_frost_minor',         type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedFrostDamage',    value: 0.12, label: '+12% increased Frost Damage' },
  { id: 'inc_frost_major',         type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedFrostDamage',    value: 0.22, label: '+22% increased Frost Damage' },
  { id: 'more_frost',              type: 'suffix', slots: ['weapon'],            stat: 'moreFrostDamage',         value: 0.10, label: '+10% more Frost Damage' },
  { id: 'of_frost_resist_minor',   type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'frostResistance', value: 0.12, label: '+12% Frost Resistance' },
  { id: 'of_frost_resist_major',   type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'frostResistance', value: 0.22, label: '+22% Frost Resistance' },

  // ─── Holy ─────────────────────────────────────────────────────────────────
  { id: 'flat_holy_minor',         type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatHolyDamage',          value: 10,   label: '+10 flat Holy Damage' },
  { id: 'flat_holy_major',         type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatHolyDamage',          value: 22,   label: '+22 flat Holy Damage' },
  { id: 'inc_holy_minor',          type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedHolyDamage',     value: 0.12, label: '+12% increased Holy Damage' },
  { id: 'inc_holy_major',          type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedHolyDamage',     value: 0.22, label: '+22% increased Holy Damage' },
  { id: 'more_holy',               type: 'suffix', slots: ['weapon'],            stat: 'moreHolyDamage',          value: 0.10, label: '+10% more Holy Damage' },
  { id: 'of_holy_resist_minor',    type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'holyResistance', value: 0.12, label: '+12% Holy Resistance' },
  { id: 'of_holy_resist_major',    type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'holyResistance', value: 0.22, label: '+22% Holy Resistance' },

  // ─── Unholy ───────────────────────────────────────────────────────────────
  { id: 'flat_unholy_minor',       type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatUnholyDamage',        value: 10,   label: '+10 flat Unholy Damage' },
  { id: 'flat_unholy_major',       type: 'prefix', slots: ['weapon', 'jewelry'], stat: 'flatUnholyDamage',        value: 20,   label: '+20 flat Unholy Damage' },
  { id: 'inc_unholy_minor',        type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedUnholyDamage',   value: 0.12, label: '+12% increased Unholy Damage' },
  { id: 'inc_unholy_major',        type: 'prefix', slots: ['weapon', 'armor', 'jewelry', 'offhand'], stat: 'increasedUnholyDamage',   value: 0.22, label: '+22% increased Unholy Damage' },
  { id: 'more_unholy',             type: 'suffix', slots: ['weapon'],            stat: 'moreUnholyDamage',        value: 0.10, label: '+10% more Unholy Damage' },
  { id: 'of_unholy_resist_minor',  type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'unholyResistance', value: 0.12, label: '+12% Unholy Resistance' },
  { id: 'of_unholy_resist_major',  type: 'suffix', slots: ['armor', 'jewelry', 'helmet', 'boots'], stat: 'unholyResistance', value: 0.22, label: '+22% Unholy Resistance' },
];

export const AFFIX_POOL = RAW_AFFIX_POOL.map(enrichAffix);
export const AFFIX_BY_ID = Object.fromEntries(AFFIX_POOL.map((a) => [a.id, a]));

const WEAPON_ARCHETYPES = {
  sword: {
    label: 'Sword',
    gridW: 1,
    gridH: 3,
    allowedSlots: ['mainhand', 'offhand'],
    twoHanded: false,
  },
  axe: {
    label: 'Axe',
    gridW: 1,
    gridH: 3,
    allowedSlots: ['mainhand', 'offhand'],
    twoHanded: false,
  },
  bow: {
    label: 'Bow',
    gridW: 2,
    gridH: 3,
    allowedSlots: ['mainhand'],
    twoHanded: true,
  },
  lance: {
    label: 'Lance',
    gridW: 1,
    gridH: 4,
    allowedSlots: ['mainhand'],
    twoHanded: true,
  },
  wand: {
    label: 'Wand',
    gridW: 1,
    gridH: 2,
    allowedSlots: ['mainhand', 'offhand'],
    twoHanded: false,
  },
  staff: {
    label: 'Staff',
    gridW: 2,
    gridH: 4,
    allowedSlots: ['mainhand'],
    twoHanded: true,
  },
  tome: {
    label: 'Tome',
    gridW: 2,
    gridH: 2,
    allowedSlots: ['offhand'],
    twoHanded: false,
  },
  shield: {
    label: 'Shield',
    gridW: 2,
    gridH: 2,
    allowedSlots: ['offhand'],
    twoHanded: false,
  },
};

const LEGACY_WEAPON_TYPES = {
  voidforge: 'sword',
  choir_of_the_storm: 'wand',
  replica_serpentscale: 'axe',
  void_edge: 'sword',
  herald_of_thunder: 'bow',
  bone_reliquary: 'lance',
  aegis_aurora: 'shield',
  bloodseeker: 'axe',
  lioneyes_glare: 'shield',
  abyssal_focus: 'tome',
  warlord_buckler: 'shield',
  siphon_talisman: 'tome',
};

const WEAPON_SLOTS = new Set(['weapon', 'mainhand', 'offhand']);

export function normalizeEquipSlotAlias(slot) {
  if (slot === 'weapon') return 'mainhand';
  if (slot === 'armor') return 'bodyarmor';
  if (slot === 'jewelry') return 'amulet';
  return slot;
}

export function getWeaponArchetypeConfig(weaponType) {
  return WEAPON_ARCHETYPES[weaponType] ?? null;
}

export function getWeaponTypeLabel(weaponType) {
  return WEAPON_ARCHETYPES[weaponType]?.label ?? weaponType ?? null;
}

export function resolveWeaponType(itemDef) {
  if (!itemDef || typeof itemDef !== 'object') return null;
  if (itemDef.weaponType && WEAPON_ARCHETYPES[itemDef.weaponType]) {
    return itemDef.weaponType;
  }
  if (itemDef.id && LEGACY_WEAPON_TYPES[itemDef.id]) {
    return LEGACY_WEAPON_TYPES[itemDef.id];
  }
  const slot = normalizeEquipSlotAlias(itemDef.slot);
  if (slot === 'offhand') return 'shield';
  if (slot === 'mainhand') return 'sword';
  return null;
}

export function isWeaponArchetypeItem(itemDef) {
  if (!itemDef || typeof itemDef !== 'object') return false;
  if (itemDef.weaponType && WEAPON_ARCHETYPES[itemDef.weaponType]) return true;
  const slot = normalizeEquipSlotAlias(itemDef.slot);
  return WEAPON_SLOTS.has(slot);
}

export function normalizeWeaponItem(itemDef, options = {}) {
  if (!itemDef || typeof itemDef !== 'object') return itemDef;

  const { enforceWeaponDimensions = true } = options;
  const normalizedSlot = normalizeEquipSlotAlias(itemDef.slot);
  const weaponType = resolveWeaponType({ ...itemDef, slot: normalizedSlot });
  if (!weaponType) return { ...itemDef, slot: normalizedSlot };

  const config = getWeaponArchetypeConfig(weaponType);
  if (!config) return { ...itemDef, slot: normalizedSlot };

  const normalized = {
    ...itemDef,
    slot: normalizedSlot,
    weaponType,
    handedness: config.twoHanded ? 'two_hand' : 'one_hand',
  };

  if (enforceWeaponDimensions) {
    normalized.gridW = config.gridW;
    normalized.gridH = config.gridH;
  }

  return normalized;
}

export function canEquipItemInSlot(itemDef, targetSlot, equipment = {}) {
  if (!itemDef || !targetSlot) return false;

  const normalizedSlot = normalizeEquipSlotAlias(itemDef.slot);

  if (targetSlot === 'ring1' || targetSlot === 'ring2') {
    return normalizedSlot === 'ring';
  }

  if (!isWeaponArchetypeItem({ ...itemDef, slot: normalizedSlot })) {
    return normalizedSlot === targetSlot;
  }

  const weaponType = resolveWeaponType({ ...itemDef, slot: normalizedSlot });
  const config = getWeaponArchetypeConfig(weaponType);
  if (!config) return normalizedSlot === targetSlot;
  if (!config.allowedSlots.includes(targetSlot)) return false;

  const equippedMainDef = equipment.mainhand?.def ?? equipment.mainhand ?? null;
  const equippedMainType = resolveWeaponType(equippedMainDef);
  const equippedMainConfig = getWeaponArchetypeConfig(equippedMainType);

  if (targetSlot === 'offhand' && equippedMainConfig?.twoHanded) {
    return false;
  }

  if (targetSlot === 'mainhand' && config.twoHanded && equipment.offhand) {
    return false;
  }

  return true;
}

export function listWeaponTypes() {
  return Object.keys(WEAPON_ARCHETYPES);
}

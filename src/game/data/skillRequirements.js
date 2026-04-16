import { getWeaponTypeLabel, resolveWeaponType } from './weaponTypes.js';

const SPELL_WEAPON_TYPES = ['wand', 'staff'];
const MELEE_WEAPON_TYPES = ['sword', 'axe', 'lance', 'staff'];
const BOW_WEAPON_TYPES = ['bow'];

function normalizeRequiredWeaponTypes(skill) {
  const explicit = Array.isArray(skill?.requiresWeaponType) ? skill.requiresWeaponType : [];
  const tags = Array.isArray(skill?.tags) ? skill.tags : [];
  const implied = [];

  if (tags.includes('Spell')) implied.push(...SPELL_WEAPON_TYPES);
  if (tags.includes('Melee')) implied.push(...MELEE_WEAPON_TYPES);
  if (tags.includes('Bow')) implied.push(...BOW_WEAPON_TYPES);

  const normalized = [...explicit, ...implied]
    .map((type) => (typeof type === 'string' ? type.trim().toLowerCase() : ''))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function listEquippedWeaponTypes(player) {
  const equipped = new Set();
  const mainhand = player?.equipment?.mainhand;
  const offhand = player?.equipment?.offhand;
  const defs = [mainhand?.def ?? mainhand ?? null, offhand?.def ?? offhand ?? null];

  for (const def of defs) {
    const weaponType = resolveWeaponType(def);
    if (weaponType) equipped.add(weaponType);
  }

  return [...equipped];
}

function formatTypeList(types) {
  const labels = types.map((type) => getWeaponTypeLabel(type) ?? type);
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

export function evaluateSkillRequirements(skill, player) {
  const requiresWeaponType = normalizeRequiredWeaponTypes(skill);
  if (!requiresWeaponType.length) {
    return {
      ok: true,
      blockedReason: null,
      requirementHint: null,
      requiresWeaponType: [],
      equippedWeaponTypes: listEquippedWeaponTypes(player),
    };
  }

  const equippedWeaponTypes = listEquippedWeaponTypes(player);
  const canUse = requiresWeaponType.some((type) => equippedWeaponTypes.includes(type));

  if (canUse) {
    return {
      ok: true,
      blockedReason: null,
      requirementHint: null,
      requiresWeaponType,
      equippedWeaponTypes,
    };
  }

  const requirementLabel = formatTypeList(requiresWeaponType);
  const equippedLabel = equippedWeaponTypes.length
    ? formatTypeList(equippedWeaponTypes)
    : 'none';
  const blockedReason = `Requires ${requirementLabel}`;
  const fallbackHint = `Equip ${requirementLabel} to use this skill (equipped: ${equippedLabel}).`;

  return {
    ok: false,
    blockedReason,
    requirementHint: skill?.requirementHint ?? fallbackHint,
    requiresWeaponType,
    equippedWeaponTypes,
  };
}

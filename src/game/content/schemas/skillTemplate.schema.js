const REQUIRED_TEMPLATE_FIELDS = [
  'id',
  'style',
  'runtimeCtorId',
  'name',
  'description',
  'tags',
];

const ALLOWED_STYLES = new Set(['projectile', 'aoe']);
const ALLOWED_WEAPON_TYPES = new Set(['sword', 'axe', 'bow', 'lance', 'wand', 'staff', 'tome', 'shield']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateMigratedSkillTemplates(templates = [], skillOffers = [], pureSkillCtors = {}) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const loc = `MIGRATED_SKILL_TEMPLATES[${i}]`;

    for (const f of REQUIRED_TEMPLATE_FIELDS) {
      if (!(f in t)) errors.push(`${loc}: missing required field '${f}'`);
    }

    if (!isNonEmptyString(t?.id)) {
      errors.push(`${loc}: id must be a non-empty string`);
      continue;
    }

    if (seen.has(t.id)) {
      errors.push(`${loc}: duplicate template id '${t.id}'`);
    }
    seen.add(t.id);

    if (!ALLOWED_STYLES.has(t.style)) {
      errors.push(`${loc} (${t.id}): style must be one of ${[...ALLOWED_STYLES].join(', ')}`);
    }
    if (!isNonEmptyString(t.runtimeCtorId)) {
      errors.push(`${loc} (${t.id}): runtimeCtorId must be non-empty string`);
    }
    if (!pureSkillCtors[t.runtimeCtorId]) {
      errors.push(`${loc} (${t.id}): runtimeCtorId '${t.runtimeCtorId}' not found in PURE_SKILL_CTORS`);
    }
    if (!isNonEmptyString(t.name)) {
      errors.push(`${loc} (${t.id}): name must be non-empty string`);
    }
    if (!isNonEmptyString(t.description)) {
      errors.push(`${loc} (${t.id}): description must be non-empty string`);
    }
    if (!Array.isArray(t.tags) || t.tags.length === 0) {
      errors.push(`${loc} (${t.id}): tags must be a non-empty array`);
    }

    if (t.requiresWeaponType != null) {
      if (!Array.isArray(t.requiresWeaponType) || t.requiresWeaponType.length === 0) {
        errors.push(`${loc} (${t.id}): requiresWeaponType must be a non-empty array when provided`);
      } else {
        for (const type of t.requiresWeaponType) {
          if (typeof type !== 'string' || !ALLOWED_WEAPON_TYPES.has(type)) {
            errors.push(`${loc} (${t.id}): unknown weapon requirement '${type}'`);
          }
        }
      }
    }

    const linkedOffer = skillOffers.find((o) => o.id === t.id);
    if (!linkedOffer) {
      errors.push(`${loc} (${t.id}): no linked skill offer found`);
    } else if (linkedOffer.isActiveSkill) {
      errors.push(`${loc} (${t.id}): linked offer is weapon skill, expected pure skill`);
    }
  }

  return { errors, warnings };
}

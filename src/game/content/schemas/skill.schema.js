export const SKILL_OFFER_SCHEMA = {
  required: ['id', 'name', 'description', 'isActiveSkill', 'available'],
};

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateSkillOffers(skillOffers = [], pureSkillCtors = {}) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  for (let i = 0; i < skillOffers.length; i++) {
    const offer = skillOffers[i];
    const loc = `SKILL_OFFER_POOL[${i}]`;

    for (const key of SKILL_OFFER_SCHEMA.required) {
      if (!(key in offer)) {
        errors.push(`${loc}: missing required field '${key}'`);
      }
    }

    if (!isNonEmptyString(offer?.id)) {
      errors.push(`${loc}: id must be a non-empty string`);
      continue;
    }

    if (seenIds.has(offer.id)) {
      errors.push(`${loc}: duplicate skill offer id '${offer.id}'`);
    }
    seenIds.add(offer.id);

    if (!isNonEmptyString(offer.name)) {
      errors.push(`${loc} (${offer.id}): name must be a non-empty string`);
    }
    if (!isNonEmptyString(offer.description)) {
      errors.push(`${loc} (${offer.id}): description must be a non-empty string`);
    }
    if (typeof offer.isActiveSkill !== 'boolean') {
      errors.push(`${loc} (${offer.id}): isActiveSkill must be boolean`);
    }
    if (typeof offer.available !== 'function') {
      errors.push(`${loc} (${offer.id}): available must be a function`);
    }

    if (offer.isActiveSkill === true) {
      if (typeof offer.create !== 'function') {
        errors.push(`${loc} (${offer.id}): weapon offer must define create()`);
      }
      if (offer.createSkill != null) {
        warnings.push(`${loc} (${offer.id}): weapon offer should not define createSkill()`);
      }
    }

    if (offer.isActiveSkill === false) {
      if (typeof offer.createSkill !== 'function') {
        errors.push(`${loc} (${offer.id}): pure-skill offer must define createSkill()`);
      }
      if (!pureSkillCtors[offer.id]) {
        errors.push(`${loc} (${offer.id}): id not found in PURE_SKILL_CTORS`);
      }
      if (offer.create != null) {
        warnings.push(`${loc} (${offer.id}): pure-skill offer should not define create()`);
      }
    }
  }

  return { errors, warnings };
}

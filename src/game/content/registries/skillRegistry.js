import {
  createSkillGemItem,
  SKILL_OFFER_POOL,
  PURE_SKILL_CTORS,
  MIGRATED_SKILL_TEMPLATE_BY_ID,
  buildCreateSkillFromTemplate,
} from '../skills/index.js';

function buildBridgedSkillOffers() {
  return SKILL_OFFER_POOL.map((offer) => {
    const tmpl = MIGRATED_SKILL_TEMPLATE_BY_ID[offer.id];
    if (!tmpl || offer.isWeaponSkill) return offer;
    return {
      ...offer,
      // Keep legacy availability and metadata, but compile from template.
      createSkill: buildCreateSkillFromTemplate(tmpl),
    };
  });
}

const BRIDGED_SKILL_OFFERS = buildBridgedSkillOffers();

/** @returns {Array<object>} */
export function listSkillOffers() {
  return BRIDGED_SKILL_OFFERS;
}

/** @returns {Array<string>} */
export function listSkillOfferIds() {
  return BRIDGED_SKILL_OFFERS.map((offer) => offer.id);
}

/** @param {string} offerId */
export function getSkillOfferById(offerId) {
  return BRIDGED_SKILL_OFFERS.find((offer) => offer.id === offerId) ?? null;
}

/** @param {string} offerId */
export function getSkillOfferByIdOrThrow(offerId) {
  const offer = getSkillOfferById(offerId);
  if (!offer) {
    throw new Error(`skillRegistry: unknown skill offer id '${offerId}'`);
  }
  return offer;
}

export function getAvailableSkillOffers(player, engine) {
  return BRIDGED_SKILL_OFFERS.filter((offer) => offer.available(player, engine));
}

export { createSkillGemItem };

/** @returns {Array<string>} */
export function listPureSkillIds() {
  return Object.keys(PURE_SKILL_CTORS);
}

/** @param {string} id */
export function getPureSkillCtorById(id) {
  return PURE_SKILL_CTORS[id] ?? null;
}

/** @param {string} id */
export function getPureSkillCtorByIdOrThrow(id) {
  const ctor = PURE_SKILL_CTORS[id] ?? null;
  if (!ctor) {
    throw new Error(`skillRegistry: unknown pure skill id '${id}'`);
  }
  return ctor;
}

export function validateSkillRegistry() {
  const errors = [];
  const warnings = [];

  const offerIds = listSkillOfferIds();
  if (new Set(offerIds).size !== offerIds.length) {
    errors.push('Duplicate skill offer ids detected in skill registry');
  }

  const pureIds = listPureSkillIds();
  if (new Set(pureIds).size !== pureIds.length) {
    errors.push('Duplicate pure skill ctor ids detected in skill registry');
  }

  for (const offer of BRIDGED_SKILL_OFFERS) {
    if (!offer.isWeaponSkill) {
      if (!PURE_SKILL_CTORS[offer.id]) {
        errors.push(`Unresolved pure skill constructor for offer '${offer.id}'`);
      }
    }
  }

  for (const id of pureIds) {
    if (!BRIDGED_SKILL_OFFERS.some((offer) => offer.id === id)) {
      warnings.push(`Pure skill '${id}' has no offer entry`);
    }
  }

  return { errors, warnings };
}

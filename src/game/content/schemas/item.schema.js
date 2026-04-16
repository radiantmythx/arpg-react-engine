import { isKnownItemStatKey } from '../../data/statKeys.js';

const ALLOWED_SLOTS = new Set(['weapon', 'armor', 'jewelry', 'helmet', 'boots', 'offhand']);
const ALLOWED_WEAPON_TYPES = new Set(['sword', 'axe', 'bow', 'lance', 'wand', 'staff', 'tome', 'shield']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateAffixEntryShape(affix, loc, errors) {
  if (!affix || typeof affix !== 'object') {
    errors.push(`${loc}: affix entry must be an object`);
    return;
  }
  if (!isNonEmptyString(affix.id)) errors.push(`${loc}: id must be non-empty string`);
  if (!isNonEmptyString(affix.type)) errors.push(`${loc}: type must be non-empty string`);
  if (!isNonEmptyString(affix.label)) errors.push(`${loc}: label must be non-empty string`);
}

export function validateItems(itemDefs = [], uniqueDefs = [], genericDefs = []) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  if (!Array.isArray(itemDefs)) {
    return { errors: ['ITEM_DEFS must be an array'], warnings };
  }

  for (let i = 0; i < itemDefs.length; i++) {
    const item = itemDefs[i];
    const loc = `ITEM_DEFS[${i}]`;

    if (!item || typeof item !== 'object') {
      errors.push(`${loc}: item must be an object`);
      continue;
    }

    if (!isNonEmptyString(item.id)) {
      errors.push(`${loc}: id must be non-empty string`);
      continue;
    }

    if (seen.has(item.id)) errors.push(`${loc}: duplicate id '${item.id}'`);
    seen.add(item.id);

    if (!isNonEmptyString(item.name)) errors.push(`${loc} (${item.id}): name must be non-empty string`);
    if (!isNonEmptyString(item.description)) errors.push(`${loc} (${item.id}): description must be non-empty string`);
    if (!ALLOWED_SLOTS.has(item.slot)) errors.push(`${loc} (${item.id}): slot must be one of ${Array.from(ALLOWED_SLOTS).join(', ')}`);
    if (!isNonEmptyString(item.color)) errors.push(`${loc} (${item.id}): color must be non-empty string`);
    if (!isFiniteNumber(item.basePrice) || item.basePrice < 0) errors.push(`${loc} (${item.id}): basePrice must be >= 0`);
    if (!isFiniteNumber(item.gridW) || item.gridW <= 0) errors.push(`${loc} (${item.id}): gridW must be > 0`);
    if (!isFiniteNumber(item.gridH) || item.gridH <= 0) errors.push(`${loc} (${item.id}): gridH must be > 0`);

    if (item.slot === 'weapon' || item.slot === 'offhand' || item.slot === 'mainhand') {
      if (!isNonEmptyString(item.weaponType)) {
        warnings.push(`${loc} (${item.id}): weaponType missing; runtime fallback will infer one`);
      } else if (!ALLOWED_WEAPON_TYPES.has(item.weaponType)) {
        errors.push(`${loc} (${item.id}): weaponType must be one of ${Array.from(ALLOWED_WEAPON_TYPES).join(', ')}`);
      }
    }

    if (!item.stats || typeof item.stats !== 'object' || Array.isArray(item.stats)) {
      errors.push(`${loc} (${item.id}): stats must be an object`);
    } else if (Object.keys(item.stats).length === 0) {
      warnings.push(`${loc} (${item.id}): stats object is empty`);
    } else {
      for (const [statKey, value] of Object.entries(item.stats)) {
        if (!isKnownItemStatKey(statKey)) {
          errors.push(`${loc} (${item.id}): unknown stat key '${statKey}'`);
        }
        if (!isFiniteNumber(value)) {
          errors.push(`${loc} (${item.id}): stat '${statKey}' must be a finite number`);
        }
      }
    }

    if (item.explicitAffixes != null) {
      if (!Array.isArray(item.explicitAffixes)) {
        errors.push(`${loc} (${item.id}): explicitAffixes must be an array when provided`);
      } else {
        item.explicitAffixes.forEach((a, idx) => validateAffixEntryShape(a, `${loc} (${item.id}).explicitAffixes[${idx}]`, errors));
      }
    }

    if (item.implicitAffixes != null) {
      if (!Array.isArray(item.implicitAffixes)) {
        errors.push(`${loc} (${item.id}): implicitAffixes must be an array when provided`);
      } else {
        item.implicitAffixes.forEach((a, idx) => validateAffixEntryShape(a, `${loc} (${item.id}).implicitAffixes[${idx}]`, errors));
      }
    }
  }

  const uniqueSet = new Set(uniqueDefs.map((item) => item.id));
  const genericSet = new Set(genericDefs.map((item) => item.id));

  if (uniqueDefs.length + genericDefs.length !== itemDefs.length) {
    errors.push('UNIQUE_ITEM_DEFS + GENERIC_ITEM_DEFS length must match ITEM_DEFS length');
  }

  for (const id of uniqueSet) {
    if (genericSet.has(id)) errors.push(`Item '${id}' appears in both unique and generic splits`);
  }

  for (const item of itemDefs) {
    const inUnique = uniqueSet.has(item.id);
    const inGeneric = genericSet.has(item.id);
    if (!inUnique && !inGeneric) errors.push(`Item '${item.id}' appears in neither unique nor generic split`);
  }

  return { errors, warnings };
}

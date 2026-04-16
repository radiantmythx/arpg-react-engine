import { ALL_AFFIX_POOL } from '../../data/affixes.js';
import { isKnownItemStatKey } from '../../data/statKeys.js';

const ALLOWED_TYPES = new Set(['prefix', 'suffix']);
const ALLOWED_KINDS = new Set(['explicit', 'implicit']);
const ALLOWED_TIERS = new Set(['minor', 'major', 'advanced', 'high', 'pinnacle']);
const ALLOWED_LEVEL_BRACKETS = new Set(['early', 'mid', 'late', 'endgame']);

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateAffixesPlaceholder() {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (let i = 0; i < ALL_AFFIX_POOL.length; i++) {
    const a = ALL_AFFIX_POOL[i];
    const loc = `AFFIX_POOL[${i}]`;

    if (!a?.id || typeof a.id !== 'string') {
      errors.push(`${loc}: id must be a non-empty string`);
      continue;
    }
    if (seen.has(a.id)) errors.push(`${loc}: duplicate id '${a.id}'`);
    seen.add(a.id);

    if (!ALLOWED_KINDS.has(a.kind)) errors.push(`${loc} (${a.id}): kind must be explicit|implicit`);
    if (!ALLOWED_TYPES.has(a.type)) errors.push(`${loc} (${a.id}): type must be prefix|suffix`);
    if (typeof a.family !== 'string' || !a.family) errors.push(`${loc} (${a.id}): family must be non-empty string`);
    if (typeof a.group !== 'string' || !a.group) errors.push(`${loc} (${a.id}): group must be non-empty string`);
    if (!Array.isArray(a.slots) || a.slots.length === 0) errors.push(`${loc} (${a.id}): slots must be non-empty array`);
    if (typeof a.stat !== 'string' || !a.stat) errors.push(`${loc} (${a.id}): stat must be non-empty string`);
    if (typeof a.stat === 'string' && a.stat && !isKnownItemStatKey(a.stat)) {
      errors.push(`${loc} (${a.id}): unknown stat key '${a.stat}'`);
    }
    if (!isFiniteNumber(a.value)) errors.push(`${loc} (${a.id}): value must be finite number`);
    if (typeof a.label !== 'string' || !a.label) errors.push(`${loc} (${a.id}): label must be non-empty string`);
    if (!a.modifier || typeof a.modifier !== 'object') {
      errors.push(`${loc} (${a.id}): modifier payload must be an object`);
    } else {
      if (typeof a.modifier.statKey !== 'string' || !a.modifier.statKey) {
        errors.push(`${loc} (${a.id}): modifier.statKey must be non-empty string`);
      }
      if (a.modifier.operation !== 'add' && a.modifier.operation !== 'multiply') {
        errors.push(`${loc} (${a.id}): modifier.operation must be add|multiply`);
      }
      if (!isFiniteNumber(a.modifier.value)) {
        errors.push(`${loc} (${a.id}): modifier.value must be finite number`);
      }
      if (!Array.isArray(a.modifier.requiresTag)) {
        errors.push(`${loc} (${a.id}): modifier.requiresTag must be an array`);
      }
      if (!Array.isArray(a.modifier.requiresWeaponType)) {
        errors.push(`${loc} (${a.id}): modifier.requiresWeaponType must be an array`);
      }
    }

    if (!ALLOWED_TIERS.has(a.tier)) {
      errors.push(`${loc} (${a.id}): tier must be minor|major|advanced|high|pinnacle`);
    }
    if (!isFiniteNumber(a.minItemLevel) || a.minItemLevel < 1) {
      errors.push(`${loc} (${a.id}): minItemLevel must be a positive number`);
    }
    if (!isFiniteNumber(a.goldValue) || a.goldValue < 0) errors.push(`${loc} (${a.id}): goldValue must be non-negative number`);
    if (!isFiniteNumber(a.weight) || a.weight <= 0) errors.push(`${loc} (${a.id}): weight must be > 0`);

    if (!a.pool || typeof a.pool !== 'object') {
      errors.push(`${loc} (${a.id}): pool must be an object`);
    } else {
      if (!Array.isArray(a.pool.itemClasses) || a.pool.itemClasses.length === 0) {
        errors.push(`${loc} (${a.id}): pool.itemClasses must be a non-empty array`);
      }
      if (!Array.isArray(a.pool.weaponTypes)) {
        errors.push(`${loc} (${a.id}): pool.weaponTypes must be an array`);
      }
      if (!Array.isArray(a.pool.defenseTypes)) {
        errors.push(`${loc} (${a.id}): pool.defenseTypes must be an array`);
      }
      if (!Array.isArray(a.pool.tags)) {
        errors.push(`${loc} (${a.id}): pool.tags must be an array`);
      }
      if (!Array.isArray(a.pool.levelBrackets) || a.pool.levelBrackets.length === 0) {
        errors.push(`${loc} (${a.id}): pool.levelBrackets must be a non-empty array`);
      } else {
        for (const bracket of a.pool.levelBrackets) {
          if (!ALLOWED_LEVEL_BRACKETS.has(bracket)) {
            errors.push(`${loc} (${a.id}): unknown level bracket '${bracket}'`);
          }
        }
      }
    }

    if (a.goldValue > 20) warnings.push(`${loc} (${a.id}): unusually high goldValue (${a.goldValue})`);
    if (a.weight < 10) warnings.push(`${loc} (${a.id}): very low weight (${a.weight})`);
  }

  return { errors, warnings };
}

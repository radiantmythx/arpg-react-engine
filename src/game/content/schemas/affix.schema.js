import { AFFIX_POOL } from '../../data/affixes.js';

const ALLOWED_TYPES = new Set(['prefix', 'suffix']);
const ALLOWED_TIERS = new Set(['minor', 'major', 'epic']);

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateAffixesPlaceholder() {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (let i = 0; i < AFFIX_POOL.length; i++) {
    const a = AFFIX_POOL[i];
    const loc = `AFFIX_POOL[${i}]`;

    if (!a?.id || typeof a.id !== 'string') {
      errors.push(`${loc}: id must be a non-empty string`);
      continue;
    }
    if (seen.has(a.id)) errors.push(`${loc}: duplicate id '${a.id}'`);
    seen.add(a.id);

    if (!ALLOWED_TYPES.has(a.type)) errors.push(`${loc} (${a.id}): type must be prefix|suffix`);
    if (!Array.isArray(a.slots) || a.slots.length === 0) errors.push(`${loc} (${a.id}): slots must be non-empty array`);
    if (typeof a.stat !== 'string' || !a.stat) errors.push(`${loc} (${a.id}): stat must be non-empty string`);
    if (!isFiniteNumber(a.value)) errors.push(`${loc} (${a.id}): value must be finite number`);
    if (typeof a.label !== 'string' || !a.label) errors.push(`${loc} (${a.id}): label must be non-empty string`);

    if (!ALLOWED_TIERS.has(a.tier)) errors.push(`${loc} (${a.id}): tier must be minor|major|epic`);
    if (!isFiniteNumber(a.goldValue) || a.goldValue < 0) errors.push(`${loc} (${a.id}): goldValue must be non-negative number`);
    if (!isFiniteNumber(a.weight) || a.weight <= 0) errors.push(`${loc} (${a.id}): weight must be > 0`);

    if (a.goldValue > 20) warnings.push(`${loc} (${a.id}): unusually high goldValue (${a.goldValue})`);
    if (a.weight < 10) warnings.push(`${loc} (${a.id}): very low weight (${a.weight})`);
  }

  return { errors, warnings };
}

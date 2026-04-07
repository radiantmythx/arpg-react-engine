import {
  LAYOUT_PROFILES,
  ENCOUNTER_PROFILES,
  REWARD_PROFILES,
  MIGRATED_MAP_DEFINITIONS,
  LAYOUT_PROFILE_BY_ID,
  ENCOUNTER_PROFILE_BY_ID,
  REWARD_PROFILE_BY_ID,
} from '../maps/index.js';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function validateMapProfiles() {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const [index, p] of LAYOUT_PROFILES.entries()) {
    const loc = `LAYOUT_PROFILES[${index}]`;
    if (!isNonEmptyString(p?.id)) errors.push(`${loc}: id must be non-empty string`);
    else {
      if (seen.has(`layout:${p.id}`)) errors.push(`${loc}: duplicate layout id '${p.id}'`);
      seen.add(`layout:${p.id}`);
    }
    if (!isNonEmptyString(p?.theme)) errors.push(`${loc} (${p?.id ?? 'unknown'}): theme must be non-empty string`);
  }

  for (const [index, p] of ENCOUNTER_PROFILES.entries()) {
    const loc = `ENCOUNTER_PROFILES[${index}]`;
    if (!isNonEmptyString(p?.id)) errors.push(`${loc}: id must be non-empty string`);
    else {
      if (seen.has(`encounter:${p.id}`)) errors.push(`${loc}: duplicate encounter id '${p.id}'`);
      seen.add(`encounter:${p.id}`);
    }
    if (!isPositiveNumber(p?.packsPerRoom)) errors.push(`${loc} (${p?.id ?? 'unknown'}): packsPerRoom must be > 0`);
    if (!isPositiveNumber(p?.difficulty)) errors.push(`${loc} (${p?.id ?? 'unknown'}): difficulty must be > 0`);
    if (!isNonEmptyString(p?.bossId)) errors.push(`${loc} (${p?.id ?? 'unknown'}): bossId must be non-empty string`);
    if (!Array.isArray(p?.enemyPool) || p.enemyPool.length === 0) errors.push(`${loc} (${p?.id ?? 'unknown'}): enemyPool must be non-empty array`);
  }

  for (const [index, p] of REWARD_PROFILES.entries()) {
    const loc = `REWARD_PROFILES[${index}]`;
    if (!isNonEmptyString(p?.id)) errors.push(`${loc}: id must be non-empty string`);
    else {
      if (seen.has(`reward:${p.id}`)) errors.push(`${loc}: duplicate reward id '${p.id}'`);
      seen.add(`reward:${p.id}`);
    }
    if (typeof p?.rewards !== 'object' || !p.rewards) errors.push(`${loc} (${p?.id ?? 'unknown'}): rewards must be object`);
  }

  for (const [index, m] of MIGRATED_MAP_DEFINITIONS.entries()) {
    const loc = `MIGRATED_MAP_DEFINITIONS[${index}]`;
    if (!isNonEmptyString(m?.id)) errors.push(`${loc}: id must be non-empty string`);
    if (!isNonEmptyString(m?.name)) errors.push(`${loc} (${m?.id ?? 'unknown'}): name must be non-empty string`);
    if (!isPositiveNumber(m?.tier)) errors.push(`${loc} (${m?.id ?? 'unknown'}): tier must be > 0`);
    if (!isNonEmptyString(m?.description)) errors.push(`${loc} (${m?.id ?? 'unknown'}): description must be non-empty string`);
    if (!isNonEmptyString(m?.layoutProfileId) || !LAYOUT_PROFILE_BY_ID[m.layoutProfileId]) {
      errors.push(`${loc} (${m?.id ?? 'unknown'}): unresolved layoutProfileId '${m?.layoutProfileId}'`);
    }
    if (!isNonEmptyString(m?.encounterProfileId) || !ENCOUNTER_PROFILE_BY_ID[m.encounterProfileId]) {
      errors.push(`${loc} (${m?.id ?? 'unknown'}): unresolved encounterProfileId '${m?.encounterProfileId}'`);
    }
    if (!isNonEmptyString(m?.rewardProfileId) || !REWARD_PROFILE_BY_ID[m.rewardProfileId]) {
      errors.push(`${loc} (${m?.id ?? 'unknown'}): unresolved rewardProfileId '${m?.rewardProfileId}'`);
    }
  }

  return { errors, warnings };
}

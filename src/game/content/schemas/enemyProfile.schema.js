import { ENEMY_ARCHETYPES, AI_PROFILES, AI_PROFILE_BY_ID } from '../enemies/index.js';

function isFinitePositive(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateEnemyProfiles() {
  const errors = [];
  const warnings = [];

  const aiSeen = new Set();
  for (let i = 0; i < AI_PROFILES.length; i++) {
    const p = AI_PROFILES[i];
    const loc = `AI_PROFILES[${i}]`;
    if (!isNonEmptyString(p?.id)) {
      errors.push(`${loc}: id must be non-empty string`);
      continue;
    }
    if (aiSeen.has(p.id)) errors.push(`${loc}: duplicate id '${p.id}'`);
    aiSeen.add(p.id);

    if (!isFinitePositive(p.aggroRadius)) errors.push(`${loc} (${p.id}): aggroRadius must be > 0`);
    if (!isFinitePositive(p.propagationRadius)) errors.push(`${loc} (${p.id}): propagationRadius must be > 0`);
  }

  const archetypeSeen = new Set();
  for (let i = 0; i < ENEMY_ARCHETYPES.length; i++) {
    const e = ENEMY_ARCHETYPES[i];
    const loc = `ENEMY_ARCHETYPES[${i}]`;
    if (!isNonEmptyString(e?.id)) {
      errors.push(`${loc}: id must be non-empty string`);
      continue;
    }
    if (archetypeSeen.has(e.id)) errors.push(`${loc}: duplicate id '${e.id}'`);
    archetypeSeen.add(e.id);

    if (!isNonEmptyString(e.aiProfileId)) {
      errors.push(`${loc} (${e.id}): aiProfileId must be non-empty string`);
    } else if (!AI_PROFILE_BY_ID[e.aiProfileId]) {
      errors.push(`${loc} (${e.id}): unresolved aiProfileId '${e.aiProfileId}'`);
    }

    if (!isFinitePositive(e.radius)) errors.push(`${loc} (${e.id}): radius must be > 0`);
    if (!isFinitePositive(e.speed)) errors.push(`${loc} (${e.id}): speed must be > 0`);
    if (!isFinitePositive(e.health)) errors.push(`${loc} (${e.id}): health must be > 0`);
    if (!isFinitePositive(e.damage)) errors.push(`${loc} (${e.id}): damage must be > 0`);
    if (!isFinitePositive(e.xpValue)) errors.push(`${loc} (${e.id}): xpValue must be > 0`);
    if (!isNonEmptyString(e.color)) errors.push(`${loc} (${e.id}): color must be non-empty string`);

    if (e.resistances && typeof e.resistances === 'object') {
      for (const [k, v] of Object.entries(e.resistances)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push(`${loc} (${e.id}).resistances.${k}: must be finite number`);
        }
      }
    }
  }

  return { errors, warnings };
}

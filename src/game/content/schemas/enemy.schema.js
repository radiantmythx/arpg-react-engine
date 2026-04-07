const REQUIRED_ENEMY_FIELDS = [
  'id',
  'radius',
  'speed',
  'health',
  'damage',
  'xpValue',
  'color',
];

function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function validateEnemies(enemyTypes = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(enemyTypes)) {
    return { errors: ['Enemy runtime map must be an object map'], warnings };
  }

  for (const [key, def] of Object.entries(enemyTypes)) {
    const loc = `ENEMY_MAP.${key}`;
    if (!isObject(def)) {
      errors.push(`${loc}: definition must be an object`);
      continue;
    }

    for (const field of REQUIRED_ENEMY_FIELDS) {
      if (!(field in def)) {
        errors.push(`${loc}: missing required field '${field}'`);
      }
    }

    if (def.id !== key) {
      errors.push(`${loc}: id '${def.id}' must match key '${key}'`);
    }

    if (!isPositiveNumber(def.radius)) errors.push(`${loc}: radius must be > 0`);
    if (!isPositiveNumber(def.speed)) errors.push(`${loc}: speed must be > 0`);
    if (!isPositiveNumber(def.health)) errors.push(`${loc}: health must be > 0`);
    if (!isPositiveNumber(def.damage)) errors.push(`${loc}: damage must be > 0`);
    if (!isPositiveNumber(def.xpValue)) errors.push(`${loc}: xpValue must be > 0`);

    if (typeof def.color !== 'string' || def.color.trim().length === 0) {
      errors.push(`${loc}: color must be a non-empty string`);
    }

    if (def.resistances != null) {
      if (!isObject(def.resistances)) {
        errors.push(`${loc}: resistances must be an object when present`);
      } else {
        for (const [rtype, rval] of Object.entries(def.resistances)) {
          if (typeof rval !== 'number' || !Number.isFinite(rval)) {
            errors.push(`${loc}.resistances.${rtype}: must be a finite number`);
          }
          if (rval > 0.9) {
            warnings.push(`${loc}.resistances.${rtype}: unusually high resistance (${rval})`);
          }
          if (rval < -1.0) {
            warnings.push(`${loc}.resistances.${rtype}: unusually low resistance (${rval})`);
          }
        }
      }
    }
  }

  return { errors, warnings };
}

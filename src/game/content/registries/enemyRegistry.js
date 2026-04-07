import {
  ENEMY_ARCHETYPES,
  compileEnemyArchetypeToRuntime,
} from '../enemies/index.js';

function buildResolvedEnemyMap() {
  return Object.fromEntries(
    ENEMY_ARCHETYPES.map((archetype) => [archetype.id, compileEnemyArchetypeToRuntime(archetype.id)]),
  );
}

const RESOLVED_ENEMIES = buildResolvedEnemyMap();

/** @returns {Array<string>} */
export function listEnemyIds() {
  return Object.keys(RESOLVED_ENEMIES);
}

/** @returns {Array<object>} */
export function listEnemies() {
  return Object.values(RESOLVED_ENEMIES);
}

export function getEnemyMap() {
  return RESOLVED_ENEMIES;
}

/** @param {string} id */
export function getEnemyById(id) {
  return RESOLVED_ENEMIES[id] ?? null;
}

/** @param {string} id */
export function getEnemyByIdOrThrow(id) {
  const def = RESOLVED_ENEMIES[id] ?? null;
  if (!def) {
    throw new Error(`enemyRegistry: unknown enemy id '${id}'`);
  }
  return def;
}

/**
 * Registry-level validation, including unresolved map enemy-pool references.
 * @param {Array<object>} freeMaps
 */
export function validateEnemyRegistry(freeMaps = []) {
  const errors = [];
  const warnings = [];

  const ids = listEnemyIds();
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate enemy ids detected in enemy registry');
  }

  for (const [key, def] of Object.entries(RESOLVED_ENEMIES)) {
    if (def.id !== key) {
      errors.push(`Enemy key/id mismatch: key '${key}' != def.id '${def.id}'`);
    }
  }

  for (const archetype of ENEMY_ARCHETYPES) {
    const compiled = RESOLVED_ENEMIES[archetype.id];
    if (!compiled) {
      errors.push(`Migrated archetype '${archetype.id}' did not compile into registry`);
    }
  }

  for (const mapDef of freeMaps) {
    const pool = Array.isArray(mapDef?.enemyPool) ? mapDef.enemyPool : [];
    for (const entry of pool) {
      const enemyId = typeof entry === 'string' ? entry : entry?.id;
      if (!enemyId) {
        errors.push(`Map '${mapDef?.id ?? 'unknown'}' has enemyPool entry with missing id`);
        continue;
      }
      if (!getEnemyById(enemyId)) {
        errors.push(`Map '${mapDef?.id ?? 'unknown'}' references unknown enemy id '${enemyId}'`);
      }
    }
  }

  return { errors, warnings };
}

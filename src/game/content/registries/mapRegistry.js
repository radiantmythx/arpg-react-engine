import {
  MIGRATED_MAP_DEFINITIONS,
  compileMapDefinitionToRuntime,
  LAYOUT_PROFILE_BY_ID,
  ENCOUNTER_PROFILE_BY_ID,
  REWARD_PROFILE_BY_ID,
} from '../maps/index.js';

function buildResolvedMaps() {
  return MIGRATED_MAP_DEFINITIONS.map((mapDef) => compileMapDefinitionToRuntime(mapDef));
}

const RESOLVED_FREE_MAPS = buildResolvedMaps();

export function listFreeMaps() {
  return RESOLVED_FREE_MAPS;
}

export function getFreeMapById(id) {
  return RESOLVED_FREE_MAPS.find((m) => m.id === id) ?? null;
}

export function isFreeMapUnlocked(mapDef, actsCleared = []) {
  if (!mapDef?.unlockReq) return true;
  return actsCleared.includes(mapDef.unlockReq);
}

export function validateMapRegistry() {
  const errors = [];
  const warnings = [];
  const ids = RESOLVED_FREE_MAPS.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate free map ids detected in map registry');
  }

  for (const mapDef of MIGRATED_MAP_DEFINITIONS) {
    if (!LAYOUT_PROFILE_BY_ID[mapDef.layoutProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved layoutProfileId '${mapDef.layoutProfileId}'`);
    }
    if (!ENCOUNTER_PROFILE_BY_ID[mapDef.encounterProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved encounterProfileId '${mapDef.encounterProfileId}'`);
    }
    if (!REWARD_PROFILE_BY_ID[mapDef.rewardProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved rewardProfileId '${mapDef.rewardProfileId}'`);
    }
  }

  return { errors, warnings };
}

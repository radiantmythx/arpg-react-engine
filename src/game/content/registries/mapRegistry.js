import {
  MIGRATED_MAP_DEFINITIONS,
  compileMapDefinitionToRuntime,
  inferCampaignProgress,
  resolveActPartRange,
  validateCampaignTransitions,
  LAYOUT_PROFILE_BY_ID,
  ENCOUNTER_PROFILE_BY_ID,
  REWARD_PROFILE_BY_ID,
  BIOME_PACK_BY_ID,
  biomePackSupportsAct,
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
    if (mapDef.biomePackId && !BIOME_PACK_BY_ID[mapDef.biomePackId]) {
      errors.push(`Map '${mapDef.id}' unresolved biomePackId '${mapDef.biomePackId}'`);
    }
    if (mapDef.biomePackId && BIOME_PACK_BY_ID[mapDef.biomePackId] && !biomePackSupportsAct(BIOME_PACK_BY_ID[mapDef.biomePackId])) {
      errors.push(`Map '${mapDef.id}' uses biome pack '${mapDef.biomePackId}' that is not act-enabled`);
    }
    if (!LAYOUT_PROFILE_BY_ID[mapDef.layoutProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved layoutProfileId '${mapDef.layoutProfileId}'`);
    }
    if (!ENCOUNTER_PROFILE_BY_ID[mapDef.encounterProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved encounterProfileId '${mapDef.encounterProfileId}'`);
    }
    if (!REWARD_PROFILE_BY_ID[mapDef.rewardProfileId]) {
      errors.push(`Map '${mapDef.id}' unresolved rewardProfileId '${mapDef.rewardProfileId}'`);
    }

    const progress = inferCampaignProgress(mapDef);
    const range = resolveActPartRange(progress.act, progress.partIndex);
    const resolved = RESOLVED_FREE_MAPS.find((m) => m.id === mapDef.id);
    if (resolved && (resolved.areaLevel < range.min || resolved.areaLevel > range.max)) {
      errors.push(
        `Map '${mapDef.id}' resolved areaLevel ${resolved.areaLevel} outside configured act band ${range.min}-${range.max}`,
      );
    }
  }

  const transitionValidation = validateCampaignTransitions();
  errors.push(...transitionValidation.errors);
  warnings.push(...transitionValidation.warnings);

  return { errors, warnings };
}

import { LAYOUT_PROFILE_BY_ID } from './layoutProfiles.js';
import { ENCOUNTER_PROFILE_BY_ID } from './encounterProfiles.js';
import { REWARD_PROFILE_BY_ID } from './rewardProfiles.js';
import { BIOME_PACK_BY_ID, BIOME_PACK_BY_THEME } from './biomePacks.js';
import { inferCampaignProgress, resolveCampaignAreaLevel } from './campaignAreaLevel.js';

export function compileMapDefinitionToRuntime(mapDef) {
  if (!mapDef) throw new Error('mapCompiler: missing map definition');

  const campaignProgress = inferCampaignProgress(mapDef);
  const campaignAreaLevel = resolveCampaignAreaLevel(campaignProgress);
  const isCampaignBossArea = (campaignProgress?.partIndex ?? 1) >= 4;

  const layout = LAYOUT_PROFILE_BY_ID[mapDef.layoutProfileId];
  const encounter = ENCOUNTER_PROFILE_BY_ID[mapDef.encounterProfileId];
  const reward = REWARD_PROFILE_BY_ID[mapDef.rewardProfileId];
  const biomePack = BIOME_PACK_BY_ID[mapDef.biomePackId]
    ?? BIOME_PACK_BY_THEME[layout?.theme]
    ?? null;

  if (!layout) throw new Error(`mapCompiler: unknown layoutProfileId '${mapDef.layoutProfileId}'`);
  if (!encounter) throw new Error(`mapCompiler: unknown encounterProfileId '${mapDef.encounterProfileId}'`);
  if (!reward) throw new Error(`mapCompiler: unknown rewardProfileId '${mapDef.rewardProfileId}'`);
  if (mapDef.biomePackId && !BIOME_PACK_BY_ID[mapDef.biomePackId]) {
    throw new Error(`mapCompiler: unknown biomePackId '${mapDef.biomePackId}'`);
  }

  const resolvedTheme = mapDef.theme
    ?? layout.theme
    ?? biomePack?.theme
    ?? 'ruins';

  const resolvedLayoutFamily = mapDef.layoutFamily
    ?? (!isCampaignBossArea ? 'strand_corridor' : null)
    ?? layout.layoutFamily
    ?? biomePack?.layoutFamily
    ?? 'bsp_fortress';

  const resolvedPathStyle = mapDef.pathStyle
    ?? layout.pathStyle
    ?? biomePack?.pathStyle
    ?? 'branching';

  const resolvedTerrainProfile = mapDef.terrainProfile
    ?? layout.terrainProfile
    ?? biomePack?.terrainProfile
    ?? 'auto';

  const resolvedPacksPerRoom = mapDef.packsPerRoom
    ?? encounter.packsPerRoom
    ?? biomePack?.defaultPacksPerRoom
    ?? 2;

  const resolvedDifficulty = mapDef.difficulty
    ?? encounter.difficulty
    ?? biomePack?.defaultDifficulty
    ?? 1;

  const resolvedEnemyPool = mapDef.enemyPool
    ?? encounter.enemyPool
    ?? [];

  const resolvedBossId = mapDef.bossId
    ?? encounter.bossId
    ?? null;

  return {
    id: mapDef.id,
    name: mapDef.name,
    act: campaignProgress.act,
    campaignPart: campaignProgress.partIndex,
    campaignZoneId: campaignProgress.zoneId,
    sourceMapItemLevel: campaignAreaLevel,
    areaLevel: campaignAreaLevel,
    description: mapDef.description,
    biomePackId: biomePack?.id ?? null,
    biomePackName: biomePack?.name ?? null,
    biomeContentStage: biomePack?.contentStage ?? null,
    theme: resolvedTheme,
    layoutFamily: resolvedLayoutFamily,
    pathStyle: resolvedPathStyle,
    terrainProfile: resolvedTerrainProfile,
    obstacleSet: biomePack?.obstacleSet ?? [],
    terrainPalette: biomePack?.terrainPalette ?? [],
    enemyPackPreferences: biomePack?.enemyPackPreferences ?? [],
    bossArenaStylePool: biomePack?.bossArenaStylePool ?? [],
    renderHints: biomePack?.renderHints ?? null,
    unlockReq: mapDef.unlockReq,
    mods: Array.isArray(mapDef.mods) ? mapDef.mods : [],
    packsPerRoom: resolvedPacksPerRoom,
    difficulty: resolvedDifficulty,
    rewards: reward.rewards,
    bossId: resolvedBossId,
    enemyPool: resolvedEnemyPool,
  };
}

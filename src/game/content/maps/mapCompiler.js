import { LAYOUT_PROFILE_BY_ID } from './layoutProfiles.js';
import { ENCOUNTER_PROFILE_BY_ID } from './encounterProfiles.js';
import { REWARD_PROFILE_BY_ID } from './rewardProfiles.js';

export function compileMapDefinitionToRuntime(mapDef) {
  if (!mapDef) throw new Error('mapCompiler: missing map definition');

  const layout = LAYOUT_PROFILE_BY_ID[mapDef.layoutProfileId];
  const encounter = ENCOUNTER_PROFILE_BY_ID[mapDef.encounterProfileId];
  const reward = REWARD_PROFILE_BY_ID[mapDef.rewardProfileId];

  if (!layout) throw new Error(`mapCompiler: unknown layoutProfileId '${mapDef.layoutProfileId}'`);
  if (!encounter) throw new Error(`mapCompiler: unknown encounterProfileId '${mapDef.encounterProfileId}'`);
  if (!reward) throw new Error(`mapCompiler: unknown rewardProfileId '${mapDef.rewardProfileId}'`);

  return {
    id: mapDef.id,
    name: mapDef.name,
    tier: mapDef.tier,
    description: mapDef.description,
    theme: layout.theme,
    unlockReq: mapDef.unlockReq,
    packsPerRoom: encounter.packsPerRoom,
    difficulty: encounter.difficulty,
    rewards: reward.rewards,
    bossId: encounter.bossId,
    enemyPool: encounter.enemyPool,
  };
}

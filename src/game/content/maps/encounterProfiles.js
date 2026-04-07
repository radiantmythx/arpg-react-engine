import { MAP_TUNING } from '../tuning/index.js';

export const ENCOUNTER_PROFILES = [
  {
    id: 'encounter_act1_cloister',
    packsPerRoom: 2,
    difficulty: MAP_TUNING.act1_fallen_cloister.difficulty,
    bossId: 'HOLLOW_SOVEREIGN',
    enemyPool: [
      { id: 'RHOA', weight: 3 },
      { id: 'RATTLING_REMNANT', weight: 3 },
      { id: 'UNDYING_THRALL', weight: 2 },
    ],
  },
  {
    id: 'encounter_act2_foothills',
    packsPerRoom: 2,
    difficulty: MAP_TUNING.act2_scorched_foothills.difficulty,
    bossId: 'UNDYING_TIDE',
    enemyPool: [
      { id: 'RHOA', weight: 2 },
      { id: 'UNDYING_THRALL', weight: 3 },
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
    ],
  },
  {
    id: 'encounter_act3_archive',
    packsPerRoom: 3,
    difficulty: MAP_TUNING.act3_sunken_archive.difficulty,
    bossId: 'WRAECLASTS_CHOSEN',
    enemyPool: [
      { id: 'UNDYING_THRALL', weight: 2 },
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 1 },
    ],
  },
  {
    id: 'encounter_act4_cathedral',
    packsPerRoom: 3,
    difficulty: MAP_TUNING.act4_blighted_cathedral.difficulty,
    bossId: 'THE_STARVELING',
    enemyPool: [
      { id: 'SHRIEKING_BANSHEE', weight: 2 },
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 2 },
      { id: 'SHADE', weight: 2 },
    ],
  },
  {
    id: 'encounter_act5_throne',
    packsPerRoom: 4,
    difficulty: MAP_TUNING.act5_throne_of_embers.difficulty,
    bossId: 'ABYSSAL_ENGINE',
    enemyPool: [
      { id: 'PLAGUE_CRAWLER', weight: 2 },
      { id: 'VOID_STALKER', weight: 2 },
      { id: 'SHADE', weight: 2 },
      { id: 'IRON_COLOSSUS', weight: 1 },
    ],
  },
];

export const ENCOUNTER_PROFILE_BY_ID = Object.fromEntries(ENCOUNTER_PROFILES.map((p) => [p.id, p]));

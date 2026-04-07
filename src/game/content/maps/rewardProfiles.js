import { MAP_TUNING } from '../tuning/index.js';

export const REWARD_PROFILES = [
  {
    id: 'reward_act1_basic',
    rewards: MAP_TUNING.act1_fallen_cloister.rewards,
  },
  {
    id: 'reward_act2_basic',
    rewards: MAP_TUNING.act2_scorched_foothills.rewards,
  },
  {
    id: 'reward_act3_basic',
    rewards: MAP_TUNING.act3_sunken_archive.rewards,
  },
  {
    id: 'reward_act4_basic',
    rewards: MAP_TUNING.act4_blighted_cathedral.rewards,
  },
  {
    id: 'reward_act5_basic',
    rewards: MAP_TUNING.act5_throne_of_embers.rewards,
  },
];

export const REWARD_PROFILE_BY_ID = Object.fromEntries(REWARD_PROFILES.map((p) => [p.id, p]));

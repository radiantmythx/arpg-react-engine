import { ENEMY_AI } from '../../config.js';

/**
 * Phase 4 minimal-risk AI profiles.
 * These are authoring-time profiles compiled into runtime enemy configs.
 */
export const AI_PROFILES = [
  {
    id: 'direct_chase',
    aggroRadius: ENEMY_AI.baseAggroRadius,
    propagationRadius: ENEMY_AI.propagationRadius,
    notes: 'Baseline direct chase behavior.',
  },
  {
    id: 'aggressive_chase',
    aggroRadius: ENEMY_AI.baseAggroRadius,
    propagationRadius: ENEMY_AI.propagationRadius,
    notes: 'Aggressive chase profile scaffold (kept parity-safe for now).',
  },
];

export const AI_PROFILE_BY_ID = Object.fromEntries(AI_PROFILES.map((p) => [p.id, p]));

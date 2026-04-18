import { ENEMY_ARCHETYPE_BY_ID } from './enemyArchetypes.js';
import { AI_PROFILE_BY_ID } from './aiProfiles.js';
import { DEFAULT_ENEMY_SKILLS } from '../../config.js';

/**
 * Compile an enemy archetype + ai profile to current runtime enemy config shape.
 * Parity-safe: emitted fields match the current Enemy runtime config shape.
 */
export function compileEnemyArchetypeToRuntime(enemyId) {
  const archetype = ENEMY_ARCHETYPE_BY_ID[enemyId] ?? null;
  if (!archetype) {
    throw new Error(`enemyCompiler: unknown archetype id '${enemyId}'`);
  }

  const ai = AI_PROFILE_BY_ID[archetype.aiProfileId] ?? null;
  if (!ai) {
    throw new Error(`enemyCompiler: unknown aiProfileId '${archetype.aiProfileId}' for '${enemyId}'`);
  }

  // Keep output fields aligned with the current Enemy runtime config for minimal-risk integration.
  return {
    id: archetype.id,
    radius: archetype.radius,
    speed: archetype.speed,
    health: archetype.health,
    damage: archetype.damage,
    xpValue: archetype.xpValue,
    color: archetype.color,
    resistances: archetype.resistances ?? {},
    skills: archetype.skills ?? DEFAULT_ENEMY_SKILLS,
  };
}

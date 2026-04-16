// STAT KEYS and effect application helpers for passive tree nodes.
import {
  applyModifierSet,
  buildPassiveModifiersFromStats,
  removeModifierSet,
} from '../modifierEngine.js';
import { PASSIVE_STAT_KEYS } from '../statKeys.js';

export const STAT_KEYS = PASSIVE_STAT_KEYS;

export function applyStats(player, stats, source = null) {
  if (!stats || !player) return null;
  const modifiers = buildPassiveModifiersFromStats(stats);
  return applyModifierSet(player, modifiers, {
    id: source?.id ?? null,
    kind: source?.kind ?? 'passiveTree',
    label: source?.label ?? source?.id ?? 'Passive Tree Node',
  });
}

export function removeStats(player, snapshot) {
  removeModifierSet(player, snapshot);
}

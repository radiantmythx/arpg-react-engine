import { SUPPORT_POOL, createSupportGemItem, makeSupportInstance } from '../src/game/data/supports.js';
import { SUPPORT_TUNING } from '../src/game/content/tuning/supports.tuning.js';
import {
  MAX_SUPPORT_SOCKETS,
  openSupportSlotsForLevel,
  unlockLevelForSocketIndex,
} from '../src/game/supportSockets.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSocketProgression() {
  const expected = [
    [1, 1],
    [3, 1],
    [4, 2],
    [6, 2],
    [7, 3],
    [9, 3],
    [10, 4],
    [12, 4],
    [13, 5],
    [20, 5],
  ];
  for (const [level, open] of expected) {
    assert(openSupportSlotsForLevel(level) === open, `slot progression mismatch at level ${level}`);
  }
  assert(MAX_SUPPORT_SOCKETS === 5, 'max support sockets must remain 5');

  const expectedUnlocks = [1, 4, 7, 10, 13];
  for (let i = 0; i < expectedUnlocks.length; i++) {
    assert(
      unlockLevelForSocketIndex(i) === expectedUnlocks[i],
      `unlock level mismatch for socket index ${i}`,
    );
  }
}

function validateSupportMultipliers() {
  for (const support of SUPPORT_POOL) {
    const mult = SUPPORT_TUNING.manaCostMultiplierBySupportId?.[support.id]
      ?? SUPPORT_TUNING.defaultManaCostMultiplier;
    assert(Number.isFinite(mult), `missing mana multiplier for ${support.id}`);
    assert(mult >= 1.0 && mult <= 1.6, `mana multiplier for ${support.id} out of expected range`);
  }
}

function validateInstanceModifier() {
  for (const support of SUPPORT_POOL) {
    const item = createSupportGemItem(support);
    const instance = makeSupportInstance(item);
    assert(instance, `failed to build support instance for ${support.id}`);
    const stats = { manaCostMult: 1, damage: 10 };
    instance.modify?.(stats, { tags: support.requiredTags ?? [] });
    assert(stats.manaCostMult > 0, `invalid manaCostMult after modify for ${support.id}`);
  }
}

function main() {
  validateSocketProgression();
  validateSupportMultipliers();
  validateInstanceModifier();

  console.log('Support gem validation passed.');
  console.log('Manual persistence checks to run: hub->map, death->hub, reload with linked supports.');
}

main();

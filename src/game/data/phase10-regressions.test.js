import { describe, expect, it } from 'vitest';

import { evaluateSkillRequirements } from './skillRequirements.js';
import { generateItem } from './itemGenerator.js';
import { getAffixCapsForRarity } from './rarityProfiles.js';
import { applyModifierSet, removeModifierSet } from './modifierEngine.js';
import { GENERIC_ITEM_DEFS } from '../content/items/index.js';
import { migrateSave, CURRENT_SAVE_VERSION } from '../CharacterSave.js';

describe('phase10 regressions', () => {
  it('blocks weapon-gated skills when no required weapon is equipped', () => {
    const skill = {
      id: 'fireball',
      requiresWeaponType: ['wand', 'staff'],
      requirementHint: 'Equip a Wand or Staff to use Fireball.',
    };
    const player = {
      equipment: {
        mainhand: { slot: 'mainhand', weaponType: 'sword' },
        offhand: null,
      },
    };

    const result = evaluateSkillRequirements(skill, player);
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toContain('Requires Wand or Staff');
    expect(result.requirementHint).toBe('Equip a Wand or Staff to use Fireball.');
  });

  it('infers melee requirement from Melee tag', () => {
    const skill = {
      id: 'melee_strike',
      tags: ['Attack', 'Melee', 'Physical'],
    };
    const player = {
      equipment: {
        mainhand: { slot: 'mainhand', weaponType: 'wand' },
        offhand: null,
      },
    };

    const result = evaluateSkillRequirements(skill, player);
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toContain('Requires');
    expect(result.requiresWeaponType).toEqual(expect.arrayContaining(['sword', 'axe', 'lance', 'staff']));
  });

  it('enforces affix caps for magic and rare items', () => {
    const baseDef = GENERIC_ITEM_DEFS.find((item) => item.slot === 'armor');
    expect(baseDef).toBeTruthy();

    const magicCaps = getAffixCapsForRarity('magic');
    const rareCaps = getAffixCapsForRarity('rare');

    for (let i = 0; i < 100; i++) {
      const magicItem = generateItem(baseDef, 'magic', { itemLevel: 75 });
      const rareItem = generateItem(baseDef, 'rare', { itemLevel: 75 });

      const magicPrefixes = (magicItem.explicitAffixes ?? []).filter((a) => a.type === 'prefix').length;
      const magicSuffixes = (magicItem.explicitAffixes ?? []).filter((a) => a.type === 'suffix').length;
      const rarePrefixes = (rareItem.explicitAffixes ?? []).filter((a) => a.type === 'prefix').length;
      const rareSuffixes = (rareItem.explicitAffixes ?? []).filter((a) => a.type === 'suffix').length;

      expect(magicPrefixes).toBeLessThanOrEqual(magicCaps.prefix);
      expect(magicSuffixes).toBeLessThanOrEqual(magicCaps.suffix);
      expect(rarePrefixes).toBeLessThanOrEqual(rareCaps.prefix);
      expect(rareSuffixes).toBeLessThanOrEqual(rareCaps.suffix);
    }
  });

  it('keeps modifier parity after apply/remove', () => {
    const player = {
      maxHealth: 100,
      health: 100,
      attackSpeed: 1,
      autoSkills: [{ damage: 10, cooldown: 1 }],
      _activeModifierSnapshots: new Map(),
    };

    const baseline = {
      maxHealth: player.maxHealth,
      health: player.health,
      attackSpeed: player.attackSpeed,
      damage: player.autoSkills[0].damage,
      cooldown: player.autoSkills[0].cooldown,
    };

    const snapshot = applyModifierSet(player, [
      { statKey: 'maxHealth', value: 25, operation: 'add', target: 'player', layer: 100 },
      { statKey: 'attackSpeed', value: 1.2, operation: 'multiply', target: 'player', layer: 100 },
      { statKey: 'damageMult', value: 1.5, operation: 'multiply', target: 'autoSkillDamage', layer: 200 },
      { statKey: 'cooldownMult', value: 0.8, operation: 'multiply', target: 'autoSkillCooldown', layer: 200 },
    ], {
      id: 'test-source',
      kind: 'itemExplicit',
      label: 'Parity Test',
    });

    removeModifierSet(player, snapshot);

    expect(player.maxHealth).toBe(baseline.maxHealth);
    expect(player.health).toBe(baseline.health);
    expect(player.attackSpeed).toBeCloseTo(baseline.attackSpeed, 10);
    expect(player.autoSkills[0].damage).toBe(baseline.damage);
    expect(player.autoSkills[0].cooldown).toBeCloseTo(baseline.cooldown, 10);
  });

  it('migrates legacy save blobs to current version with normalized slots', () => {
    const legacy = {
      id: 'char_1',
      class: 'sage',
      equipment: {
        weapon: { id: 'voidforge', slot: 'weapon' },
        armor: { id: 'kaoms_heart', slot: 'armor' },
      },
      passiveTree: { allocated: [] },
    };

    const { data, migrated } = migrateSave(legacy);

    expect(migrated).toBe(true);
    expect(data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(data.equipment.mainhand?.id).toBe('voidforge');
    expect(data.equipment.bodyarmor?.id).toBe('kaoms_heart');
    expect(data.equipment.weapon).toBeUndefined();
    expect(data.equipment.armor).toBeUndefined();
    expect(Array.isArray(data.activeSkills)).toBe(true);
    expect(data.activeSkills.length).toBe(3);
    expect(data.maxEnergyShield).toBe(0);
    expect(data.energyShield).toBe(0);
  });
});

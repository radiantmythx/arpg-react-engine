import {
  applyModifierSet,
  buildAffixModifiersFromAffixes,
  buildItemModifiersFromStats,
  removeModifierSet,
} from './data/modifierEngine.js';

/**
 * PassiveItem
 * Equipment-backed source of stat modifiers.
 */
export class PassiveItem {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.slot = config.slot;
    this.color = config.color;
    this.rarity = config.rarity ?? 'normal';
    this.stats = { ...(config.stats ?? {}) };
    this.baseStats = { ...(config.baseStats ?? {}) };
    this.explicitAffixes = [...(config.explicitAffixes ?? [])];
    this.implicitAffixes = [...(config.implicitAffixes ?? [])];
  }

  apply(player) {
    const snapshots = [];
    const isUnique = this.rarity === 'unique';
    const baseStats = Object.keys(this.baseStats).length > 0 ? this.baseStats : this.stats;
    const baseModifiers = buildItemModifiersFromStats(baseStats);
    if (baseModifiers.length > 0) {
      snapshots.push(applyModifierSet(player, baseModifiers, {
        id: null,
        kind: isUnique ? 'uniqueItem' : 'itemBase',
        label: this.name,
      }));
    }

    if (!isUnique) {
      const implicitModifiers = buildAffixModifiersFromAffixes(this.implicitAffixes);
      if (implicitModifiers.length > 0) {
        snapshots.push(applyModifierSet(player, implicitModifiers, {
          id: null,
          kind: 'itemImplicit',
          label: `${this.name} Implicit`,
        }));
      }

      const explicitModifiers = buildAffixModifiersFromAffixes(this.explicitAffixes);
      if (explicitModifiers.length > 0) {
        snapshots.push(applyModifierSet(player, explicitModifiers, {
          id: null,
          kind: 'itemExplicit',
          label: `${this.name} Explicit`,
        }));
      }
    }

    return snapshots;
  }

  remove(player, snapshot) {
    const snapshots = Array.isArray(snapshot) ? snapshot : [snapshot];
    snapshots.filter(Boolean).forEach((entry) => removeModifierSet(player, entry));
  }
}

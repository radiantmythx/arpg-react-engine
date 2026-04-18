/**
 * Phase 9 enemy cutover.
 * Full live enemy catalog now resolves from content archetypes.
 */
import { ENEMY_TUNING } from '../tuning/index.js';

export const ENEMY_ARCHETYPES = [
  {
    id: 'RHOA',
    aiProfileId: 'direct_chase',
    radius: 10,
    speed: 90,
    health: ENEMY_TUNING.RHOA.health,
    damage: ENEMY_TUNING.RHOA.damage,
    xpValue: 2,
    color: '#9b59b6',
    resistances: { physical: 0.15 },
    skills: [
      { id: 'rhoa_gore', name: 'Gore', damage: { min: 6, max: 12 }, cooldown: 1.3, castTime: 0.12, range: 12, tags: ['Attack', 'Melee', 'Physical'] },
    ],
  },
  {
    id: 'UNDYING_THRALL',
    aiProfileId: 'aggressive_chase',
    radius: 14,
    speed: 60,
    health: ENEMY_TUNING.UNDYING_THRALL.health,
    damage: ENEMY_TUNING.UNDYING_THRALL.damage,
    xpValue: 5,
    color: '#27ae60',
    resistances: { frost: 0.20, unholy: 0.15 },
    skills: [
      { id: 'thrall_slam', name: 'Heavy Slam', damage: { min: 10, max: 18 }, cooldown: 2.0, castTime: 0.2, range: 16, tags: ['Attack', 'Melee', 'Physical'] },
    ],
  },
  {
    id: 'RATTLING_REMNANT',
    aiProfileId: 'direct_chase',
    radius: 12,
    speed: 110,
    health: 20,
    damage: 12,
    xpValue: 3,
    color: '#ecf0f1',
    resistances: { physical: 0.25, holy: -0.20 },
    skills: [
      { id: 'bone_slash', name: 'Bone Slash', damage: { min: 5, max: 14 }, cooldown: 1.1, castTime: 0.1, range: 10, tags: ['Attack', 'Melee', 'Physical'] },
    ],
  },
  {
    id: 'SHRIEKING_BANSHEE',
    aiProfileId: 'aggressive_chase',
    radius: 11,
    speed: 140,
    health: 25,
    damage: 14,
    xpValue: 4,
    color: '#74b9ff',
    resistances: { frost: 0.25, physical: 0.30 },
    skills: [
      { id: 'chill_touch', name: 'Chill Touch', damage: { min: 6, max: 16 }, cooldown: 1.4, castTime: 0.15, range: 14, tags: ['Attack', 'Melee', 'Frost'] },
    ],
  },
  {
    id: 'PLAGUE_CRAWLER',
    aiProfileId: 'direct_chase',
    radius: 13,
    speed: 55,
    health: 70,
    damage: 18,
    xpValue: 7,
    color: '#55efc4',
    resistances: { unholy: 0.25, blaze: -0.15 },
    skills: [
      { id: 'venom_bite', name: 'Venom Bite', damage: { min: 8, max: 22 }, cooldown: 1.8, castTime: 0.18, range: 12, tags: ['Attack', 'Melee', 'Unholy'] },
    ],
  },
  {
    id: 'VOID_STALKER',
    aiProfileId: 'aggressive_chase',
    radius: 10,
    speed: 150,
    health: 18,
    damage: 10,
    xpValue: 3,
    color: '#6c5ce7',
    resistances: { unholy: 0.20, frost: 0.15 },
    skills: [
      { id: 'void_strike', name: 'Void Strike', damage: { min: 4, max: 12 }, cooldown: 0.9, castTime: 0.08, range: 10, tags: ['Attack', 'Melee', 'Unholy'] },
    ],
  },
  {
    id: 'IRON_COLOSSUS',
    aiProfileId: 'direct_chase',
    radius: 22,
    speed: 40,
    health: 200,
    damage: 35,
    xpValue: 18,
    color: '#b2bec3',
    resistances: { physical: 0.30, thunder: 0.20, blaze: -0.10 },
    skills: [
      { id: 'iron_crush', name: 'Iron Crush', damage: { min: 20, max: 40 }, cooldown: 2.5, castTime: 0.2, range: 20, tags: ['Attack', 'Melee', 'Physical'] },
    ],
  },
  {
    id: 'SHADE',
    aiProfileId: 'aggressive_chase',
    radius: 9,
    speed: 125,
    health: 22,
    damage: 12,
    xpValue: 3,
    color: '#2d3436',
    resistances: { unholy: 0.25, thunder: 0.10 },
    skills: [
      { id: 'shadow_rend', name: 'Shadow Rend', damage: { min: 5, max: 14 }, cooldown: 1.2, castTime: 0.1, range: 10, tags: ['Attack', 'Melee', 'Unholy'] },
    ],
  },
];

export const ENEMY_ARCHETYPE_BY_ID = Object.fromEntries(ENEMY_ARCHETYPES.map((e) => [e.id, e]));

/**
 * Phase 3 skill decomposition (minimal-risk slice).
 * Only two migrated templates for now:
 * - fireball (projectile-style)
 * - frost_nova (aoe-style)
 */

export const MIGRATED_SKILL_TEMPLATES = [
  {
    id: 'fireball',
    style: 'projectile',
    runtimeCtorId: 'fireball',
    name: 'Fireball',
    icon: '🔥',
    description: 'Launch an arcing fireball that detonates on impact, dealing fire damage in an area.',
    tags: ['Spell', 'Projectile', 'Blaze', 'AoE'],
    requiresWeaponType: ['wand', 'staff'],
    requirementHint: 'Equip a Wand or Staff to use Fireball.',
  },
  {
    id: 'frost_nova',
    style: 'aoe',
    runtimeCtorId: 'frost_nova',
    name: 'Frost Nova',
    icon: '❄',
    description: 'Release an ice ring that damages and freezes nearby enemies.',
    tags: ['Spell', 'AoE', 'Frost'],
  },
];

export const MIGRATED_SKILL_TEMPLATE_BY_ID = Object.fromEntries(
  MIGRATED_SKILL_TEMPLATES.map((t) => [t.id, t]),
);

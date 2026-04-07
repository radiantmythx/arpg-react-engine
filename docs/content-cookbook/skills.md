# Skills Cookbook

## Good Example

```js
export const SKILL_DRAFT = {
  id: 'ember_lance',
  style: 'projectile',
  runtimeCtorId: 'ember_lance',
  name: 'Ember Lance',
  icon: '🔥',
  description: 'Fire a fast burning lance that pierces one target.',
  tags: ['Spell', 'Projectile', 'Blaze'],
};
```

Why it is good:
- `id` is unique and runtime-friendly.
- `style` matches the intended compiler path.
- `tags` are minimal and mechanically meaningful.
- The description says what the player experiences.

## Anti-Pattern

```js
export const SKILL_DRAFT = {
  id: 'newSkill',
  style: 'stuff',
  runtimeCtorId: 'TODO',
  name: 'Super Good Skill Maybe',
  icon: '🔥',
  description: 'Does a lot of different things probably.',
  tags: ['Spell', 'Projectile', 'AoE', 'Frost', 'Blaze', 'Holy'],
};
```

Why it is bad:
- The `id` is vague and inconsistent with current naming.
- The `style` does not map to a known compiler path.
- The description is not actionable.
- The tags overstate mechanics and will confuse later tuning.

## Fast Path

1. Run `npm run make:skill -- --id ember_lance --name "Ember Lance"`.
2. Compare the draft against `definition.template.js` and migrated entries in `skillTemplates.js`.
3. Keep the draft isolated until the compiler and registry changes are ready.

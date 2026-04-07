# Enemies Cookbook

## Good Example

```js
export const ENEMY_DRAFT = {
  id: 'ASHEN_STALKER',
  aiProfileId: 'direct_chase',
  radius: 11,
  speed: 105,
  health: 28,
  damage: 11,
  xpValue: 3,
  color: '#d35400',
  resistances: { blaze: 0.15 },
};
```

Why it is good:
- The `id` matches current enemy naming conventions.
- The AI profile is explicit.
- Core stats are readable and role-appropriate.
- Resistances are sparse and justified.

## Anti-Pattern

```js
export const ENEMY_DRAFT = {
  id: 'enemy1',
  aiProfileId: 'custom_later',
  radius: 4,
  speed: 300,
  health: 5000,
  damage: 1,
  xpValue: 99,
  color: '#ffffff',
  resistances: { physical: 1, frost: 1, blaze: 1, holy: 1, unholy: 1 },
};
```

Why it is bad:
- The `id` is not durable.
- The AI profile does not exist.
- The stat spread is incoherent.
- Full immunity across every channel makes tuning and readability worse.

## Fast Path

1. Run `npm run make:enemy -- --id ASHEN_STALKER`.
2. Compare the draft with `enemyArchetypes.js` and `CHECKLIST.md`.
3. Promote it only after AI profile and registry wiring are intentional.

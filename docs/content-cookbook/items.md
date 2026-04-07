# Items Cookbook

## Good Example

```js
export const ITEM_DRAFT = {
  id: 'cinderband',
  name: 'Cinderband',
  description: '+12% weapon damage. Heat lingers in the metal.',
  slot: 'jewelry',
  color: '#e67e22',
  basePrice: 10,
  gridW: 1,
  gridH: 1,
  stats: {
    damageMult: 1.12,
  },
};
```

Why it is good:
- The slot and footprint are coherent.
- The description explains the gameplay effect.
- The stat shape matches current item conventions.

## Anti-Pattern

```js
export const ITEM_DRAFT = {
  id: 'ring2',
  name: 'Ring',
  description: 'Good stats.',
  slot: 'whatever',
  color: '#fff',
  basePrice: -10,
  gridW: 3,
  gridH: 7,
  stats: {
    damageMult: 10,
    cooldownMult: 10,
    xpMultiplier: 10,
  },
};
```

Why it is bad:
- The id and name are too vague.
- The slot is invalid.
- Price and footprint are not compatible with current systems.
- The stats are wildly outside existing balance expectations.

## Fast Path

1. Run `npm run make:item -- --id cinderband --name Cinderband --slot jewelry`.
2. Compare the draft to items in `src/game/content/items/itemCatalog.js`.
3. Keep the draft isolated until pricing and affix interactions are reviewed.

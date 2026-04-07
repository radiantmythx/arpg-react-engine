# Maps Cookbook

## Good Example

```js
export const MAP_DRAFT = {
  id: 'act3_ashen_cathedral',
  name: 'Act III: Ashen Cathedral',
  tier: 3,
  description: 'Collapsed sanctums and ember-choked aisles.',
  unlockReq: 'act2_scorched_foothills',
  layoutProfileId: 'layout_cathedral_ring',
  encounterProfileId: 'encounter_act3_cathedral',
  rewardProfileId: 'reward_act3_basic',
};
```

Why it is good:
- The map id and name fit the current campaign style.
- Unlock progression is explicit.
- Layout, encounter, and reward concerns stay separated.

## Anti-Pattern

```js
export const MAP_DRAFT = {
  id: 'new_map',
  name: 'Test',
  tier: 99,
  description: 'Big hard place.',
  unlockReq: 'unknown_map',
  layoutProfileId: 'layout_thing',
  encounterProfileId: 'encounter_thing',
  rewardProfileId: 'reward_thing',
};
```

Why it is bad:
- The progression data is disconnected from the real campaign.
- The profile ids do not point to known authoring surfaces.
- The description does not communicate encounter flavor.

## Fast Path

1. Run `npm run make:map -- --id act3_ashen_cathedral --name "Act III: Ashen Cathedral" --tier 3`.
2. Fill in real profile ids only after those profiles exist.
3. Validate pressure and rewards before touching the map registry.

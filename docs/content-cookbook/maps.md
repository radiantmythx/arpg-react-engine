# Maps Cookbook

This page is the source of truth for adding or tuning maps after the Phase 9 map-generation rollout.

## What A Map Definition Owns

A map definition wires together four content surfaces:
- Biome identity via biome pack.
- Layout intent via layout profile.
- Enemy pressure via encounter profile.
- Reward pacing via reward profile.

The map definition itself lives in [src/game/content/maps/mapDefinitions.js](src/game/content/maps/mapDefinitions.js).

The draft template is in [src/game/content/maps/definition.template.js](src/game/content/maps/definition.template.js).

## Authoring Surfaces

Edit these files when creating a new map:
- Map entry: [src/game/content/maps/mapDefinitions.js](src/game/content/maps/mapDefinitions.js)
- Biome packs: [src/game/content/maps/biomePacks.js](src/game/content/maps/biomePacks.js)
- Layout profiles: [src/game/content/maps/layoutProfiles.js](src/game/content/maps/layoutProfiles.js)
- Encounter profiles: [src/game/content/maps/encounterProfiles.js](src/game/content/maps/encounterProfiles.js)
- Reward profiles: [src/game/content/maps/rewardProfiles.js](src/game/content/maps/rewardProfiles.js)

Compiler behavior for all resolved runtime fields is defined in [src/game/content/maps/mapCompiler.js](src/game/content/maps/mapCompiler.js).

Schema and profile validation rules are defined in [src/game/content/schemas/mapProfile.schema.js](src/game/content/schemas/mapProfile.schema.js).

## Required Fields In A Map Entry

Every map entry should provide:
- id
- name
- tier
- description
- unlockReq
- biomePackId
- layoutProfileId
- encounterProfileId
- rewardProfileId

Optional advanced overrides can also be supplied directly on the map entry:
- theme
- layoutFamily
- pathStyle
- terrainProfile
- packsPerRoom
- difficulty
- enemyPool
- bossId
- mods

If optional overrides are omitted, the compiler resolves values from profile and biome defaults.

## Good Example

Map draft shape:

export const MAP_DRAFT = {
  id: 'act6_sundered_barricades',
  name: 'Act VI: Sundered Barricades',
  tier: 6,
  description: 'A broken siege lane with flooded choke trenches.',
  unlockReq: 'act5_throne_of_embers',
  biomePackId: 'pack_siege_road',
  layoutProfileId: 'layout_wastes_open',
  encounterProfileId: 'encounter_act5_throne',
  rewardProfileId: 'reward_act5_basic',
  mods: [
    { id: 'fortified', type: 'prefix', value: 1 },
    { id: 'flooded', type: 'prefix', value: 1 },
  ],
};

Why this is good:
- Uses real ids from current authoring surfaces.
- Keeps map, profile, and biome responsibilities separated.
- Uses explicit map mods only when intended.
- Remains compatible with compiler fallback rules.

## Anti-Pattern

Bad draft shape:

export const MAP_DRAFT = {
  id: 'test_map',
  name: 'Test',
  tier: 99,
  description: 'Hard map.',
  unlockReq: 'unknown_unlock',
  biomePackId: 'pack_unknown',
  layoutProfileId: 'layout_unknown',
  encounterProfileId: 'encounter_unknown',
  rewardProfileId: 'reward_unknown',
  mods: [{ id: 'something_custom', value: 999 }],
};

Why this is bad:
- Unresolved ids fail schema and registry validation.
- Progression gating is disconnected from known map progression.
- Unknown mod ids are ignored by runtime systems and create false expectations.
- Tier and description quality are not production-ready.

## Supported Layout Families And Path Styles

Current production families:
- bsp_fortress
- meandering_cavern
- gauntlet_lane

Common path styles currently used:
- linear
- branching
- curved

Choose family and path style through layout profiles first. Only override on a map definition when you intentionally need a special case.

## Supported Map Mods

Map mod pool lives in [src/game/content/maps/mapMods.js](src/game/content/maps/mapMods.js).

Layout-affecting Phase 9 mods:
- twisting
- fortified
- flooded
- overgrown
- volatile

Gameplay pressure mods still supported:
- pack_size
- enemy_life
- enemy_speed
- area_of_effect
- extra_champion_packs
- reduced_player_regen
- elemental_weakness
- corrupted

Use only ids from the pool above when authoring explicit map mods.

## Runtime Resolution Rules

Compiler resolution order is:
1. Explicit field on map definition.
2. Profile value.
3. Biome pack value.
4. Safe default.

This applies to core runtime fields such as theme, layoutFamily, pathStyle, terrainProfile, packsPerRoom, difficulty, enemyPool, and bossId.

## Fast Path For New Maps

1. Scaffold a draft with npm run make:map -- --id your_map_id --name "Your Map Name" --tier N.
2. Add or pick biome pack and profiles first.
3. Add the map definition entry in [src/game/content/maps/mapDefinitions.js](src/game/content/maps/mapDefinitions.js).
4. Run npm run content:validate.
5. Run npm run build.
6. If using explicit layout-affecting mods, run node scripts/phase9-mapmods-sanity.mjs.

## Review Checklist

Before merging a new map:
- All referenced ids resolve.
- Unlock chain is intentional.
- Description communicates biome and gameplay expectation.
- packsPerRoom and difficulty align with target tier.
- Boss id and enemy pool match intended encounter identity.
- Explicit mods are from supported pool only.
- content:validate and build both pass.

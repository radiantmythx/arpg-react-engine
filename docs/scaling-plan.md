# Scaling Plan

## Goal

Ship a phased, testable, and **easily tunable** level-scaling model where:
- Map item numeric level determines monster and boss strength in that instance.
- Item base types remain mostly static by identity.
- Affix availability can later be gated by item iLvl.
- Campaign acts are split into 5 level-banded parts each.
- Map drops from maps stay within a +-5 iLvl variance so players can continuously climb toward level 100.
- Skill gems and support gems scale from level 1 to 20 with smooth numeric progression and no special level 20 one-off effects.
- **Every numeric constant and curve coefficient lives in a single config file** so that tuners and modders can adjust feel without touching engine logic.

## Tuning-First Design Principle

This system is built to be easy to tune and mod from day one. That means:

- All scaling constants are declared in one dedicated config file (e.g. `src/game/config/scalingConfig.js`), never scattered across logic files.
- Curve formulas are expressed as small pure functions that receive only a level integer and the config object — no hidden state.
- Act level bands, map drop weights, gem per-level deltas, and affix iLvl gates are all plain data arrays or objects, not computed inline.
- Any tuner should be able to open `scalingConfig.js`, change a number, save, and immediately see the effect in the simulation scripts without a full rebuild.
- A future modder should be able to swap in an entirely different config file and override the defaults without modifying core engine files.

Implementation rule: if a designer would ever want to change a number during balance, it must live in the config, not in the formula code.

## Non-Goals

- Redesigning map geometry families.
- Rebuilding item base-type catalogs.
- Adding new gem systems beyond numeric scaling.

## Core Rules

1. Area level source of truth:
   - AreaLevel = MapItemLevel for map instances.
   - Campaign zones have authored AreaLevel bands (defined in config, not hardcoded in zone files).

2. Monster and boss scaling:
   - Enemy base archetype remains identity.
   - Final combat stats are derived from archetype base multiplied by AreaLevel curves, using coefficients from the config.

3. Item model:
   - Base type identity does not need to scale with level.
   - Affix pool gating by item iLvl is a later phase and its gates live in config.

4. Gem progression:
   - Levels 1 to 20 adjust numbers via shared per-level deltas stored in config.
   - Remove all level 20 special-effect unlock behavior.

## Phase 1: Data Contracts and Plumbing

Objective:
- Make AreaLevel and scaling inputs explicit, queryable, and externally configurable everywhere.

Deliverables:
- Create `src/game/config/scalingConfig.js` as the single home for all scaling constants (see Phase 2 for initial contents).
- Add a single runtime scalar to map instances: `AreaLevel`.
- Ensure map items carry `MapItemLevel` cleanly into spawned map definitions.
- Add scaling metadata to encounters for debugging:
  - `sourceMapItemLevel`
  - `computedAreaLevel`
  - `enemyScalarProfileVersion` — version tag pulled from the config so a tuner knows which constant set produced the result
- Add telemetry counters for kill-time and damage-taken by AreaLevel bucket.

Config structure target (scalingConfig.js):
```js
export const SCALING_CONFIG = {
  version: '1.0.0',           // bump when tuning numbers to track which build used which values
  enemy: { ... },             // all enemy curve coefficients
  boss: { ... },              // boss multipliers
  eliteChampion: { ... },     // elite/champion overlays
  mapDrop: { ... },           // drop distribution and bad-luck thresholds
  actBands: [ ... ],          // act part level ranges
  gem: { ... },               // per-level deltas and floors
  affixGates: { ... },        // iLvl thresholds per tier name
};
```

Acceptance:
- Entering any map logs one consistent AreaLevel value and the `scalingConfig.version` in use.
- All spawned enemies and bosses in that map report the same AreaLevel source.
- Changing any number in `scalingConfig.js` and re-running simulation scripts immediately reflects the new value.

## Phase 2: Enemy and Boss Scaling Curves (1 to 100)

Objective:
- Introduce stable numeric curves with controlled growth and minimal spikes.
- Express all coefficients as named constants in config so a tuner can read, adjust, and reason about each one independently.

Curve formulas (pure functions, coefficients from config):
```
Let L = AreaLevel, and C = SCALING_CONFIG.enemy

EnemyLifeMult(L)    = 1 + C.lifeLinear x (L - 1) + C.lifeQuad x (L - 1)^2
EnemyDamageMult(L)  = 1 + C.dmgLinear  x (L - 1) + C.dmgQuad  x (L - 1)^2
EnemySpeedMult(L)   = 1 + min(C.speedCap, C.speedPerLevel x (L - 1))
EnemyArmorPenMult(L)= 1 + min(C.armorPenCap, C.armorPenPerLevel x (L - 1))
```

Initial config values to start from:
```js
enemy: {
  lifeLinear:       0.11,
  lifeQuad:         0.0016,
  dmgLinear:        0.085,
  dmgQuad:          0.0012,
  speedPerLevel:    0.0025,
  speedCap:         0.22,
  armorPenPerLevel: 0.0035,
  armorPenCap:      0.35,
},
```

Boss multipliers (applied on top of enemy curves, stored separately so boss feel can be tuned without touching enemy feel):
```js
boss: {
  lifeMult:       3.6,
  damageMult:     1.45,
  mitigationPerLevel: 0.003,
  mitigationCap:  0.30,
},
```

Elite and champion overlays (flat multipliers, independently tunable):
```js
eliteChampion: {
  eliteLife:     1.9,
  eliteDamage:   1.25,
  championLife:  2.6,
  championDamage:1.38,
},
```

Acceptance:
- Time-to-kill and death-rate curves are monotonic across level buckets.
- No sudden survivability cliff across any 5-level interval.
- A designer can change `lifeLinear` from 0.11 to 0.09 and run `npm run simulate:scaling` to see the new TTK curve within seconds.

## Phase 3: Campaign Level Banding (Acts Split Into 5 Parts)

Objective:
- Define each act's five progression segments as plain data in config so banding can be adjusted without touching zone logic.

Config structure:
```js
actBands: [
  { act: 1, parts: [[1,3], [4,6], [7,8], [9,10], [11,12]] },
  { act: 2, parts: [[13,15], [16,18], [19,20], [21,22], [23,24]] },
  { act: 3, parts: [[25,27], [28,30], [31,32], [33,34], [35,36]] },
  { act: 4, parts: [[37,39], [40,42], [43,44], [45,46], [47,48]] },
  { act: 5, parts: [[49,51], [52,54], [55,56], [57,58], [59,60]] },
],
```

Rules:
- Zone exits within an act increase by 1 to 3 levels; this delta range is also a config value (`actBands.zoneExitDeltaMin`, `actBands.zoneExitDeltaMax`).
- End-of-act bosses use the top of the act band.
- Rebanding an act means editing one array entry in config, not touching zone files.

Acceptance:
- Campaign progression naturally seeds players into early map iLvl space.
- A content designer can try a different act split by editing `actBands` and running validation.

## Phase 4: Map Drop Progression and Climb Logic

Objective:
- Make map progression self-sustaining and climbable, with all weights editable in one place.

Drop rules:
- Campaign acts: dropped map iLvl = AreaLevel ± 2, clamped.
- Map instances: dropped map iLvl = CurrentMapItemLevel − 5 to +5, weighted toward climb.

Config structure:
```js
mapDrop: {
  campaignVariance:    2,   // +/- from AreaLevel in acts
  instanceMinDelta:   -5,
  instanceMaxDelta:    5,
  // weights for deltas -5 through +5 (11 entries, must sum to 1.0)
  instanceWeights: [0.04, 0.03, 0.03, 0.09, 0.09, 0.22, 0.14, 0.14, 0.08, 0.08, 0.06],
  badLuckThreshold:    6,   // maps without a non-negative delta before protection triggers
  bossDropFloor:      0.35, // guaranteed map drop chance on boss kill
},
```

Having the weight table as a flat array means a tuner can see the shape of the distribution at a glance and adjust individual slots without any formula changes.

Acceptance:
- Long-run simulation shows players can steadily progress toward iLvl 100 without extreme droughts.
- Changing `badLuckThreshold` or any weight slot immediately updates simulation output.

## Phase 5: Skill Gem and Support Gem Numeric Scaling (1 to 20)

Objective:
- Replace breakpoint fantasy with smooth per-level progression driven entirely by config values.
- Remove all level 20 special-effect unlocks.

Policy change:
- Level 20 is the top of numeric scaling only — no unlock, no bonus, no special behavior.
- All per-level deltas live in `SCALING_CONFIG.gem` so gem feel can be adjusted globally without touching individual skill files.

Config structure:
```js
gem: {
  active: {
    dmgPerLevel:        0.045,  // +4.5% multiplicative per level  (~x2.30 at lvl 20)
    manaCostPerLevel:   0.012,  // +1.2% multiplicative per level
    cooldownPerLevel:  -0.007,  // -0.7% per level
    cooldownFloor:      0.78,   // floor at 78% of base
    castTimePerLevel:  -0.005,  // -0.5% per level
    castTimeFloor:      0.82,
    aoePerLevel:        0.009,  // +0.9% per level for radius/duration
  },
  support: {
    throughput:  { effectRange: [1.12, 1.32], manaMult: [1.35, 1.20] },
    utility:     { effectRange: [1.06, 1.22], manaMult: [1.20, 1.10] },
    ailment:     { effectRange: [1.10, 1.30], manaMult: [1.28, 1.16] },
  },
},
```

The `effectRange` and `manaMult` arrays are [level1Value, level20Value]; the engine interpolates linearly. A tuner can give throughput supports a stronger curve simply by changing `1.32` to `1.40`.

Mandatory cleanup tasks:
- Remove any level 20 special bonus wording from plan docs.
- Remove all `_applyMaxLevelEffect` / `maxLevelBonus` code paths from `skills.js`.
- Update any UI tooltip copy that claims level 20 grants a special extra effect.

Acceptance:
- All skill and support gems scale via shared numeric curves driven by config.
- No one-off level 20 behavior remains in implementation, docs, or tooltips.
- A designer can globally reduce gem scaling power by changing one number in one file.

## Phase 6: Affix iLvl Gating (Deferred but Planned)

Objective:
- Use item iLvl to gate stronger affix tiers while keeping base items static.
- Gates are defined in config as named tiers so the threshold values can be adjusted without touching the affix pool logic.

Config structure:
```js
affixGates: {
  minor:    1,
  major:    25,
  advanced: 50,
  high:     75,
  pinnacle: 90,
},
```

Acceptance:
- Affix progression aligns with map climb and does not invalidate low-level economy.
- A designer can shift the `advanced` gate from 50 to 40 by editing one number.

## Implementation Milestones

Milestone A:
- `scalingConfig.js` created; Phase 1 plumbing and Phase 2 curves enabled behind a `scalingProfileVersion` flag.

Milestone B:
- Phase 3 campaign rebanding shipped; `actBands` config driving all zone AreaLevel lookups.

Milestone C:
- Phase 4 map sustain loop active; `mapDrop` weights validated by simulation script.

Milestone D:
- Phase 5 gem rework complete; all gems read from `SCALING_CONFIG.gem`; level 20 special-effect code removed.

Milestone E:
- Phase 6 affix gating live; all gates driven by `affixGates` config.

## Validation and Tooling

Required checks per milestone:
- `npm run content:validate` passes.
- Production build passes.
- `npm run simulate:scaling` — encounter simulation across AreaLevel 1-100, outputs TTK and death-rate curve.
- `npm run simulate:mapdrops` — long-run drop distribution sim against `mapDrop` config.
- Combat telemetry review for TTK and death-rate trend in production.

The simulation scripts must read directly from `SCALING_CONFIG` so that any config change is immediately exercised by the sim without a code change.

Recommended KPIs:
- Median time to kill standard enemy by 10-level bucket.
- Median player deaths per map by iLvl bucket.
- Map sustain ratio at each iLvl band.
- Percent of runs that reach iLvl 100 within target session count.

## Risks and Mitigations

Risk:
- Over-scaling life creates slog while damage remains spiky.
Mitigation:
- Tune `lifeLinear`/`lifeQuad` and `dmgLinear`/`dmgQuad` independently; the named config keys make it obvious which lever to pull.

Risk:
- +-5 map variance can still produce progression stalls.
Mitigation:
- Adjust `instanceWeights` slots for positive deltas and lower `badLuckThreshold`; changes take effect immediately in the sim.

Risk:
- Removing level 20 specials feels like loss of excitement.
Mitigation:
- Compensate through stronger continuous scaling (`dmgPerLevel`) and better level-up presentation at key checkpoints; both are config-adjustable.

Risk:
- Config object grows large and becomes hard to navigate.
Mitigation:
- Keep `scalingConfig.js` organized into clearly named top-level sections (enemy, boss, gem, mapDrop, actBands, affixGates) with a comment header on each block describing units and expected range.

## Immediate Next Steps

1. Create `src/game/config/scalingConfig.js` with the full structure outlined above.
2. Add AreaLevel plumbing and wire `scalingProfileVersion` from config into encounter metadata.
3. Implement enemy and boss scaling curve functions reading from config; add telemetry.
4. Author act part level bands in `actBands` config and connect to zone logic.
5. Replace level 20 gem special-effect logic with config-driven numeric interpolation.
6. Clean wording in main-plan and gem-facing UI text to match new policy.
7. Write `simulate:scaling` and `simulate:mapdrops` scripts that consume the config directly.

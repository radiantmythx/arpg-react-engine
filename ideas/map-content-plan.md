# Map Content Plan

## Goal

Expand the game from a single room-and-corridor map language into a broad library of procedural map archetypes while preserving the core loop:

- every run is still a map
- every map still culminates in a boss encounter
- acts are also maps, just with stronger authored identity and lower randomness
- layouts should increasingly express biome, pacing, threat profile, and boss anticipation

The target is not just "more tiles." The target is a content system where geometry changes gameplay.

## Current Baseline

The current generator is a solid first foundation:

- BSP-style rectangular room splits
- orthogonal corridors
- start room chosen from generated rooms
- boss room chosen as the farthest room from start
- room typing already exists: start, boss, combat, elite, treasure

This gives a good backbone for progression maps, but it currently biases the game toward:

- boxy geometry
- hallway chaining
- low silhouette variety
- limited tactical obstacles beyond walls
- little biome identity in traversal

The next step should be broadening generator families rather than endlessly tuning the current one.

## Design Pillars

### 1. Boss-Path Legibility

Every layout should still communicate forward momentum toward a boss. Even when the map is nonlinear, players should feel that they are pushing deeper rather than wandering randomly.

### 2. Distinct Combat Texture

Different map families should privilege different builds:

- open arenas reward kiting and projectile spread
- tight ruins reward choke control and AoE denial
- curved caverns reward movement and ambush awareness
- obstacle-dense sanctums reward blink and positioning tools

### 3. Readable Randomness

Procedural variety should not become visual noise. A player should be able to read a level family within 3 to 5 seconds of entering it.

### 4. Biome Drives Layout

Map themes should not be mere color swaps. A swamp should generate differently from a catacomb. A canyon should create lane pressure differently from a courtyard.

### 5. Acts and Endgame Share a Grammar

Acts can use more curated versions of generator families, while endgame maps can use more extreme variants and modifiers. This keeps asset investment reusable.

## Recommended Generator Architecture

Move from one generator to a generator suite.

Each map definition should eventually choose from:

- `layoutFamily`: high-level structure
- `pathStyle`: straight, curved, looping, branching, spiral
- `obstacleSet`: pillars, rubble, water, trenches, roots, lava seams, cages, etc.
- `arenaStyle`: circular, rectangular, ring, broken, pillar, moat, cruciform
- `setpieceDensity`: none, low, medium, high
- `hazardProfile`: static, telegraphed, periodic, moving

Suggested top-level families:

1. `bsp_fortress`
2. `meandering_cavern`
3. `looping_garden`
4. `branching_catacomb`
5. `canyon_spine`
6. `river_delta`
7. `spiral_descent`
8. `ring_sanctum`
9. `gauntlet_lane`
10. `island_chain`

## Layout Families

### 1. BSP Fortress

Use case:

- current acts
- ruined keeps
- prisons
- archives

Shape language:

- strong rectangles
- gates, barracks, courtyards
- boss in a throne room, chapel, or command chamber

Why it matters:

- easiest evolution of current system
- can absorb obstacle systems quickly

### 2. Meandering Cavern

Use case:

- caves
- fungal tunnels
- magma chambers
- root networks

Shape language:

- curved tunnels
- bulb rooms
- broken sightlines
- organic dead ends with rewards or elites

Generator approach:

- drunk-walk tunnel carving
- cellular automata smoothing
- occasional chamber stamps

### 3. Looping Garden

Use case:

- overgrown temples
- hedge mazes
- dream gardens
- grave orchards

Shape language:

- loops instead of strict branches
- many circular returns
- line-of-sight blockers from vegetation and statues

Gameplay texture:

- flank pressure
- repositioning pressure
- backtracking that feels intentional rather than wasted

### 4. Branching Catacomb

Use case:

- tombs
- ossuaries
- crypt libraries
- sewer lattices

Shape language:

- central spine plus side wings
- sealed rooms
- crypt clusters
- small chambers with brutal choke fights

Gameplay texture:

- high tension in narrow spaces
- strong elite ambush potential

### 5. Canyon Spine

Use case:

- deserts
- ravines
- frozen gulches
- broken badlands

Shape language:

- long curved main route
- elevated cliff walls implied through impassable boundaries
- occasional overlooks and side shelves

Gameplay texture:

- forward pressure
- ranged enemies become more threatening
- strong boss build-up at route terminus

### 6. River Delta

Use case:

- marshes
- drowned ruins
- toxic floodplains
- glacial thaw fields

Shape language:

- multiple partial routes separated by water or sludge
- bridges, fords, causeways
- branching reconnection patterns

Gameplay texture:

- movement denial
- risk/reward around narrow crossings

### 7. Spiral Descent

Use case:

- abyssal pits
- cursed towers inverted downward
- ritual sinkholes
- dream vortices

Shape language:

- inward or downward spiral path
- boss arena in the center or deepest node

Gameplay texture:

- excellent boss anticipation
- simple directional clarity
- dramatic for acts and special maps

### 8. Ring Sanctum

Use case:

- celestial observatories
- coliseums
- machine shrines
- flooded arenas

Shape language:

- outer loop, inner loop, radial connectors
- boss arena in center or isolated sector

Gameplay texture:

- many tactical choices
- enemies can collapse from multiple directions

### 9. Gauntlet Lane

Use case:

- siege roads
- bridge assaults
- barricaded avenues
- blood canals

Shape language:

- mostly linear progression
- staged combat pockets
- clear midpoint gate moment

Gameplay texture:

- strong pacing control
- best place for obstacle tutorials and minibosses

### 10. Island Chain

Use case:

- shattered floating ruins
- lava plates
- glacier floes
- necropolis rooftops

Shape language:

- discrete arenas linked by bridges or narrow connectors
- boss on final or largest island

Gameplay texture:

- punctuated encounters
- strong room identity
- clear escalation beats

## Curves and Organic Space

To introduce curves without needing true non-grid collision, use grid-native techniques that read as curved:

1. Tunnel worms
- carve a spline-like route by stepping direction gradually rather than by right angles

2. Chamber stamps
- stamp circles, ovals, crescents, and kidney shapes onto tilemaps

3. Smoothing passes
- after raw organic carve, run cellular smoothing to reduce box edges

4. Diagonal blocking clusters
- place small triangular wall groups to fake rounded turns

5. Broken edge masks
- erode room corners and corridor mouths to soften the BSP look

This keeps navigation cache and tile collision workable while making levels feel less grid-obvious.

## Obstacle Taxonomy

Obstacles should be introduced in layers.

### Layer 1. Passive Line-of-Sight Obstacles

- pillars
- statues
- rubble heaps
- tomb stacks
- tree trunks
- crystal spines

Purpose:

- make open rooms more tactical
- create projectile breaks
- give melee enemies ambush angles

### Layer 2. Soft Terrain

- mud
- shallow water
- ash drifts
- thorn patches
- cracked ice
- corrupted carpet

Purpose:

- alter movement without hard walls
- create route preference and danger zones

### Layer 3. Hard Traversal Features

- gates
- bridges
- trenches
- collapsed hallways
- prison bars
- bone fences

Purpose:

- create pacing gates and route identity

### Layer 4. Hazard Obstacles

- periodic flame vents
- poison pools
- lightning relays
- swinging pendulums
- collapsing floor tiles
- blood geysers

Purpose:

- make traversal itself part of challenge
- give maps more than pure enemy pressure

### Layer 5. Encounter Setpieces

- summoning circles
- elite shrines
- cursed chests
- boss antechambers
- trap gauntlets
- locked vault rooms

Purpose:

- create memorable micro-objectives inside generated maps

## Encounter Grammar Per Map

Each generated map should aim to contain these beats even when geometry differs:

1. Safe-ish spawn area
2. Early read of map family
3. First pressure room or lane test
4. Midpoint escalation or miniboss pocket
5. Pre-boss warning zone
6. Boss arena with distinctive geometry

That keeps procedural content aligned with the "boss at the end" structure.

## Content Packs By Biome

Each biome should combine a layout family with an obstacle package and boss-arena style.

### Pack 1. Ruined Keep

- family: `bsp_fortress`
- obstacles: pillars, barricades, gatehouses
- boss arena: throne hall or shattered courtyard

### Pack 2. Flooded Crypt

- family: `branching_catacomb`
- obstacles: shallow water, sarcophagus clusters, narrow bridges
- boss arena: drowned mausoleum

### Pack 3. Thorn Maze

- family: `looping_garden`
- obstacles: hedges, roots, brambles, hidden chokepoints
- boss arena: rose court

### Pack 4. Ash Canyon

- family: `canyon_spine`
- obstacles: lava cracks, narrow ledges, broken siege lines
- boss arena: caldera rim

### Pack 5. Fungal Grotto

- family: `meandering_cavern`
- obstacles: spore pods, mushroom pillars, toxic bloom patches
- boss arena: giant bloom chamber

### Pack 6. Sunken Delta

- family: `river_delta`
- obstacles: reeds, fords, flooded islands, rot pools
- boss arena: temple island

### Pack 7. Observatory Ring

- family: `ring_sanctum`
- obstacles: rotating relay pillars, lenses, beam blockers
- boss arena: central astrolabe

### Pack 8. Bone Vault

- family: `branching_catacomb`
- obstacles: ossuary walls, bone piles, spike trenches
- boss arena: ossuary cathedral

### Pack 9. Spiral Abyss

- family: `spiral_descent`
- obstacles: collapsing outer ledges, summoning runes, void tears
- boss arena: abyssal core

### Pack 10. Siege Road

- family: `gauntlet_lane`
- obstacles: wagons, barricades, fire pits, kill-boxes
- boss arena: breached gate plaza

### Pack 11. Fractured Glacier

- family: `island_chain`
- obstacles: ice walls, slip zones, crack bridges
- boss arena: frozen lake circle

### Pack 12. Machine Cloister

- family: `ring_sanctum`
- obstacles: pistons, grinder lanes, energy rails
- boss arena: engine nave

## Map Idea Library

Use this as the "ton of different types" backlog. These are procedural archetypes, not one-off handcrafted maps.

1. Barracks labyrinth
2. Processional cathedral
3. Broken aqueduct
4. Root-choked temple
5. Flood-channel marsh
6. Hollow antler forest
7. Crystal sink cavern
8. Lava vein foundry
9. Sun-bleached canyon road
10. Ritual hedge maze
11. Tomb lattice
12. Hanging bridge archipelago
13. Spiral observatory
14. Sewer bifurcation web
15. Dead orchard loop
16. Shattered plaza district
17. Prison block gauntlet
18. Coral ruin delta
19. Glacier fissure chain
20. Bone kiln catacomb
21. Blackglass garden
22. Colossus ribcage interior
23. Clockwork cloister
24. Drowned archive
25. Smoke quarry
26. Chapel ringway
27. Fungal trench system
28. Salt flat monolith field
29. Blood canal citadel
30. Dream court spiral

## Acts vs Endgame Content Strategy

### Acts

Acts should introduce map language in a readable order.

Act structure recommendation:

- Act 1: fortress, road, simple graveyard, early cave
- Act 2: marsh, canyon, catacomb, temple garden
- Act 3: machine spaces, flooded ruins, ring sanctums, prisons
- Act 4+: more exotic hybrid families and hazard-heavy variants

Act maps should bias toward:

- fewer layout variables per map
- clearer routes
- obstacle types introduced one at a time
- stronger thematic identity

### Endgame Maps

Endgame can remix everything:

- hybrid families
- heavier hazards
- extreme arena modifiers
- layout-affecting map mods
- boss arena corruption variants

Examples:

- `Twisting`: adds more loops and curved side routes
- `Fortified`: adds barricades, gates, choke points
- `Flooded`: adds water channels and fewer wide floors
- `Overgrown`: adds soft blockers and ambush pockets
- `Volatile`: injects active hazard clusters

## Rollout Roadmap

This rollout should be treated as a production sequence, not just a design wishlist. The intent is to get visible variety early, keep implementation risk low, and avoid overcommitting to art pipelines before the geometry and gameplay grammar are proven.

For the near and mid term, all new map visuals should continue using placeholder graphics drawn fully in code, just like the current game. That means:

- floors are still color fields, patterns, outlines, and decals rendered procedurally
- obstacles are still shape-driven primitives
- terrain and hazards are still readable via color, animation, and silhouette
- no phase should block on sprite production

Sprite support should be a later abstraction once the content system is stable enough to justify it.

### Phase 1. Strengthen the Existing BSP Generator

Primary objective:

- make the current room-and-corridor generator feel like multiple map variants instead of one map repeated forever

Implementation scope:

- add room template variants to the current BSP leaf carving
- support non-rectangular room stamps inside BSP leaves: clipped corners, pill rooms, long halls, courtyards, offset chambers
- vary corridor widths from 1 to 3 tiles based on map theme or room pairing
- add corridor mouth widening so transitions into rooms do not always feel like rigid doorways
- add boss room templates with deliberate silhouettes: throne rectangle, circular duel room, cross-shaped chapel, pillar hall, broken arena
- add simple in-room obstacle seeding for combat rooms and elite rooms only

Recommended code changes:

- split `MapGenerator.generate()` into helper stages:
  - partition
  - room carve
  - corridor carve
  - room typing
  - arena shaping
  - obstacle seeding
- add a lightweight `roomShape` property to generated rooms
- add a lightweight `bossArenaStyle` property to map output

Rendering expectations:

- continue using code-drawn tiles and props
- use floor tint shifts, border lines, pillar circles, rubble rectangles, and shadow blobs to visually separate room types

Success criteria:

- players can notice obvious room variety immediately
- boss rooms stop looking like ordinary rooms with a boss dropped inside
- existing navigation and spawner systems continue to work with minimal disruption

### Phase 2. Add a Formal Map Layout API

Primary objective:

- stop treating map generation as one monolithic method and define stable data contracts before adding more families

Implementation scope:

- create a layout-family dispatch layer so map generation becomes:
  - resolve map definition
  - choose generator family
  - build raw geometry
  - decorate geometry
  - build encounter metadata
- normalize map output so all families return the same core structure:
  - tiles
  - rooms or regions
  - paths
  - start area
  - boss area
  - obstacle placements
  - terrain tags
  - encounter nodes

Recommended code changes:

- introduce family-specific generator methods or modules such as:
  - `generateBspFortress`
  - `generateMeanderingCavern`
  - `generateGauntletLane`
- introduce `mapDef.layoutFamily` and `mapDef.pathStyle`
- keep `MapGenerator.generate()` as an orchestrator rather than the sole implementation body

Rendering expectations:

- no new art system yet
- instead, define per-family render hints such as floor palette, wall palette, and decal style so visuals can scale later

Success criteria:

- adding a new family no longer requires hacking conditionals all through one generator body
- map definitions become expressive enough to carry biome intent

### Phase 3. Ship the First Organic Layout Family: Meandering Cavern

Primary objective:

- break the rectangular visual language and prove curved, organic traversal works in the current collision/navigation model

Implementation scope:

- add a cavern generator using tunnel worms, chamber stamps, and smoothing passes
- generate bulb chambers connected by winding paths instead of hard orthogonal hallways
- add fake curvature through diagonal blocker clusters and eroded corners
- create boss chambers that feel excavated or naturally hollowed rather than architected

Gameplay goals:

- more broken sightlines
- more flank routes
- stronger ambush potential
- more positional tension for ranged builds

Recommended code changes:

- introduce region typing beyond "room" for organic families, such as `chamber`, `tunnel`, `pocket`, `nest`, `boss_basin`
- ensure navigation cache tolerates less regular walkable space
- audit enemy spawn heuristics so enemies do not clip into narrow tunnels or boss pockets

Rendering expectations:

- code-draw cavern edges with irregular outlines
- use layered floor noise, darker wall fill, fungus pods, crystal clusters, or roots as primitive shapes

Success criteria:

- the cavern family is immediately distinguishable from the fortress family
- pathing remains reliable
- combat stays readable in curved geometry

### Phase 4. Ship the First Directed Layout Family: Gauntlet Lane

Primary objective:

- add a highly controlled progression map family that can teach pacing, obstacle use, and pre-boss escalation

Implementation scope:

- create a mostly linear map generator with staged combat pockets
- include lane widenings, chokepoints, barricaded sections, and one or two side alcoves for optional rewards
- add a midpoint escalation node such as a gate, miniboss pocket, or elite barricade cluster
- generate a strongly telegraphed final boss plaza

Gameplay goals:

- clear forward pressure
- highly legible momentum
- better control over encounter pacing and tutorialization

Recommended code changes:

- add support for "sequence nodes" in the map layout, not just rooms
- allow future map scripting to anchor events to these nodes

Rendering expectations:

- use lane markings, rubble lines, fences, torches, broken wagons, and gate silhouettes drawn from primitives

Success criteria:

- the game gains at least one family that feels authored even though it is generated
- acts can use this family to stage memorable boss build-up

### Phase 5. Introduce the Static Obstacle System

Primary objective:

- make geometry influence combat even before hazards and complex interactions exist

Implementation scope:

- define obstacle categories:
  - line-of-sight blockers
  - collision blockers
  - decorative blockers with no collision
  - boss-arena props
- start with static obstacles only
- add placement rules per room/region type
- support anchor placement, cluster placement, and symmetry placement for boss rooms

Recommended first obstacle set:

- pillars
- statues
- rubble piles
- sarcophagi
- trees
- crystal growths

Recommended code changes:

- map output should include `obstacles[]` with position, radius/footprint, type, and optional render hint
- navigation should treat collision obstacles as walls or blocked tiles
- spawners should avoid obstacle overlap

Rendering expectations:

- keep obstacles fully code-drawn using circles, rectangles, shadows, outlines, and simple animation where needed

Success criteria:

- open rooms stop playing like empty boxes
- obstacle density can be tuned by family and biome

### Phase 6. Add Soft Terrain and Traversal Texture

Primary objective:

- move beyond binary wall-or-floor spaces so maps gain movement identity without becoming trap-heavy too early

Implementation scope:

- add terrain tags to tiles or tile clusters
- implement a first set of soft terrain types:
  - mud
  - shallow water
  - ash
  - brambles
  - cracked ice
- define gameplay effects conservatively at first, such as small movement penalties or enemy-specific bonuses later
- add clear visual telegraphing for all terrain zones

Recommended code changes:

- extend map output with a `terrainMask` or `terrainZones[]`
- update movement and collision checks to consult terrain modifiers without destabilizing existing controls
- ensure renderer draws terrain beneath props and entities cleanly

Rendering expectations:

- terrain remains code-drawn with color overlays, animated ripples, drifting embers, thorn outlines, and surface noise

Success criteria:

- players can feel that a swamp, crypt, and canyon play differently even before hazard systems are added
- terrain remains readable under combat pressure

### Phase 7. Convert Families Into Biome Content Packs

Primary objective:

- stop shipping "generators" as abstract tech and start shipping content packs that feel like real maps

Implementation scope:

- create a biome-pack registry that bundles:
  - layout family
  - allowed path styles
  - obstacle set
  - terrain palette
  - enemy package preferences
  - boss arena style pool
  - visual render hints
- convert a first set of map packs, for example:
  - ruined keep
  - fungal grotto
  - flooded crypt
  - siege road
  - ash canyon
- define which packs belong to acts versus endgame pools

Recommended code changes:

- map defs should reference biome packs instead of directly specifying every field in all cases
- allow map defs to override pack defaults for special maps and bosses

Rendering expectations:

- still code-only visuals, but now driven by pack-level palettes and prop recipes instead of ad hoc generator-specific colors

Success criteria:

- new map content can be authored mostly through data and pack composition
- the same family can feel different across multiple biomes

### Phase 8. Add Encounter Setpieces and Boss Approach Logic

Primary objective:

- make generated maps feel intentionally staged, not just spatially varied

Implementation scope:

- add setpiece node types:
  - shrine room
  - elite ambush room
  - cursed chest pocket
  - trap antechamber
  - vault side room
  - boss prelude hall
- add boss approach rules so the final third of the map reliably builds anticipation
- add simple per-family encounter grammar templates

Recommended code changes:

- map layouts should contain encounter metadata separate from pure geometry
- spawner should read region types and encounter tags when choosing pack composition
- boss arenas should support arena-specific obstacle presets and spawn boundaries

Rendering expectations:

- setpieces should use code-drawn signature elements like ritual circles, braziers, banners, bones, or machines

Success criteria:

- entering a boss room feels authored
- midpoint encounters become memorable rather than invisible procedural variance

### Phase 9. Add Layout-Affecting Map Mods and Hybrid Families

Primary objective:

- make endgame maps exciting because they change the play space, not only enemy numbers

Implementation scope:

- add geometry-affecting mod hooks such as:
  - `Twisting`
  - `Fortified`
  - `Flooded`
  - `Overgrown`
  - `Volatile`
- permit controlled family hybrids such as:
  - fortress + flooded
  - catacomb + bone vault
  - canyon + gauntlet
  - garden + ring sanctum
- add corruption variants for boss arenas and late-map traversal

Recommended code changes:

- map mods should be able to modify layout params before generation and decoration rules after generation
- map instances should preserve enough generation metadata to explain why a map looks the way it does

Rendering expectations:

- continue code-drawn visuals, but use stronger overlays and special-case render passes for corruption, flooding, overgrowth, and hazard versions

Success criteria:

- map items gain a real identity beyond stat tuning
- endgame geometry starts feeling combinatorial and replayable

### Phase 10. Add Render Abstraction for Optional Sprite-Based Map Presentation

Primary objective:

- keep procedural content and gameplay systems stable while making it possible, much later, to swap some map rendering layers from code-drawn primitives to sprites or tilesets

Important constraint:

- this phase should happen only after the geometry, obstacle, terrain, and biome-pack systems have stabilized
- sprites are a presentation layer upgrade, not a prerequisite for map variety

Implementation scope:

- define a rendering abstraction where map content exposes semantic types rather than hardcoded drawing behavior
- examples:
  - `floorStyle: crypt_stone`
  - `wallStyle: fungal_wall`
  - `obstacleStyle: sarcophagus_large`
  - `terrainStyle: shallow_water_green`
- keep two rendering modes possible:
  - procedural code-drawn mode
  - sprite/tileset-backed mode
- ensure collision, navigation, spawns, and map logic remain completely independent from whether visuals are code-drawn or sprite-based

Recommended code changes:

- introduce render descriptors on map output and props
- refactor renderer so it consumes semantic draw data rather than assuming all visuals are primitive geometry forever
- preserve code-drawn fallback for all content even after sprite support exists

Success criteria:

- art production can be introduced incrementally without rewriting generator logic
- debug readability remains strong because code-drawn fallback always exists

## Delivery Notes

Recommended implementation order by value:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9
10. Phase 10

This order is deliberate:

- early phases improve visible variety fast
- middle phases convert geometry into gameplay texture
- late phases turn the system into scalable content
- sprite support stays late, where it belongs

## Data Model Recommendation

Add fields like these to map definitions over time:

```js
{
  id: 'flooded_crypt_01',
  name: 'Flooded Crypt',
  tier: 3,
  biome: 'crypt',
  layoutFamily: 'branching_catacomb',
  pathStyle: 'branching',
  obstacleSet: ['shallow_water', 'sarcophagus', 'bridge'],
  hazardProfile: 'static',
  arenaStyle: 'mausoleum',
  setpieceDensity: 'medium',
  bossApproach: 'narrowing_corridor',
}
```

This will scale much better than baking all behavior into a single `MapGenerator.generate()` branch.

## Success Criteria

This plan is working when:

- players can recognize map families quickly
- movement and positioning strategies differ between maps
- bosses feel foreshadowed by level geometry
- acts feel more authored without losing procedural replayability
- endgame maps become content, not just stat containers

## Recommended First 6 Implementation Targets

1. Boss arena templates for the existing BSP generator
2. Room obstacle placement inside current combat rooms
3. Curved cave generator
4. Linear gauntlet generator
5. Soft terrain system
6. Biome-pack registry that chooses generator + obstacle rules together

If executed in this order, the game gets immediate variety first, then true geometric identity, then long-term scalable content.

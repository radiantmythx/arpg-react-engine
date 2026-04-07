# ARPG Conversion Plan

This document maps out the conversion from the current Vampire Survivors-style roguelite into a
PoE-adjacent ARPG with persistent characters, a hub world, structured maps, cluster spawning, and
a portal-based death system.

It is now integrated with [main-plan.md](main-plan.md):

- [main-plan.md](main-plan.md) is the canonical master roadmap
- [conversion-plan.md](conversion-plan.md) is the focused ARPG phase tracker

---

## Guiding Principles

- **Keep everything that works.** All Phase 10–12 content (items, defense layers, skills, gem
  engine, passive tree, combat systems) stays intact. The conversion is a structural change to
  _how the player interacts_ with that content, not to the content itself.
- **No permadeath.** Death consumes a portal and returns the player to the hub. Losing all portals
  simply closes the map instance — the character is never deleted.
- **Persistent characters.** Characters are serialized to `localStorage` and survive across browser
  sessions. A player can have multiple characters.
- **Map items are optional endgame.** The first 3–4 "Acts" are free maps accessible from the hub.
  Map items are used to create specialized endgame instances beyond that.

---

## Integration Checklist (Current Status)

- [x] C1 Character save system
- [x] C2 Game state machine rework
- [x] C3 Hub world
- [x] C4 Map layout engine
- [x] C5 Cluster spawner
- [x] C6 Portal system
- [x] C7 Free act maps
- [x] C8 Map items and map device
- [x] C9 Runtime map mod application
- [x] C10 UI polish and character sheet
- [x] C11.1 Enemy aggro state system
- [x] C11.2 Local pack alert propagation
- [x] C11.3 Wall-aware navigation and LOS-first chase

---

## What Changes vs What Stays

### Stays Unchanged

| System | Notes |
|--------|-------|
| All Phase 10–12 combat systems | Items, skills, gems, ailments, collision, weapons — untouched |
| `Renderer.js` | Adds wall tile drawing; camera logic stays |
| `Player.js`, `Enemy.js`, `BossEnemy.js` | Core entity logic unchanged |
| `CollisionSystem.js` | Adds wall-vs-entity checks; rest unchanged |
| `SpatialGrid.js` | Unchanged |
| `AudioManager.js`, `InputManager.js` | Unchanged |
| `PassiveTree`, `MetaTree` | Data stays; skill points now earned per character-level, not per run |
| `InventoryGrid.js`, item/affix pipeline | Unchanged |
| Character classes (Sage, Rogue, Warrior) | Now used as persistent character archetypes |

### Changes

| System | Change |
|--------|--------|
| `GameEngine.js` state machine | New states: `HUB`, `MAP_LOADING`, `MAP_RUNNING`; GAME_OVER → DIED |
| `WaveSpawner.js` | Replaced by `ClusterSpawner.js` (cluster placement, no time-based loop) |
| `MetaProgression.js` | Run history → character journal; Chaos Shards become account-wide crafting currency |
| `ExperienceSystem.js` | Level/XP persists across maps on the character; no run-level reset |
| `App.jsx` | New screens: CharacterSelect, CharacterCreate, Hub, MapSelect, MapComplete |
| `MainMenu.jsx` | Simplifies to "New Character", "Continue", "Options" |
| `GameOver.jsx` | Repurposed as `DeathScreen.jsx` — shows portals remaining, "Return to Hub" |
| `RunHistory.jsx` | Repurposed as `CharacterJournal.jsx` — maps cleared, bosses killed |

### New

| File | Purpose |
|------|---------|
| `src/game/CharacterSave.js` | Serialize/deserialize full character state to `localStorage` |
| `src/game/MapGenerator.js` | BSP-tree procedural map: rooms, corridors, walls, enemy cluster placement |
| `src/game/MapInstance.js` | Runtime map state: portals remaining, clear status, seed, active mods |
| `src/game/ClusterSpawner.js` | Replaces WaveSpawner; places enemy clusters in rooms on map load |
| `src/game/HubWorld.js` | Hub renderer and interactable zone definitions |
| `src/game/entities/PortalEntity.js` | World entity: portal glyph, player overlap → hub transition |
| `src/game/data/mapDefs.js` | Free map definitions (5 Acts) + map item tier table |
| `src/components/HubScreen.jsx` | Hub overlay: interactable labels, map device prompt |
| `src/components/MapSelectScreen.jsx` | Browse free + item-generated maps |
| `src/components/MapCompleteScreen.jsx` | Boss-kill victory: loot display, portal-or-exit |
| `src/components/DeathScreen.jsx` | Portals remaining; Return to Hub button |
| `src/components/CharacterCreateScreen.jsx` | Name + class selection for new character |
| `src/styles/HubScreen.css` | Hub overlay styles |
| `src/styles/MapSelect.css` | Map select styles |

---

## Phase C1 — Character Save System

**Goal:** Fully serialize a character to `localStorage` so it persists between sessions.
Characters have names, classes, levels, equipment, inventory, passive tree state, skill gems, and
map progress.

### What to Build

**`src/game/CharacterSave.js`**

```
CharacterSave.save(characterId, data)    — JSON.stringify → localStorage
CharacterSave.load(characterId)          — parse + validate
CharacterSave.list()                     — returns array of { id, name, class, level, created }
CharacterSave.delete(characterId)        — removes key
CharacterSave.exists(characterId)        — boolean check
```

`data` schema:

```js
{
  id,           // uuid (crypto.randomUUID())
  name,
  class,        // 'sage' | 'rogue' | 'warrior'
  created,      // ISO timestamp
  lastPlayed,

  // combat stats
  level, xp,
  health, maxHealth,
  energyShield, maxEnergyShield,

  // systems
  passiveTree,       // { allocated: Set<nodeId> }
  metaTree,          // { allocated: Set<nodeId> }
  inventory,         // InventoryGrid.serialize()
  equipment,         // { [slot]: itemDef | null }
  activeSkills,      // ActiveSkillSystem.serializeFull()  (slots + gem tree)
  autoSkills,        // weapon ids equipped

  // map progress
  actsCleared,       // ['act1', 'act2', ...]
  mapsCleared,       // count
  bossesKilled,      // ['The Starveling', ...]
  chaosShards,       // account-level currency
}
```

**Changes to `MetaProgression.js`**

- Remove run-history tracking
- `chaosShards` migrates to `CharacterSave` data (per-character, not global)
- `LeagueStash` remains as a separate localStorage key (account-wide stash)

**Changes to `ExperienceSystem.js`**

- Remove run-level reset; `player.level` and `player.xp` are loaded from save on zone entry
- Add `ExperienceSystem.checkpoint(player, characterId)` — called after each map clear to save
  progress

**Changes to `App.jsx`**

- On mount: if no characters exist, go to `CharacterCreate` screen
- If characters exist, go to `CharacterSelect` screen
- Remove `startGame()` from MainMenu path; replace with character-based flow

**`CharacterSelectScreen.jsx`**

- Lists saved characters (name, class icon, level, last played)
- "New Character" button
- "Delete" (with confirmation)
- Click character → enter Hub for that character

**`CharacterCreateScreen.jsx`**

- Text input: character name (max 24 chars)
- Class picker (Sage / Rogue / Warrior cards, same data as `characters.js`)
- "Create" → `CharacterSave.save(id, initialState)` → enter Hub

---

## Phase C2 — Game State Machine Rework

**Goal:** Extend `GameEngine` state machine to support HUB and MAP states cleanly.

### New States

| State | Description |
|-------|-------------|
| `HUB` | Player is in the hub world; no enemies; interactable zones active |
| `MAP_LOADING` | Map is generating (brief — can skip to immediate on small maps) |
| `MAP_RUNNING` | Active map gameplay |
| `MAP_CLEARING` | Boss just died; victory flash, loot drop, portals collapse to exit |
| `DIED` | Player death in map; portals remaining > 0 |
| `MAP_COMPLETE` | React overlay showing loot + clear reward |

**Remove/Rename**

- `GAME_OVER` → used only for permadeath fallback (all portals gone AND no stash revival)
- `RUNNING` → rename to `MAP_RUNNING` to be explicit (or alias it)

### Changes to `GameEngine.js`

```js
// New fields
this.currentCharId = null;   // active character save id
this.mapInstance   = null;   // current MapInstance | null (null = in hub)
this.hubWorld      = null;   // HubWorld instance

// New methods
enterHub(characterId)   — load character, switch to HUB state, init HubWorld
enterMap(mapDef, seed)  — generate MapInstance, spawn clusters, switch to MAP_RUNNING
onPlayerDeath()         — if portals > 0: DIED + consume portal; else: final death
exitMap(cleared)        — save progress, return to hub
```

### Changes to `App.jsx`

- New state: `screen` now includes `'HUB'`, `'MAP_SELECT'`, `'MAP_COMPLETE'`, `'DIED'`
- Callbacks from engine: `onEnterHub`, `onMapComplete(stats)`, `onPlayerDied(portalsLeft)`
- Remove: `onGameOver` (replaced by `onPlayerDied`)

---

## Phase C3 — Hub World

**Goal:** A non-combat zone the player always returns to between maps. Contains all
management systems (stash, passive tree, map device).

### Layout

The hub is a fixed 2400 × 1600 px canvas map (the player can walk around it). It does not
scroll to infinity. Interactable zones are marked by floating labels.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  [Stash]          [WAYSTONE DEVICE]      [Vendor]   │
│                                                      │
│                      [Player]                        │
│                                                      │
│  [Passive Tree]                    [Crafting Bench]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### `src/game/HubWorld.js`

```js
class HubWorld {
  constructor(player) { ... }

  interactables = [
    { id: 'stash',       x, y, radius: 48, label: 'League Stash',    key: 'F' },
    { id: 'passive_tree',x, y, radius: 48, label: 'Passive Tree',    key: 'P' },
    { id: 'map_device',  x, y, radius: 48, label: 'Map Device',      key: 'M' },
    { id: 'vendor',      x, y, radius: 48, label: 'Vendor',          key: 'V' },
    { id: 'crafting',    x, y, radius: 48, label: 'Crafting Bench',  key: 'C' },
  ];

  update(dt, player, input) { ... }   // check overlaps, report nearby interactable
  draw(renderer) { ... }               // floor tiles, interactable glyphs, labels
  getNearbyInteractable(player) { return interactable | null }
}
```

**Drawing the Hub**

- Stone tile background (replace the current dot-grid pattern)
- Colored glowing circles for interactable zones with floating text label
- Player draws on top as normal
- No enemies, no projectiles, no spawner active in `HUB` state

**`HubScreen.jsx`** (React overlay over canvas)

- Shows `[Key] Action` prompt in bottom-center when player is near an interactable
- Open hub interactables: stash `→ InventoryScreen`, passive tree `→ PassiveTreeScreen`,
  map device `→ MapSelectScreen`, crafting `→ CraftingBenchScreen` (future)

**`GameEngine.updateHub(dt)`**

- Runs player movement + camera as normal
- Calls `hubWorld.update(dt, player, input)`
- No collision system, no wave spawner
- Calls `onHudUpdate` as normal (player HP/ES still visible)

---

## Phase C4 — Map Layout Engine

**Goal:** Replace the infinite background grid with bounded, walled maps that have rooms,
corridors, and a designated boss room.

### Approach: BSP (Binary Space Partition)

A BSP tree splits the map canvas recursively into rooms until rooms reach minimum size, then
connects adjacent rooms with corridors. Simple, fast, produces diverse layouts.

**`src/game/MapGenerator.js`**

```js
class MapGenerator {
  /**
   * @param {number} width   — canvas px width (e.g. 3200)
   * @param {number} height  — canvas px height (e.g. 3200)
   * @param {object} opts    — { minRoomSize, maxRoomSize, corridorWidth, seed }
   * @returns {MapLayout}
   */
  generate(width, height, opts) { ... }
}

// MapLayout output:
{
  walls:       Array<{ x, y, w, h }>,     // solid rect collision boxes
  rooms:       Array<Room>,               // { id, x, y, w, h, type }
  corridors:   Array<Corridor>,
  startRoom:   Room,                      // where player + portals spawn
  bossRoom:    Room,                      // where boss spawns
  clusterRooms: Array<Room>,             // non-start, non-boss rooms with enemies
  width, height,
}
```

Room types: `'start'`, `'boss'`, `'combat'`, `'elite'` (champion pack), `'treasure'` (chest + few enemies).

**Wall Collision**

- `CollisionSystem.checkEntityVsWalls(entity, walls)` — AABB overlap, push entity out
- Called for player and all enemies each frame
- Fast: use SpatialGrid for wall cells or just AABB broad-phase on walls array

**`Renderer` changes**

- `Renderer.drawMapLayout(layout)` — draws wall rects in dark stone color, floors in lighter color
- Called as the first draw step (replacing the dot-grid)
- Camera still centers on player as before

**`Minimap`** (optional, Phase C4.5)

- Small fixed-corner overlay showing explored rooms
- Room discovered when player enters it (fog of war)

---

## Phase C5 — Cluster Spawner

**Goal:** Replace time-based continuous enemy spawning with map-load-time cluster placement.
All enemies in a map are placed when the map generates — nothing spawns mid-run unless it's
a scripted boss phase.

### `WaveSpawner.js` → `ClusterSpawner.js`

**`src/game/ClusterSpawner.js`**

```js
class ClusterSpawner {
  /**
   * Populate entities.enemies based on map layout + map def difficulty.
   * Called once on map load, not each frame.
   */
  populateMap(mapLayout, mapDef, entities, difficulty) {
    // For each clusterRoom:
    //   roll enemy count (mapDef.packsPerRoom × [1–3])
    //   roll enemy types from mapDef.enemyPool (weighted by difficulty)
    //   place enemies randomly inside room rect (avoid walls)
    //   5% chance per room of champion pack (isChampion = true, ×1-3 enemies)

    // Place boss in bossRoom
    //   spawnBoss(mapDef.bossId, bossRoom.cx, bossRoom.cy)

    // Place treasure chests in treasure rooms (ItemDrop entities)
  }

  placeSingleEnemy(type, room, entities) { ... }
  spawnBoss(bossId, x, y, entities) { ... }
}
```

**Enemy sleeping** — enemies in distant rooms do not run AI until they're within
`ACTIVATION_RADIUS` (e.g. 1200 px) of the player. This keeps performance flat.

```js
// In Enemy.update(dt, player):
if (!this._active && dist(this, player) > ACTIVATION_RADIUS) return;
this._active = true;
// ... normal AI
```

**Kill tracking** — `MapInstance.enemiesTotal` and `MapInstance.enemiesKilled` are updated by
`GameEngine.onEnemyKilled()`. HUD can show a "Cleared X / Y" counter.

---

## Phase C6 — Portal System

**Goal:** Each map starts with 3 portals in the start room. Death consumes one portal and
returns the player to the hub. Re-entering the map (via hub portal) teleports back to the
start room with restored HP.

### `src/game/entities/PortalEntity.js`

```js
class PortalEntity extends Entity {
  constructor(x, y, type) { ... }
  // type: 'entry' (open, glowing blue) | 'used' (dim gray)

  draw(renderer) { ... }   // swirling glyph animation
}
```

**`src/game/MapInstance.js`**

```js
class MapInstance {
  constructor(mapDef, seed, layout) {
    this.mapDef    = mapDef;
    this.seed      = seed;
    this.layout    = layout;
    this.portals   = 3;          // decrements on each player death
    this.cleared   = false;      // true when boss dies
    this.elapsed   = 0;
    this.killCount = 0;
    this.portalsInWorld = [];    // PortalEntity[]
  }

  consumePortal() {
    this.portals--;
    return this.portals;  // returns remaining count
  }

  isExpired() { return this.portals <= 0 && !this.cleared; }
}
```

**Death Flow**

```
player.health <= 0
  → engine.onPlayerDeath()
    → if mapInstance.portals > 0:
        mapInstance.consumePortal()
        save character (as-is, no item loss)
        engine.setState('DIED')
        React shows DeathScreen ("X portals remaining — Return to Hub")
    → else:
        engine.setState('GAME_OVER')   // map is lost; character lives, but instance is gone
```

**Re-entry Flow**

```
Player clicks "Enter Map" in hub (when mapInstance exists and !cleared and portals > 0)
  → engine.enterMap(existing instance)
    → player.health restored to max
    → player spawns at startRoom center
    → portals already consumed remain used
```

**`DeathScreen.jsx`**

- Shows portals remaining as glyph icons (3 filled → grayed ones consumed)
- "Return to Hub" button → `engine.exitMap(false)`
- "Character" summary (name, level, class)

**Portal HUD element**

- Bottom-right corner: 3 portal icons (blue = available, gray = consumed)
- Appears only in `MAP_RUNNING` state

---

## Phase C7 — Free Maps (Acts)

**Goal:** 5 pre-defined maps the player can always run, no map item required. They provide the
initial progression path and unlock as the player clears each one.

### `src/game/data/mapDefs.js`

```js
export const FREE_MAPS = [
  {
    id:           'act1_ruin',
    name:         'The Ruined Coast',
    tier:         1,
    description:  'Crumbling cliffs overlooking a poisoned sea.',
    theme:        'coast',
    enemyPool:    ['basic', 'banshee', 'shade'],
    bossId:       'plague_herald',   // new boss
    packsPerRoom: 2,
    difficulty:   1.0,
    unlockReq:    null,              // always available
    rewards:      { xpMult: 1.0, itemLevel: 4 },
  },
  {
    id:           'act2_catacombs',
    name:         'The Sunken Catacombs',
    tier:         2,
    ...
    unlockReq:    'act1_ruin',
  },
  {
    id:           'act3_iron_fortress',
    name:         'The Iron Fortress',
    tier:         3,
    unlockReq:    'act2_catacombs',
  },
  {
    id:           'act4_void_rift',
    name:         'Void Rift',
    tier:         4,
    unlockReq:    'act3_iron_fortress',
  },
  {
    id:           'act5_the_abyss',
    name:         'The Abyss',
    tier:         5,
    unlockReq:    'act4_void_rift',
  },
];
```

**Map Select Screen (`MapSelectScreen.jsx`)**

- Two tabs: "Acts" (free maps) | "Map Device" (item maps)
- Each act card: name, theme thumbnail color, tier badge, unlock status, "Enter" button
- Locked acts show a padlock and the required clear
- On "Enter": `engine.enterMap(mapDef, Math.random())`

**Map Clear Progress** — stored in `CharacterSave.actsCleared[]`. An act that is cleared shows
a checkmark but can still be re-run for loot.

---

## Phase C8 — Map Items & Map Device

**Goal:** Players can use a map item (consumed on use) in the hub's Map Device to generate a
specialized map instance with modifiers, scaling difficulty and loot.

### Map Item Type

Added to item type system in `items.js`:

```js
{
  type:    'map',
  name:    'Weathered Map',
  tier:    1,          // 1–10; scales with player progression
  theme:   'ruins',    // determines visual theme + enemy pool variant
  mods:    [],         // rolled affixes (see below)
  iLvl:   12,          // item level; drives affix tier
}
```

Map items drop from enemies in acts (5–8% champion drop chance, 2–3% normal).

### Map Affixes (`mapDefs.js`)

Map mods follow the same prefix/suffix pool pattern as gear affixes:

| Mod | Type | Effect |
|-----|------|--------|
| `pack_size` | Prefix | +30% more enemy packs per room |
| `enemy_life` | Prefix | Enemies have +50% max HP |
| `enemy_speed` | Prefix | Enemies are 20% faster |
| `area_of_effect` | Prefix | Enemy AoE attacks have +40% radius |
| `reduced_player_regen` | Suffix | Player has no HP regen |
| `elemental_weakness` | Suffix | Player -25% elemental resistances |
| `extra_champion_packs` | Prefix | +3 additional champion packs |
| `corrupted` | Special | 1 extra mod; map is corrupted (cannot be modified by currency) |

Magic map = 1 prefix + 1 suffix; Rare = 3+3; Unique = fixed mods (named unique maps).

### Map Device (`HubWorld.js` interactable)

- Opens `MapSelectScreen` on the "Map Device" tab
- Player drags a map item from inventory into the device slot
- "Open Portal" button: generates instance → portal appears at Map Device location in hub
- Entering the hub portal starts `engine.enterMap(mapDef + rolled mods)`

### Map Item Currency

Future extension (Phase C8.5): Currency Orbs from Phase 13 (main-plan) can be applied to map
items to reroll/upgrade their mods before use.

---

## Phase C9 — Map Mods Runtime Application

**Goal:** Map modifiers from map items actually affect the generated MapInstance at runtime.

**`MapInstance.applyMods(mods)`**

Called during `engine.enterMap()`. Each mod is a key-value pair applied to the instance:

```js
// Examples:
{ id: 'enemy_life',    value: 1.5 }   // enemies spawned with ×1.5 max HP
{ id: 'enemy_speed',   value: 1.2 }   // enemies start with ×1.2 speed
{ id: 'pack_size',     value: 1.3 }   // ClusterSpawner multiplies pack counts
{ id: 'extra_champion_packs', value: 3 }
{ id: 'reduced_player_regen', value: true }  // Player.regenFlat set to 0 in this instance
```

`ClusterSpawner.populateMap` reads `mapInstance.mods` before placing enemies.

**HUD Mod Display** — small icons in the top-right corner during a map run showing active map
mods (hover for description).

---

## Phase C10 — UI Polish & Character Sheet

**Goal:** Clean up all screens to reflect the ARPG framing. Add a Character Sheet accessible
from the hub.

### Changes

**`MainMenu.jsx`**

- "New Character" → CharacterCreateScreen
- "Continue" → CharacterSelectScreen (or directly to Hub if only 1 character)
- "Options" → OptionsModal
- Remove "Start Run" button entirely

**`HUD.jsx`**

- Add portal counter (3 icons, bottom-right) in MAP_RUNNING state
- Add map name/tier display (top-center, fades after 3 s on map entry)
- Add "Cleared N/M" enemy counter (top-right) in MAP_RUNNING state
- Remove run timer (replaced by elapsed shown in journal)

**`MapCompleteScreen.jsx`**

- Triggered when boss dies (`engine.setState('MAP_CLEARING')`)
- Shows: map name, boss name killed, items dropped (grid), XP gained
- Buttons: "Exit to Hub" | "Stay" (stay in now-cleared map for looting)
- Portal icons collapse to a single gold "Exit Portal"

**`DeathScreen.jsx`** (replaces `GameOver.jsx`)

- "You Died" header
- Portal icons row (remaining vs consumed)
- Character name, level, map name
- "Return to Hub" button

**`CharacterJournal.jsx`** (replaces `RunHistory.jsx`)

- Acts cleared (with timestamps)
- Maps run count, bosses killed list
- High-level stat summary (hours played, total kills)

**`CharacterSheet.jsx`** (new, accessible from Hub with key `C`)

- Full stat summary: HP/ES, Armor/Evasion, damage stats from passive tree + gear
- Resistances (future: elemental resistances)
- Equipped skills with gem tree preview

---

## Phase C11 — Enemy AI Awareness & Aggro

**Goal:** Upgrade enemy behavior from simple direct-chase to map-aware combat AI.
Enemies should navigate around walls and only become aggressive when the player enters an aggro radius,
or when nearby enemies are alerted.

### Phase C11.1 — Aggro State System (No Pathfinding Yet)

**Goal:** Introduce explicit enemy alert states and proximity-based aggro without changing movement
strategy yet.

**Build Scope**

- `src/game/entities/Enemy.js`
  - Add AI fields: `aiState`, `aggroRadius`, `spawnX`, `spawnY`, `lastKnownPlayerX`, `lastKnownPlayerY`
  - Add methods: `tryAcquireAggro(player)`, `setAggro(source)`
  - Idle behavior: unaggroed enemies do not chase/attack
- `src/game/systems/ClusterSpawner.js`
  - Assign baseline `aggroRadius` values when enemies are spawned
  - Champions get larger aggro radius
- `src/game/GameEngine.js`
  - Ensure update loops call aggro acquisition checks before chase/attack logic

**Acceptance Criteria**

1. Enemies stay idle until player enters aggro radius.
2. Bosses remain always active (no idle gating).
3. Existing combat still functions once enemies are aggroed.

### Phase C11.2 — Local Pack Alert Propagation

**Goal:** Pulling one enemy can alert nearby enemies, but only locally.

**Build Scope**

- `src/game/entities/Enemy.js`
  - Add `propagationRadius` and optional `packId`
  - Support aggro source tagging (`player_proximity`, `ally_alert`, `damaged`)
- `src/game/systems/ClusterSpawner.js`
  - Stamp `packId` for spawned groups where possible
  - Set default `propagationRadius`
- `src/game/GameEngine.js`
  - Add alert propagation pass:
    - when an enemy aggroes, emit a local alert event
    - nearby idle enemies receive `setAggro('ally_alert')`
  - Prefer spatial queries over full-map scans if available

**Acceptance Criteria**

1. Pulling one pack alerts nearby allies in that pack/room.
2. Distant rooms do not chain-aggro map-wide.
3. Performance remains stable under high enemy counts.

### Phase C11.3 — Wall-Aware Navigation & Repathing

**Goal:** Enemies can route around walls/corridors to reach the player reliably.

**Build Scope**

- `src/game/Navigation.js` (new)
  - Build walkable representation from `MapLayout`
  - Implement `findPath(startX, startY, targetX, targetY, mapLayout)`
  - A* grid pathing preferred; room/corridor graph fallback acceptable
- `src/game/entities/Enemy.js`
  - Replace naive direct-seek with waypoint follow behavior
  - Repath on interval (for example every `0.2-0.4s`, not every frame)
  - Optional leash behavior if player disengages far from spawn
- `src/game/GameEngine.js`
  - Hook nav/path caches into map lifecycle so generation and teardown are safe

**Acceptance Criteria**

1. Enemies navigate around corners and room walls instead of getting stuck.
2. Collision jitter against walls is significantly reduced.
3. CPU cost remains controlled (no per-frame full recompute).

### Shared Config Knobs (Across C11.1-C11.3)

Add tunables to config so behavior is easy to tune:

```js
ENEMY_AI = {
  baseAggroRadius: 420,
  championAggroBonus: 120,
  propagationRadius: 300,
  suspiciousDuration: 0.25,
  repathInterval: 0.3,
  leashDistance: 1200,
}
```

### Shared Gameplay Rules

- Enemies outside aggro still render, but do not chase or attack.
- Damaging an idle enemy immediately aggroes it and can propagate locally.
- Bosses ignore idle behavior and remain encounter-active.
- Aggro propagation should stay local to a pack/room, not map-wide.

---

## Phase Reference Summary

| Phase | Deliverable | Complexity | Status |
|-------|-------------|------------|--------|
| C1 | Character save/load, CharacterCreate, CharacterSelect | Medium | [x] |
| C2 | GameEngine state machine rework (HUB / MAP_RUNNING / DIED) | Medium | [x] |
| C3 | Hub world renderer + interactable zones + HubScreen UI | Medium | [x] |
| C4 | MapGenerator BSP, wall rendering, wall collision | High | [x] |
| C5 | ClusterSpawner, enemy sleeping, kill counter | Medium | [x] |
| C6 | PortalEntity, MapInstance, death-portal flow, DeathScreen | Medium | [x] |
| C7 | Free map definitions (5 Acts), MapSelectScreen, act unlock chain | Low | [x] |
| C8 | Map item type, Map Device interactable, map item drops | Medium | [x] |
| C9 | Map mod runtime application, mod HUD display | Low | [x] |
| C10 | UI polish: MainMenu, HUD, MapComplete, CharacterJournal, CharacterSheet | Low | [x] |
| C11.1 | Enemy AI states + aggro radius gating | Medium | [x] |
| C11.2 | Local pack alert propagation (group aggro) | Medium | [x] |
| C11.3 | Wall-aware pathfinding + repath/leash behavior | High | [x] |

Each Phase builds directly on the previous. C1 and C2 are the foundation — nothing else
can be done without a working save system and extended state machine.

---

## Open Questions / Design Decisions to Revisit

1. **Permadeath option?** Currently: no character death — losing all portals just closes the
   instance. We could add a hardcore mode toggle on character creation.

2. **Stash scope** — Is the League Stash account-wide (shared between all characters) or
   per-character? PoE does account-wide. Recommended: account-wide.

3. **Map atlas** — For Phase C8 endgame, do we want a visual "atlas" of unlocked maps (like PoE's
   Atlas of Worlds), or just a flat list? The flat list is simpler for now.

4. **Enemy respawn** — On re-entry to a map via portal, do dead enemies stay dead? Recommended:
   yes, enemies stay dead. The map state is saved in MapInstance.

5. **Vendor in hub** — What does the vendor sell? Consumable flasks, map items, or just
   identification scrolls? Defer to Phase C10.

6. **Weapon unlocks** — Currently unlocked at player levels 5/15/30 during a run. With persistent
   characters this should become "first time reaching that level" (already stored in save).


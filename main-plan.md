# Survivor ARPG - Unified Main Plan

This is the canonical roadmap for the project. It merges the original survivor-style roadmap and the ARPG conversion roadmap into one checklist-oriented execution plan.

- Primary reference for implementation order: this document
- Focused conversion detail: [conversion-plan.md](conversion-plan.md)

---

## Project Snapshot

- Engine: Canvas + Vanilla JS runtime systems
- UI: React overlays/screens
- Build: Vite
- Current direction: mini-ARPG with persistent characters, hub, maps, map device, and progression systems

---

## Global Progress Board

### Completed Track

- [x] Core game runtime (loop, input, rendering, collision, XP)
- [x] Performance systems (spatial grid, pooling, dt smoothing)
- [x] Weapon/content expansion baseline
- [x] Itemization baseline + affix generation + inventory grid flow
- [x] Passive tree + meta progression baseline
- [x] Character archetypes and unlock flow
- [x] Boss systems and encounter baseline
- [x] Defense layer system (armor/evasion/ES)
- [x] Active skill system baseline
- [x] Skill-gem and support foundations (majority of Phase 12 delivered)
- [x] ARPG conversion C1-C11.3 (hub/maps/portals/map mods/AI upgrades)

### In Progress / Next Up

- [~] Top Priority: Mobile Addition rollout (Phase 1 done, Phases 2-5 queued) - see [mobile-addition.md](mobile-addition.md)
- [ ] Deep skill-gem completion and tooling polish
- [ ] Advanced item economy + crafting + influences
- [ ] Encounter depth and monster ecosystem expansion
- [ ] Endgame systems (atlas-style progression, mode variants, daily seeds)
- [ ] Quality pass and platform expansion

---

## Phase Map (Renamed + Reordered)

| New Phase | Legacy Mapping | Status |
|---|---|---|
| P0 Foundation Runtime | Legacy 1-4 | [x] |
| P1 Loot and Build Base | Legacy 5-9 + 10 + 10.5 + 11 | [x] |
| P2 Skill-Gem Engine | Legacy 12 | [x] |
| P3 ARPG World Conversion | Conversion C1-C11.3 | [x] |
| P4 Item Economy and Crafting | Legacy 13 + 16 | [ ] |
| P5 Encounter and AI Depth | Legacy 14 + parts of C11 follow-ups | [ ] |
| P6 Build Identity and Endgame Modes | Legacy 15 + 17 + 18 + 19 + 20 | [ ] |
| P7 Meta Replayability Systems | Legacy 21 + 22 | [ ] |
| P8 Final Polish and Platform | Legacy 23 + 24 | [ ] |

Legend:
- `[x]` complete
- `[~]` partially complete
- `[ ]` not started

---

## P0 - Foundation Runtime [x]

### Goals

- [x] Stable game loop and state handling
- [x] Reliable input and movement
- [x] Baseline enemy spawning and kill loop
- [x] Core HUD and overlays

### Delivered

- [x] Canvas runtime orchestration in game engine
- [x] Input manager and keyboard controls
- [x] Renderer camera and world drawing pipeline
- [x] Collision and damage baseline
- [x] XP collection and level-up loop
- [x] Pause and game-over shell screens

Exit criteria:

- [x] Playable complete loop from spawn to death
- [x] Stable frame behavior under normal load

---

## P1 - Loot and Build Base [x]

### Goals

- [x] Build diversity through skills/items/tree systems
- [x] Meaningful item drops and inventory decisions
- [x] Character identity and progression hooks

### Delivered (consolidated)

- [x] Expanded weapon/content set and scaling curve
- [x] Item drops, rarity tiers, affix rolling
- [x] Grid inventory + equipment and item tooltip ecosystem
- [x] Passive tree implementation and node allocation flow
- [x] Meta progression baseline (shards/history/high scores)
- [x] Character classes and unlock logic
- [x] Boss announcements and multi-boss cadence
- [x] Defense layers (armor/evasion/ES + HUD support)
- [x] Active skill hotbar model (Q/E/R)

Exit criteria:

- [x] Multiple viable class/loadout styles
- [x] Loot and progression loops stable end-to-end

---

## P2 - Skill-Gem Engine [x]

### Goals

- [ ] Full PoE-like socket/support dynamics
- [ ] Predictable stat computation and cast model
- [ ] Complete UI support for gem/sockets/workflows

### Completed

- [x] Tag and ailment framework
- [x] Skill/weapon stat formula scaffolding
- [x] Cast-time and cast-speed integration
- [x] Expanded active roster and reclassification
- [x] Significant support-gem groundwork
- [x] Skill leveling and max-level effects
- [x] Skill acquisition moved to monster-dropped skill gems (replaces level 5/15/30 assignment)

### Remaining

- [x] Finalize support pool parity and edge behaviors
- [x] Finish gem panel UX and socket management polish
- [x] Fill remaining tooling/files marked incomplete in legacy P12 list
- [x] Add validation matrix for support interactions and ailment edge cases

Exit criteria:

- [x] Every active skill has production-ready support interactions
- [x] Socketing UX is intuitive and error-resilient
- [x] Deterministic behavior for cast/trigger/order of operations

---

## P3 - ARPG World Conversion [x]

This phase is fully delivered in implementation and tracked in detail in [conversion-plan.md](conversion-plan.md).

### Conversion Checklist

- [x] C1 Character save system
- [x] C2 Game state machine rework
- [x] C3 Hub world and interactables
- [x] C4 Bounded map generation and wall collision
- [x] C5 ClusterSpawner map seeding
- [x] C6 Portal death/re-entry loop
- [x] C7 Free act maps and unlock chain
- [x] C8 Map items and map device
- [x] C9 Runtime map modifiers
- [x] C10 ARPG UI framing and progression screens
- [x] C11.1 Enemy aggro state gating
- [x] C11.2 Local pack alert propagation
- [x] C11.3 Wall-aware pathing + LOS-first chase

### Delivered ARPG Systems

- [x] Persistent characters and hub-first flow
- [x] Map progression and map-device endgame entry
- [x] Death without character deletion (portal economy)
- [x] Character journal/sheet and map completion UX
- [x] Enemy AI upgrade path (aggro + local propagation + pathing)

Exit criteria:

- [x] End-to-end mini-ARPG loop playable and stable

---

## P4 - Item Economy and Crafting [ ]

(Consolidates legacy 13 + 16)

### Goals

- [ ] Turn items into a long-form crafting game
- [ ] Introduce deterministic and stochastic upgrade paths
- [ ] Support long-tail economy decisions per character/account

### Core Checklist

- [ ] Currency orb system and drop economy
- [ ] Item level + tiered affix gating
- [ ] Enemy resistance and penetration interactions aligned with itemization
- [ ] Crafting bench operations (add/remove/lock/reroll)
- [ ] Influence systems and dual-influence outcomes
- [ ] Unique item expansion pass and drop logic
- [ ] Divination card collection + turn-in flow
- [ ] Expanded stash model (currency/crafting tabs)

Exit criteria:

- [ ] At least 3 distinct item progression paths are viable (drop-only, light craft, heavy craft)
- [ ] Crafting outcomes feel learnable and worth investment

---

## P5 - Encounter and AI Depth [ ]

(Consolidates legacy 14 and future C11 depth)

### Goals

- [ ] Increase moment-to-moment combat variety
- [ ] Build recognizable enemy archetypes and pack identities
- [ ] Expand encounter events beyond standard pulls

### Core Checklist

- [ ] Monster class system (skirmisher/brute/caster/support/summoner/shaman)
- [ ] Elite modifier pool and conflict/balance rules
- [ ] Pack leader logic and aura/death-response behavior
- [ ] Multi-phase boss overhauls and phase telegraphing
- [ ] Strongboxes, shrines, wandering champions, special event hooks
- [ ] Bestiary tracking + bounty board objectives
- [ ] AI quality follow-ups (leash policy, path cache tuning, group pull tuning)

Exit criteria:

- [ ] Two runs at similar time marks can still feel tactically different
- [ ] Elite/pack encounters are readable and strategically meaningful

---

## P6 - Build Identity and Endgame Modes [ ]

(Consolidates legacy 15 + 17 + 18 + 19 + 20)

### Goals

- [ ] Strengthen player build identity and long-term specialization
- [ ] Add run-shaping systems for replayability
- [ ] Deliver alternative game modes and progression pacing options

### Core Checklist

- [ ] Ascendancy/class specialization trees
- [ ] Expanded act/endgame progression structure
- [ ] Shrine/event integration across map flow
- [ ] Run modifier stack and reward multipliers
- [ ] Alternate modes (endless/gauntlet/hardcore/sprint)
- [ ] Balance pass for mode/modifier interoperability

Exit criteria:

- [ ] Multiple distinct endgame playstyles exist and are fun
- [ ] Difficulty customization is broad but understandable

---

## P7 - Meta Replayability Systems [ ]

(Consolidates legacy 21 + 22)

### Goals

- [ ] Add repeatable shared challenges and long-term meta goals
- [ ] Create account-level motivation loops outside single runs

### Core Checklist

- [ ] Seeded run framework with deterministic RNG path
- [ ] Daily challenge generation + local leaderboard flow
- [ ] Achievement/trophy ecosystem and rewards
- [ ] Secret unlock and aspirational long-term goals

Exit criteria:

- [ ] Players have strong reasons to return daily/weekly
- [ ] Meta goals reinforce, not replace, core gameplay loop

---

## P8 - Final Polish and Platform [ ]

(Consolidates legacy 23 + 24)

### Goals

- [ ] Raise production feel and readability
- [ ] Expand platform support and performance ceiling

### Core Checklist

- [ ] Audio layering and dynamic mix states
- [ ] Visual polish pass (hit feedback, trails, transitions, combat readability)
- [ ] Performance renderer path (WebGL batcher option)
- [ ] Input platform expansion (gamepad/touch)
- [ ] Mobile responsive HUD and controls
- [ ] PWA/offline baseline

Exit criteria:

- [ ] Smooth large-combat readability on target hardware
- [ ] Core play loop works comfortably on desktop and mobile form factors

---

## Immediate Implementation Queue (Suggested)

1. [ ] Start P4 currency + crafting vertical slice (single orb family + bench MVP)
2. [ ] Begin P5 elite modifier MVP with 6 high-impact modifiers
3. [ ] Add P6 run modifiers MVP tied to reward multiplier

---

## Open Questions We Can Explore Next

1. [ ] Should enemy aggro be reversible (leash/de-aggro) or one-way per encounter?
2. [ ] Should map progression move to an atlas board or remain list/device based?
3. [ ] How deterministic should crafting be vs high-variance gambling?
4. [ ] Should stash be strictly account-wide or mixed (account + character tabs)?
5. [ ] Which endgame pillar should be prioritized first: crafting depth, encounter depth, or mode variety?
6. [ ] What is the preferred difficulty identity: tactical mechanics, stat pressure, or modifier complexity?
7. [ ] Which platform target is most important after desktop: mobile touch or controller-first?
8. [ ] Do we add optional hardcore rulesets now or after economy/encounter systems stabilize?

---

## Agent Notes

- Keep all tuning numbers centralized in [src/game/config.js](src/game/config.js).
- Prefer additive changes over rewrites unless a subsystem is explicitly being migrated.
- After each major phase slice, run build and sanity checks before moving forward.

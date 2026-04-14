# Passive Tree — Phased Plan

## What We're Building

A **radial-grid passive tree** for three character classes, inspired by Path of Exile
but kept mathematically simple so it stays maintainable and visually clean.

- All nodes live on a **polar coordinate grid**: (ring, slot).
- Connections are either **arcs** (same ring, adjacent slots) or **spokes** (adjacent rings, same slot).
- Three class sections spaced 120° apart share a small central hub.
- Left-click allocates; right-click deallocates (free, connectivity-safe).
- Players earn 2 passive points per level-up; allocation is instant.

---

## Coordinate System

ID format: r{ring}s{slot:02d}

Ring 0 = innermost hub ring  (8 slots,  45°   apart)
Ring 1 = first minor ring   (16 slots, 22.5° apart)
Ring 2 = class gate ring    (36 slots, 10°   apart)  ← class start nodes
Ring 3 = minor branch ring  (36 slots, 10°   apart)
Ring 4 = notable ring       (36 slots, 10°   apart)
Ring 5 = outer/keystone     (36 slots, 10°   apart)

Slot 0 = 0° (right). Increases clockwise.
Class starts: Warrior r2s00 (0°), Rogue r2s12 (120° exact), Sage r2s24 (240° exact)

### Section Layout (rings 2–5)

| Slots    | Owner            | Degrees     | Nodes/ring |
|----------|------------------|-------------|------------|
| 00 – 07  | Warrior section  | 0° – 70°    | 8          |
| 08 – 11  | W→R bridge       | 80° – 110°  | 4          |
| 12 – 19  | Rogue section    | 120° – 190° | 8          |
| 20 – 23  | R→S bridge       | 200° – 230° | 4          |
| 24 – 31  | Sage section     | 240° – 310° | 8          |
| 32 – 35  | S→W bridge       | 320° – 350° | 4          |
|          | **Total**        |             | **36**     |

The three class starts sit at exact 120° intervals: slots 0, 12, and 24.
Each class section spans 8 contiguous slots; each bridge zone spans 4.

---

## Section Themes

| Class   | Element   | Typical Stats                                    |
|---------|-----------|--------------------------------------------------|
| Warrior | Fire      | Max HP, life regen, armor, flat fire damage      |
| Rogue   | Cold      | Move speed, attack speed, HP regen, flat cold    |
| Sage    | Lightning | Max mana, mana regen, cast speed, flat lightning |

---

## How to Add New Nodes (AI Instructions)

1. Pick coordinates (ring/slot), format id as r{ring}s{slot:02d}
2. Choose type: minor / notable / keystone / start / hub
3. Write stats using only keys from STAT_KEYS in passiveTree.js (additive deltas)
4. Declare connections on BOTH ends (bidirectional)
5. Run npm run dev and verify visually

---

## Golden Rules

These apply to every epic and must never be violated when touching the tree.

1. **Tri-radial symmetry** — the tree must always read as three equal sections at 120° intervals. Any node added to one class section must have a symmetric counterpart in the other two (same ring, equivalent slot offset, comparable power level).
2. **Power scales outward** — nodes get stronger and more specialised the further they are from the centre. Hub (ring 0) → bridge (rings 1–2) → minor (ring 3) → notable (ring 4) → keystone (ring 5+).
3. **Keystones have a negative** — every keystone must include a meaningful drawback that enforces a build commitment. Pure upside is Ascendancy territory.
4. **Notables are strong, not spectacular** — a notable is a meaningful decision point, not a build-defining event. Reserve explosive or one-of-a-kind effects for keystones and Ascendancy nodes.
5. **Grandmaster effects belong in Ascendancies** — on-hit procs and periodic effects are fine at the keystone level, but multi-layered, stacking, or screen-wide mechanics are reserved for Ascendancy unlocks tied to major progression milestones.
6. **Decisive pathing over web pathing** — nodes form clear "strands" with limited lateral interconnection. Players should feel the weight of choosing one branch over another, not be able to cheaply sweep up everything in a neighbourhood.

---

## ══════════════════════════════════════
## EPIC 1 — Foundation [COMPLETE]
## ══════════════════════════════════════

Everything required to ship a working, playable passive tree: renderer, data layer,
runtime keystone effects, mobile input, and initial content. ~80 nodes, 3 classes,
hub wiring, cross-section bridge, and full documentation.

---

### [x] E1 Phase 0 — Compilation Baseline

- [x] passiveTree.js exports TREE_NODE_MAP, applyStats, removeStats, STAT_KEYS
- [x] Three stub start nodes (r2s00, r2s11, r2s21) present
- [x] PassiveTreeScreen exports named component with all App.jsx props
- [x] npm run build exits 0

---

### [x] E1 Phase 1 — Radial Grid Data Layer

- [x] STAT_KEYS enumerated and documented in passiveTree.js
- [x] AI addition guide block comment at top of passiveTree.js
- [x] Warrior section: 12 nodes (start, minors, notables, keystone Pyre's Dominion)
- [x] Rogue section: 12 nodes (start, minors, notables, keystone Ghost Step)
- [x] Sage section: 12 nodes (start, minors, notables, keystone Overload)
- [x] Hub nodes (4 nodes, ring 0): Vitality, Clarity, Resilience, Earthen Will
- [x] All connections bidirectional; start nodes wired to first ring-3 child

---

### [x] E1 Phase 2 — Canvas Renderer

- [x] Dark radial gradient background
- [x] Faint ghost rings for each ring tier
- [x] Connections: grey unallocated, section-colored + glowing when allocated
- [x] Nodes: filled+glowing when allocated, pulsing when reachable, dark when locked
- [x] Notable nodes: larger circle. Keystone nodes: 6-point star
- [x] Pan (click-drag), zoom (scroll wheel, clamped 0.35-2.2x)
- [x] Hover tooltip (name, type, stat lines, allocate/refund hint)
- [x] Left-click allocate, right-click refund
- [x] Close button + points remaining HUD overlay

---

### [x] E1 Phase 3 — Polish & Keystones

- [x] Free right-click node refund (removed gold cost)
- [x] Warrior keystone Pyre's Dominion (r5s00): periodic fire nova every 2s within 280px
- [x] Rogue keystone Ghost Step (r5s11): move speed scales 0→+40% as HP drops to 10%
- [x] Sage keystone Overload (r5s21): every 5th primary cast triggers a free lightning nova
- [x] Mobile: two-finger pinch-zoom on canvas
- [x] Mobile: tap to inspect, second tap to allocate/refund
- [x] Animate allocation: expanding ring pulse when a node is allocated

---

### [x] E1 Phase 4 — Content Expansion

- [x] Each section expanded to 22 nodes (80 total across all sections)
- [x] Warrior→Rogue cross-section bridge (4-node shared path in ring 3, slots 4–7)
- [x] Hub nodes wired outward via ring-1 bridge nodes (r1s00/04/08/12 → r2s08/r2s24)
- [ ] Mastery node type with choice dialog on allocation *(deferred to E2)*
- [x] All 80 nodes documented in docs/content-cookbook/passives.md

---

### E1 Files Modified

| Phase | Files |
|-------|-------|
| E1P0 | src/game/data/passiveTree.js, src/components/PassiveTreeScreen.jsx (stubs) |
| E1P1 | src/game/data/passiveTree.js (full data) |
| E1P2 | src/components/PassiveTreeScreen.jsx (canvas renderer) |
| E1P3 | src/game/GameEngine.js (keystones + free refund), src/components/PassiveTreeScreen.jsx (mobile + anim) |
| E1P4 | src/game/data/passiveTree.js (more nodes), docs/content-cookbook/passives.md |

---

## ══════════════════════════════════════
## EPIC 2 — Depth & Balance [ IN PROGRESS ]
## ══════════════════════════════════════

With the foundation in place, Epic 2 focuses on making the tree *feel correct*:
balanced trade-offs, intentional pathing structure, and a radial reach that scales
into a richer endgame. All work must respect the Golden Rules.

---

### [x] E2 Phase 1 — Keystone Rebalance  ← COMPLETE

**Goal:** Keystones must be defining *trade-offs*, not free power packages.
Current keystones are all upside, and their secondary stat bonuses pad what should
already be covered by the notables players pass through on the way. This phase
adds a meaningful negative to each keystone and slims their stat bloat.

**Design brief:**

| Keystone | Core positive (keep) | Negative (add) | Secondary stats (trim) |
|---|---|---|---|
| **Pyre's Dominion** (r5s00) | Fire nova every 2s, 280px | Self-ignites for 2% max HP per nova (burn) | Trim flat fire bonus; keep armor |
| **Ghost Step** (r5s11) | Move speed scales with missing HP | –20% maximum HP (fragile by design) | Trim flat cold + attack speed bonus |
| **Overload** (r5s21) | Free lightning nova every 5th cast | All skill mana costs +30% | Trim flat lightning; keep cast speed |

- [x] Implement keystone negatives in `_applyPassiveTreeRuntimeEffects` / `applyStats`
- [x] Trim secondary stat bloat on all three keystone data entries
- [x] Redistribute trimmed stats onto the notable nodes leading into each keystone
- [x] Update `description` fields to clearly state both the positive and the negative
- [x] Update docs/content-cookbook/passives.md keystone table entries

---

### [x] E2 Phase 2 — Layout Symmetry & Strand Sculpting

**Goal:** Replace the current web-like connectivity with clear, intentional *strands* —
linear or lightly branching paths that funnel toward a payoff. Enforce strict
tri-radial slot symmetry so the three sections mirror each other structurally.

**Strand rules:**
- Each class section has exactly **two strands** from the class section (not necessarily from the start node itself). A primary (main element) and a secondary (utility/off-stat) strand, both rooted at the section's center pivot node.
- Within a strand, only notable nodes may laterally connect to another strand. Minor-to-minor cross-wires within a section are cut.
- Strands may dead-end (one exit). This is encouraged in the approach to keystones.
- Equivalent ring positions across sections must have matching node counts.

- [x] Audit all current connections and remove minor-to-minor cross-wires that violate the strand rule
- [x] Define and document the two strands for each section in docs/content-cookbook/passives.md
- [x] Add or reposition nodes so each section achieves matching slot-offset symmetry
- [x] Validate: Warrior notable at ring 4 offset 0 → Rogue at ~offset 11 → Sage at ~offset 21

---

### [x] E2 Phase 2.5 — Full Cross-Section Bridge Symmetry

**Goal:** Complete the three-way bridge ring. The original Warrior→Rogue bridge (slots 4–7)
was the only cross-section path. This phase adds the two missing bridges so all three
class sections are symmetrically interconnected at ring 3.

**Bridge layout:**

| Bridge | Slots | Pattern | Entry → Exit |
|--------|-------|---------|-------------|
| Warrior → Rogue | r3s04–r3s07 | minor, notable, minor, minor | r3s03 → r3s08 |
| Rogue → Sage | r3s15–r3s17 | minor, notable, minor | r3s14 → r3s18 |
| Sage → Warrior | r3s25–r3s28 | minor, notable, minor, minor | r3s24 → r3s29 |

Each bridge has a **notable midpoint** blending both adjacent class elements, and minor nodes flanking it. All bridges are ring-3 only; the cross-sections do not extend to rings 4–5.

- [x] Add Rogue→Sage bridge: Crackle Frost (r3s15), Storm's Eye (r3s16, notable), Charged Veil (r3s17)
- [x] Wire r3s14 → r3s15 and r3s17 → r3s18 (bidirectional endpoints)
- [x] Add Sage→Warrior bridge: Arc Ember (r3s25), Conduit Flame (r3s26, notable), Scorch Circuit (r3s27), Molten Arc (r3s28)
- [x] Wire r3s24 → r3s25 and r3s28 → r3s29 (bidirectional endpoints)
- [x] Update cookbook with new bridge entries

---

### [x] E2 Phase 2.75 — Bridge Deep-Trees (Fill r4 & r5 to 32 nodes)

**Goal:** Rings 4 and 5 had 21 nodes each — only covering the three class sections.
The 11 bridge zone slots on each ring (slots 4–7, 15–17, 25–28) were empty. This phase
fills them with isolated deep-tree branches rooted at each bridge's ring-3 notable,
giving players exclusive cross-class power unavailable through any single class section.

**Structure per bridge (example: Warrior→Rogue, slots 4–7):**
```
r3s05 (Shard of Halves) ──spoke──▶ r4s05 (Frozen Furnace, notable)
                                       ├──arc──▶ r4s04 ──spoke──▶ r5s04 [KEYSTONE]
                                       ├──spoke──▶ r5s05 (Ashblizzard, notable)
                                       │              ├──arc──▶ r5s04
                                       │              └──arc──▶ r5s06 ──arc──▶ r5s07
                                       └──arc──▶ r4s06 ──arc──▶ r4s07 ──spoke──▶ r5s07 [KEYSTONE]
```

**New nodes per bridge:**

| Bridge | r4 center | r5 center | Keystone A | Keystone B |
|--------|-----------|-----------|-----------|-----------|
| W→R (Fire+Cold) | Frozen Furnace (r4s05) | Ashblizzard (r5s05) | Permafrost Pyre (r5s04, armor+fire / −speed) | Pyroclast Rush (r5s07, speed+cold / −HP) |
| R→S (Cold+Lightning) | Tempest Nexus (r4s16) | Galestorm (r5s16) | Static Frost (r5s15, cold+cast / −atkspd) | Frozen Circuit (r5s17, atkspd+lightning / −mana) |
| S→W (Lightning+Fire) | Conduit Nexus (r4s26) | Stormfire (r5s26) | Thunderforge (r5s25, fire+lightning / −HP/−mana) | Voltaic Titan (r5s28, HP+regen / −cast/−speed) |

- [x] Add 8 W→R bridge nodes: r4s04–r4s07, r5s04–r5s07
- [x] Add 6 R→S bridge nodes: r4s15–r4s17, r5s15–r5s17
- [x] Add 8 S→W bridge nodes: r4s25–r4s28, r5s25–r5s28
- [x] Wire r3 bridge notables (r3s05, r3s16, r3s26) with spoke to new r4 entry notables
- [x] All bridge keystones have a meaningful negative stat

---

### [x] E2 Phase 3 — 36-Slot Grid Migration

**Goal:** Migrate rings 2–5 from the legacy 32-slot coordinate system to the new 36-slot
system. Structural overhaul only — no new stat values, no new gameplay effects.
We are moving the grid scaffolding into its correct shape and wiring the new start nodes.

**Key changes:**
- `RING_SLOTS[2..5]` in `PassiveTreeScreen.jsx`: 32 → 36
- All legacy ring 2–5 node data removed from `passiveTree.js`
- Three new class start nodes added at exact 120° positions
- Hub ring-1 spoke connections reviewed and updated
- `GameEngine.js` keystone ID checks updated (old r5s00/r5s11/r5s21 → new IDs TBD at E2P8)

- [x] Update `RING_SLOTS` array in `PassiveTreeScreen.jsx` (index 2–5: 32 → 36)
- [x] Clear all r2–r5 nodes from `passiveTree.js` (keep ring 0–1 hub nodes intact)
- [x] Add `r2s00` Warrior start, `r2s12` Rogue start, `r2s24` Sage start
- [x] Wire start nodes into hub spokes (review r1s00 → r2s00, r1s04 → ?, r1s12 → ?)
- [x] Stub `GameEngine.js` keystone checks with placeholder new IDs (or disable temporarily)
- [x] Build passes `npx vite build` with no errors
- [x] Update `PassiveTreeScreen.jsx` comment block and this plan doc

---

### [x] E2 Phase 4 — Ring 3 Scaffold (18 nodes, first pass)

**Goal:** Implement the first 18 of 36 ring-3 nodes. Structure and connectivity only —
use placeholder stats throughout (HP for Warrior, Mana for Sage, Move Speed for Rogue).
Strand A of each class plus the leading edge of each bridge zone.

**Placeholder stat philosophy:**
- Warrior nodes: `maxHealth` only (e.g. +20 HP per minor)
- Rogue nodes: `moveSpeedMult` only (e.g. +0.05 per minor)
- Sage nodes: `maxMana` only (e.g. +15 mana per minor)
- Bridge nodes: mix of the two adjacent classes' placeholder stats

**Target slot allocation (18 of 36):**

| Slots  | Content                          | Count |
|--------|----------------------------------|-------|
| 00–03  | Warrior Strand A (4 minors)      | 4     |
| 08–09  | W→R bridge entry (2 minors)      | 2     |
| 12–15  | Rogue Strand A (4 minors)        | 4     |
| 20–21  | R→S bridge entry (2 minors)      | 2     |
| 24–27  | Sage Strand A (4 minors)         | 4     |
| 32–33  | S→W bridge entry (2 minors)      | 2     |

- [x] Add Warrior r3 nodes: `r3s00`–`r3s03` (maxHealth placeholder, arc chain)
- [x] Add W→R bridge r3 nodes: `r3s08`–`r3s09` (HP+mana placeholder)
- [x] Add Rogue r3 nodes: `r3s12`–`r3s15` (moveSpeedMult placeholder)
- [x] Add R→S bridge r3 nodes: `r3s20`–`r3s21` (spd+mana placeholder)
- [x] Add Sage r3 nodes: `r3s24`–`r3s27` (maxMana placeholder)
- [x] Add S→W bridge r3 nodes: `r3s32`–`r3s33` (mana+HP placeholder)
- [x] Wire spoke from `r2s00` → `r3s00`, `r2s12` → `r3s12`, `r2s24` → `r3s24`
- [x] All arc connections bidirectional; bridge endpoints connect to adjacent class start arcs
- [x] Build passes

---

### [x] E2 Phase 5 — Ring 4 Scaffold (18 nodes, first pass)

**Goal:** Mirror Phase 4 for ring 4 — same slot columns, same placeholder stat philosophy.
All nodes are `minor` type for now. Spokes connect to the matching ring-3 column nodes.

**Target slot allocation (18 of 36, matches ring 3 scaffold):**

| Slots  | Content                          | Count |
|--------|----------------------------------|-------|
| 00–03  | Warrior Strand A notables-to-be  | 4     |
| 08–09  | W→R bridge (2 minors)            | 2     |
| 12–15  | Rogue Strand A notables-to-be    | 4     |
| 20–21  | R→S bridge (2 minors)            | 2     |
| 24–27  | Sage Strand A notables-to-be     | 4     |
| 32–33  | S→W bridge (2 minors)            | 2     |

- [x] Add Warrior r4 nodes: `r4s00`–`r4s03`, spoke from matching r3 nodes
- [x] Add W→R bridge r4 nodes: `r4s08`–`r4s09`
- [x] Add Rogue r4 nodes: `r4s12`–`r4s15`
- [x] Add R→S bridge r4 nodes: `r4s20`–`r4s21`
- [x] Add Sage r4 nodes: `r4s24`–`r4s27`
- [x] Add S→W bridge r4 nodes: `r4s32`–`r4s33`
- [x] Build passes

---

### [x] E2 Phase 6 — Complete Rings 3 & 4 (fill to 36 nodes each)

**Goal:** Add the remaining 18 slots on each of rings 3 and 4, completing both rings to
the target of 36 nodes. Strand B of each class plus the second half of each bridge zone.
Bridge midpoint notables are added here and designated explicitly as `notable` type.

**Remaining slots per ring:**

| Slots  | Content                              |
|--------|--------------------------------------|
| 04–07  | Warrior Strand B (4 nodes)           |
| 10–11  | W→R bridge (2 more + midpoint)       |
| 16–19  | Rogue Strand B (4 nodes)             |
| 22–23  | R→S bridge (2 more + midpoint)       |
| 28–31  | Sage Strand B (4 nodes)              |
| 34–35  | S→W bridge (2 more + midpoint)       |

- [x] Add Warrior Strand B r3 & r4 nodes: `r3s04`–`r3s07`, `r4s04`–`r4s07`
- [x] Add W→R bridge remainder: `r3s10`–`r3s11`, `r4s10`–`r4s11`; slots 10 promoted to `notable`
- [x] Add Rogue Strand B r3 & r4 nodes: `r3s16`–`r3s19`, `r4s16`–`r4s19`
- [x] Add R→S bridge remainder: `r3s22`–`r3s23`, `r4s22`–`r4s23`; slot 22 promoted to `notable`
- [x] Add Sage Strand B r3 & r4 nodes: `r3s28`–`r3s31`, `r4s28`–`r4s31`
- [x] Add S→W bridge remainder: `r3s34`–`r3s35`, `r4s34`–`r4s35`; slot 34 promoted to `notable`
- [x] Verify ring 3 total = 36 nodes, ring 4 total = 36 nodes
- [x] Build passes

---

### [x] E2 Phase 7 — Ring 5 Scaffold + Outer Rings (r5, r6, r7)

**Goal:** Build ring 5 using the same 36-slot grid with placeholder stats, then introduce
rings 6 and 7 for deep endgame content. Ring 5 must include at least one `keystone`
type node per class section (stub only — runtime effects added in E2P8).

**Ring 5 structure (36 nodes, same section layout):**
- Class sections: 8 nodes each × 3 = 24
- Bridge zones: 4 nodes each × 3 = 12
- Each class section's terminal node (slot 03 or 07 per strand) is type `keystone`

**Rings 6 & 7 (outer endgame, 36 slots each):**
- Ring 6 = strong minors and second-tier notables. No keystones.
- Ring 7 = terminus keystones, each with a meaningful drawback.
- Hub paths do not extend beyond ring 2.

- [x] Add `RING_RADII[6]` (~680px) and `RING_RADII[7]` (~790px) to `PassiveTreeScreen.jsx`
- [x] Add ghost rings 5–7 to canvas renderer loop
- [x] Implement ring-5 scaffold (36 nodes, placeholder stats, 3 stub keystones)
- [x] Implement ring-6 extensions per strand terminus (placeholder notables)
- [x] Implement ring-7 terminus keystones per class (placeholder names + negatives)
- [ ] Update cookbook with ring 5–7 slot ranges
- [x] Build passes

---

### [x] E2 Phase 7.5 — Arc Segmentation & Highway Rings

**Goal:** Restructure the inter-ring arc topology so that players navigate the tree via
a hub-and-spoke discipline rather than freely rotating around every ring. Three "highway"
rings remain fully traversable; the remaining five have their arcs severed at each spoke
boundary, creating six dead-end branches per ring that are only accessible by climbing a
radial spoke from a highway ring.

**Design rules:**

| Ring type | Rings | Arc behaviour |
|-----------|-------|---------------|
| **Highway** | r3, r7, r10 | Fully arc-connected — player rotates freely |
| **Broken** | r4, r5, r6, r8, r9 | Arcs severed at spoke boundaries — dead-end branches only |

**Spoke column positions (every 60°):** s00 (0°), s06 (60°), s12 (120°), s18 (180°), s24 (240°), s30 (300°)

**Segmentation mechanic (broken rings only):**

Each of the six inter-spoke spans (e.g. s00–s05, s06–s11, …, s30–s35) becomes an
isolated dead-end branch. The spoke node at the START of each branch (s00, s06, etc.)
connects to both: (a) inward/outward spokes and (b) the arc going clockwise into the
branch (s+1). The spoke node does **not** connect backwards to the previous branch's
terminal arc node. The terminal arc node (s05, s11, …, s35) connects only inward within
the branch — it is a true dead end.

Result: entering any broken ring requires allocating a spoke node from a highway ring.
From that spoke node the player can traverse up to five arc nodes in one direction before
hitting the branch terminal. To enter the *next* segment they must return to a highway
ring and travel to a different spoke column — or climb a further spoke outward to the next
broken ring's segment from that same spoke.

**Arc cuts per broken ring (6 cuts × 5 rings = 30 cuts, 60 connection edits):**

| Cut | Nodes modified |
|-----|----------------|
| s35 ↔ s00 | remove rXs00 from rXs35 · remove rXs35 from rXs00 |
| s05 ↔ s06 | remove rXs06 from rXs05 · remove rXs05 from rXs06 |
| s11 ↔ s12 | remove rXs12 from rXs11 · remove rXs11 from rXs12 |
| s17 ↔ s18 | remove rXs18 from rXs17 · remove rXs17 from rXs18 |
| s23 ↔ s24 | remove rXs24 from rXs23 · remove rXs23 from rXs24 |
| s29 ↔ s30 | remove rXs30 from rXs29 · remove rXs29 from rXs30 |

**Symmetry guarantee:** All six branches per broken ring are topologically identical
(spoke-node + 5 arc-only nodes). The tri-radial class symmetry (s00/s12/s24) and the
secondary 60° symmetry (s06/s18/s30) are both preserved throughout.

**Player journey example:**
> Player at r3s00 (Warrior gate) → arc along r3 to r3s06 → spoke up to r4s06
> → arc along r4s07 → r4s08 → r4s09 → r4s10 → r4s11 (dead end, W→R bridge)
> → back to r4s06 → spoke up to r5s06 → arc deeper…

- [x] Define highway rings (r3, r7, r10) and broken rings (r4, r5, r6, r8, r9)
- [x] Cut arc at s35 ↔ s00 on all 5 broken rings (remove wraparound)
- [x] Cut arc at s05 ↔ s06 on all 5 broken rings (end of CW branch from s00)
- [x] Cut arc at s11 ↔ s12 on all 5 broken rings (end of CW branch from s06)
- [x] Cut arc at s17 ↔ s18 on all 5 broken rings (end of CW branch from s12)
- [x] Cut arc at s23 ↔ s24 on all 5 broken rings (end of CW branch from s18)
- [x] Cut arc at s29 ↔ s30 on all 5 broken rings (end of CW branch from s24)
- [x] Verify highway rings r3/r7/r10 remain unmodified
- [x] Build passes

---

### [x] E2 Phase 7.75 — Rings 11–15 (Deep Extension, same arc-segmentation pattern)

**Goal:** Extend the tree outward with rings 11–15, maintaining the exact same highway/broken
topology established in E2P7.5. Ring 15 is the new terminal highway.

**Highway vs broken assignment:**

| Ring type | Rings | Arc behaviour |
|-----------|-------|---------------|
| **Highway** | r3, r7, r10, **r15** | Fully arc-connected |
| **Broken** | r4–r6, r8–r9, **r11–r14** | 6 isolated dead-end branches per ring |

**Renderer updates:** `RING_RADII` extended to r15 (1670px); `RING_SLOTS` extended to 16 entries; ghost rings loop `<= 15`.

**Spoke extension:** r10 spoke nodes (previously terminal) patched to add outward `r11sXX` references.

**New node topology (r11–r14, broken):**
- Spoke nodes (s00/s06/s12/s18/s24/s30): 3 connections — inward spoke + 1 arc (CW into branch) + outward spoke.
- Interior branch nodes: 2 connections (arc only).
- Branch terminal (s05/s11/s17/s23/s29/s35): 1 connection — dead end.

**New node topology (r15, terminal highway):**
- Spoke nodes: 3 connections — inward spoke from r14 + both arc neighbours.
- All other nodes: 2 connections (arc only, wraparound at s35).
- No outward spokes — terminus.

**Placeholder stat scales:**

| Ring | Warrior | Rogue | Sage |
|------|---------|-------|------|
| r11 | +60 HP | +0.13 spd | +55 mana |
| r12 | +65 HP | +0.14 spd | +60 mana |
| r13 | +70 HP | +0.15 spd | +65 mana |
| r14 | +75 HP | +0.16 spd | +70 mana |
| r15 | +80 HP | +0.17 spd | +75 mana |

Ring names: r11 Sear/Wail/Zap · r12 Char/Rime/Crackle · r13 Brand/Squall/Static · r14 Magma/Hail/Tempest · r15 Sovereign (all).

Generation script: `scripts/gen-rings-11-15.mjs`

- [x] Extend `RING_RADII` → r15 (1670px) in `PassiveTreeScreen.jsx`
- [x] Extend `RING_SLOTS` to 16 entries; ghost rings loop `<= 15`
- [x] Patch r10 spoke nodes to add `r11sXX` outward connections
- [x] Generate and append 180 nodes for rings 11–15 (segmented topology baked in)
- [x] Verify r11–r14 branch terminals have exactly 1 connection (dead ends)
- [x] Verify r15 highway has full arc connectivity + inward spokes only
- [x] Build passes

---

### [ ] E2 Phase 8 — Full Stat & Theme Pass  *(tracked in `docs/E2P8.md`)*

**Goal:** Replace every placeholder stat with a final value, ring by ring. Each sub-phase
is tested before moving on. Full design rules are documented in `docs/E2P8.md`.

**Sub-phases (8.1 – 8.16):**

| Phase | Scope | Type |
|-------|-------|------|
| **8.1** | Functional verification — Refund All button, allocation smoke test | Infrastructure |
| **8.2** | r0 Hub + r1 Inner rings | Content |
| **8.3** | r2 Class Gates | Content |
| **8.4** | r3 Highway (travel, no notables) | Content |
| **8.5** | r4 Broken ring (6 branches, Notable caps) | Content |
| **8.6** | r5 Broken ring (Keystone stubs per class) | Content |
| **8.7** | r6 Broken ring | Content |
| **8.8** | r7 Highway (travel, no notables) | Content |
| **8.9** | r8 Broken ring | Content |
| **8.10** | r9 Broken ring | Content |
| **8.11** | r10 Highway (travel, no notables) | Content |
| **8.12** | r11 Broken ring | Content |
| **8.13** | r12 Broken ring | Content |
| **8.14** | r13 Broken ring | Content |
| **8.15** | r14 Broken ring (all Keystone caps) | Content |
| **8.16** | r15 Terminal Highway + full tree review | Content |

**Key design rules (abbreviated — see `docs/E2P8.md` for full spec):**
- Minor nodes follow ONE thematic stat per branch (no mixing within a branch)
- Branch dead-ends must cap with a Notable or Keystone (never a plain minor terminal)
- Highway rings (r3, r7, r10, r15) contain no notables or keystones
- Notables / Keystones only at branch ENDS, never mid-branch
- Perfect tri-radial symmetry at all times

- [x] E2P8.1 Refund All button implemented; allocation/deallocation verified across r0–r15
- [ ] E2P8.2 r0 + r1 content pass
- [ ] E2P8.3 r2 content pass
- [ ] E2P8.4 r3 content pass
- [ ] E2P8.5 r4 content pass
- [ ] E2P8.6 r5 content pass
- [ ] E2P8.7 r6 content pass
- [ ] E2P8.8 r7 content pass
- [ ] E2P8.9 r8 content pass
- [ ] E2P8.10 r9 content pass
- [ ] E2P8.11 r10 content pass
- [ ] E2P8.12 r11 content pass
- [ ] E2P8.13 r12 content pass
- [ ] E2P8.14 r13 content pass
- [ ] E2P8.15 r14 content pass
- [ ] E2P8.16 r15 content pass + full tree review

---

### [ ] E2 Phase 9 — Full Audit & Polish

**Goal:** Final verification pass before playtesting. Confirm all Golden Rules are met.

- [ ] Three-way symmetry audit: slot counts and ring/slot-offset parity across all three sections
- [ ] Power-scaling audit: no ring-3 node stronger than a ring-5 node on the same strand
- [ ] Bridge audit: shared zones do not shortcut into class deep-tree territory
- [ ] Run `npm run content-validate` and resolve any ID or connection errors
- [ ] Final cookbook update and this file marked complete

---

### E2 Files to Modify (anticipated)

| Phase | Files |
|-------|-------|
| E2P1  | src/game/data/passiveTree.js, src/game/GameEngine.js |
| E2P2  | src/game/data/passiveTree.js, docs/content-cookbook/passives.md |
| E2P3  | src/game/data/passiveTree.js, src/components/PassiveTreeScreen.jsx, src/game/GameEngine.js |
| E2P4  | src/game/data/passiveTree.js |
| E2P5  | src/game/data/passiveTree.js |
| E2P6  | src/game/data/passiveTree.js |
| E2P7  | src/game/data/passiveTree.js, src/components/PassiveTreeScreen.jsx |
| E2P8  | src/game/data/passiveTree.js, src/game/GameEngine.js, docs/content-cookbook/passives.md |
| E2P9  | docs/content-cookbook/passives.md, this file |
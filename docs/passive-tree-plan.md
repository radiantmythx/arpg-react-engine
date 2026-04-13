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

Ring 0 = innermost hub ring  (8 slots, 45° apart)
Ring 1 = first minor ring   (16 slots, 22.5° apart)
Ring 2 = class gate ring    (32 slots, 11.25° apart)  <- class start nodes
Ring 3 = minor branch ring  (32 slots, 11.25° apart)
Ring 4 = notable ring       (32 slots, 11.25° apart)
Ring 5 = outer/keystone     (32 slots, 11.25° apart)

Slot 0 = 0° (right). Increases clockwise.
Class starts: Warrior r2s00 (0°), Rogue r2s11 (~123°), Sage r2s21 (~236°)

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

### [ ] E2 Phase 1 — Keystone Rebalance

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

- [ ] Implement keystone negatives in `_applyPassiveTreeRuntimeEffects` / `applyStats`
- [ ] Trim secondary stat bloat on all three keystone data entries
- [ ] Redistribute trimmed stats onto the notable nodes leading into each keystone
- [ ] Update `description` fields to clearly state both the positive and the negative
- [ ] Update docs/content-cookbook/passives.md keystone table entries

---

### [ ] E2 Phase 2 — Layout Symmetry & Strand Sculpting

**Goal:** Replace the current web-like connectivity with clear, intentional *strands* —
linear or lightly branching paths that funnel toward a payoff. Enforce strict
tri-radial slot symmetry so the three sections mirror each other structurally.

**Strand rules:**
- Each class section gets exactly **two strands** from its start node: a primary (main element) and a secondary (utility/off-stat).
- Within a strand, only notable nodes may laterally connect to another strand. Minor-to-minor cross-wires within a section are cut.
- Strands may dead-end (one exit). This is encouraged in the approach to keystones.
- Equivalent ring positions across sections must have matching node counts.

- [ ] Audit all current connections and remove minor-to-minor cross-wires that violate the strand rule
- [ ] Define and document the two strands for each section in docs/content-cookbook/passives.md
- [ ] Add or reposition nodes so each section achieves matching slot-offset symmetry
- [ ] Validate: Warrior notable at ring 4 offset 0 → Rogue at ~offset 11 → Sage at ~offset 21

---

### [ ] E2 Phase 3 — Outer Ring Extensions

**Goal:** Introduce rings 6 and 7 to double the radial depth of the tree, seeded with
highly specialised nodes at the terminus of each strand. These are the long-haul goals
players save passive points toward.

**Rules for outer ring content:**
- Rings 6 and 7 use the same 32-slot polar grid as rings 3–5.
- Each strand's ring-5 terminus (keystone or outer minor) extends outward along the same slot column.
- Ring 6 nodes are strong minors or second-tier notables. No keystones.
- Ring 7 nodes are **terminus keystones** — the strand's final, most powerful node. Must have a negative.
- Hub paths do not extend beyond ring 2 at this stage.

- [ ] Add `RING_RADII[6]` (~680px) and `RING_RADII[7]` (~790px) to PassiveTreeScreen.jsx renderer constants
- [ ] Add ghost rings 6 and 7 to the canvas renderer loop
- [ ] Implement 2–3 ring-6 nodes per section (6–9 total), symmetric across classes
- [ ] Implement 1 ring-7 terminus keystone per section (3 total), each with a negative
- [ ] Update docs/content-cookbook/passives.md with ring 6–7 entries and free slot ranges

---

### [ ] E2 Phase 4 — Resymmetrisation & Full Audit

**Goal:** After the preceding phases, do a complete pass to confirm the tree satisfies
all Golden Rules and is ready for playtesting.

- [ ] Three-way symmetry audit: compare node counts and ring/slot-offset positions across all three sections
- [ ] Power-scaling audit: no ring-3 node may be stronger than a ring-5 node on the same strand
- [ ] Cross-class bridge audit: shared bridge paths must not shortcut into deep strand territory; cap entry at ring 3
- [ ] Run `npm run content-validate` and resolve any ID or connection errors
- [ ] Final update to docs/content-cookbook/passives.md and this file

---

### E2 Files to Modify (anticipated)

| Phase | Files |
|-------|-------|
| E2P1 | src/game/data/passiveTree.js, src/game/GameEngine.js |
| E2P2 | src/game/data/passiveTree.js, docs/content-cookbook/passives.md |
| E2P3 | src/game/data/passiveTree.js, src/components/PassiveTreeScreen.jsx |
| E2P4 | src/game/data/passiveTree.js, docs/content-cookbook/passives.md |
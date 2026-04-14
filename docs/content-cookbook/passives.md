# Passive Tree — Content Cookbook

This document is the **authoritative reference** for all passive nodes, plus fill-in-the-blank
templates and design guidelines for adding hundreds more nodes in the future.

---

## Quick-Add Template

Copy this block, fill in every field, then paste into the appropriate section of `passiveTree.js`.
Remember to add the new ID to every neighbour's `connections` array (bidirectional).

```js
{
  id: 'r{ring}s{slot:02d}',          // e.g. r3s07
  label: 'Node Name',                 // short flavour name shown in tooltip
  type: 'minor',                      // minor | notable | keystone | start | hub
  section: 'warrior',                 // warrior | rogue | sage | shared
  ring: 3,                            // 0–5
  slot: 7,                            // 0–35 for rings 2–5; 0–15 for ring 1; 0–7 for ring 0
  stats: {
    // Paste ONLY keys from STAT_KEYS. Additive deltas.
    // e.g.  maxHealth: 20, flatBlazeDamage: 8, increasedBlazeDamage: 0.06
  },
  connections: ['r3s06', 'r3s08', 'r4s07'],  // bidirectional — add this ID to each neighbour too
  description: 'One-line tooltip sentence.',
},
```

---

## Ring & Slot Reference

| Ring | Slots | °/slot | Purpose              | Typical type    |
|------|-------|--------|----------------------|-----------------|
| 0    | 8     | 45°    | Hub                  | hub             |
| 1    | 16    | 22.5°  | Bridge / inner minor | minor / shared  |
| 2    | 36    | 10°    | Class gate + cross   | start / shared  |
| 3    | 36    | 10°    | Minor branches       | minor           |
| 4    | 36    | 10°    | Notables             | notable         |
| 5    | 36    | 10°    | Outer / Keystone     | keystone / minor|

**Slot 0 = 0° (3 o'clock). Increases clockwise.**

Class starts: Warrior `r2s00` (0°) · Rogue `r2s12` (120°) · Sage `r2s24` (240°)  
Hub nodes:    Vitality `r0s00` (0°) · Clarity `r0s02` (90°) · Resilience `r0s04` (180°) · Earthen Will `r0s06` (270°)

### 36-Slot Section Layout (rings 2–5)

Each ring from 2 onward divides into **three class sections of 8 slots** and **three bridge zones of 4 slots**.

| Slots    | Owner            | Degrees     | Per-ring count |
|----------|------------------|-------------|----------------|
| 00 – 07  | Warrior section  | 0° – 70°    | 8              |
| 08 – 11  | W→R bridge       | 80° – 110°  | 4              |
| 12 – 19  | Rogue section    | 120° – 190° | 8              |
| 20 – 23  | R→S bridge       | 200° – 230° | 4              |
| 24 – 31  | Sage section     | 240° – 310° | 8              |
| 32 – 35  | S→W bridge       | 320° – 350° | 4              |
| **Total**|                  |             | **36**         |

### Strand Layout (within each 8-slot class section)

Each class section contains two strands of 4 nodes each, anchored at the class start.
The start node (ring 2) connects via spoke to the ring-3 left anchor (slot N+0),
which chains rightward: Strand A covers slots N+0 through N+3, Strand B covers N+4 through N+7.

| Class   | Start   | Strand A slots | Strand B slots | Bridge L (entry) | Bridge R (exit) |
|---------|---------|----------------|----------------|------------------|-----------------|
| Warrior | r2s00   | 00 – 03        | 04 – 07        | 32–35 (S→W)      | 08–11 (W→R)     |
| Rogue   | r2s12   | 12 – 15        | 16 – 19        | 08–11 (W→R)      | 20–23 (R→S)     |
| Sage    | r2s24   | 24 – 27        | 28 – 31        | 20–23 (R→S)      | 32–35 (S→W)     |

### Slot fill status (target — 36 nodes per ring)

| Section       | Ring 3 target slots | Ring 4 target slots | Ring 5 target slots |
|---------------|---------------------|---------------------|---------------------|
| Warrior       | 00–07 (8)           | 00–07 (8)           | 00–07 (8)           |
| W→R bridge    | 08–11 (4)           | 08–11 (4)           | 08–11 (4)           |
| Rogue         | 12–19 (8)           | 12–19 (8)           | 12–19 (8)           |
| R→S bridge    | 20–23 (4)           | 20–23 (4)           | 20–23 (4)           |
| Sage          | 24–31 (8)           | 24–31 (8)           | 24–31 (8)           |
| S→W bridge    | 32–35 (4)           | 32–35 (4)           | 32–35 (4)           |
| **Total**     | **36**              | **36**              | **36**              |

---

## Stat Keys Reference

All keys must come from `STAT_KEYS` in `passiveTree.js`.

### Additive stats (flat values)
| Key                    | Unit       | Display example          |
|------------------------|------------|--------------------------|
| `maxHealth`            | integer    | +25 Max Health           |
| `maxMana`              | integer    | +20 Max Mana             |
| `maxEnergyShield`      | integer    | +15 Max Energy Shield    |
| `healthRegenPerS`      | float      | +1.5 HP/s                |
| `manaRegenPerS`        | float      | +1.0 Mana/s              |
| `totalArmor`           | integer    | +12 Armor                |
| `totalEvasion`         | integer    | +10 Evasion              |
| `flatBlazeDamage`      | integer    | +8 Flat Fire Damage      |
| `flatThunderDamage`    | integer    | +8 Flat Lightning Damage |
| `flatFrostDamage`      | integer    | +8 Flat Cold Damage      |
| `flatPhysicalDamage`   | integer    | +8 Flat Physical Damage  |
| `flatHolyDamage`       | integer    | +6 Flat Holy Damage      |
| `flatUnholyDamage`     | integer    | +6 Flat Unholy Damage    |
| `pickupRadiusBonus`    | integer    | +20 Pickup Radius        |
| `projectileCountBonus` | integer    | +1 Projectile(s)         |

### Fractional stats (addend to multiplier, e.g. 0.10 = "+10%")
| Key                       | Display example                      |
|---------------------------|--------------------------------------|
| `moveSpeedMult`           | +10% Movement Speed                  |
| `castSpeed`               | +8% Cast Speed                       |
| `attackSpeed`             | +8% Attack Speed                     |
| `manaCostMult`            | +5% reduced Mana Cost (use negative) |
| `spellDamage`             | +10% Spell Damage                    |
| `attackDamage`            | +10% Attack Damage                   |
| `aoeDamage`               | +12% AoE Damage                      |
| `xpMultiplier`            | +5% Experience Gained                |
| `increasedBlazeDamage`    | +8% Increased Fire Damage            |
| `increasedThunderDamage`  | +8% Increased Lightning Damage       |
| `increasedFrostDamage`    | +8% Increased Cold Damage            |
| `increasedPhysicalDamage` | +8% Increased Physical Damage        |
| `increasedHolyDamage`     | +8% Increased Holy Damage            |
| `increasedUnholyDamage`   | +8% Increased Unholy Damage          |
| `blazeResistance`         | +5% Fire Resistance                  |
| `thunderResistance`       | +5% Lightning Resistance             |
| `frostResistance`         | +5% Cold Resistance                  |
| `blazePenetration`        | +5% Fire Penetration                 |
| `thunderPenetration`      | +5% Lightning Penetration            |
| `frostPenetration`        | +5% Cold Penetration                 |
| `physicalPenetration`     | +5% Physical Penetration             |
| `potionEffectMult`        | +10% Potion Effect                   |
| `potionDurationMult`      | +10% Potion Duration                 |
| `potionChargeGainMult`    | +5% Potion Charge Gain               |

---

## Node Type Design Guidelines

### `minor` — Small circle
- 1–2 stats. Moderate values.
- Player will allocate dozens of these. Keep them cheap-feeling.
- Example budgets: +15–30 max HP, +6–12 flat elemental, +5–8% speed

### `notable` — Large circle, has a name
- 2–3 stats. Meaningful values. Doubles as a "decision point."
- Should feel like a milestone allocation.
- Example budgets: +40–60 max HP, +18–25 flat elemental, +10–15% multiplicative

### `keystone` — 6-point star, build-defining
- Has a `description` that explains a unique **runtime effect** implemented in `GameEngine.js`.
- Stats are secondary to the special mechanic.
- Only 1 per section (3 total for base classes).
- Unlock the runtime effect in `_applyPassiveTreeRuntimeEffects()` or `_activatePrimarySkill()`.

### `hub` — Solid circle, innermost ring
- Always `section: 'shared'`, `ring: 0`.
- Reachable via ring-1 bridge nodes; cannot be refunded.
- 2–3 generalist stats that benefit any class.

### `start` — Class gate
- Zero stats, zero cost. Allocated free at character creation.
- Must connect outward (ring 3). Also connects inward to hub via ring-1 bridge.

---

## Strand Definitions (36-Slot Target)

Each class section has exactly **two strands of 4 nodes each** per ring, rooted at the
class start node. Strand A runs from the left anchor to the bridge-side, Strand B continues
further right. Both strands share the same r3 left anchor as their entry point.

> **Rules:** Only notable nodes may arc across strands. Minor-to-minor cross-wires within a
> section are cut. Strands may dead-end — the keystone approach is encouraged at ring-5 termini.

### Warrior — "The Pyre" (start: r2s00, section slots 00–07)

```
STRAND A — slots 00–03 (theme TBD in E2P8)
  Ring 3: r3s00 (left anchor) → r3s01 → r3s02 → r3s03
  Ring 4: r4s00 [notable] → r4s01 → r4s02 → r4s03 [notable]
  Ring 5: r5s00 → r5s01 → r5s02 → r5s03 [★ keystone terminus]

STRAND B — slots 04–07 (theme TBD in E2P8)
  Ring 3: r3s04 → r3s05 [notable] → r3s06 → r3s07
  Ring 4: r4s04 → r4s05 [notable] → r4s06 → r4s07
  Ring 5: r5s04 → r5s05 → r5s06 → r5s07 [★ keystone terminus]
```

### Rogue — "The Frost" (start: r2s12, section slots 12–19)

```
STRAND A — slots 12–15 (theme TBD in E2P8)
  Ring 3: r3s12 (left anchor) → r3s13 → r3s14 → r3s15
  Ring 4: r4s12 [notable] → r4s13 → r4s14 → r4s15 [notable]
  Ring 5: r5s12 → r5s13 → r5s14 → r5s15 [★ keystone terminus]

STRAND B — slots 16–19 (theme TBD in E2P8)
  Ring 3: r3s16 → r3s17 [notable] → r3s18 → r3s19
  Ring 4: r4s16 → r4s17 [notable] → r4s18 → r4s19
  Ring 5: r5s16 → r5s17 → r5s18 → r5s19 [★ keystone terminus]
```

### Sage — "The Storm" (start: r2s24, section slots 24–31)

```
STRAND A — slots 24–27 (theme TBD in E2P8)
  Ring 3: r3s24 (left anchor) → r3s25 → r3s26 → r3s27
  Ring 4: r4s24 [notable] → r4s25 → r4s26 → r4s27 [notable]
  Ring 5: r5s24 → r5s25 → r5s26 → r5s27 [★ keystone terminus]

STRAND B — slots 28–31 (theme TBD in E2P8)
  Ring 3: r3s28 → r3s29 [notable] → r3s30 → r3s31
  Ring 4: r4s28 → r4s29 [notable] → r4s30 → r4s31
  Ring 5: r5s28 → r5s29 → r5s30 → r5s31 [★ keystone terminus]
```

### Bridge Zone Structure (slots 08–11, 20–23, 32–35)

```
W→R bridge: r3s08 → r3s09 → r3s10 [notable] → r3s11
             (r3s07 arc-entry from Warrior) / (r3s12 arc-exit to Rogue)
             Deep-tree hangs from r3s10 notable via spoke down rings 4–5 (design TBD)

R→S bridge: r3s20 → r3s21 → r3s22 [notable] → r3s23
             (r3s19 arc-entry from Rogue) / (r3s24 arc-exit to Sage)

S→W bridge: r3s32 → r3s33 → r3s34 [notable] → r3s35
             (r3s31 arc-entry from Sage) / (r3s00 arc-exit to Warrior)
```

### Ring-4 Notable Symmetry Target (36-slot era, offset +1, +3, +5, +7 from start)

| Section | Slot N+1    | Slot N+3    | Slot N+5    | Slot N+7    |
|---------|-------------|-------------|-------------|-------------|
| Warrior | r4s01 (TBD) | r4s03 (TBD) | r4s05 (TBD) | r4s07 (TBD) |
| Rogue   | r4s13 (TBD) | r4s15 (TBD) | r4s17 (TBD) | r4s19 (TBD) |
| Sage    | r4s25 (TBD) | r4s27 (TBD) | r4s29 (TBD) | r4s31 (TBD) |

Notable placement and names are finalized in E2P8 (stat pass). Two notables per strand.

---

## Placeholder Stat Philosophy (E2P4–E2P7)

During the structural scaffold phases, every node uses a single simple stat as a stand-in.
This keeps the data layer compiling and navigable without committing to final balancing.

| Section      | Placeholder stat   | Value per minor | Rationale                          |
|--------------|--------------------|-----------------|---------------------------------|
| Warrior      | `maxHealth`        | +20 per node    | High HP = Warrior's core identity |
| Rogue        | `moveSpeedMult`    | +0.05 per node  | Speed = Rogue's core identity     |
| Sage         | `maxMana`          | +15 per node    | Mana pool = Sage's core identity  |
| All bridges  | mix of neighbours  | half each       | Blends the two adjacent classes   |

All placeholder stats are replaced with final themed values in **E2P8**.

---

## Legacy Node Inventory (32-Slot Era — Design Reference Only)

> ⚠️ **The nodes below use the old 32-slot coordinate system.** All slot IDs, connection
> chains, and ring positions are superseded by the 36-slot layout. Use this table for
> *design inspiration and stat budget reference* only — do not copy IDs or connections
> verbatim into the new tree. Final 36-slot inventory will be documented here after E2P8.

### Warrior (22 nodes — 32-slot era)

| ID      | Label              | Type     | Key Stats                                         |
|---------|--------------------|----------|---------------------------------------------------|
| r2s00   | Warrior's Gate     | start    | —                                                 |
| r3s29   | Iron Vein          | minor    | +20 HP, +5 armor                                  |
| r3s30   | Forge Blood        | minor    | +1.5 HP/s, +6 flat fire                           |
| r3s31   | Smoldering Blood   | minor    | +1.5 HP/s, +6 flat fire                           |
| r3s00   | Thick Hide         | minor    | +25 HP, +8 armor                                  |
| r3s01   | Ember Coils        | minor    | +12 flat fire, +6% inc fire                       |
| r3s02   | Charred Hide       | minor    | +10 armor, +5% fire resist                        |
| r3s03   | Blaze Mark         | minor    | +10 flat fire, +6% inc fire                       |
| r4s29   | Iron Bastion       | notable  | +28 armor, +40 HP, +8% fire resist *(E2P2)*       |
| r4s30   | Cinder Vein        | minor    | +18 HP, +6 flat fire *(demoted E2P2)*             |
| r4s31   | Flameguard         | notable  | +3.0 HP/s, +18 armor, +30 HP *(E2P2)*            |
| r4s00   | Ironclad           | notable  | +55 HP, +22 armor, +15 flat fire, +10% inc fire *(E2P2)* |
| r4s01   | Blazeheart         | minor    | +14 flat fire, +8% inc fire *(demoted E2P2)*      |
| r4s02   | Blaze Brand        | minor    | +12 flat fire, +8% inc fire                       |
| r4s03   | Scorched Earth     | notable  | +18 flat fire, +12% AoE, +8% inc fire             |
| r5s29   | Volcanic           | minor    | +18 flat fire, +8% inc fire                       |
| r5s30   | Ashforged          | minor    | +25 HP, +8 armor, +5 flat fire                    |
| r5s31   | Undying Flame      | minor    | +20 HP, +1 HP/s                                   |
| r5s00   | Pyre's Dominion    | keystone | Fire nova every 2s. +20 armor. DRAWBACK: −2% maxHP/nova self-burn |
| r5s01   | Inferno's Edge     | minor    | +18 flat fire, +8% inc fire                       |
| r5s02   | Searing Brand      | minor    | +15 flat fire, +6% inc fire                       |
| r5s03   | Pyre's Wake        | minor    | +18 flat fire, +10% inc fire                      |

### Rogue (22 nodes — 32-slot era)

| ID      | Label              | Type     | Key Stats                                         |
|---------|--------------------|----------|---------------------------------------------------|
| r2s11   | Rogue's Gate       | start    | —                                                 |
| r3s08   | Shadow Veil        | minor    | +80 evasion, +0.8 HP/s                            |
| r3s09   | Crisp Air          | minor    | +5% frost resist, +6 flat cold                    |
| r3s10   | Frostfoot          | minor    | +6% spd, +5% frost resist                         |
| r3s11   | Shiver Step        | minor    | +8% spd, +8 flat cold                             |
| r3s12   | Cold Reflex        | minor    | +8% atk spd, +6 flat cold                         |
| r3s13   | Chill Vein         | minor    | +1.2 HP/s, +6% frost resist                       |
| r3s14   | Cold Trail         | minor    | +4% frost resist, +6 flat cold                    |
| r4s08   | Blizzard Step      | notable  | +10% spd, +14 flat cold, +6% inc cold             |
| r4s09   | Gelid Reflex       | minor    | +7% atk spd, +5 flat cold                         |
| r4s10   | Windstep           | notable  | +12% spd, +1.5 HP/s                               |
| r4s11   | Frostbite          | notable  | +28 flat cold, +16% inc cold, +6% frost resist, +8% atk spd *(buffed E2P1)* |
| r4s12   | Swift Killer       | minor    | +10% atk spd, +10 flat cold                       |
| r4s13   | Frozen Reflex      | minor    | +8% atk spd, +5% spd                              |
| r4s14   | Frostweave         | notable  | +8% atk spd, +16 flat cold, +8% inc cold          |
| r5s08   | Deep Freeze        | minor    | +16 flat cold, +8% inc cold                       |
| r5s09   | Hypothermia        | minor    | +6% spd, +10 flat cold                            |
| r5s10   | Arctic Wind        | minor    | +10% spd, +8 flat cold                            |
| r5s11   | Ghost Step         | keystone | Speed scales w/ low HP. +18% base spd. DRAWBACK: −60 max HP |
| r5s12   | Shatter            | minor    | +18 flat cold, +10% inc cold                      |
| r5s13   | Shattered Bone     | minor    | +15 flat cold, +8% inc cold                       |
| r5s14   | Winter's Edge      | minor    | +18 flat cold, +10% inc cold                      |

### Sage (22 nodes — 32-slot era)

| ID      | Label              | Type     | Key Stats                                         |
|---------|--------------------|----------|---------------------------------------------------|
| r2s21   | Sage's Gate        | start    | —                                                 |
| r3s18   | Leyline Tap        | minor    | +12 mana, +6 flat lightning                       |
| r3s19   | Static Field       | minor    | +8 flat lightning, +0.6 mana/s                    |
| r3s20   | Charged Mind       | minor    | +18 mana, +0.8 mana/s                             |
| r3s21   | Spark Touch        | minor    | +10 flat lightning, +15 mana                      |
| r3s22   | Arc Surge          | minor    | +7% cast spd, +8 flat lightning                   |
| r3s23   | Mana Flow          | minor    | +22 mana, +1.0 mana/s                             |
| r3s24   | Shock Web          | minor    | +10 flat lightning, +0.8 mana/s                   |
| r4s18   | Conductor          | notable  | +35 mana, +12 flat lightning, +8% inc lightning   |
| r4s19   | Surge Vent         | minor    | +6% cast spd, +8 flat lightning                   |
| r4s20   | Arcane Reservoir   | notable  | +45 mana, +2.5 mana/s                             |
| r4s21   | Stormcaller        | notable  | +30 flat lightning, +16% inc lightning, +10% cast, +30 mana *(buffed E2P1)* |
| r4s22   | Tempest Mind       | minor    | +8% cast spd, +20 mana                            |
| r4s23   | Overcharged        | minor    | +12 flat lightning, +1.2 mana/s                   |
| r4s24   | Tempest Coil       | notable  | +20 mana, +16 flat lightning, +10% inc lightning  |
| r5s18   | Ball Lightning     | minor    | +14 flat lightning, +10% inc lightning            |
| r5s19   | Voltaic            | minor    | +8% cast spd, +10 flat lightning                  |
| r5s20   | Lightning Rod      | minor    | +12 flat lightning, +8% inc lightning             |
| r5s21   | Overload           | keystone | Free nova every 5th cast. +15% cast. DRAWBACK: all mana costs +30% |
| r5s22   | Chain Lightning    | minor    | +18 flat lightning, +10% inc lightning            |
| r5s23   | Bifurcate          | minor    | +12 flat lightning, +8% inc lightning, +5% cast   |
| r5s24   | Storm Surge        | minor    | +18 flat lightning, +10% inc lightning            |

### Hub (4 nodes — ring 0, unchanged across both eras)

| ID    | Label        | Stats                              | Bridge-out via |
|-------|--------------|------------------------------------|----------------|
| r0s00 | Vitality     | +25 HP, +1 HP/s                    | r1s00          |
| r0s02 | Clarity      | +25 mana, +1.5 mana/s              | r1s04          |
| r0s04 | Resilience   | +12 armor, +12 evasion             | r1s08          |
| r0s06 | Earthen Will | +15 HP, +15 mana, +0.5 HP/s        | r1s12          |

### Shared / Bridge (ring-0/1 hub nodes intact; ring-2+ nodes to be rebuilt in 36-slot era)

| ID    | Label           | Ring | Slot | Purpose                                          |
|-------|-----------------|------|------|--------------------------------------------------|
| r1s00 | Life's Crossing | 1    | 0    | Vitality → Warrior Gate spoke                    |
| r1s04 | Mana Veil       | 1    | 4    | Clarity → Crossroads                             |
| r1s08 | Steel Heart     | 1    | 8    | Resilience anchor (no class exit yet)            |
| r1s12 | Spirit Root     | 1    | 12   | Earthen Will → Sage right spoke                  |
| r2s08 | Crossroads      | 2    | 8    | Mana Veil → Shadow Veil (enters Rogue left)      |
| r2s24 | Earthen Transit | 2    | 24   | Spirit Root → Shock Web (enters Sage right)      |
| r3s04 | Emberglass      | 3    | 4    | Cross-section bridge (Warrior→Rogue), step 1     |
| r3s05 | Shard of Halves | 3    | 5    | Cross-section bridge notable, step 2             |
| r3s06 | Frostburn Mantle| 3    | 6    | Cross-section bridge, step 3                     |
| r3s07 | Cold Hearth     | 3    | 7    | Cross-section bridge → Shadow Veil, step 4       |

---

## Cross-Section Bridge Paths (36-Slot Target Layout)

Bridge zones sit between class sections and are each 4 slots wide. The bridge notable at
the midpoint connects outward to an isolated deep-tree hanging at rings 4–5 (designed in E2P6).
Class sections connect to bridge entry/exit points via arc (slot N ↔ slot N+1).

### W→R bridge (slots 08–11)

```
[Warrior r3s07] →arc→ r3s08 → r3s09 → r3s10 [NOTABLE] → r3s11 →arc→ [Rogue r3s12]
                              ↑ deep-tree entry (r4s10 spoke, design TBD)
```

### R→S bridge (slots 20–23)

```
[Rogue r3s19] →arc→ r3s20 → r3s21 → r3s22 [NOTABLE] → r3s23 →arc→ [Sage r3s24]
                               ↑ deep-tree entry (r4s22 spoke, design TBD)
```

### S→W bridge (slots 32–35)

```
[Sage r3s31] →arc→ r3s32 → r3s33 → r3s34 [NOTABLE] → r3s35 →arc→ [Warrior r3s00]
                              ↑ deep-tree entry (r4s34 spoke, design TBD)
```

All bridge arcs are bidirectional. Players may traverse from either class side into the
bridge zone, then optionally descend into the bridge deep-tree from the midpoint notable.

---

## Future Expansion Guidelines (36-Slot Era)

### Adding a new class node

1. Pick a slot in the class's 8-slot range (e.g. Warrior: 00–07, Rogue: 12–19, Sage: 24–31).
2. Follow the strand layout: Strand A = lower 4 slots, Strand B = upper 4 slots.
3. Use placeholder stat only during scaffold phases (E2P4–E2P7); finalize in E2P8.
4. Arc-connect to both neighbours in the same ring; spoke-connect down to ring+1 if it exists.
5. Promote to `notable` if it's at offset +1 or +5 from the class start slot.

### Adding a bridge node

1. Pick a slot in the bridge's 4-slot range (W→R: 08–11, R→S: 20–23, S→W: 32–35).
2. Set `section: 'shared'`. Use hybrid placeholder stats (half each adjacent class).
3. The midpoint slot (09/10, 21/22, or 33/34) is the bridge `notable` — the deep-tree root.
4. Deep-tree nodes hang below the notable via spoke at ring 4 and 5 (slots match the notable).

### Adding a keystone

1. Add the data node as `type: 'keystone'`, at the ring-5 terminus of a strand (slot 03, 07, 15, 19, 27, or 31).
2. Add the `id` check to `_applyPassiveTreeRuntimeEffects()` in `GameEngine.js`.
3. Write the `description` mentioning the runtime effect AND the negative drawback explicitly.
4. Update `docs/passive-tree-plan.md`.

### Adding a hub node (ring 0)

Hub slots 1, 3, 5, 7 remain free (45°, 135°, 225°, 315°).
Connect via new ring-1 bridge nodes. Use only `section: 'shared'` and generalist stats.

---

## Checklist for adding a node

- [ ] ID follows `r{ring}s{slot:02d}` format  
- [ ] `section` matches the angular position (warrior / rogue / sage / shared)  
- [ ] `ring` and `slot` numbers are correct for the angular position  
- [ ] `stats` uses ONLY keys from `STAT_KEYS`  
- [ ] `connections` lists all neighbours  
- [ ] Each neighbour's `connections` array has been updated with this new ID  
- [ ] `type: 'keystone'` → matching runtime handler added to `GameEngine.js`  
- [ ] Build passes: `npm run build`  
- [ ] Visually verified in `npm run dev` passive tree screen  
- [ ] This file's inventory table updated  

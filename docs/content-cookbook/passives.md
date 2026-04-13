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
  slot: 7,                            // 0–(slotsInRing-1)
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

| Ring | Slots | °/slot | Purpose             | Typical type   |
|------|-------|--------|---------------------|----------------|
| 0    | 8     | 45°    | Hub                 | hub            |
| 1    | 16    | 22.5°  | Bridge / inner minor| minor / shared |
| 2    | 32    | 11.25° | Class gate + cross  | start / shared |
| 3    | 32    | 11.25° | Minor branches      | minor          |
| 4    | 32    | 11.25° | Notables            | notable        |
| 5    | 32    | 11.25° | Outer / Keystone    | keystone / minor|

**Slot 0 = 0° (3 o'clock). Increases clockwise.**

Class centres: Warrior `r2s00` (0°) · Rogue `r2s11` (~124°) · Sage `r2s21` (~236°)  
Hub nodes:     Vitality `r0s00` (0°) · Clarity `r0s02` (90°) · Resilience `r0s04` (180°) · Earthen Will `r0s06` (270°)

### Free slot ranges by section (Phase 4 state)

| Section | Used slots (ring 3) | Used slots (ring 4) | Used slots (ring 5) | Open ranges     |
|---------|---------------------|---------------------|---------------------|-----------------|
| Warrior | 29,30,31,00,01,02,03| 29,30,31,00,01,02,03| 29,30,31,00,01,02,03| 24–28 (left gap)|
| Rogue   | 08–14               | 08–14               | 08–14               | 15–17, 05–07   |
| Sage    | 18–24               | 18–24               | 18–24               | 25–27, 15–17   |
| Shared  | 04–07 (bridge)      | —                   | —                   | ring 2: 09–10  |

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

## Current Node Inventory (Phase 4 — 80 nodes)

### Warrior (22 nodes)

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
| r4s29   | Cinder Guard       | minor    | +12 armor, +5% fire resist                        |
| r4s30   | Molten Core        | notable  | +35 HP, +10 flat fire, +8% inc fire               |
| r4s31   | Forge-Born         | minor    | +20 HP, +8 armor                                  |
| r4s00   | Ironclad           | notable  | +55 HP, +22 armor                                 |
| r4s01   | Blazeheart         | notable  | +22 flat fire, +14% inc fire                      |
| r4s02   | Blaze Brand        | minor    | +12 flat fire, +8% inc fire                       |
| r4s03   | Scorched Earth     | notable  | +18 flat fire, +12% AoE, +8% inc fire             |
| r5s29   | Volcanic           | minor    | +18 flat fire, +8% inc fire                       |
| r5s30   | Ashforged          | minor    | +25 HP, +8 armor, +5 flat fire                    |
| r5s31   | Undying Flame      | minor    | +20 HP, +1 HP/s                                   |
| r5s00   | Pyre's Dominion    | keystone | Fire nova every 2s. +40 HP, +15 armor, +15 fire   |
| r5s01   | Inferno's Edge     | minor    | +18 flat fire, +8% inc fire                       |
| r5s02   | Searing Brand      | minor    | +15 flat fire, +6% inc fire                       |
| r5s03   | Pyre's Wake        | minor    | +18 flat fire, +10% inc fire                      |

### Rogue (22 nodes)

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
| r4s11   | Frostbite          | notable  | +20 flat cold, +14% inc cold, +6% frost resist    |
| r4s12   | Swift Killer       | minor    | +10% atk spd, +10 flat cold                       |
| r4s13   | Frozen Reflex      | minor    | +8% atk spd, +5% spd                              |
| r4s14   | Frostweave         | notable  | +8% atk spd, +16 flat cold, +8% inc cold          |
| r5s08   | Deep Freeze        | minor    | +16 flat cold, +8% inc cold                       |
| r5s09   | Hypothermia        | minor    | +6% spd, +10 flat cold                            |
| r5s10   | Arctic Wind        | minor    | +10% spd, +8 flat cold                            |
| r5s11   | Ghost Step         | keystone | Speed scales w/ low HP. +18% spd, +12 cold        |
| r5s12   | Shatter            | minor    | +18 flat cold, +10% inc cold                      |
| r5s13   | Shattered Bone     | minor    | +15 flat cold, +8% inc cold                       |
| r5s14   | Winter's Edge      | minor    | +18 flat cold, +10% inc cold                      |

### Sage (22 nodes)

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
| r4s21   | Stormcaller        | notable  | +22 flat lightning, +14% inc lightning, +10% cast |
| r4s22   | Tempest Mind       | minor    | +8% cast spd, +20 mana                            |
| r4s23   | Overcharged        | minor    | +12 flat lightning, +1.2 mana/s                   |
| r4s24   | Tempest Coil       | notable  | +20 mana, +16 flat lightning, +10% inc lightning  |
| r5s18   | Ball Lightning     | minor    | +14 flat lightning, +10% inc lightning            |
| r5s19   | Voltaic            | minor    | +8% cast spd, +10 flat lightning                  |
| r5s20   | Lightning Rod      | minor    | +12 flat lightning, +8% inc lightning             |
| r5s21   | Overload           | keystone | Free nova every 5th cast. +18 lightning, +15% cast|
| r5s22   | Chain Lightning    | minor    | +18 flat lightning, +10% inc lightning            |
| r5s23   | Bifurcate          | minor    | +12 flat lightning, +8% inc lightning, +5% cast   |
| r5s24   | Storm Surge        | minor    | +18 flat lightning, +10% inc lightning            |

### Hub (4 nodes — ring 0)

| ID    | Label        | Stats                              | Bridge-out via |
|-------|--------------|------------------------------------|----------------|
| r0s00 | Vitality     | +25 HP, +1 HP/s                    | r1s00          |
| r0s02 | Clarity      | +25 mana, +1.5 mana/s              | r1s04          |
| r0s04 | Resilience   | +12 armor, +12 evasion             | r1s08          |
| r0s06 | Earthen Will | +15 HP, +15 mana, +0.5 HP/s        | r1s12          |

### Shared / Bridge (10 nodes)

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

## Cross-Section Bridge Paths (Phase 4)

### Warrior ↔ Rogue via ring-3 shared nodes

```
[Warrior] r3s03 (Blaze Mark)
    ↓ arc
  r3s04 (Emberglass)      SHARED  +10 HP, +5 fire, +4 cold
    ↓ arc
  r3s05 (Shard of Halves) SHARED  +18 HP, +7 fire, +7 cold, +4% spd  ← NOTABLE
    ↓ arc
  r3s06 (Frostburn Mantle)SHARED  +8 HP, +6 fire, +6 cold
    ↓ arc
  r3s07 (Cold Hearth)     SHARED  +10 HP, +8 cold, +5 fire
    ↓ arc
  r3s08 (Shadow Veil) → [Rogue left branch]
```
Cost to cross: 4 shared passive points. Reward: dual-element hybrid stats.

### Hub → Rogue via Clarity

```
r0s02 (Clarity) → r1s04 (Mana Veil) → r2s08 (Crossroads) → r3s08 (Shadow Veil)
```
Cost from hub: 3 bridge points. Opens the Rogue left wing from any class with hub access.

### Hub → Sage right via Earthen Will

```
r0s06 (Earthen Will) → r1s12 (Spirit Root) → r2s24 (Earthen Transit) → r3s24 (Shock Web)
```
Cost from hub: 3 bridge points. Opens the Sage right wing from any class with hub access.

---

## Future Expansion Guidelines

### Adding a new Warrior node

The Warrior's left branch (slots 24–28, rings 3–5) is **completely empty**. Perfect for a
survivability/physical sub-build. Suggested additions:

- `r3s24–r3s28`: regen + armor minor chain
- `r4s25–r4s27`: a notable around "Bulwark of Iron" (+40 HP, +20 armor, +8% phys damage)
- `r5s26`: second Warrior keystone candidate — e.g. "Phalanx" (permanent stagger aura)

### Adding a new Rogue node

The Rogue's right wing (slots 15–17) and left-of-bridge area (slots 05–07) are free.

- `r3s15–r3s17`: dodge/evasion minor chain
- `r4s15–r4s16`: a notable around "Shadow Dance" (+20% evasion, +10% atk spd)

### Adding a new Sage node

Slots 25–27 (ring 3–5) and slots 15–17 are free.

- `r3s25–r3s27`: mana cost reduction / penetration minor chain
- `r4s26`: notable "Void Tap" (–10% mana cost, +10% lightning pen)

### Adding a new hub node

Ring 0 slots 1, 3, 5, 7 are free (at 45°, 135°, 225°, 315°). Connect via new ring-1 bridge nodes.
Use only `section: 'shared'` and general stats (no class-specific elements).

### Adding a keystone

1. Add the data node as `type: 'keystone'`, `ring: 5`.
2. Add the `id` check to `_applyPassiveTreeRuntimeEffects()` in `GameEngine.js`.
3. Write the lore description mentioning the runtime effect explicitly.
4. Update `docs/passive-tree-plan.md`.

### Adding a Mastery node (Phase 4 plan item)

A `type: 'mastery'` node opens a **choice dialog** on first allocation. Implementation TBD:
- On allocation, fire `onMasteryChoice(nodeId)` callback → React modal appears.
- Player picks one of N mutually-exclusive sub-bonuses.
- Chosen sub-bonus stored in `player.masteryChoices[nodeId]`.
- `applyStats` applies the chosen sub-bonus; `removeStats` reverses it.

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

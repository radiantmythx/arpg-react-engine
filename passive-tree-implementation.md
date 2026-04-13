# Passive Tree Expansion — Implementation Plan

## Overview

**Goal:** Add ~1,000 new passive nodes to the existing tree (currently 60 nodes across 7 clusters), expanding it to ~1,060 total nodes with a PoE-inspired radial branch structure.

**Design pillars:**
- Every branch is **thematically coherent** — minors reinforce the branch identity, notables deliver meaningful power spikes, keystones define a specific build archetype.
- **Trade-off keystones only** — every keystone gives something powerful and takes something away. Never pure upside.
- **Reachability** — no branch should require more than 12–16 points from the starting hub to reach its keystone.
- Branches **cross-connect** to enable hybrid builds. No cluster is a dead end.

---

## Current State (Baseline)

| Cluster | Nodes | Keystone |
|---|---|---|
| Starting Hub | 9 | — |
| Power | 14 | Bloodrage (+80% dmg / −50 life) |
| Speed | 13 | Elusive (+50 spd / −40 life) |
| Tank | 12 | Immortal Ambition (+150 life / −30% dmg) |
| Arcane | 12 | Void Pact (+100% XP / −3 regen/s) |
| Arcane Mastery | 12 | Spellweave (+2 proj / −20% dmg) |
| Blood Rite | 10 | Bloodlust (+100 life / −30 speed) |
| Fortune's Edge | 8 | Treasure Sense (+80% XP / −15% dmg) |
| **Total** | **90** | **7 keystones** |

**New nodes to add:** ~1,000 (targeting ~1,060–1,070 total).

---

## Technical Prerequisites (Phase PT-0)

Before any new nodes are added, the engine needs infrastructure to support a larger tree and new stat types.

### PT-0A: Canvas Expansion & Desktop Pan/Zoom

The current SVG viewBox is `0 0 900 900`. At ~1,060 nodes this becomes unreadable. Expand to a virtual canvas and add desktop pan/zoom.

**File:** `src/components/PassiveTreeScreen.jsx`

- [ ] Expand SVG viewBox to `0 0 3600 3600`; re-center hub at `(1800, 1800)`
- [ ] Add desktop wheel-zoom (`onWheel`): zoom range `0.15x – 1.5x`, default `0.55x`
- [ ] Add desktop click-drag pan (hold middle-mouse or hold alt + left-drag)
- [ ] Add minimap overlay (canvas thumbnail, top-right corner) showing allocated path
- [ ] Update all existing node `position` values by multiplying x and y by 4 (scaling from 900→3600 space)
- [ ] Move existing clusters outward: hub stays at center (1800,1800), outer clusters shift to 600–700px radius from center

**File:** `src/game/data/passiveTree.js`

- [ ] Update all 90 existing node positions to new coordinate space

### PT-0B: New Stat Keys

Add these stat keys to `applyStats` and `removeStats` in `passiveTree.js`. All are already referenced in the branch designs below.

| Key | Effect |
|---|---|
| `armorFlat` | Flat armor (damage reduction) |
| `evasionFlat` | Flat evasion rating |
| `critChanceFlat` | Flat crit chance % |
| `critMultFlat` | Flat crit multiplier % |
| `blazeDamageMult` | % increased Blaze-tagged damage |
| `thunderDamageMult` | % increased Thunder-tagged damage |
| `frostDamageMult` | % increased Frost-tagged damage |
| `holyDamageMult` | % increased Holy-tagged damage |
| `unholyDamageMult` | % increased Unholy/Chaos-tagged damage |
| `physDamageMult` | % increased Physical-tagged damage |
| `igniteChanceFlat` | Flat chance % to Ignite on hit |
| `shockChanceFlat` | Flat chance % to Shock on hit |
| `chillChanceFlat` | Flat chance % to Chill on hit |
| `freezeChanceFlat` | Flat chance % to Freeze on hit |
| `aoeSizeFlat` | Flat AoE radius bonus |
| `skillDurationMult` | % increased skill effect duration |
| `lifeOnKillFlat` | Life gained on kill |
| `manaOnKillFlat` | Mana gained on kill |
| `goldDropMult` | % increased gold dropped by enemies |
| `dashCooldownMult` | % reduced dash/blink cooldown |
| `energyShieldFlat` | Flat energy shield |
| `energyShieldRegenPerS` | Energy shield recharge per second |

- [ ] Add all 22 keys to `applyStats()` with snapshot capture
- [ ] Add all 22 keys to `removeStats()` with reversal logic
- [ ] Update `statLines()` in `PassiveTreeScreen.jsx` to display all new keys in tooltips

### PT-0C: Visual Upgrades

- [ ] Add a fourth node type: `**mastery**` — an octagon shape, r=19, between notable and keystone. Used for powerful single-stat notables that anchor a branch's identity
- [ ] Add branch **region tinting** — each cluster zone lightly tints the SVG background with its theme color (e.g., red glow for Blaze zone)
- [ ] Add **allocated path highlighting** — draw a brighter golden line following the connected path from `start` to each allocated node

---

## Phase PT-1: Elemental Branches (400 new nodes)

Five new elemental branches grow from the outer edge of existing clusters. Each branch has: ~5–6 minor nodes per segment, 3–4 notables, 1 mastery, 1 keystone. Each branch is structurally identical in pattern but unique in theme.

### Branch 1: The Blaze Path — Fire/Ignite Branch (~80 nodes)

**Theme:** Stacking fire damage, Ignite chance, and burning DoT multipliers.  
**Entry:** Connects from `pw_ks` region (upper-right, Power cluster outer edge) and from `am_ks`.  
**Layout:** Sweeps northeast from Power cluster.

**Node segments:**

| Segment | Nodes | Pattern |
|---|---|---|
| Entry gate | 3 minor | +5% Blaze dmg each |
| Fork A (left) | 5 minor → Notable: **Smoldering Strikes** (+20% Blaze, +15% Ignite chance) | Blaze damage focus |
| Fork B (right) | 4 minor → Notable: **Kindling** (+25% Ignite chance, Ignite stacks twice) | Status focus |
| Convergence | 3 minor | Mixed blaze/ignite |
| Deep spine | 4 minor | +5–8% blaze each |
| Mastery: **Pyromaniac** | 1 mastery | +35% Blaze damage, +30% Ignite chance |
| Pre-keystone | 2 minor | +5% blaze each |
| **Keystone: Conflagration** | 1 keystone | +120% Blaze damage and Ignites always deal 30% of life as damage, but you cannot regenerate life while Ignited (debuff reflected to self) |

**All ~80 node IDs prefixed:** `bz_`

**Notable full list (4 notables + 1 mastery):**
1. **Smoldering Strikes** — +20% Blaze damage, +15% Ignite chance
2. **Kindling** — +25% Ignite chance; enemies you Ignite take 10% increased damage from all sources
3. **Cremation** — Ignite duration +50%, +20% Blaze damage while an enemy is Ignited
4. **Cinder Rain** — AoE of Blaze skills +20, Ignite spreads to nearby enemies on expiry
5. *(Mastery)* **Pyromaniac** — +35% Blaze damage, +30% Ignite chance

**Keystone trade-off rationale:** The self-Ignite vulnerability forces players to commit hard to the archetype — they cannot stack life regen without negating their own keystone. Huge upside (30% life Ignite on enemies) balanced by positioning risk.

**Implementation checklist:**
- [ ] Define 80 nodes in `passiveTree.js` with `bz_` prefix
- [ ] All positions placed in northeast region of 3600×3600 space (~2400–3400 x, 100–900 y)
- [ ] `bz_entry` connects to `pw_ks` and `am_n3`
- [ ] `bz_ks` (Conflagration) requires `igniteChanceFlat` treatment in GameEngine on-hit logic
- [ ] Add tooltip line for `igniteChanceFlat` to `statLines()`

---

### Branch 2: The Tempest Path — Thunder/Shock Branch (~80 nodes)

**Theme:** Chain lightning, AoE size, Shock chance, and shocking enemies to deal more damage.  
**Entry:** Connects from `sp_ks` (Speed cluster top) and from `am_ks` (secondary).  
**Layout:** Sweeps north-northwest.

**Node segments:**

| Segment | Nodes | Pattern |
|---|---|---|
| Entry gate | 3 minor | +5% Thunder dmg each |
| Fork A | 5 minor → Notable: **Arc Flash** (+25% Thunder dmg, chains hit 1 extra target) | Chain emphasis |
| Fork B | 4 minor → Notable: **Static Field** (+20% Shock chance, Shocked enemies take 20% more dmg) | Shock emphasis |
| Convergence | 3 minor | +5% thunder each |
| Deep spine | 4 minor | +AoE size |
| Mastery: **Stormcaller** | 1 mastery | +30% Thunder dmg, +25% AoE, Shock chance +20% |
| Pre-keystone | 2 minor | +AoE each |
| **Keystone: Ball Lightning** | 1 keystone | Thunder skills fire 2 additional projectiles that arc between nearby enemies, but you lose 15 mana per second passively |

**Notable full list:**
1. **Arc Flash** — +25% Thunder damage; chain effects hit 1 additional target
2. **Static Field** — +20% Shock chance; Shocked enemies take 20% increased damage from all sources
3. **Overcharge** — Shock duration +75%; +15% Thunder damage while you have Shocked an enemy in the last 3 seconds
4. **Thunderstruck** — +20% AoE size for Thunder skills; Shocks have a 10% chance to Stun

**Keystone trade-off:** Massive clear potential (2 extra projectiles arcing) offset by passive mana drain forcing strong mana investment or fast killing.

**Implementation checklist:**
- [ ] Define 80 nodes with `tm_` prefix
- [ ] Positions: northwest region (~400–1400 x, 100–900 y)
- [ ] `tm_entry` connects to `sp_ks`
- [ ] Add `shockChanceFlat` and `aoeSizeFlat` to engine on-hit / skill dispatch

---

### Branch 3: The Permafrost Path — Frost/Freeze Branch (~80 nodes)

**Theme:** Chill, Freeze, slowing enemies, and dealing damage to frozen targets.  
**Entry:** Connects from `tn_ks` (Tank cluster left) and from `sp_n1`.  
**Layout:** Sweeps west-northwest.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +5% Frost dmg each |
| Fork A (5 minor → Notable) | **Glacial Spear** — +25% Frost dmg, Freeze chance +20% |
| Fork B (4 minor → Notable) | **Brittle Cold** — Chilled enemies take +15% damage from all sources, Chill duration +60% |
| Convergence (3 minor) | Mixed frost/chill |
| Deep spine (4 minor) | +10% Frost dmg each |
| Mastery: **Absolute Zero** | +40% Frost dmg, +25% Freeze chance, Frozen enemies shatter for AoE dmg |
| Pre-keystone (2 minor) | mixed |
| **Keystone: Glacier's Embrace** | You and enemies within 300px are permanently Chilled (you move 15% slower, all enemies take +25% Frost damage) |

**Notable full list:**
1. **Glacial Spear** — +25% Frost dmg, +20% Freeze chance
2. **Brittle Cold** — Chilled enemies take 15% increased damage from all; Chill duration +60%
3. **Frost Nova** — Frost skills deal 100% bonus damage to Frozen enemies; +15% Frost dmg
4. **Permafrost** — Freeze duration +80%; Frozen enemies cannot be knocked back (they shatter instead)

**Keystone trade-off:** Enormous debuff on enemies but the permanent personal Chill is a significant movement penalty, punishing players who need mobility.

**Implementation checklist:**
- [ ] Define 80 nodes with `fr_` prefix
- [ ] Positions: west region (~100–900 x, 900–1800 y)
- [ ] `fr_entry` connects to `tn_ks`
- [ ] Engine: implement Chill/Freeze status effects if not already done; Permafrost keystone requires always-on aura check each tick

---

### Branch 4: The Sanctified Path — Holy/Divine Branch (~80 nodes)

**Theme:** Healing, radiant damage, shields, and empowering allied or self-buff effects.  
**Entry:** Connects from `ar_ks` (Arcane cluster bottom) and from `br_n1`.  
**Layout:** Sweeps south.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +5% Holy dmg each |
| Fork A (5 minor → Notable) | **Consecration** — +25% Holy dmg, AoE +15, area you occupy deals minor Holy dmg/s to enemies |
| Fork B (4 minor → Notable) | **Blessed Ground** — +3 HP regen/s, max life +25, potions heal 15% more |
| Convergence (3 minor) | +5–8% holy |
| Deep spine (4 minor) | +armor, +holy dmg mix |
| Mastery: **Radiant Sentinel** | +35% Holy dmg, +4 HP regen/s, +50 armor |
| Pre-keystone (2 minor) | holy and regen |
| **Keystone: Divine Covenant** | You regenerate 2% of max life per second and deal 60% increased Holy damage, but your mana does not regenerate naturally (must use potions or on-kill) |

**Notable full list:**
1. **Consecration** — +25% Holy dmg; radiant ground around you deals 8 Holy dmg/s to enemies
2. **Blessed Ground** — +3 HP regen/s, +25 max life; potions restore 15% additional life
3. **Smite** — Holy skills have a 15% chance to Stun; +20% Holy dmg
4. **Martyr's Ward** — +40 armor; when you're struck, deal 50% Holy dmg back to attacker (once per 0.5s)

**Keystone trade-off:** Massive regen + Holy damage bonus but forces the player to source all mana from potions or kill-triggers, demanding careful resource management.

**Implementation checklist:**
- [ ] Define 80 nodes with `hl_` prefix
- [ ] Positions: south region (~1400–2200 x, 3000–3500 y)
- [ ] `hl_entry` connects from `ar_ks`
- [ ] `holyDamageMult` driving in engine elemental dispatch
- [ ] Consecration aura requires engine-side per-tick damage zone

---

### Branch 5: The Void Path — Chaos/Unholy Branch (~80 nodes)

**Theme:** Poison, Bleed, Doom DoT, life drain, and chaos-infused attacks.  
**Entry:** Connects from `ar_ks` (secondary) and from `br_ks`.  
**Layout:** Sweeps south-southwest.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +5% Unholy dmg each |
| Fork A (5 minor → Notable) | **Pestilence** — +25% Unholy dmg, Poison chance +20% |
| Fork B (4 minor → Notable) | **Hemorrhage** — Bleed chance +25%, Bleeding enemies take +15% all dmg |
| Convergence (3 minor) | mixed void |
| Deep spine (4 minor) | +mana/unholy mix |
| Mastery: **Void Walker** | +35% Unholy dmg, Poison stacks deal 15% more dmg per stack, life drain on hit |
| Pre-keystone (2 minor) | unholy |
| **Keystone: Pact with Ruin** | Your damage ignores 40% of enemy resistance, and you deal 25% increased damage for each DoT (poison, bleed, ignite) on the target. But your maximum life is reduced by 30% |

**Notable full list:**
1. **Pestilence** — +25% Unholy, Poison chance +20%
2. **Hemorrhage** — Bleed chance +25%; Bleeding enemies take 15% increased damage
3. **Soul Shatter** — Enemies killed while Poisoned or Bleeding explode, dealing 15% of their max life as Unholy AoE damage
4. **Wither** — Unholy skills reduce enemy movement speed by 20% for 3 seconds; +20% Unholy dmg

**Keystone trade-off:** The resistance ignore and DoT multiplier is huge burst value for DoT builds, but the 30% life reduction makes the player extremely squishy — must kill fast.

**Implementation checklist:**
- [ ] Define 80 nodes with `vd_` prefix
- [ ] Positions: southwest region (~100–900 x, 2400–3400 y)
- [ ] `vd_entry` connects from `br_ks`
- [ ] Poison/Bleed as status stacks need engine-side DoT tracking per enemy if not yet implemented

---

## Phase PT-2: Combat Style Branches (320 new nodes)

Four branches for specific combat archetypes. Entry points cross-connect from Phase PT-1 branches and existing clusters for hybrid build potential.

### Branch 6: The Berserker Path (~80 nodes)

**Theme:** Trade life for power. Frenzy charges, life-cost abilities, attack speed scaling with low HP.  
**Entry:** Connects from `pw_ks` and from `vd_entry`.  
**Layout:** Far-east, below Power cluster.

**Design goal:** Reward high-risk low-life playstyle. Points here make you much stronger when near death.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +5% dmg each |
| Fork A (5 minor → Notable) | **Blood Price** — spend 5% max life per skill use; gain +30% damage for that hit |
| Fork B (4 minor → Notable) | **Cannibalize** — +3 life on kill; damage increases by 1% per 1% missing life (up to +30%) |
| Convergence (3 minor) | +damageMult |
| Deep spine (4 minor) | +dmg and speed mix |
| Mastery: **Frenzy State** | +40% dmg, +20 speed, −5% max life for each node you have in this branch |
| Pre-keystone (2 minor) | damage |
| **Keystone: Last Stand** | When below 25% life, gain +100% weapon damage and +50% attack speed. Your life cannot regenerate while above 25% max life |

**Notables:**
1. **Blood Price** — spending life boosts that hit's dmg by 30%
2. **Cannibalize** — +3 life on kill; +1% dmg per 1% missing life (max +30%)
3. **Warcry** — Every 10 kills grants a Frenzy Charge (up to 3); each charge is +8% attack speed and +5% dmg
4. **Savage** — Critical hits (if applicable) or overkills deal splash damage equal to 25% of the excess damage

**Keystone:** "Last Stand" — the 100% damage and 50% attack speed bonus are enormous, but the anti-regen above 25% means you cannot safely heal back up; you must stay near death to benefit.

**Implementation checklist:**
- [ ] Define 80 nodes with `bk_` prefix
- [ ] Positions: far-east below Power (~2800–3500 x, 1200–2200 y)
- [ ] Missing-life scaling requires engine-side real-time calculation (snapshot player.health / player.maxHealth each hit)
- [ ] Frenzy Charges need a charge counter on the player entity

---

### Branch 7: The Iron Bulwark Path — Defense/Armor (~80 nodes)

**Theme:** Armor stacking, block chance, damage reduction, and counter-damage.  
**Entry:** Connects from `tn_ks` and from `fr_entry`.  
**Layout:** Far-west, to the left of Tank cluster.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +20 armor each |
| Fork A (5 minor → Notable) | **Plated** — +80 armor, damage reduction 5% hard cap |
| Fork B (4 minor → Notable) | **Retribution** — When struck, deal 15% of the hit back as Physical damage |
| Convergence (3 minor) | +armor/life mix |
| Deep spine (4 minor) | +armor and regen |
| Mastery: **Fortress** | +150 armor, +50 max life, incoming damage reduced by 8% |
| Pre-keystone (2 minor) | armor |
| **Keystone: Monument** | +400 armor and −40% movement speed. You are immune to Chill and Freeze. While stationary for 1+ seconds, gain +25% damage reduction |

**Notables:**
1. **Plated** — +80 armor; hard DR cap raised by 5%
2. **Retribution** — 15% of damage you receive is reflected as Physical back to attacker (once per 0.2s)
3. **Tower Shield** — Each point of armor above 200 grants 0.01% life regeneration per second (effectively scales regen with armor)
4. **Juggernaut** — Immune to knockback; +20 armor per second for 3 seconds after being hit (stacks up to 60)

**Keystone:** Moving −40% speed is brutal, but the immunity to two status effects and stationary bonus makes this for turret-style players or boss-killing builds.

**Implementation checklist:**
- [ ] Define 80 nodes with `ib_` prefix
- [ ] Positions: far-west (~100–600 x, 1400–2400 y)
- [ ] `armorFlat` applied in engine damage resolution (reduce incoming damage)
- [ ] Monument keystone requires stationary-timer tracking on player entity (reset on movement input)

---

### Branch 8: The Shadow Step Path — Evasion/Crit (~80 nodes)

**Theme:** Evasion rating, critical hit chance, critical multiplier, dodge, and burst windows.  
**Entry:** Connects from `sp_ks` and from `bz_n3`.  
**Layout:** North-northeast, above Speed cluster.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +40 evasion each |
| Fork A (5 minor → Notable) | **Whisper Step** — +150 evasion, +10% crit chance |
| Fork B (4 minor → Notable) | **Marked for Death** — Crit hits deal +40% more damage; crit strikes apply a 2s mark doubling crit chance vs that target |
| Convergence (3 minor) | +evasion + crit chance |
| Deep spine (4 minor) | +crit mult |
| Mastery: **Phantom** | +200 evasion, +15% crit chance, +30% crit multiplier |
| Pre-keystone (2 minor) | crit mult |
| **Keystone: Glass Cannon** | +50% critical chance and +100% critical multiplier, but your maximum life is reduced by 25% and you have −100 armor |

**Notables:**
1. **Whisper Step** — +150 evasion, +10% crit chance; rolling/dashing refills one charge
2. **Marked for Death** — Crits deal +40% more damage; crits mark target (all crits vs that target +100% more crit chance, 2s)
3. **Assassin's Focus** — Standing still for 0.5s grants +25% crit chance until you move; +20% crit mult
4. **Blinding Speed** — +30 evasion; skill crits reduce skill cooldown by 15% on Crit (once per 0.5s)

**Keystone:** Massive crit potential but forces glass-cannon fragility. The −100 armor means even small hits hurt.

**Implementation checklist:**
- [ ] Define 80 nodes with `ss_` prefix
- [ ] Positions: north-northeast (~2200–3300 x, 100–800 y)
- [ ] `critChanceFlat` and `critMultFlat` consumed in damage calc; engine needs crit roll per hit
- [ ] Evasion: add evasion-based dodge chance formula to incoming hit resolution

---

### Branch 9: The Martial Combatant Path — Melee/Physical (~80 nodes)

**Theme:** Physical damage scaling, melee range, life-on-hit, and AoE cleave.  
**Entry:** Connects from `pw_n2` (Alacrity) and from `ib_entry`.  
**Layout:** East-southeast.

**Node segments:**

| Segment | Pattern |
|---|---|
| Entry gate (3 minor) | +5% Physical dmg each |
| Fork A (5 minor → Notable) | **Cleave** — Melee attacks hit all enemies in a 90° arc, +20% Physical dmg |
| Fork B (4 minor → Notable) | **Iron Fist** — +25% Physical dmg vs non-boss; +3 life on hit |
| Convergence (3 minor) | +phys dmg |
| Deep spine (4 minor) | +dmg and life on hit |
| Mastery: **Titan's Grip** | +35% Physical dmg, +6 life on hit, +20 AoE for melee weapons |
| Pre-keystone (2 minor) | pure phys |
| **Keystone: Brute Force** | All damage dealt is Pure Physical regardless of weapon type. +60% Physical damage, but elemental skills deal no bonus elemental damage (converted to Physical) |

**Notables:**
1. **Cleave** — Melee swings hit all targets in a 90-degree arc; +20% Physical dmg
2. **Iron Fist** — +25% Physical dmg vs non-boss enemies; +3 life on hit
3. **Colossus** — +50 max life, +20% Physical dmg; enemies hit by skills are Slowed 15% for 2s
4. **Warpath** — On kill, briefly gain +15% speed and +10% Physical dmg (1.5s duration, stacks up to 3 kills)

**Keystone:** Converting all damage to Physical loses elemental scaling (a deliberate anti-synergy with the elemental branches) but the +60% and cleave potential on a melee build is enormous.

**Implementation checklist:**
- [ ] Define 80 nodes with `mc_` prefix
- [ ] `physDamageMult` in engine
- [ ] Brute Force keystone: engine strips elemental tags from damage and applies physDamageMult instead

---

## Phase PT-3: Utility & Support Branches (240 new nodes)

### Branch 10: The Arcanist Path — Mana Mastery (~80 nodes)

**Theme:** Mana-as-resource scaling, spell power from mana, mana regen stacking, and skill cost reduction.  
**Entry:** Connects from `ar_n2` (Gem Hoarder) and from `am_ks`.  
**Layout:** Upper-center (above existing Arcane Mastery cluster).

**High-level design:** This branch rewards investing deeply in mana. All notables scale power from mana pool size, making it the definitive "caster" branch.

**Notables:**
1. **Wellspring** — +100 max mana; mana regen +2/s; for every 100 max mana you have, gain +1% skill damage
2. **Arcane Amplifier** — Mana costs reduced by 20%; skills deal +10% more damage for each 50 mana spent in the last 3 seconds (max +40%)
3. **Overflowing Power** — When mana is above 80%, deal +25% skill damage; +50 max mana
4. **Void Tap** — On kill, restore 15% of max mana; +30 max mana

**Mastery: Leyline Conduit** — +150 max mana, −15% all mana costs, +20% skill dmg per 100 max mana (up to +80%)

**Keystone: Mana as Aegis** — Your mana acts as a second life pool. Damage hits mana first, then life. Mana does not regenerate when it has absorbed damage in the last 2 seconds. +100 max mana.

- [ ] Define 80 nodes with `ac_` prefix
- [ ] Track "mana spent last N seconds" as a rolling counter on player for Arcane Amplifier
- [ ] Mana-as-Aegis: engine damage routing checks mana before life

---

### Branch 11: The Ritualist Path — Cooldown & Charges (~80 nodes)

**Theme:** Reducing cooldowns, building charges for burst, and skill reset mechanics.  
**Entry:** Connects from `sp_n2` (Windrunner) and from `am_n2` (Spellhaste).  
**Layout:** Top-center.

**High-level design:** Very high attack-speed / cooldown reduction ceiling. Trade-off is very high mana cost since you're casting so much more frequently.

**Notables:**
1. **Expedite** — −15% all skill cooldowns; when a skill comes off cooldown, its first use deals +30% damage
2. **Charge Reset** — When you use a skill while at full charges, that skill's cooldown resets completely (once per 6s)
3. **Tempo** — Every 5 skills used in succession (no downtime) increases attack speed by 5% (up to +25%), reset if you don't use a skill for 1s
4. **Cantrip Master** — Skills with zero cooldown (passive/instant) empower the next cooldown skill by +30%

**Mastery: Relentless Rhythm** — −20% all cooldowns; every skill use reduces all cooldowns by an additional 0.1s

**Keystone: Eternal Machine** — All active skills have no cooldown. Every use of a skill costs 25% more mana. (Pairs devastatingly with Mana Mastery or requires heavy regen investment.)

- [ ] Define 80 nodes with `rt_` prefix
- [ ] "Eternal Machine" keystone: engine skill dispatch skips cooldown check, applies manaCost × 1.25
- [ ] Charge tracking per skill for "Charge Reset" notable

---

### Branch 12: The Wanderer's Fortune Path — Utility (~80 nodes)

**Theme:** Gold amplification, item quality, experience multipliers, and map-running efficiency.  
**Entry:** Connects from `fe_ks` and from `ar_n1`.  
**Layout:** Far south-southeast.

**High-level design:** The "grind accelerator" branch. No combat power, but enormous loot and progression value. Keystoned to be useless in combat, powerful for farming.

**Notables:**
1. **Opportunist** — +40% gold dropped; rare enemies drop one additional common item
2. **Road Scholar** — +30% XP; map completion (clearing 100% enemies) grants a bonus chaos shard
3. **Plunderer** — Pickup radius +80; items are automatically picked up if within 50% of your pickup radius while moving
4. **Merchant's Eye** — Vendor prices reduced by 10%; item rarity of drops increased by 20%

**Mastery: Gilded Path** — +60% gold, +40% XP, +100 pickup radius; map completion bonus doubled

**Keystone: Greed's Reward** — You gain 2× gold from all sources. Your weapon damage is reduced by 30%. Gold directly becomes power — invest in a vendor's wares to compensate.

- [ ] Define 80 nodes with `wf_` prefix
- [ ] `goldDropMult` in engine enemy death loot generation
- [ ] Auto-pickup radius threshold check in engine pickup loop
- [ ] Map completion bonus chaos shard referenced in `MapInstance.js` completion handler

---

## Phase PT-4: Cross-Branch Connective Nodes (40 new nodes)

After all 12 branches are implemented, add ~40 cross-branch bridge nodes to connect adjacent branches and enable hybrid paths. These are all **minor nodes** with mixed stats bridging two branch themes.

**Bridges needed:**

| Bridge Name | Connects | Stats |
|---|---|---|
| Burning Storm | Blaze ↔ Tempest | +5% Blaze, +5% Thunder, +10% AoE |
| Glacial Shock | Tempest ↔ Frost | +5% Thunder, +5% Frost, +10% Chill chance |
| Radiant Frost | Frost ↔ Sanctified | +5% Frost, +5% Holy, +10 armor |
| Plague Saint | Sanctified ↔ Void | +5% Holy, +5% Unholy, +2 regen/s |
| Savage Flame | Blaze ↔ Berserker | +8% Blaze, +5% dmg while above 50% life |
| Armored Fists | Iron Bulwark ↔ Martial | +30 armor, +5% Physical dmg |
| Ghost Strike | Shadow Step ↔ Berserker | +5% crit chance, +30 evasion |
| Sorcerer's Body | Arcanist ↔ Shadow Step | +30 max mana, +5% crit chance |
| Tempo Ritual | Ritualist ↔ Arcanist | −5% cooldown, +0.5 mana/s |
| Lucky Strike | Wanderer's ↔ Shadow Step | +10% XP, +5% crit chance |

Each bridge is 4 nodes (2 each side meeting in the middle).

- [ ] Define 40 bridge nodes with `xb_` prefix
- [ ] Connect each bridge's ends to nearest outer nodes of their respective branches
- [ ] No new stat types needed for bridges

---

## Phase PT-5: Keystones Overhaul & Additional Keystones (0 new nodes, redesign)

After all branches exist, audit all 12 + 7 existing = 19 keystones for balance. Add 6 special **Ascendancy-style** secret keystones reachable only by allocating 8+ nodes in two different branches.

**Secret Keystones (unlocked via dual-branch path):**

| Keystone | Unlock Condition | Effect |
|---|---|---|
| **Elemental Harmony** | 8+ Blaze + 8+ Frost nodes | All elemental damage types deal 25% more damage. You deal no Physical damage. |
| **Soul Exchange** | 8+ Void + 8+ Holy nodes | Your life and mana pools swap their functions (mana used for regen, life for spell costs). +50% skill damage. |
| **War Machine** | 8+ Berserker + 8+ Iron Bulwark nodes | +50% damage and +100 armor. You cannot move faster than base speed (no speed bonuses apply). |
| **Arcane Predator** | 8+ Arcanist + 8+ Shadow Step nodes | Critical strikes restore 5% max mana. Mana is consumed instead of life when below 20% life. |
| **God-Killer's Rage** | 8+ Martial + 8+ Berserker nodes | +80% damage vs bosses. Against non-boss enemies, you deal 30% reduced damage. |
| **The Eternal Wanderer** | 8+ Wanderer + 8+ Ritualist nodes | +80% XP, +80% gold, zero skill cooldowns. Every skill use costs 1% max life instead of mana. |

These keystones are not placed on the tree physically — they appear as a special **Ascendancy Panel** unlocked when conditions are met, selectable from a dedicated UI row.

- [ ] Add `ascendancyKS` field to player state (single selected ascendancy keystone)
- [ ] Add "Ascendancy" section to PassiveTreeScreen header showing unlock progress
- [ ] Implement `checkAscendancyUnlock(allocatedIds)` function that counts per-branch nodes

---

## Phase PT-6: Polish & Performance (0 new nodes)

- [ ] **Node clustering optimization:** group nodes into spatial buckets; only render nodes within current viewport (virtual list pattern for SVG)
- [ ] **Search bar:** type a stat keyword to highlight matching nodes on the tree
- [ ] **Path finder:** click a locked node to see the shortest allocation path from your current tree
- [ ] **Allocation undo:** add "Refund Point" mechanic (costs 2 skill points to unallocate 1; limited to 3 per run)
- [ ] **Stats summary sidebar:** show total accumulated stats from all allocated nodes
- [ ] **Branch labels:** render floating zone-label text in the SVG background per cluster area

---

## Node Count Summary

| Phase | Branches | New Nodes | Running Total |
|---|---|---|---|
| Baseline | — | 90 (existing) | 90 |
| PT-0 | Infrastructure | 0 new | 90 |
| PT-1 | Elemental (5 branches) | 400 | 490 |
| PT-2 | Combat (4 branches) | 320 | 810 |
| PT-3 | Utility (3 branches) | 240 | 1,050 |
| PT-4 | Cross-bridges | 40 | 1,090 |
| PT-5 | Secret keystones (panel) | 0 | 1,090 |
| PT-6 | Polish | 0 | **1,090** |

**Total new nodes added: ~1,000. Final tree size: ~1,090 nodes across 12 branches + existing 7 clusters.**

---

## Stat Key Index (Complete)

All stat keys that need to be supported (existing + new):

```
Existing:
  damageMult, cooldownMult, speedFlat, maxHealthFlat,
  healthRegenPerS, pickupRadiusFlat, xpMultiplier,
  maxManaFlat, manaRegenPerS, manaCostMult,
  projectileCountBonus, potionChargeGainMult,
  potionChargeGainFlat, potionChargeRegenPerS,
  potionDurationMult, potionEffectMult,
  potionMaxChargesMult, potionChargesPerUseMult

New (PT-0B):
  armorFlat, evasionFlat, critChanceFlat, critMultFlat,
  blazeDamageMult, thunderDamageMult, frostDamageMult,
  holyDamageMult, unholyDamageMult, physDamageMult,
  igniteChanceFlat, shockChanceFlat, chillChanceFlat,
  freezeChanceFlat, aoeSizeFlat, skillDurationMult,
  lifeOnKillFlat, manaOnKillFlat, goldDropMult,
  dashCooldownMult, energyShieldFlat, energyShieldRegenPerS
```

---

## Implementation Order & Dependencies

```
PT-0A (canvas/zoom) ──────────────────── required before any new nodes
PT-0B (stat keys) ────────────────────── required before PT-1+
PT-0C (visual types) ─────────────────── parallel with PT-0B

PT-1 Blaze ────────┐
PT-1 Tempest ──────┤
PT-1 Frost ────────┤ ── independent, implement in any order
PT-1 Sanctified ───┤
PT-1 Void ─────────┘

PT-2 Berserker ────┐
PT-2 Iron Bulwark ─┤ ── independent after PT-0B
PT-2 Shadow Step ──┤
PT-2 Martial ──────┘

PT-3 Arcanist ─────┐
PT-3 Ritualist ────┤ ── independent after PT-0B
PT-3 Wanderer ─────┘

PT-4 Bridges ───────── after all 12 branch entry/exit nodes exist
PT-5 Ascendancy ────── after all 12 branches have counts (PT-4 complete)
PT-6 Polish ────────── after all nodes defined
```

---

## Notes on Coordinate Layout (3600×3600 Space)

Hub center: **(1800, 1800)**

Suggested outer cluster anchor points (branch keystones):

| Branch | Keystone Position (approx) |
|---|---|
| Power (existing) | (3100, 1500) |
| Speed (existing) | (1800, 400) |
| Tank (existing) | (500, 1500) |
| Arcane (existing) | (1800, 3100) |
| Arcane Mastery | (3200, 700) |
| Blood Rite | (450, 2800) |
| Fortune's Edge | (2800, 3200) |
| **Blaze** | (3400, 900) |
| **Tempest** | (700, 400) |
| **Frost** | (200, 1800) |
| **Sanctified** | (1800, 3500) |
| **Void** | (400, 3300) |
| **Berserker** | (3200, 2200) |
| **Iron Bulwark** | (200, 2400) |
| **Shadow Step** | (3000, 600) |
| **Martial** | (3400, 1800) |
| **Arcanist** | (2600, 400) |
| **Ritualist** | (1800, 200) |
| **Wanderer's Fortune** | (2900, 3400) |

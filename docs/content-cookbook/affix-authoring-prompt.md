# Affix Authoring Prompt — Increased/More Stat Families

Use this prompt template to generate new `defineAffixFamily` blocks for any "increased X" or "more X"
modifier you want to add to `src/game/data/affixes.js`.

---

## Prompt Template (copy → paste → fill in)

```
I need a new affix family for the survivor-react-engine project.
Generate a `defineAffixFamily(...)` call that follows the pattern below.

**Stat key**: <e.g. increasedLife>
**English modifier name**: <e.g. "increased life">
**Type**: prefix | suffix
**Slots**: comma-separated list from: weapon, armor, jewelry, helmet, boots, offhand
**Format**: percent (values like 0.10 = +10%) | flat (integer) | multiplier (values like 1.15)
**Tiers to include**: pick 4 from t1–t8 (t1 = best/highest ilvl req, t8 = weakest/always drops)
**Min/max guidance**:
  - t1: <best range, e.g. 0.18–0.24>
  - t3: <good range, e.g. 0.12–0.17>
  - t6: <average range, e.g. 0.07–0.11>
  - t8: <weak range, e.g. 0.03–0.06>

Output a single `defineAffixFamily({...})` call using this exact structure:

\`\`\`js
...defineAffixFamily({
  id:       '<family_id>',           // e.g. 'inc_life'
  family:   '<family_id>',
  group:    '<family_id>',
  type:     'prefix',                // or 'suffix'
  slots:    ['armor', 'jewelry'],
  stat:     '<statKey>',
  labelFn:  L.pct('<english label>'), // L.flat / L.mult / L.reduct / L.pct
  tiers: [
    { tier: 1, min: 0.18, max: 0.24 },
    { tier: 3, min: 0.12, max: 0.17 },
    { tier: 6, min: 0.07, max: 0.11 },
    { tier: 8, min: 0.03, max: 0.06 },
  ],
  tags: ['life'],                    // optional: for pool-tag filtering
}),
\`\`\`
```

---

## Five Families to Author Now

Below are the five new stat families. Use the prompt above (or just copy the pre-filled blocks).
Paste each into `RAW_AFFIX_POOL` in `src/game/data/affixes.js`.

### 1. `increasedLife` — prefix, all armor slots

| Tier | Min  | Max  | Meaning          |
|------|------|------|-----------------|
| t1   | 0.20 | 0.28 | +20–28% life    |
| t3   | 0.13 | 0.19 | +13–19% life    |
| t6   | 0.07 | 0.12 | +7–12% life     |
| t8   | 0.03 | 0.06 | +3–6% life      |

```js
...defineAffixFamily({
  id:      'inc_life',
  family:  'inc_life',
  group:   'inc_life',
  type:    'prefix',
  slots:   ['armor', 'helmet', 'boots', 'offhand', 'jewelry'],
  stat:    'increasedLife',
  labelFn: L.pct('increased maximum life'),
  tiers: [
    { tier: 1, min: 0.20, max: 0.28 },
    { tier: 3, min: 0.13, max: 0.19 },
    { tier: 6, min: 0.07, max: 0.12 },
    { tier: 8, min: 0.03, max: 0.06 },
  ],
  tags: ['life'],
}),
```

### 2. `increasedMana` — prefix, all armor + jewelry slots

| Tier | Min  | Max  | Meaning          |
|------|------|------|-----------------|
| t1   | 0.20 | 0.28 | +20–28% mana    |
| t3   | 0.13 | 0.19 | +13–19% mana    |
| t6   | 0.07 | 0.12 | +7–12% mana     |
| t8   | 0.03 | 0.06 | +3–6% mana      |

```js
...defineAffixFamily({
  id:      'inc_mana',
  family:  'inc_mana',
  group:   'inc_mana',
  type:    'prefix',
  slots:   ['armor', 'helmet', 'boots', 'offhand', 'jewelry'],
  stat:    'increasedMana',
  labelFn: L.pct('increased maximum mana'),
  tiers: [
    { tier: 1, min: 0.20, max: 0.28 },
    { tier: 3, min: 0.13, max: 0.19 },
    { tier: 6, min: 0.07, max: 0.12 },
    { tier: 8, min: 0.03, max: 0.06 },
  ],
  tags: ['mana'],
}),
```

### 3. `increasedMoveSpeed` — suffix, boots + jewelry

> Movement speed is high impact — keep t1 conservative.

| Tier | Min  | Max  | Meaning               |
|------|------|------|-----------------------|
| t1   | 0.14 | 0.18 | +14–18% move speed    |
| t3   | 0.09 | 0.13 | +9–13% move speed     |
| t6   | 0.05 | 0.08 | +5–8% move speed      |
| t8   | 0.02 | 0.04 | +2–4% move speed      |

```js
...defineAffixFamily({
  id:      'inc_move_speed',
  family:  'inc_move_speed',
  group:   'inc_move_speed',
  type:    'suffix',
  slots:   ['boots', 'jewelry'],
  stat:    'increasedMoveSpeed',
  labelFn: L.pct('increased movement speed'),
  tiers: [
    { tier: 1, min: 0.14, max: 0.18 },
    { tier: 3, min: 0.09, max: 0.13 },
    { tier: 6, min: 0.05, max: 0.08 },
    { tier: 8, min: 0.02, max: 0.04 },
  ],
  tags: ['speed'],
}),
```

### 4. `increasedAttackSpeed` — suffix, weapon + jewelry

| Tier | Min  | Max  | Meaning               |
|------|------|------|-----------------------|
| t1   | 0.16 | 0.22 | +16–22% attack speed  |
| t3   | 0.10 | 0.15 | +10–15% attack speed  |
| t6   | 0.05 | 0.09 | +5–9% attack speed    |
| t8   | 0.02 | 0.04 | +2–4% attack speed    |

```js
...defineAffixFamily({
  id:      'inc_attack_speed',
  family:  'inc_attack_speed',
  group:   'inc_attack_speed',
  type:    'suffix',
  slots:   ['weapon', 'jewelry'],
  stat:    'increasedAttackSpeed',
  labelFn: L.pct('increased attack speed'),
  tiers: [
    { tier: 1, min: 0.16, max: 0.22 },
    { tier: 3, min: 0.10, max: 0.15 },
    { tier: 6, min: 0.05, max: 0.09 },
    { tier: 8, min: 0.02, max: 0.04 },
  ],
  tags: ['speed', 'attack'],
}),
```

### 5. `increasedCastSpeed` — suffix, weapon + jewelry + offhand

| Tier | Min  | Max  | Meaning               |
|------|------|------|-----------------------|
| t1   | 0.16 | 0.22 | +16–22% cast speed    |
| t3   | 0.10 | 0.15 | +10–15% cast speed    |
| t6   | 0.05 | 0.09 | +5–9% cast speed      |
| t8   | 0.02 | 0.04 | +2–4% cast speed      |

```js
...defineAffixFamily({
  id:      'inc_cast_speed',
  family:  'inc_cast_speed',
  group:   'inc_cast_speed',
  type:    'suffix',
  slots:   ['weapon', 'jewelry', 'offhand'],
  stat:    'increasedCastSpeed',
  labelFn: L.pct('increased cast speed'),
  tiers: [
    { tier: 1, min: 0.16, max: 0.22 },
    { tier: 3, min: 0.10, max: 0.15 },
    { tier: 6, min: 0.05, max: 0.09 },
    { tier: 8, min: 0.02, max: 0.04 },
  ],
  tags: ['speed', 'spell'],
}),
```

---

## How the Engine Applies `increasedX` Stats

Wire up each new stat key in `src/game/systems/StatSystem.js` (or wherever player stats are computed):

```js
// Example: apply increasedLife to maxHealth
player.maxHealth *= (1 + totalStat('increasedLife'));

// Example: apply increasedMoveSpeed to moveSpeedMult
player.moveSpeedMult *= (1 + totalStat('increasedMoveSpeed'));

// Attack/cast speed — additive pool (same as PoE model)
player.attackSpeed  *= (1 + totalStat('increasedAttackSpeed'));
player.castSpeed    *= (1 + totalStat('increasedCastSpeed'));
```

`increasedX` stats stack **additively** into a single pool (like PoE "increased"), then multiply the
base value once. Only `moreX` suffixes are multiplicative per-source.

---

## `L` Label Helper Reference

| Helper | Usage | Renders |
|--------|-------|---------|
| `L.flat(noun)` | flat integer amounts | `+42 max HP` |
| `L.pct(noun)` | percentage (×100) amounts | `+18% increased life` |
| `L.mult(noun)` | multiplier (−1, ×100) amounts | `+25% weapon damage` |
| `L.reduct(noun)` | reduction (1−x, ×100) amounts | `−10% mana costs` |

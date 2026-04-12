# Potion Smoke Checklist

1. Default loadout:
- Start a new run and verify slot 1 has Minor Life Potion and slot 2 has Minor Mana Potion.
- Verify slots 3 and 4 are empty.

2. Hotkey activation:
- Press `1` and `2` with enough charges.
- Verify charges are consumed and the potion enters active/drinking state.
- Verify using at zero charges does nothing.

3. Active effects:
- While Life Potion is active, health should recover faster.
- While Mana Potion is active, mana should recover faster.
- While Quicksilver Potion is active, movement speed should increase.

4. Charge refill:
- Kill normal/champion/boss enemies and verify charges increase.
- Equip/passive-modify charge regen and verify over-time charge gain occurs.

5. Scaling hooks:
- Modify player stats for `potionChargeGainMult`, `potionChargeRegenPerS`, `potionDurationMult`,
  `potionEffectMult`, `potionMaxChargesMult`, and `potionChargesPerUseMult`.
- Verify runtime values update correctly and clamp safely.

6. Persistence:
- Save, reload, and verify potion slot contents, charges, and active timers persist safely.

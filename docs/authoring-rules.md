# Content Authoring Rules

This guide defines the stable authoring contract for skills, passives, affixes, implicits, and unique effects.

## Core Rules
- Content files should be data-only; avoid embedding runtime behavior in content records.
- Use canonical stat keys from `src/game/data/statKeys.js` only.
- Prefer additive stats for flat values and multiplicative stats for rate/scalar changes.
- Keep ids stable once shipped; do not rename content ids without a migration plan.
- Any new content must pass `npm run content:validate`.

## Skills
- Define migrated skill templates in `src/game/content/skills/skillTemplates.js`.
- Keep `id`, `runtimeCtorId`, `name`, `description`, and `tags` consistent.
- Use `requiresWeaponType` for hard weapon gates and `requirementHint` for player-facing guidance.
- Active skill offers must provide `create()`; pure-skill offers must provide `createSkill()`.

## Passives
- Passive node stats must use known passive stat keys.
- Keystone nodes should set `type: 'keystone'` so they render and debug distinctly.
- Node ids are save-stable; avoid repurposing existing ids.

## Affixes (Explicit + Implicit)
- Affix records must include: `id`, `kind`, `type`, `family`, `group`, `slots`, `tier`, and `modifier`.
- `kind` is required: use `explicit` or `implicit` only.
- `type` is required: use `prefix` or `suffix` only.
- Affix caps are rarity-driven (normal 0/0, magic 1/1, rare 3/3); do not bypass caps in content.
- `pool.itemClasses`, `pool.weaponTypes`, and `pool.defenseTypes` should be used to constrain legal rolls.
- Keep `modifier.statKey` aligned with canonical stat keys and use `modifier.operation` (`add` or `multiply`) deliberately.

## Implicits
- If an item has fixed implicits, author them in `implicitAffixes` on the item base.
- Implicits should represent base identity, not random variance.
- Random implicit rolls should still satisfy `kind: 'implicit'` schema and gating rules.

## Unique Effects
- Unique items are marked with `isUnique: true` and optional `flavorText`.
- Unique effects should be encoded as base stats and/or fixed implicit affixes.
- Do not rely on ad hoc runtime conditionals for one-off unique behavior; extend shared systems first.

## Save Compatibility
- Save blobs are versioned via `saveVersion` in `CharacterSave`.
- If content or slot keys change, add migrations in `migrateSave()`.
- Legacy saves must either migrate cleanly or fail with clear UX messaging.

## Validation + Smoke Checklist
- `npm run content:validate`
- `npm run test`
- `npm run smoke`
- `npm run build`

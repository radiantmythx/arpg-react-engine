# Skills and Item Refactor Plan

## Objective
Build a scalable skills and item framework that:
- Treats active combat abilities as skills (not weapons).
- Adds real weapon item types and equips restrictions.
- Enforces skill requirements (for example, bow skills require a bow equipped).
- Unifies passive effects and item affix effects into one reusable modifier system.
- Supports robust affix pools, tiers, prefixes/suffixes, implicits, and reroll currency.

## Guiding Principles
- Single-source modifier logic: the same effect definition should work for passives, affixes, implicits, and uniques.
- Data-driven over hardcoded: keep balance/content in data tables where possible.
- Backward-compatible migration steps: avoid a big-bang rewrite.
- Strong validation and smoke checks at every phase.

---

## Phase 1 - Rename skill runtime concepts (weapons -> skills)

### Goals
- Rename code concepts where Arcane Lance / Phantom Blade style abilities are currently modeled under weapons.
- Move folder structure from weapons to skills for runtime combat abilities.

### Checklist
- [x] Rename src/game/weapons to src/game/skills.
- [x] Rename code symbols and imports that represent active skills but still use weapon naming.
- [x] Keep true item weapons separate from runtime skill definitions.
- [x] Add temporary compatibility re-exports if needed to reduce breakage during transition.
- [x] Run build and fix all import/type/runtime regressions.

### Exit Criteria
- [x] No runtime skill code lives under weapons paths.
- [x] App compiles and current skill behavior is unchanged.

---

## Phase 2 - Introduce item weapon archetypes and equip rules

### Goals
- Add weapon item categories: swords, axes, bows, lances, wands, tomes, shields.
- Decouple item shape and slot rules from current 3x1 default assumptions.

### Checklist
- [x] Add weaponType field to item definitions and generation paths.
- [x] Define legal slot placement for weapon archetypes (main hand/off hand/two-hand policy).
- [x] Support non-3x1 sizes where needed (data-driven size by base type).
- [x] Update tooltip/UI to display weapon type clearly.
- [x] Add migration fallback for older weapon items missing weaponType.

### Exit Criteria
- [x] Player can equip each new weapon type according to rule set.
- [x] Inventory and equip flows work with mixed item sizes.

---

## Phase 3 - Skill requirement model (equip gating)

### Goals
- Add explicit skill requirements tied to equipment (first target: bow skills require bow).

### Checklist
- [x] Add requires fields on skill definitions (for example requiresWeaponType: ["bow"]).
- [x] Add runtime validation before skill activation.
- [x] Add HUD/Gem UI state for blocked skills (disabled, reason text, requirement hint).
- [x] Add support for multi-allowed requirements (for example wand or tome).
- [x] Ensure requirement checks apply to primary and Q/E/R slots consistently.

### Exit Criteria
- [x] Bow-tagged or bow-required skills cannot be cast without a bow.
- [x] UI clearly explains why a skill is unusable.

---

## Phase 4 - Unified modifier engine (passives + items + uniques)

### Goals
- Build one modifier pipeline consumed by passives, affixes, implicits, and unique effects.

### Phase 4.1 - Canonical schema + engine core
- [x] Define canonical modifier schema (statKey, operation, value, target, source, layer/order).
- [x] Add source layering and deterministic merge order.

### Phase 4.2 - Runtime migration (passives + item stats)
- [x] Move passive stat application to this schema.
- [x] Move item affix stat application to this schema.

### Phase 4.3 - Observability + verification
- [x] Add modifier debugging view for active sources per stat.
- [x] Verify equivalent totals for passive/item modifier application after migration.
- [x] Expand modifier debug to full per-source attribution: source label, operation type (add/multiply), and contribution value per stat key. Green for additive, purple for multiplicative.

### Exit Criteria
- [x] Same 10% increased fire damage effect behaves identically whether from passive or item.
- [x] Existing passives/items still produce expected totals after migration.

---

## Phase 5 - Weapon and skill scoped stat keys

### Goals
- Introduce scalable stats for weapon classes and skill families.

### Checklist
- [x] Add stat keys for increasedDamageWithBow, increasedDamageWithAxe, increasedAttackSpeedWithWand, and similar.
- [x] Add tag-based modifiers for spell skills, attack skills, bow skills.
- [x] Add condition evaluator for requiresTag/requiresWeaponType style modifiers.
- [x] Update stat labeling/UI formatting for new scoped modifiers.
- [x] Add validation to prevent unknown stat keys in content.

### Exit Criteria
- [x] New scoped modifiers are supported in passives and items through shared logic.
- [x] Tooltip text is readable and consistent.

---

## Phase 6 - Affix domain model (prefix/suffix/implicit)

### Goals
- Formalize affix taxonomy and limits by rarity.

### Checklist
- [x] Define affix record shape: id, family, group, tags, weight, tier table, modifier payload.
- [x] Implement rarity limits: Magic up to 1 prefix + 1 suffix; Rare up to 3 prefixes + 3 suffixes.
- [x] Separate implicits as special affixes with their own pool/rules.
- [x] Add conflict/group rules to avoid invalid combinations.
- [x] Add serialization support for explicit and implicit affix sets.

### Exit Criteria
- [x] Item data can represent prefix/suffix/implicit cleanly.
- [x] Rarity cap rules are enforced at generation and crafting time.

---

## Phase 7 - Affix pool and tier generation system

### Goals
- Add weighted affix pools and tier selection for rolling items.

### Checklist
- [x] Build affix pool definitions by item class, weaponType, level bracket, and tags.
- [x] Implement weighted random selection and tier roll logic.
- [x] Add min item level checks per tier.
- [x] Support deterministic seeded simulation for tuning.
- [x] Add scripts to sanity-check affix distribution and illegal outcomes.

### Exit Criteria
- [x] Generated items roll legal affixes with expected frequency curves.
- [x] Affix pool tuning is data-driven and testable.

---

## Phase 8 - Crafting and reroll currency hooks

### Goals
- Enable reroll and upgrade flows for explicits and implicits.

### Checklist
- [x] Define currency actions: reroll implicits, reroll prefixes/suffixes, augment, regal-style upgrades.
- [x] Implement transaction-safe crafting API with before/after snapshots.
- [x] Enforce rarity/slot caps during crafting outcomes.
- [x] Add deterministic crafting simulation scripts for balancing.
- [x] Add user-facing feedback for blocked crafting actions.

### Exit Criteria
- [x] Currency operations mutate items legally and persist correctly.
- [x] Crafting outcomes are reproducible in tests with seeded RNG.

---

## Phase 9 - UI and UX expansion

### Goals
- Make requirements, affix structure, and modifier sources understandable in-game.

### Checklist
- [x] Gem UI: display equipped requirement status and unmet-requirement callouts.
- [x] Item tooltip: explicit prefix/suffix and implicit sections with tier labels.
- [x] Character sheet: grouped breakdown by passive, item explicit, item implicit, and unique/keystone.
- [x] Inventory/vendor panels: expose weapon type filters and readable compare metrics.
- [x] Debug overlays for modifier stack inspection and skill gate reasons.

### Exit Criteria
- [x] Players can understand why a skill is disabled and where stats come from.
- [x] Tooltips remain readable despite richer data.

---

## Phase 10 - Migration, balancing, and hardening

### Goals
- Complete migration of existing content, then stabilize and balance.

### Checklist
- [x] Migrate current skills/items/passives to the new schema and stat keys.
- [x] Add compatibility translators for legacy save data where required.
- [x] Add regression tests for skill gating, affix caps, and modifier parity.
- [x] Run long-session smoke tests across hub/map transitions, crafting, and inventory flows.
- [x] Document authoring rules for skills, passives, affixes, implicits, and unique effects.

### Exit Criteria
- [x] No critical regressions in gameplay loops.
- [x] Legacy saves either migrate cleanly or fail with clear messaging.
- [x] Team can author new skills/items without touching runtime logic.

---

## Cross-Phase Validation Checklist
- [x] npm run build passes after each phase.
- [x] Content validation scripts updated and passing.
- [x] Save/load compatibility verified at key checkpoints.
- [x] New stat keys and modifier schema covered by automated checks.
- [ ] Performance impact measured after modifier pipeline unification.

## Suggested Milestones
- Milestone A (Phases 1-3): Terminology cleanup + skill equip gating.
- Milestone B (Phases 4-6): Unified modifier engine + affix data model.
- Milestone C (Phases 7-8): Generation and crafting loops.
- Milestone D (Phases 9-10): UX, migration, balancing, and release hardening.

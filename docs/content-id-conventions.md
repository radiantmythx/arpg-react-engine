# Content ID Conventions

These rules apply to all future content ids (skills, enemies, maps, items, affixes, modifiers).

## Global Rules

1. IDs are immutable once shipped.
2. IDs are lowercase snake_case unless domain requires uppercase legacy compatibility.
3. IDs must be unique within domain.
4. IDs must be ASCII only.
5. IDs should be semantic, not numeric (`frost_nova`, not `skill_17`).

## Domain Prefix Guidelines

- Skills: `skill_<name>` for new schema-based entries.
- Enemies: `enemy_<name>` for new schema-based entries.
- Maps: `map_<name>` for new schema-based entries.
- Item bases: `item_<name>` for new schema-based entries.
- Affixes: `affix_<group>_<tier>` for new schema-based entries.
- Modifiers: `mod_<scope>_<name>`.

Note: Existing legacy IDs can remain unchanged and be mapped via adapters.

## Reference Rules

1. Cross-domain references must always use canonical id strings.
2. No inline display names where ids are required.
3. Registry lookups should fail fast with descriptive errors for unknown ids.

## File Naming Rules

- One definition per file when practical.
- File name matches id when possible.
- Index files should only aggregate and export.

## Deprecation Rules

1. Mark deprecated IDs in adapter maps before removal.
2. Keep deprecation aliases for at least one release milestone.
3. Save/load migrations must resolve old ids to canonical replacements.

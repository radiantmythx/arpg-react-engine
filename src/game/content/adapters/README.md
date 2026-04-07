# Compatibility Adapters (Phase 0 Scaffold)

Purpose:
- Provide safe migration seams while old and new content systems coexist.
- Avoid breaking gameplay during phased refactor.

Planned adapters:
1. Skill definition adapter (legacy class/offer -> new content schema)
2. Item/affix adapter (legacy generated shape -> canonical stat-op shape)

Retired in Phase 9:
- Map definition adapter (`FREE_MAPS` -> registry entry) removed after full map-domain cutover.
- Enemy config adapter (`ENEMY_TYPES` -> registry entry) removed after full enemy-domain cutover.
- Skill offer / constructor adapter removed after Phase 9C content ownership cutover.
- Item catalog adapter removed after Phase 9D content ownership cutover.
- Skill class implementation adapter removed after final Phase 9 follow-up relocation.

Current note:
- All planned compatibility adapters for core content domains have now been retired.

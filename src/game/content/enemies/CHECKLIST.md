# Enemy Definition Checklist

- Use a unique `id` and confirm it does not collide with existing enemy archetypes or snapshot ids.
- Reference an existing `aiProfileId` or add that profile separately before integration.
- Keep `radius`, `speed`, `health`, and `damage` internally coherent for the role.
- Set `xpValue` proportionally to threat.
- Keep `resistances` sparse and readable.
- Leave registry wiring for a follow-up change unless the draft is fully tested.

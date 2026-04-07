# Skill Definition Checklist

- Use a unique `id` that matches the runtime constructor id you intend to bridge.
- Keep `name` and `description` player-facing and concise.
- Pick the correct `style` for the compiler path you expect to use.
- Keep `tags` minimal and mechanically meaningful.
- Validate the draft against nearby migrated examples before wiring it into registries.
- Do not edit runtime registries in the same commit unless the draft is ready to ship.

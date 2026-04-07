# ADR 0001: Content Architecture Direction

Status: Accepted
Date: 2026-04-07

## Context

The game currently ships and plays well, but content authoring has become progressively harder as systems grow:
- Skills are large and code-heavy in one module.
- Item/affix/map/enemy tuning is spread across multiple files and formats.
- Data contracts are implicit and only validated at runtime.
- AI agents and new contributors must touch many unrelated files to add one feature.

We want to increase content velocity without destabilizing runtime behavior.

## Decision

We will migrate to a data-first content architecture in phases.

Core decisions:
1. Introduce explicit schemas for content definitions.
2. Load content through registries, not direct constants.
3. Normalize stat operations under one deterministic pipeline.
4. Keep behavior hooks for special-case mechanics.
5. Use compatibility adapters during migration to avoid big-bang rewrites.

## Consequences

Positive:
- Faster content additions (skills/maps/items/enemies).
- Better safety via validation before runtime.
- Cleaner prompts for AI-assisted content creation.

Tradeoffs:
- Temporary dual-path complexity (legacy + new adapters).
- Up-front refactor effort before net speed gains.

## Non-Goals (Phase 0)

- No behavior changes to current gameplay.
- No forced migration of all content at once.
- No replacement of existing runtime systems in this phase.

## Phase 0 Exit Criteria Mapping

This ADR satisfies Phase 0 item: architecture direction is documented and agreed.

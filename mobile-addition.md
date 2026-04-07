# Mobile Addition Plan

Goal: add mobile support without breaking desktop controls, using a selectable Mobile Mode and staged delivery.

## Phase 1 - Mobile Mode Entry and Persistence [x]

- [x] Add a Mobile Mode toggle button on the main menu.
- [x] Store preference in localStorage so it persists between sessions.
- [x] Surface active mode in menu control hints (Desktop vs Mobile).
- [x] Add a root app class hook for mobile-mode specific UI styling.

Exit criteria:
- [x] Player can enable/disable Mobile Mode from menu.
- [x] Preference survives page refresh/relaunch.

## Phase 2 - Touch Input Layer and Virtual Controls [x]

- [x] Add touch input service (touchstart/move/end) with pointer tracking.
- [x] Implement on-screen left movement stick (drag radius, deadzone, normalization).
- [x] Implement right-side skill cluster (Primary, Q, E, R) as touch buttons.
- [x] Add action buttons for Inventory, Gems, Passive Tree, Character Sheet, and Pause.
- [x] Prevent page scroll/zoom gestures while actively playing.
- [x] Add touch/mouse de-duplication guards to avoid double-firing mobile actions.
- [x] Add optional haptic feedback for mobile control presses.
- [x] Add persisted left-handed layout toggle for swapping movement/combat sides.
- [x] Add persisted large-button mode for easier thumb targets.
- [x] Add lock-on targeting for mobile/ranged combat with HUD feedback and target reticle.

Exit criteria:
- [x] Full combat loop playable on touch-only device with no keyboard.

## Phase 3 - Mobile HUD, Layout, and Safe Areas [~]

- [x] Add initial mobile HUD preset with repositioned hotbar and status widgets.
- [x] Reposition bars/tooltips/paperdoll away from thumbs and notch areas.
- [x] Add safe-area support (env(safe-area-inset-*)).
- [ ] Increase tap targets and spacing for mobile overlays.

Exit criteria:
- [ ] UI remains readable and tappable across common phone sizes.

## Phase 4 - Mobile UX for Inventory and Menus [ ]

- [ ] Add tap-to-pick/place and long-press interactions for inventory management.
- [ ] Add drag ghost + haptic-friendly feedback pacing for socketing/equipment.
- [ ] Add mobile-optimized modal controls for vendor, map device, passive tree.
- [ ] Add optional auto-pickup assist for small item drops.

Exit criteria:
- [ ] Core non-combat workflows are usable on mobile without precision frustration.

## Phase 5 - Performance, QA, and Ship Readiness [ ]

- [ ] Add mobile quality presets (particles, shadows, update frequency caps).
- [ ] Add battery/perf mode toggle and automatic defaults for low-end devices.
- [ ] Device QA sweep (iOS Safari, Chrome Android, Samsung Internet).
- [ ] Final bug pass for touch edge cases (multi-touch conflicts, pause/resume, orientation).

Exit criteria:
- [ ] Stable 30-60 FPS target on representative mobile devices.
- [ ] No blocker-level issues for complete mobile sessions.

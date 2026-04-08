# Phone UI Hardening Plan

Goal: do a second-pass across the current mobile work so the game remains usable on **narrow portrait phones** without breaking the better landscape / desktop layouts we already have.

This plan is specifically about taking the existing mobile UI pass and making it feel intentional on real phones, especially for screens that are currently too wide, too dense, or too “desktop-shaped” to be comfortable in portrait.

---

## Success Criteria

- All core game flows are usable on a **vertical phone screen** (roughly `320px`–`430px` wide).
- No major overlay feels squished, clipped, or dependent on precision taps.
- Wide panels like inventory/gems/tree/vendor are either:
  - fully usable in portrait, **or**
  - clearly assisted by a soft **“rotate your phone for easier management”** prompt.
- Desktop and landscape tablet play remain unaffected.

---

## Design Principles

- **Portrait-first baseline:** assume the player is holding a phone vertically.
- **Landscape-enhanced, not landscape-required:** rotation should help, not hard-block progress.
- **One task at a time:** break dense UIs into tabs, sheets, accordions, and step flows.
- **Sticky actions:** close / confirm / primary actions should stay visible while scrolling.
- **Thumb-zone friendly:** major controls should sit in reachable areas with `44px+` tap targets.
- **Safe-area aware:** nothing critical should overlap notches, browser bars, or gesture areas.

---

## Phase 1 - Phone Audit and Breakpoint Baseline [ ]

- [ ] Define the primary portrait breakpoints to target:
  - `320x568`
  - `360x800`
  - `390x844`
  - `412x915`
- [ ] Do a screen-by-screen audit of all current overlays and in-run HUD states.
- [ ] Capture a “problem list” for each screen: overflow, unreadable text, cramped controls, hidden actions, awkward scrolling.
- [ ] Mark each screen as one of:
  - `works in portrait now`
  - `needs portrait reflow`
  - `should suggest rotate for best experience`
- [ ] Establish a shared phone QA checklist for future passes.

Priority screens for the audit:
- `InventoryScreen`
- `GemPanel`
- `VendorScreen`
- `MapSelectScreen`
- `PassiveTreeScreen`
- `CharacterSheet`
- `OptionsModal`
- `HUD` / boss banners / hub help prompts

Exit criteria:
- [ ] We have a documented portrait-UI issue list and a clear order of attack.

---

## Phase 2 - Shared Phone Modal Shell + Orientation Guidance [~]

- [x] Add a shared “phone overlay shell” pattern for all large modal panels.
- [x] Standardize:
  - sticky headers
  - sticky bottom action bars
  - internal scrolling regions
  - safe-area padding
  - tighter but readable spacing on portrait
- [x] Add a reusable **orientation helper** for wide screens:
  - soft banner or badge such as: *“For easier inventory management, rotate your phone horizontally.”*
  - visible on portrait for layout-heavy screens only
  - dismissible or non-intrusive
- [x] Ensure the orientation suggestion never blocks gameplay or core actions.
- [x] Add a shared “compact phone mode” class for very narrow widths.

Exit criteria:
- [~] Every major overlay uses the same portrait-safe shell behavior.
- [x] Rotation guidance exists for wide / dense screens without being annoying.

---

## Phase 3 - Inventory and Gem Flow Rework for Portrait [~]

- [x] Rework `InventoryScreen` into a clearly portrait-first flow.
- [x] Keep or expand the current `Bag / Gear` split so each section breathes on narrow phones.
- [x] Add clearer sticky guidance when holding an item.
- [x] Consider turning some dense inventory actions into a **selected-item bottom sheet** with:
  - equip
  - use
  - drop
  - socket / inspect
- [x] Rework `GemPanel` into a step-by-step phone flow:
  - pick a skill
  - view sockets
  - choose a support gem
- [x] Keep the currently wide gem content from appearing all at once in portrait.
- [x] Make selected state and next step very obvious so players do not get lost.

Exit criteria:
- [~] Inventory and gem management feel intentional in portrait and do not require zooming or precision tapping.

---

## Phase 4 - Vendor, Map Device, and Other Wide Panels [~]

- [x] Revisit `VendorScreen` for portrait compression:
  - larger list rows
  - clearer gold / reroll affordance
  - segmented categories that stay reachable
- [x] Revisit `MapSelectScreen` so act travel and map-device actions remain obvious on narrow phones.
- [x] Collapse secondary descriptions behind expandable summaries when space is limited.
- [x] Ensure buttons do not wrap awkwardly or push important content below the fold.
- [x] Confirm `OptionsModal`, `CharacterSheet`, and any journal/meta/progression screens also follow the same compact phone rules.

Exit criteria:
- [~] All non-combat overlays are navigable in portrait without feeling cramped.

---

## Phase 5 - Passive Tree and Character Information Pass [~]

- [x] Do a dedicated pass on `PassiveTreeScreen` for portrait ergonomics.
- [x] Improve node selection flow on small screens with a persistent info sheet and clear allocate CTA.
- [x] Audit `CharacterSheet` / stat-heavy screens and group details into collapsible sections.
- [x] Make sure progression screens prioritize readability over showing everything at once.
- [x] Reduce visual density where possible while keeping ARPG flavor.

Exit criteria:
- [~] Long-form progression screens remain readable and actionable on phones.

---

## Phase 6 - In-Run HUD and Overlay Collision Pass [ ]

- [ ] Audit the moment-to-moment HUD in portrait while actually playing.
- [ ] Check for overlap between:
  - movement stick
  - skill buttons
  - boss announcements
  - interact prompts
  - portal/map banners
  - loot / tooltip feedback
- [ ] Reduce clutter when multiple alerts appear at once.
- [ ] Add compact or collapsible behavior for lower-priority info during combat.
- [ ] Ensure hub help text and tutorial prompts do not block the lower thumb zone.

Exit criteria:
- [ ] Portrait gameplay remains readable during combat, looting, hub navigation, and boss encounters.

---

## Phase 7 - Accessibility, Readability, and Touch Ergonomics [ ]

- [ ] Review font sizes, contrast, and spacing specifically for small phones.
- [ ] Add or tune a compact-phone readability mode if needed.
- [ ] Ensure major controls respect minimum touch target sizes.
- [ ] Improve empty states / helper text so the UI explains itself on touch.
- [ ] Test haptics, handedness, large-button mode, and auto-pickup together for conflicts.
- [ ] Make orientation messaging and mobile hints helpful but easy to ignore once learned.

Exit criteria:
- [ ] The UI is readable, tappable, and understandable for first-time mobile users.

---

## Phase 8 - Device QA and Ship Readiness [ ]

- [ ] Test on real devices / emulated profiles for:
  - iPhone Safari portrait + landscape
  - Chrome on Android portrait + landscape
  - Samsung Internet if available
- [ ] Verify browser chrome changes do not break modal height calculations.
- [ ] Verify safe-area handling with notches / dynamic island / gesture bars.
- [ ] Verify no blocker issues across a full session:
  - title screen
  - character selection
  - hub
  - vendor
  - map select
  - combat
  - inventory / gems / tree
  - death / map complete / options
- [ ] Document remaining phone-only bugs and cut or postpone anything non-essential.

Exit criteria:
- [ ] Full mobile session is stable and comfortable on portrait phones.
- [ ] We have a punch list of polish-only issues rather than blocker-level usability problems.

---

## Recommended Implementation Order

1. **Phase 2** - shared shell + rotate prompt
2. **Phase 3** - inventory and gems
3. **Phase 4** - vendor / map select / options / sheets
4. **Phase 6** - HUD overlap cleanup
5. **Phase 5** - passive tree and stat-heavy pages
6. **Phase 7** - accessibility + readability pass
7. **Phase 8** - final QA sweep

This order front-loads the screens most likely to feel cramped on a vertical phone while preserving the current landscape-friendly structure.

---

## Notes / Implementation Intent

- We should **not** treat portrait phone support as “shrink the desktop UI.”
- The likely winning pattern is:
  - simpler vertical stacking
  - more tabs / segmented views
  - bottom sheets for selected details
  - sticky action areas
  - optional rotate suggestion on the widest / densest screens
- If a screen is naturally wide (inventory, gem linking, passive tree), the phone UI should guide the player instead of pretending nothing is different.

# Components enhancements — plan index

Source research: `00-research-findings.md` (2026-07-30, five source-verified
audits). Each `NN-*.md` is a self-contained implementation plan following the
`plans/cdk-port/` conventions: read the `component-architecture`, `theming`,
`changeset`, `docs`, and `verify-in-storybook` skills before implementing;
every change ships with stories + docs + changeset in one PR.

Numbering is priority order, but plans are independent unless noted.

| #   | Plan                                 | Size | One-liner                                                                            |
| --- | ------------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| 01  | `01-touch-gesture-overhaul.md`       | L    | Momentum/velocity-aware drag-to-dismiss, pointer-events port, snap points, touch CSS |
| 02  | `02-consistency-fixes.md`            | S–M  | RTL dismiss direction + notification CSS, reduced-motion gating, error-code strays   |
| 03  | `03-i18n-consolidation.md`           | M–L  | One locale story instead of four; kill non-overridable hardcoded strings             |
| 04  | `04-rich-text-editor-essentials.md`  | L    | Undo/redo history (data-loss risk), image tool, blockquote, code block               |
| 05  | `05-form-field-character-counter.md` | S–M  | `x / N` counter in the field shell + generic pending/busy state                      |
| 06  | `06-slider-vertical-ticks.md`        | M    | `orientation: vertical` + labelled tick marks                                        |
| 07  | `07-date-time-enhancements.md`       | M–L  | Range presets, Today/Now, time min/max, month/year views, precision modes            |
| 08  | `08-notification-upgrades.md`        | M    | Promise API, second action, status icons, dedupe ids, swipe-to-dismiss               |
| 09  | `09-table-export-inline-edit.md`     | L    | CSV export plugin, inline cell editing, arrow-key grid navigation                    |
| 10  | `10-quick-wins.md`                   | S ea | Page-size selector, breadcrumb JSON-LD, accordion min-open, select-all, orientation… |
| 11  | `11-sport-match-components.md`       | L–XL | Match card + live score animations, standout final card, standings, match list       |
| 12  | `12-bracket-improvements.md`         | L    | Bracket↔list auto-switch, participant journeys + focus mode, mirrored double elim    |

Dependencies: 08's swipe-to-dismiss builds on 01's gesture primitives — 01 has
landed, so reuse `createSwipeTracker`'s release velocity and the
pointer-events/commit-threshold shape from `overlay-drag-to-dismiss.ts`.

## Future planning candidates (not planned yet — see findings §5)

Stream unified control bar (needs per-platform capability session), calendar
multi-month view, select mobile bottom sheet, masonry spanning/
virtualization, grid per-item lock, menubar, tabs closable, shared sizing
tokens in core. (Calendar event markers and month/year jump moved into plan
07 — `dateClass` hook + view drilling.)

## Progress

- [x] 01 — touch & gesture overhaul _(done 2026-07-30 except the touch-target
      audit — see the "found while implementing" notes in the plan: `touch-action`
      turned out unusable on a sheet whose body scrolls on the dismiss axis, so the
      gesture is pointer-events + one non-passive `touchmove` for scroll
      suppression; hit-area work deferred to its own device pass)_
- [x] 02 — consistency fixes _(done 2026-07-30; see the "found while
      implementing" notes in the plan — overlay animations are still ungated for
      reduced motion, and 2 of the 3 stray `throw`s were correctly left alone)_
- [ ] 03 — i18n consolidation
- [ ] 04 — RTE essentials
- [x] 05 — form-field character counter _(done 2026-07-30; schema `maxLength()`
      and async-validator `pending` both turned out to be auto-bound signal-forms
      inputs — see the note in the plan, including the `hostDirectives` gotcha.
      Counting is opt-in per control family; only the text-field-base controls
      and `et-tag-input` declare the inputs so far.)_
- [ ] 06 — slider vertical + ticks
- [ ] 07 — date-time enhancements
- [ ] 08 — notification upgrades
- [ ] 09 — table export + inline edit
- [ ] 10 — quick wins
- [ ] 11 — sport/match components
- [ ] 12 — bracket improvements (depends on 11)

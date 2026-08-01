# Components enhancements - plan index

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

Dependencies: 08's swipe-to-dismiss builds on 01's gesture primitives - 01 has
landed, so reuse `createSwipeTracker`'s release velocity and the
pointer-events/commit-threshold shape from `overlay-drag-to-dismiss.ts`.

## Future planning candidates (not planned yet - see findings §5)

Stream unified control bar (needs per-platform capability session), calendar
multi-month view, select mobile bottom sheet, masonry spanning/
virtualization, grid per-item lock, menubar, tabs closable, shared sizing
tokens in core. (Calendar event markers and month/year jump moved into plan
07 - `dateClass` hook + view drilling.)

## Progress

- [x] 01 - touch & gesture overhaul _(done 2026-07-30 except the touch-target
      audit - see the "found while implementing" notes in the plan: `touch-action`
      turned out unusable on a sheet whose body scrolls on the dismiss axis, so the
      gesture is pointer-events + one non-passive `touchmove` for scroll
      suppression; hit-area work deferred to its own device pass)_
- [x] 02 - consistency fixes _(done 2026-07-30; see the "found while
      implementing" notes in the plan - overlay animations are still ungated for
      reduced motion, and 2 of the 3 stray `throw`s were correctly left alone)_
- [x] 03 - i18n consolidation _(done 2026-07-30; `createLabels` in core is the one shape, and all 22
      domains use it. Found while implementing: the plan's "four mechanisms" undercounted - `GridConfig`
      and the three stream configs carried strings next to a `transformer(text, locale)` hook that asked
      apps to translate by matching the SDK's English, so those strings moved to label tokens and the
      hooks went. Core's `TitleConfig`/`MetaConfig` keep theirs deliberately: those strings are the
      app's, so there is no default to override. The plan's item 4 also undercounted the ad-hoc
      `input()` defaults - ~60 across 15 domains, not 4 - and `mixed`/`clear` recurred often enough to
      earn a shared `FORM_FIELD_LABELS`.)_
- [x] 04 - RTE essentials _(done 2026-07-30; all three phases. Phase 3 is `provideRichTextEditorImageTool` - pick/paste/drop, an upload handler that also takes a `createDropzoneUpload` config for progress,
      a value-invisible placeholder and an alt-text popover. See the plan's "found while implementing"
      notes: core already round-tripped `![alt](url)`, what was broken was image **files** becoming
      `blob:` URLs; and tool definitions gained `paste`/`drop`/`click` content hooks.)_
- [x] 05 - form-field character counter _(done 2026-07-30; schema `maxLength()`
      and async-validator `pending` both turned out to be auto-bound signal-forms
      inputs - see the note in the plan, including the `hostDirectives` gotcha.
      Counting is opt-in per control family; only the text-field-base controls
      and `et-tag-input` declare the inputs so far.)_
- [x] 06 - slider vertical + ticks _(done 2026-07-30, `84a8d005`)_
- [x] 07 - date-time enhancements _(done 2026-07-30; the plan's own backlog was pulled into scope and
      built too - see §8 of the plan for the eight follow-up commits, incl. week numbers,
      `mode="multiple"`, comparison ranges, range-selection strategies, a replaceable header and the
      multi-month view. One open decision recorded there: rendering a foreign time zone.)_
- [x] 08 - notification upgrades _(done 2026-07-30; all six items. `manager.promise()` also takes an
      `@ethlete/query` query - `components` already depends on query - following its `executionState`
      and, on request, its upload progress. See the plan's "found while implementing" notes: dedupe
      needed a whole-config `replaceConfig` next to the merging `update()`, and the swipe exit rides
      the existing leave animation via an `!important` override of the drag's inline transform rather
      than animating itself.)_
- [x] 09 - table export + inline edit _(done 2026-07-31; all four phases - CSV export, inline cell
      editing, arrow-key grid navigation, and export beyond the loaded page. See the plan's four "found
      while implementing" sections: the export is typed against a structural source rather than the
      feature seam (which deliberately hides cell values), editing hands the consumer a signal-forms
      field instead of inventing a cell-editor interface, `Enter` is settled between editing and
      navigation through the table, and phase 4 came out observable-native because the styleguide bans
      async/await.)_
- [x] 10 - quick wins _(done 2026-07-31; all seven. Found while implementing: the breadcrumb's crumbs
      are opaque templates, so `etBreadcrumbSeo` has them state their own `name`/`url` rather than
      scraping the DOM - and building it surfaced a real bug in core's `applyStructuredDataBinding`,
      which wrote its JSON into a `text` attribute and emitted an empty script. The page-size select is
      a native `<select>` and a separate component, since page size is the app's state. Horizontal
      selection lists needed no DOM wrapper: the label and support block are pushed onto their own
      lines with `flex-basis: 100%`, so an option stays a direct child of the group. The radio group
      already bound all four arrow keys, so item 5's keyboard note needed no change.)_
- [x] 11 - sport/match components
- [x] 12 - bracket improvements _(done 2026-07-31; all four areas. Found while implementing: mirrored
      double elimination has **no real-world convention** - every reference draws double elim
      left-to-right with losers below - so rather than invent one, mirroring became a property of the
      column sequence: both brackets fold and converge on the rounds too small to halve, with the finals
      in the middle. The outbound side of a fold is an ordinary bracket with half the matches, so the
      ratio/padding/span maths were reused unchanged and the way back is that side mirrored sub-column
      for sub-column. Mirroring trades height for width (32 teams: `1640×1720` → `2880×880`), so it is
      not the answer to a too-wide bracket - density and the rounds list are. Two latent bugs surfaced:
      a connector carried both of a match's participants instead of the one who advanced along it, and
      the "wire the lower round at the same index" heuristic mis-wired a centre round once a fold put a
      right-hand half past the finals. The pin is driven from outside and never rides on a card tap, so
      §3's option (c) was dropped and `participantFocusChange` with it - a `model` already emits its own
      change event. `et-bracket-adaptive` stayed unbuilt: with `signalHostElementDimensions` the switch
      is four lines, and a wrapper would have had to forward every layout input of both representations
      to earn its place. The layout inputs became overrides (`undefined` when unbound) so the density
      preset has somewhere to sit between them and the defaults.)_

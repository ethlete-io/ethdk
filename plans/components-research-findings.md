# Components lib research - feature gaps & opportunities (2026-07-30)

Five parallel source-verified audits of `libs/components` (+ `libs/core` primitives):
forms controls, overlay/popup domains, data display, cross-cutting concerns
(RTL/i18n/a11y/SSR/sizing/errors/API hygiene), and a touch/gesture deep-dive.

Complements `plans/opportunities.md` (2026-07-23 pass: new-component candidates,
platform decisions) - this pass covers gaps **inside** existing components.

**Status: the twelve implementation plans this pass produced (`plans/enhancements/`)
all shipped between 2026-07-30 and 2026-07-31 and have been deleted.** What survives
here is the evidence record: the audit findings (§1–§4, each now marked with when it
shipped), what was deliberately **not** planned (§5), the handful of items the shipped
work deferred (§6), and the strengths not worth re-auditing (§7).

## 1. Bug-like inconsistencies (shipped 2026-07-30)

- **RTL drag-to-dismiss is backwards.** Sheet _positioning_ is logical
  (`horizontal: 'start'/'end'` via grid `placeItems`,
  `libs/core/src/lib/overlay/overlay-position.ts:74`) but the dismiss gesture is
  hardcoded physical: `left-sheet.strategy.ts:14-16` → `direction: 'to-left'`,
  `right-sheet.strategy.ts` → `'to-right'`; `overlay-drag-to-dismiss.ts` never
  checks document direction. In RTL a "left sheet" renders on the physical right
  yet still demands a leftward swipe.
- **Notification stack uses physical CSS under logical names.**
  `notification-stack.component.css` implements `data-position='bottom-start'/'bottom-end'`
  with literal `left`/`right` instead of `inset-inline-*` - doesn't flip in RTL.
- **Reduced-motion gating is inconsistent across identical utilities.**
  `createFlipAnimation(Group)` (core `flip-animation.ts`) has no internal check;
  gated by callers in `grid.directive.ts:173`, carousel, dropzone,
  date-time-panes - but **not** in `tabs/headless/tab-bar-underline.directive.ts`,
  `segmented-button.component.ts`, nor any PiP animation
  (`pip-animation.ts` - 7 raw `.animate()` calls, `stream-manager.ts`,
  `pip-chrome-animations.ts`). Note: `fullscreen-animation.ts`'s
  `shouldUseReducedAnimation` is a false friend (geometry fallback, not a11y).
  Fixed at the source (the flip helpers check `prefers-reduced-motion` themselves);
  the overlay's own enter/leave animations were left out of scope - see §6.
- **Error-code hygiene**: docs master range table omits the Masonry row
  (`3900–3999`; the `ET39xx` section exists further down) - it turned out to be
  missing four rows, not one; 3 stray plain `throw new Error` bypass `RuntimeError`
  (`cascader-from-query.ts:127`, `rich-text-editor-trigger-with-query.ts:110`,
  `fullscreen-animation.ts:444`), of which only the last was a real misuse signal -
  the other two carry display-ready text into the UI and keep a plain `Error`, now
  with a comment saying why, so the next grep-driven audit doesn't "fix" them.
- **SSR**: deprecated `core/seo.directive.ts:98-154` touches bare global
  `document` (only real crash risk; deliberately left for removal - see
  `opportunities.md`'s next-major checklist); `core/scrolling/scrollable.ts` +
  `animations/animation-utils.ts` were guarded instead, since they stay.
- **Loaders animate under reduced motion with no documented exemption** -
  a legitimate WCAG "essential feedback" exemption, now documented (contrast
  `skeleton.component.ts:40`, which always did).

## 2. Touch & gesture deep-dive (shipped 2026-07-30)

The gesture landed as pointer events + one non-passive `touchmove` that only
`preventDefault()`s _after_ the 8 px commit - `touch-action` on the sheet container
is unusable, because it intersects up the ancestor chain and would disable the
scroll axis of `.et-overlay-body`, and `preventDefault()` on `pointermove` is
ignored. Findings as audited:

- Velocity **is** tracked but as a whole-gesture average
  (`swipe.ts:78-97`: `movement / (Date.now() - startTime)`) - a slow drag ending
  in a fast flick under-reports. Needs a trailing-window (~100 ms) sample.
- Dismiss decision is distance **or** velocity (defaults 150 px / 150 px/s,
  `overlay-strategy.types.ts:95-105`) - flick-to-dismiss works.
- **No momentum carry-over**: on dismiss the handler just calls
  `overlayRef.closeVia('drag')`; the exit is a CSS class transition
  (`overlay-container.component.css:401-417`) at fixed
  `150ms var(--ease-in-5)` to `translateY(100%) !important`. Positional
  continuity yes (inline transform stays), but duration/easing constant
  regardless of gesture speed. Snap-back likewise fixed
  `100ms var(--ease-out-1)` whether released 2 px or 149 px below threshold.
  **No channel exists to pass velocity from the drag handler into
  `lifecycle.leave()` / `OverlayStrategyContext`** - plumbing must be added.
  (Shipped as an `onDismiss` callback on `DragToDismissContext`; no strategy-context
  change was needed.)
- Drag-to-dismiss is the **only** gesture surface still on legacy
  touch/mouse events; everything else (core `drag-gesture.ts`, slider,
  carousel, scrollable-snap) is unified on Pointer Events with
  `setPointerCapture` and an 8 px commit threshold. Drag-to-dismiss has **no
  commit threshold** on touch - first `touchmove` immediately `preventDefault()`s.
- **No `touch-action` on the sheet container** (relies on non-passive
  `preventDefault`); no `overscroll-behavior` on `.et-overlay-body` /
  `scrollable` (menu/select/cascader/RTE-popup already set `contain`);
  `-webkit-tap-highlight-color` never set anywhere; `user-select` lock only
  fires on the mouse path.
- `touch-action` coverage elsewhere is good (drag-handle/grid/resize `none`;
  slider/rating `pan-y`; buttons/calendar/date-inputs `manipulation`).
- Touch-target shortfalls: slider thumb 18 px (28 px row), rating icons 24 px,
  checkbox/radio 20 px boxes, `xs`/`sm` buttons - all under 44 px. **Not fixed** -
  see §6.
- Related overlay gap: **no sheet snap points** - interpolator only knows
  "past threshold → dismiss, else return to 0"; `OverlayDragToDismissConfig`
  has no `snapPoints` field.
- Tooltip is hover-only (`tooltip.directive.ts:188-222`) with no
  touch/pointerType handling - can stick open or never show on touch.
- `useCursorDragScroll` is mouse-only (acceptable fallback, inconsistent).
- Passive-listener hygiene is otherwise correct throughout (only intentional
  non-passive: the drag-to-dismiss `touchmove`).

## 3. Cross-cutting: i18n (shipped 2026-07-30)

Four parallel, unconnected string/locale mechanisms - `createLabels` in core is now
the one shape, and all 22 domains use it:

1. `injectLocale()`/`provideLocale()` - plain `signal('en')` in core; consumed
   reactively by stream consent/error/PiP, grid, phone-input.
2. `DATE_LOCALE` (date-fns `Locale` object) - static, feeds calendar month/
   weekday names; **not** connected to `injectLocale()`.
3. Per-domain label injection tokens (`provide*Labels` for pagination, table,
   carousel, breadcrumb, notification) - static override only.
4. Ad-hoc `input()` English defaults (chip remove, calendar prev/next, select
   clear, dropzone retry/remove/replace) - per-instance override only. This
   undercounted badly: ~60 across 15 domains, not 4.

Plus genuinely **non-overridable** hardcoded strings: RTE toolbar/link-editor
aria-labels (6 spots), `stream-player-loading` "Loading", PiP close/back
labels, `brand-loader` "Loading".

The audit's "four mechanisms" also undercounted: `GridConfig` and the three stream
configs carried strings next to a `transformer(text, locale)` hook that asked apps to
translate by matching the SDK's English. Those strings became label tokens and the
hooks went. Core's `TitleConfig`/`MetaConfig` keep theirs deliberately - those strings
are the app's, so there is no default to override.

## 4. High-value feature gaps (all shipped 2026-07-30/31)

- **RTE**: no undo/redo history at all (relies on native contenteditable undo,
  which desyncs because the editor rewrites DOM through its Markdown pipeline on
  paste/autoformat - content-loss risk); no image embedding (images actively
  stripped on paste; `tools/` has only align + table); no blockquote or
  fenced-code-block tools.
- **Slider**: no vertical orientation (`slider-thumb.directive.ts:17` hardcodes
  `aria-orientation: horizontal`); no ticks/marks (only invisible `step` snapping).
- **Form field**: no character counter anywhere (no `maxLength` display on
  input/textarea/tag-input; the shell's support region has hint/error only); no
  generic field busy/pending state (relevant for signal-forms async validators).
- **Date & time**: no range presets/quick-picks (grep clean across `date-time/`);
  no "Today/Now" jump; time-picker has no min/max/`timeFilter` (direct parity gap
  with sibling calendar); documented rough edge: range per-field errors don't reach
  the field's single error area (§6).
- **Notification**: single action only, no promise API, no dedupe/custom id, no
  status icons (only loading spinner), no swipe-to-dismiss (overlays have it; toast
  stack doesn't), physical-CSS RTL issue (fixed in §1).
- **Table**: no CSV export (zero surface area); no true inline editing
  (`table.types.ts:56-65` comment gestures at it via `cellState` but no edit
  UI/keyboard flow exists); no arrow-key cell navigation (docs self-acknowledge:
  "arrives with the later interactive features").
- **Quick wins**: pagination page-size selector (its own doc comment describes the
  composition, `pagination.component.ts:96-100`); breadcrumb schema.org JSON-LD
  (core `structured-data-binding.ts` exists; pagination-seo sets the pattern);
  accordion non-collapsible/min-open mode; styled checkbox-group select-all (logic
  exists headless-only in `selection-list-control.directive.ts`; story hand-rolls
  markup); selection-list `orientation` (CSS hardcodes `flex-direction: column`);
  meaningful-icon opt-in (`icon.directive.ts:28` hardcodes `aria-hidden`).

## 5. Recorded but NOT planned (backlog; revisit on demand)

- **Stream unified control bar** - biggest single stream gap (no volume level,
  playback rate, captions, fullscreen, or keyboard shortcuts in the
  `StreamPlayer` abstraction; docs explicitly punt controls to consumers).
  High value **but** requires per-platform capability work across 8 adapters -
  needs its own planning session; don't half-bake it.
- Select: mobile bottom-sheet presentation (inconsistent with cascader/
  date-time siblings, which swap below `md`).
- Cascader: branch-level "select all descendants" in multi mode.
- Table: row grouping/banding, row drag-reorder, bulk-selection toolbar;
  tree/data-grid extensions.
- Grid: per-item lock/static flag (grid-wide `readOnly` only), duplicate action.
- Masonry: multi-column item spanning, feed virtualization.
- Carousel: thumbnail strip; vertical orientation surfaced on default component.
- Bracket: zoom/pan/minimap for large brackets; export.
- Dropzone: drag-to-reorder files; crop-before-upload hook; chunked uploads.
- Color input: alpha channel, swatches (deliberate native-wrapper scope today).
- Skeleton: auto-shapes.
- Menubar pattern; lazy `loadComponent` overlay-router routes; tooltip shared
  delay groups; tabs closable/reorderable; menu `loop` opt-out.
- Sizing tokens: `{sm,md,lg}` consts duplicated per family, no shared core
  token; `pagination.component.ts:85` inlines the union, breaking convention.
- Loader: buffer segment, visible percentage label.
- Haptics hooks (`navigator.vibrate`) at gesture commit points.
- OTP resend affordance; tag-input Backspace-to-edit; per-tag validation;
  RTE text color/highlight + word count; switch thumb icons.

Query devtools has its own live backlog in
[`query-devtools-enhancements.md`](./query-devtools-enhancements.md); of this pass's
three items, free-text search and the timing waterfall shipped 2026-08-04 and
whole-session export is still open there.

## 6. Deferred by the shipped work

Four items the plans reached and deliberately left. Each is small enough to fold
into the next relevant pass rather than plan on its own.

- **≥ 44 px touch-target audit** (from §2, phase 5). Every candidate either changes
  layout or steals neighbouring taps, so it needs measuring on a device
  (`verify-in-mobile-emulator`) rather than reasoning: the slider's whole
  `.et-slider-interaction` row is already the target and it is 28 px tall, so growing
  it moves the label/hint; rating icons sit adjacent in a flex row, so a symmetric
  44 px area makes each star steal its neighbour's taps and only block-direction
  growth is safe; for checkbox/radio the target is in practice the whole
  `et-choice-field` label row, and the bare 20 px box only matters for label-less uses
  (table select-all), where a 44 px overlay would reach into adjacent rows.
- **Overlay enter/leave reduced-motion gating** (from §1). `overlay-container.component.css`
  has no `prefers-reduced-motion` block (unlike `notification.component.css:208`), and
  `overlay/strategies/fullscreen-animation.ts` (733 lines of JS transform math) is
  ungated too. Notification, accordion, calendar and carousel all gate correctly, so
  this is the same half-right shape as the rest of that section - but 7 strategies ×
  enter/leave plus the fullscreen JS path is a meaningfully bigger change and wants
  its own plan.
- **Rendering a foreign time zone** (from §4, date & time). The contract shipped as
  docs: every `Date` is local wall-clock and `valueFormat="yyyy-MM-dd"` is the fix for
  calendar dates. Rendering a zone other than the browser's was ruled out of scope -
  zoned arithmetic through calendar + time picker + all four inputs, a new dependency,
  different value semantics. **Open decision** if it is ever wanted.
- **Range per-field errors don't reach the field's single error area** (from §4, date &
  time). Never resolved either way: the plan asked whether the shell's error resolver
  can merge child-field errors for the range input, and no finding was recorded, so it
  stands as documented-as-is.

## 7. Verified strengths (don't re-audit)

FormValueControl contract (`disabled/readonly/invalid/errors/required/touched`)
fully consistent across all controls; mixed-state contract CI-enforced. Menu
already has submenus/context-menu/typeahead/search/selection groups. Overlay
already has drag-to-dismiss (4 directions), unsaved-changes guards, routing,
origin-clone fullscreen animation, correct stacked-dialog Escape/focus.
Notification has update-in-place, hover/focus pause, FLIP stack, correct
`role="log"` live region. Table ships resize/reorder/sticky/selection/
visibility/footers/expansion/state-persistence/virtualization. Zero TODO/FIXME
in the audited domains except the known bracket one. Public API hygiene clean.
119 files use SSR-safe render guards. Error-code system consistently adopted
(189 refs, ~35 domain files).

Also already built, against stale notes elsewhere: **table virtualization**
(`table-virtual-scroll.directive.ts`), **carousel reduced-motion autoplay handling**
(`carousel-autoplay.directive.ts` pause reason) and **breadcrumb overflow collapsing**.

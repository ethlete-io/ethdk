# Existing components: improvement backlog

Shower-thought pass over Storybook/mobile UX, written down 2026-08-05 and
checked against source in `libs/components/src/lib/{scheduler,accordion,
avatar,badge,button,copy-button,description-list,filter-overlay,forms}`,
`libs/core/src/lib/{theming,utils/swipe.ts}` and `libs/query/src/lib/
{paged-query-stack.ts,legacy/infinite-query}`. Unprioritized backlog, same
spirit as `opportunities.md` - pick items into real plans as needed. To be
continued; this pass didn't reach every domain.

## Scheduler

The header (`scheduler.component.html`) is one flat row today - today-button,
toolbar actions (including add-appointment), prev/next, label, spacer,
`et-segmented-button-group` view switcher - all siblings, not split into
mobile-specific stacked bars. A page-filling multi-sectional mobile layout
means actually separating these concerns (nav vs. view-switch vs. actions)
into distinct sections instead of one row that presumably wraps at narrow
widths.

- **Add-appointment as a FAB.** Today it's a plain toolbar button
  (`scheduler-action-add-appointment.directive.ts`). The `floating-action`
  domain (`floating-action.directive.ts`) already exists and is unused by
  scheduler - swap to it below a breakpoint, keep the toolbar button on
  desktop.
- **Today button as an icon button.** Currently `size="sm" variant="outline"`
  text button. A descriptive icon-only form at narrow widths is a styling
  change, no behavior change (`headless.goToToday()` stays as-is).
- **Connector lines for linked appointments in agenda.** The only
  relationship indicator today is `scheduler-badge-chain-count.component.ts`
  (a chevron + descendant count on the parent's badge); no line renders
  between parent and children. `scheduler-agenda-view.component.html`
  already flattens the tree with a `depth`/`data-nested` per node, so a
  connector can be drawn off data that already exists - no new tree-walking.
- **Full-screen edit on mobile, anchored on desktop.** `scheduler-edit-
surface.component.ts` hardcodes one `dialogOverlayStrategy` with no
  breakpoint branching. `overlay/strategies/presets.ts` ships a packaged
  `transformingFullScreenDialogToDialogOverlayStrategy`/`...ToRightSheetOverlayStrategy`,
  but the SDK's own already-responsive controls don't actually use those
  presets - `cascader.directive.ts` and `date-picker-overlay.ts` both hand-
  compose `[{ strategy: bottomSheetStrategy.build(...) }, { breakpoint:
'md', strategy: anchoredOverlayStrategy(...)... }]` directly. That hand-
  composed shape is the real precedent to copy for a fullscreen→anchored
  split (no packaged preset covers anchored today - see "Overlay
  responsiveness" below for the full picture across the SDK).
- **Add-new stays a plain dialog.** Already true - `addAppointment()` opens
  the same `SCHEDULER_EDIT_SURFACE_OVERLAY` as edit. Once edit gets the
  responsive split above, add-new needs pinning to its own overlay
  definition (plain `dialogOverlayStrategy`) so it doesn't inherit edit's
  new mobile/desktop branching.
- **Start/end as a date-time range picker.** `scheduler-edit-time-
range.component.ts` pairs two independent `et-date-time-input` controls.
  The SDK's `DateRangeInputComponent` is date-only; no combined date-time-
  range control exists. This is new `forms/date-time/` surface, not a
  scheduler-only change.
- **Color as a predefined palette.** `scheduler-edit-color.component.ts` is
  deliberately free-text today (its own doc comment: theme names are
  app-registered, the SDK has no fixed set to offer). A palette needs a new
  DI token scheduler can read, parallel to `injectColorThemes`/
  `provideColorThemesWithTailwind4` for color theming, so apps opt into a
  picker - keep free text as the fallback when nothing is provided.
- **Richer sub-appointment list.** `scheduler-edit-surface.component.html`'s
  children list is bare `<button>`s with just a title. Carrying start time
  and the existing chain-count badge is additive; don't turn it into a
  second full appointment card.
- **Swipe navigation on mobile.** `libs/core/src/lib/utils/swipe.ts`'s
  `SwipeTracker` already exists (used by `drag-handle`) but scheduler
  doesn't import it - wiring it to `headless.goToPrevious()`/`goToNext()`
  needs no new gesture primitive.
- **Infinite-scrolling agenda.** The agenda directive takes a plain array,
  no paging concept. `libs/query`'s `paged-query-stack.ts` and the legacy
  `infinite-query` module both exist, neither wired to scheduler. This
  should land as a documented consumer pattern against `paged-query-stack`
  - paging state belongs to whatever query backs the appointment list, not
    inside scheduler itself.

## Accordion

`.et-accordion-trigger:hover` swaps `background` via `color-mix(in srgb,
var(--et-surface-interaction-solid) 7%, transparent)` across the full
`inline-size: 100%` row - that's the edge-to-edge tint. A border/label-color
transition instead (or alongside) has direct precedent: `button.component
.css` transitions `border-color` through a `--_et-button-border-color`
custom property per variant, and `checkbox.component.css` does the same.
Accordion already imports the tokens involved (`--et-surface-border-solid`,
`--et-surface-interaction-solid`), so shrinking the tint to a narrower
element plus a border/label transition needs no new theming plumbing.

## Avatar

`AvatarComponent` (`src`, `name`, `size`, `shape`, `color` via
`ProvideColorDirective`) is component-only today - no `headless/` split,
unlike tooltip/toggletip/accordion. Directive usage on an arbitrary host
(`routerLink`, `button`) means extracting an `AvatarDirective` the way those
domains do, so hover/focus apply to whatever it's attached to.

`AvatarGroupComponent` is a no-logic `<ng-content />` wrapper - overlap and
ring come entirely from CSS (`--et-avatar-group-overlap`, `--et-avatar-
group-ring-width`); stacking threshold and "+N" overflow are left to the
consumer (its own JSDoc example is "just project `<et-avatar>+5</et-avatar>`
yourself"). No other "+N" counter pattern exists anywhere in the SDK to
copy, so a `maxVisible` input plus a built-in overflow avatar is new
surface. Neither avatar nor avatar-group has any `:hover` today - keep it
that way for the plain preview-stack case (all avatars shown, no
interaction), and only add hover once directive-usable avatars need it.

## Badge

One dimension today, `variant` (`filled`/`tonal`/`outline`) plus `color` -
no `size` input. "Icon support" is currently just `<ng-content />`; nothing
stops projecting an `et-icon` now, but there's no dedicated slot/input
making sizing a documented contract. Tooltip/toggletip integration needs no
new plumbing on badge's side - both already attach as directives on the
trigger (`[etTooltip]`, `[etToggletip]`), so `<et-badge etTooltip="...">`
composes today. The real gap is `size` and an icon slot on badge itself.

## Buttons

Button's CSS has no `data-color`/`data-theme` switch - color always comes
from whatever `--et-theme-color-*` is in scope via `ProvideColorDirective`.
Separately, `mutedUntilPressed` (`button.directive.ts`, host attr
`data-muted-until-pressed`) already repoints button's color source from
theme color to `--et-surface-interaction-solid` per variant
(`button.component.css`, the `[data-muted-until-pressed]` block) - functionally the "surface, not theme,
colored button" look, just gated behind the muted-until-pressed state
rather than selectable on its own. `libs/core`'s `surface-interactive-
styles.component.css` already defines the full interactive set
(`--et-surface-interaction{,-hover,-focus,-active,-disabled,-rgb,-solid}`)
a real surface color theme would consume, but nothing today promotes a
surface's interactive set into a registered `ColorTheme` - that contract
(`color-theme.util.ts` + the Tailwind generator) is separate machinery from
surface theming. Deciding whether "surface" becomes a generated `ColorTheme`
entry or a third theming axis needs a real design pass given the contrast
risk already flagged - not a quick CSS addition.

Copy button (`copy-button.directive.ts`) is already a bare directive with
no `.css` of its own - its doc comment says to compose it with `et-icon-
button`/`et-text-button`, and its stories already do exactly that. If it
looks messy, that's the demo/story, not the directive reimplementing button
styles. Moving its story from the standalone `Components/Copy button` entry
into `Components/Button/*` is a pure story-organization move (see Storybook
structure below), no component change.

## Form field

Busy state and a suffix already have a defined precedence, not a collision:
`form-field.component.html` appends the busy spinner (`et-spinner`, driven
by `isBusy = busy() || formFieldDir.isPending()`) _after_ whatever's
projected into `[etInputSuffix]`, inside the same `.et-form-field-affix`
flex box - a comment on it is explicit: "After the consumer's own suffix,
never instead of it - a pending async validator must not displace a clear
button or a reveal toggle." So icon and spinner sit side by side and the
affix widens; they don't overlap.

The worse case - date/time pickers with a clear (X) button, a picker-toggle
button, a suffix icon, and a busy spinner all at once - isn't actually
governed by that rule today, because the clear and picker-toggle buttons on
select/date/time controls don't use `[etInputSuffix]` at all. Each control
renders them as plain sibling buttons in its own flex template (e.g.
`date-input.component.html`: clear button immediately before the
`etDatePickerTrigger` button), positioned to _look_ like a suffix without
being one. So the extreme case has three independent mechanisms sharing the
same visual real estate - form-field's real suffix slot, each control's
hand-rolled clear+trigger buttons, and form-field's busy spinner appended
after the real slot - rather than one governed stack. Making "the suffix
should be the picker toggle button already" true means moving clear and
picker-trigger into `[etInputSuffix]` projection on date-input/date-time-
input/date-range-input/time-input, so form-field's existing append-after
rule covers the whole stack instead of being bypassed by four controls that
render outside it.

The same bypass isn't limited to the date/time family: `phone-input.component
.html`'s clear button and `input/password-input.component.html`'s reveal
button are both plain siblings too, with zero `[etInputSuffix]` usage in
either file - so the fix scope is six controls (date-input, date-time-
input, date-range-input, time-input, phone-input, password-input), not
four. `masked-input` has no template of its own to compare (it's a bare
directive applied to an existing input, per `headless/input-mask.directive.ts`).

## Over limit is a validator in a trench coat

`CounterComponent.isOverLimit` (`counter.component.ts:70-79`) recomputes
`current() > max` itself from the raw value and a numeric limit, and never
reads `errors()`/`effectiveErrors()` from the control's own maxLength
validator. That validator already exists and already fires correctly -
`controlMaxLength()` (`form-field.directive.ts:80`) reads the signal-forms
schema's `maxLength()` binding, deliberately kept off the native `maxlength`
attribute (`form-field.tokens.ts:75-81`) precisely so the validator still
runs on overflow instead of the browser silently truncating input. Two
independent length checks exist for the same limit today. Fix is
`CounterComponent` deriving `isOverLimit` from the control's validation
error state instead of re-comparing lengths itself.

Checked whether this is a pattern or a one-off: it's a one-off. `otp-input`
and `phone-input` both derive their error display from the control's real
`invalid()`/`errors()` inputs, not a self-recomputed check - phone-input
does carry an unused `isPlausible` length-window sanity check
(`phone-input.directive.ts`, doc comment: "not real validation"), but it's
dead code only referenced from its own spec, not wired into
`shouldDisplayError` or the template. `tag-input.directive.ts` goes further
and explicitly documents the distinction it draws: its `maxLength` input is
"display only: the tag input does not refuse tags past it, so the
validator is still the thing that reports the violation," while a separate
`maxTags` input deliberately blocks `add()` as its own interaction rule,
not a stand-in for validation. Counter is the outlier to fix, not a
symptom of a wider habit.

## Description list

`DescriptionListComponent` is an empty class - zero inputs, one visual
style, tunable only through five `@property` CSS custom properties (row/
column gap, term min-width, term/detail font size). Any enhanced style
(bordered, striped, inline) is new surface; there's no `variant` input to
extend.

## Filter overlay story

The default story (`filter-overlay-storybook.component.ts`) already
composes real components - `et-button`, `et-chip`, a floating-action
trigger, a three-page routed overlay (main/region/division) - it isn't a
bare unstyled form. It leans on inline Tailwind utility classes and one
inline `style` attribute for a hard-coded team list, plus ten lorem-ipsum
filler paragraphs, and stands toggle-buttons in for real form fields (per
its own comment). If it looks silly, that's demo dressing fixable inside
the story file alone, not the filter-overlay component.

## Color input

`ColorInputComponent`/`ColorInputDirective` (`forms/color-input/`) already
exists as a custom control - swatch, text value, and a native `<input
type="color">` synced underneath, with `readonly`/`disabled`/`mixed`
handling. A custom picker replaces that native input while keeping the same
directive/value contract. Validators are the actual gap: no hex/RGB/hex-6-
only/contrast validator exists anywhere in `libs/forms` or `libs/core`
today (`value: string | null` only claims `#rrggbb` in a doc comment) -
correctness currently depends entirely on the native picker's output, which
won't hold once free-text entry or a custom picker is in play. A contrast
validator against another control's value needs a cross-field read - check
how (if at all) that's wired elsewhere in `libs/forms` before designing it.

## Grid: reordering doesn't finish on touchend

Drag lifecycle is pointer-events-only end to end - `GridDragDirective`
hosts core's `DragHandleDirective`, whose gesture stream
(`drag-gesture.ts`) is built entirely from `fromEvent` on `pointerdown`/
`pointermove`/`pointerup`/`pointercancel`. There are no `touchstart`/
`touchmove`/`touchend` listeners anywhere in `grid/` or `drag-handle/` -
`touch-action: none` is set on the drag handle specifically so touch
pointer events aren't hijacked for native scrolling (its own comment:
"Without this the browser claims touch pointermoves for scrolling and
fires pointercancel, so a touch drag never gets past the commit
threshold"). `setPointerCapture` is called once past the commit threshold;
`releasePointerCapture` is never called anywhere in core or grid, relying
on the browser's implicit release on `pointerup`/`pointercancel`. The only
two exits from a captured drag - `settleDrag()`/`cancelDrag()` - are both
gated exclusively on that same `pointerup`/`pointercancel` merged stream.

So "stays in touch-move state" means some touch sequence reaches
`pointermove` but its terminating `pointerup` (or `pointercancel`) never
reaches the `document`-level listener that `end$` subscribes to. Source
alone can't say which - the fix has to start with reproducing on real touch
hardware and instrumenting whether `pointercancel` fires (handled, but
maybe not routing back to `cancelDrag`) versus neither event firing at all
(e.g. capture never released, or a synthetic mouse sequence intervening
after the touch sequence). There's no dedicated `.css` file in `grid/` and
no explicit state-machine type to inspect further - drag state is implicit
in a closure `committed` flag plus a nullable `origin`/`dragState` signal.

## Progress steps

Today: `ProgressStepComponent` has exactly one input, `state`
(`PROGRESS_STEP_STATES`: `complete`/`current`/`upcoming` only). Label is
plain projected content, the step number comes from CSS `counter()`, not an
input. Layout is hardcoded horizontal (`display:flex` row, connector drawn
as a horizontal `::after` bar sized off the gap) - no `vertical` input
exists. Every step renders as plain `<span>`s - no `routerLink`, `<a>`, or
`<button>` anywhere in the template, so nothing is interactive today, and
neither `.css` file has any `:hover` rule. Stories are a single `Default`
story with one hardcoded 4-step example.

Expanding this, roughly in order of how disruptive each is:

- **Success/warning/error states** - additive: `ProgressStepState` grows
  from 3 values to include them, parallel to the semantic set banner
  already has (`BANNER_TYPES.SUCCESS/WARNING/ERROR`) rather than inventing
  new color language.
- **Vertical orientation** - not a CSS flip: the horizontal connector is
  purpose-built (`inline-size` bar sized to the gap), so vertical needs its
  own connector geometry (a `block-size` bar), not a rotation of the
  existing one.
- **Steps as links/hover states** - new markup: steps are `<span>`-only
  today, so a linked step means conditionally swapping the step's root
  element (`<span>`/`<a>`/`<button>`) based on whether a link/click input is
  set, the same polymorphic-root pattern other SDK components already use,
  plus adding the `:hover` rules that don't exist yet.
- **Detailed sub-steps** - the least defined ask; needs a decision on
  whether it's a projected slot per step or a fixed description input, and
  whether it's meaningful outside the vertical orientation at all.

## Query devtools: broken on mobile

Layout is a fixed-position overlay (`.et-query-devtools-host { position:
fixed; inset-inline: 0; inset-block-end: 0; }`) built as a two-pane master-
detail split with hardcoded minimums: list pane `min-inline-size: 22rem`
(352px), drawer pane `min-inline-size: 26rem` (416px)
(`query-devtools.component.css`) - roughly 768px of minimum width before
any content, wider than most phone viewports on its own. Grep for `@media`
in this domain returns exactly two hits, both `prefers-reduced-motion` -
there is no width-based breakpoint anywhere in query-devtools today. The
only alternate layout is `[data-dock='right']`, a user-chosen dock
position that already stacks list/detail vertically instead of side by
side - it just isn't reachable except by manual choice. The cheapest fix
for "at least not completely broken" is reusing that same stacked layout
under a `@media (max-width: ...)` query instead of only under the manual
right-dock attribute, before any deeper redesign of the ~10-tab header
strip for mobile.

## Query error: rebuild on banner

`query-error.component` builds its own colored card from scratch -
`.et-query-error-card` uses `background: color-mix(in srgb, var(--et-
theme-color-primary-solid, currentColor) 8%, transparent)` with a matching
border - which is the _identical_ formula banner already uses for its own
surface. Both independently implement an icon slot, a heading, a
description/message, and an action row. Banner already carries the
semantic type query-error needs - `type="error"` forces `injectErrorTheme()`

- so rebuilding query-error on banner is mostly composition: project the
  icon into `[etIcon]`, the retry button into `[etBannerAction]`, set
  `type="error"`. Two things banner doesn't have yet and query-error would
  still need to layer on top: the violation-list rendering (a `<ul>` of
  messages vs. banner's single description paragraph) and the retry-button-
  only-if-`canRetry` conditional.

## Standings story causes a mobile horizontal scrollbar

Not a standings component bug - `standings.component.css` already uses
container queries (`container-type: inline-size`) to progressively drop the
form column below 720px and the remaining detail columns below 560px,
collapsing to position/team/points at the narrowest; the story's own doc
comment confirms this is deliberate. The scrollbar comes from the story
wrapper: `standings-storybook.component.ts` renders `<et-standings>` inside
`<div [style.inline-size.px]="width()">` with a fixed pixel width
(Storybook control, default 760, range 280-900). On a real mobile viewport
narrower than that default, the fixed-width div - not `100%` or `min(760px,
100%)` - forces the page to scroll horizontally to show the whole box, even
though standings itself would happily collapse columns if given the actual
(narrower) container width it's sitting in. Fix is confined to the story:
default the width control to something that shrinks with viewport, or wrap
it in `min(760px, 100%)`.

## Overlay responsiveness: scheduler's gap is systemic

Checked every overlay-anchored dropdown-style control for the same
"one strategy, no breakpoint" gap flagged on scheduler's edit dialog. Three
already solve it, and none of them use the packaged `transforming*`
presets in `overlay/strategies/presets.ts` - they hand-compose a breakpoint
array directly: `cascader.directive.ts` and `date-picker-overlay.ts` both
build `[{ strategy: bottomSheetStrategy.build({ hasBackdrop: true, ... }) },
{ breakpoint: 'md', strategy: anchoredOverlayStrategy(...) }]`, and
`rich-text-editor-link-editor.directive.ts` does the equivalent with a top
sheet instead of a bottom sheet (comment: "on phones (< md) an anchored
popover would be cramped against the on-screen keyboard"). Three don't:
`menu.directive.ts`, `rich-text-editor-floating-toolbar.directive.ts`, and
`rich-text-editor-triggers.directive.ts` all build one raw anchored
strategy with no breakpoint at all - the same shape as scheduler's gap.
`select.directive.ts` is anchored-only too, but that one is a documented,
deliberate choice ("a select is a single-column listbox that reads fine
anchored to the field on mobile"), not an oversight.

`anchored.strategy.ts` itself explains why this is inconsistent rather than
missing: it already does real viewport-awareness for _collision avoidance_
(`fallbackPlacements`, `shift`, `viewportPadding`, `autoResize`, `autoHide`)
but has no concept of swapping to a different UI shape at a breakpoint -
that only happens where a caller composes multiple strategies itself, which
three controls do and three don't. Fixing menu and the two RTE overlays
means copying cascader's/the date-picker's exact composition pattern, which
is also the fix for scheduler's edit dialog above - one pattern, four
call sites.

## Duplicated pointer-drag logic: slider, rating, carousel

`libs/core`'s `dragGestureFrom` (`drag-handle/drag-gesture.ts`) already
models exactly this problem - pointerdown/move/up plus capture, exposed as
`start`/`move`/`end`/`tapped` events - and `grid` plus the stream domain's
PIP window chrome (`pip-title-bar.directive.ts`,
`pip-collapse-overlay.directive.ts`, via `DragHandleDirective`) both reuse
it correctly. Two other controls that need the same "track pointer delta
from a start point" behavior don't: `slider-track.directive.ts` and
`rating.component.ts` each hand-roll their own
`pointerdown`/`pointermove`/`pointerup` handling, their own
`setPointerCapture` call, and their own boolean `dragging` flag - nearly
identical in shape to each other and to what `dragGestureFrom` already
provides. Carousel adds a third, more distinct reimplementation:
`cursor-drag-scroll.ts` (behind `ScrollableDragDirective`, opt-in for
mouse-drag-to-scroll) hand-rolls its own `mousedown`/`mousemove`/`mouseup`
pipeline with its own deadzone concept - carousel's touch path needs no
gesture code at all, since touch scrolling there is native CSS scroll-snap.
Consolidating slider and rating onto `dragGestureFrom` first is the
cleaner win since they're near-identical today; carousel's deadzone/
threshold semantics differ enough that it may not fold in as cleanly.

## Notification/toast doesn't adapt to mobile width

`notification-stack.component.css` docks a fixed `--et-notification-min-
width: 300px` / `-max-width: 420px` card to a corner via `position: fixed`

- `data-position` (`bottom-end`, `top-start`, etc.), stacking multiple
  toasts as plain flex children in document order. Grep for `@media` in the
  whole notification domain returns only `(hover: hover)` and
  `(prefers-reduced-motion: reduce)` - no width-based breakpoint anywhere. On
  a phone that's a small floating card in a corner rather than the common
  full-width mobile toast pattern; same shape of gap as the overlay
  controls above and scheduler's header, just nobody's added a breakpoint
  here yet.

## Already covered - don't rebuild

Two components already have solid mobile/narrow-viewport treatments worth
using as reference patterns for the gaps above, not touching themselves:
**Table** scrolls wide content inside its own `.et-table-host { overflow:
auto }` grid instead of blowing out the page, with an edge scroll-fade
(`.et-table-scroll-fades`) hinting there's more to scroll - no
`@media`/`container-type` needed because the scroll container handles it.
**Pagination** (`paginate.ts` + `pagination.component.ts`) already
JS-measures its own rendered width and collapses through shrinking
`siblingCount`/`boundaryCount` down to a `COMPACT_MAX_WIDTH = 480px`
previous/next-plus-"page X of Y" mode - more thorough than a plain
ellipsis truncation.

## Charts - new domain, uncharted

Nothing chart-shaped exists today: a repo-wide grep for chart/sankey/d3/
recharts/chart.js/visx turns up only false positives (grid's storybook
placeholder tiles named `DummyChartComponent`, a code comment using "a
chart" as an example of expensive content, a `skeleton.md` doc line) - no
component, directive, drawing logic, or dependency (`package.json` has no
d3/visx/recharts/chart.js/highcharts/plotly anywhere in the workspace).
This is genuinely new surface, not an extraction like most of the rest of
this backlog - the goal per the ask is basics (bar/pie/sankey/etc.), not a
D3 replacement.

What already exists to build on:

- **Sizing.** `libs/core/src/lib/signals/element-dimensions.ts`
  (`signalElementDimensions`/`signalHostElementDimensions`, `ResizeObserver`-
  backed) is the reusable primitive for a chart's container-relative SVG
  viewBox - but it's adopted inconsistently today (`masonry` uses it,
  `carousel` deliberately avoids a per-item `ResizeObserver` as too costly,
  `standings` uses neither), so there's no single blessed pattern to copy
  wholesale.
- **SVG rendering has two existing precedents, and they disagree.** Icon
  (`icon.directive.ts`) and bracket (`bracket.component.html`) both render
  via sanitized `[innerHTML]` of a raw/generated SVG string rather than an
  Angular template with real per-element bindings; bracket computes its
  connector geometry as path-data strings (`bracket/drawing/line.ts`:
  `linePath`/`verticalPath`/`gutterPath` → `M x y L x2 y2`) fed into that
  string. A chart library needs real per-datum elements with real Angular
  bindings (for hover/tooltip/animation on individual bars or slices as
  data changes), which the bracket/icon `[innerHTML]` approach doesn't
  give you - worth deciding explicitly to diverge from that precedent
  rather than copying it, since charts re-render on data change far more
  than a bracket does.
- **Categorical color palette doesn't exist yet.** `injectColorThemes()`
  (`color-theme.util.ts`) returns `ColorTheme[]`, but every consumer
  (`injectColorThemeByType`, `injectDefaultColorTheme`) only `.find()`s a
  single theme by `type`/`isDefault` - nothing today iterates the registry
  as an ordered N-colors palette, and semantic accent themes (brand/danger/
  etc.) aren't guaranteed to number enough distinct hues for an 8-12
  category series anyway. A chart palette is likely its own small provided-
  config concept (closer to the "predefined palette via provided config"
  idea already flagged for scheduler's appointment color) rather than a
  reuse of color theming.
- **Tooltip-on-datapoint is untested territory.** `[etTooltip]`
  (`tooltip.directive.ts`) injects `ElementRef<HTMLElement>` explicitly -
  attaching it to an SVG `<rect>`/`<path>` compiles (directives apply to any
  host tag) but the HTMLElement-typed internals are asserted, not verified,
  against an `SVGElement` host. Needs a check (or an SVG-safe variant)
  before "hover a bar to see its value" is a supported pattern.
- **Loading state has a pattern to follow.** `skeleton`
  (`SkeletonComponent`/`Item`/`Text`) is already composed by `table` via its
  own `etTableSkeleton` directive pair while data loads, swapped for real
  rows once ready - a chart-loading skeleton (e.g. bars of random heights)
  should follow that same compose-while-loading shape, though the skeleton
  content itself (a fake bar/pie shape) would be new, not reused.
- **Animation is the open question.** `animatable.directive.ts`/`animated-
lifecycle.directive.ts` are class-driven CSS-transition directives typed
  to `HTMLElement`, animating only DOM layout/opacity-style properties via
  CSS classes - there is no existing mechanism for animating raw SVG
  attributes (`r`, `d`, `points`), which is what bars growing or pie slices
  sweeping in actually need. Simple enter/exit (fade/scale a whole bar) can
  probably reuse the existing directive pair; arc/path morphing (a pie
  slice's `d` changing value) cannot, and needs its own mechanism designed
  from scratch before pie/sankey are on the table - bar charts alone could
  ship without solving this.

## Password input: caps-lock warning

The indicator (`password-input.component.html`) is a bare
`etIcon="et-triangle-exclamation"` marked `aria-hidden="true"`, next to a
`resolvedCapsLockLabel()` text span (default `'Caps Lock is on'`,
`input-labels.ts`) - but that text span is styled with the standard
visually-hidden clip pattern in `password-input.component.css`, so it's
screen-reader-only. Sighted users get the bare triangle with nothing
visible explaining it. Fix is straightforward: the icon can take
`[etTooltip]` directly (it's a directive attachable to any host, same as
already noted for badge) using the same text already resolved for the
screen-reader label, rather than inventing a second copy.

The "stays on after caps lock is turned off" report doesn't trace to a
filtering bug in the wiring - `password-input.directive.ts`'s
`syncCapsLock(event)` calls the standard `event.getModifierState('CapsLock')`
unconditionally from `(keydown)`, `(keyup)`, _and_ `(mousedown)` on the
input (the directive's own comment notes `mousedown` was added specifically
so a focus-click with no keystroke still re-checks state), with no
`event.key`/`event.code` filter excluding the CapsLock key itself. On spec
behavior that should catch a bare toggle immediately via the CapsLock key's
own keyup. The likely explanation is a real cross-browser/OS quirk in
whether the CapsLock key reliably fires a `keyup` (or reports the post-
toggle modifier state at that point) at all - well documented as
inconsistent, particularly on macOS - which source alone can't confirm.
Needs reproducing on the actual browser/OS combo before designing a fix;
if confirmed, the workaround is re-checking on some event other than the
CapsLock key's own keyup (e.g. next `focusin`, or accepting the state can
only be trusted to update on the next real keystroke and saying so in the
label) rather than anything fixable in this directive's current listener
set.

No duplication elsewhere - `otp-input` and every other password-adjacent
control have no caps-lock logic of their own; `password-input` owns this
exclusively.

## Storybook structure

Every story sits under a flat `Components/<Name>` (or `Components/<Domain>/
<Name>`) - nothing groups categories like Forms/Overlays/Data-display as
siblings above `Components`, which is the likely source of the "big dump"
feeling. Two concrete instances found this pass: `Components/Copy button`
is a top-level sibling of `Components/Button/*` instead of living under it,
and `Components/Forms/Form field/Counter` is the only story in the SDK
nested three levels under a `Form field` category with no other children -
it reads as its own subsystem when it's one piece of the form-field
wrapper. Both are one-line `title:` fixes. Whether `Components/*` should
gain real top-level categories at all is a bigger, separate call.

## Query devtools: response overrides are presets-only

The ✎ menu on every value-explorer row
(`query-devtools-override-menu.component.html`) offers only fixed presets.
There is no way to type a value. The op model already supports it -
`OverrideOp` in `libs/query/src/lib/devtools/query-devtools-overrides.ts`
declares `{ type: 'set'; path; value }`, plus a `custom` variant on both
`stringPreset` (`custom?: string`) and `numberPreset` (`custom?: number`),
and `applyOp` handles all three. Nothing in the panel ever arms them: grep
for `'set'` or `preset: 'custom'` in `libs/components/src/lib/query-devtools`
returns no hits. So the entire gap is UI - a "Custom…" menu item that opens
a small input and arms `set` (or the `custom` preset for a typed leaf), no
query-side work at all.

The only other editing affordance is the whole-body one: `openResponseEditor`
→ `setResponse()` (`query-devtools-detail.component.html`, the `Edit`
→ `Response` button), a raw-JSON textarea over the entire response that is
one-shot and does not survive a refetch. Path-addressed and free-form are
today mutually exclusive; a custom `set` op is what joins them.

- **Null values get a dead menu.** `kindOf(null)` returns `'null'`
  (`query-devtools-json.component.ts`), which matches no `@switch` case in
  the override menu; `isContainer`, `isArrayElement` and `paginationShape`
  are all false/null too, so the menu renders exactly one item: the
  destructive `Reset` - which is itself a no-op when nothing is armed at
  that path. Same for `'undefined'`. This is the case where custom values
  matter most: a null field is precisely the one you want to fill with a
  plausible value to see what the UI does. Minimum fix is a `'null'` /
  `'undefined'` case offering `set`-backed "Set to string / number /
  boolean / empty object / empty array", and suppressing `Reset` when the
  path has nothing armed.
- **Copy/paste subtrees.** Copy already exists as the ⧉ button on every
  row - `copyValue()` writes the whole subtree as JSON for containers, the
  raw unquoted value for leaves, and `copyLabel()` already says "Copy
  object (n keys)" / "Copy array (n items)". The missing half is paste:
  read the clipboard, `JSON.parse`, and arm `{ type: 'set', path, value }`.
  Gate the menu item on the parse succeeding and, for a container row,
  on the pasted value's kind matching (`kindOf`) so an array isn't silently
  dropped onto an object. This is the cheapest real win here - copy from
  one query's response, paste onto another's, and the op replays on every
  future fetch, which the whole-body editor can't do. Note clipboard reads
  need permission and a user gesture; the menu item is a gesture, but the
  read can reject and needs an error path (the panel has no clipboard-read
  precedent yet - all six existing sites are writes).
- **Randomize what the presets generate.** `STRING_PRESETS` and
  `NUMBER_PRESETS` are frozen literals - `short` is always `'Ab'`, `long`
  is the same lorem paragraph repeated 4x, `negative` is always `-1`,
  `huge` is always `Number.MAX_SAFE_INTEGER`. Applying "short text" to
  twenty fields fills all twenty identically, which hides exactly the bugs
  a fill is meant to surface (a key collision, a wrong field rendered, a
  layout that only breaks on varied widths). Generating a value per arm -
  a short phrase from a small word pool, a length-varied lorem slice, a
  random negative/large integer - fixes that. The constraint: the value has
  to be generated **at arm time and stored in the op**, not re-rolled inside
  `applyOp`, or every refetch reshuffles the response and the panel stops
  being reproducible. That is what the existing `custom` field is for -
  `arm({ type: 'stringPreset', preset: 'custom', custom: generated })` - so
  randomization and custom values are the same change, and `Math.random()`
  stays out of the replay path. `datePreset` is the precedent for the
  opposite choice: `now`/`plusDay` deliberately resolve at apply time, which
  is right for "now" and wrong for a random sample.
- **A long-word string preset.** Today's `long` preset is lorem - all short
  words with whitespace everywhere, so it only ever tests wrapping, never
  overflow. The bug class it can't reach is a single unbreakable token:
  a German compound (`Straßenverkehrs-Zulassungs-Ordnung` spelled out in
  full, or the classic
  `Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz`), a long
  URL, a base64 blob, an email address. Those blow out flex/grid tracks,
  push ellipsis truncation past its container, and break table column
  sizing in ways lorem never will. Add a `longWord` preset (and its
  matching menu item) rather than folding it into `long` - "does it wrap"
  and "does it overflow" are separate checks and you want to arm them
  independently.
- **While in there: the fill-recursively actions are hardcoded to one
  preset each.** `fillStrings()` always arms `'short'`, `fillNumbers()`
  always `'zero'`. Once presets randomize, the natural shape is "fill every
  string with «preset»" as a submenu rather than three fixed verbs.

## Tree: multi select selection stacks into a slab

`tree.component.css` already anticipated this - the multi-select block
(`.et-tree:where([aria-multiselectable]) .et-tree-node`) exists purely to
weaken the single-select treatment, with a comment saying so ("Multi select
stacks selected rows into one slab, so it states the selection with a mark
and keeps the fill and the label untinted"): the accent fill drops from 16%
to 8% and the `--et-theme-color-ink-solid` label recolor is reverted to
`inherit`. It didn't go far enough. Rows are flat flex boxes with no margin
between them, so consecutive selected rows paint one continuous
`--et-theme-color-primary-solid` band - the per-row `--et-tree-node-radius`
only rounds the outer corners of each row and is invisible mid-run. Select
five siblings and you get a solid colored block, not five marked rows.

The SDK's own list-style multi-select controls both resolve this by not
filling at all:

- `select-option.component.css` states selection **only** through the
  `.et-select-option-check` icon (opacity 0 → 1, colored
  `--et-theme-color-primary-solid`); its backgrounds are reserved
  exclusively for hover / `:active` / keyboard-active. A selected option has
  no fill in single or multiple mode.
- `cascader-panel.component.css` does the same in multi mode with a leading
  `.et-cascader-check` square (a real checkbox shape, also driven by
  `data-indeterminate`), and lets `[data-selected]` change only ink color and
  `font-weight: 500`.

Tree already has the mark half of that - the `::after` CSS-drawn checkmark
on the multi-select block - but it's a **trailing** 4x8px pseudo-element
rather than a leading check in a reserved slot, so it doesn't read as the
primary selection signal the way cascader's leading square does. The likely
fix is dropping the selected fill entirely in multi-select mode (keep fill
for hover/active only, matching select-option) and promoting the mark:
leading, checkbox-shaped, in a slot that's reserved whether or not the row
is selected, so labels don't shift. Single select can keep its current fill -
one filled row was never the problem.

## Tree: disabled rows still take hover/active tint when multi selectable

`.et-tree-node:where([aria-disabled])` resets `&:hover, &:active { background:
transparent }`, which works in single select: that rule and the selected
hover it has to beat both weigh one class plus one pseudo-class, and the
disabled block is later in the file. It loses in multi select, where the
same hover lives under a descendant selector -
`.et-tree:where([aria-multiselectable]) .et-tree-node:where([data-selected]):hover`
is two classes plus a pseudo-class, outweighing the disabled reset
regardless of order. So a selected row in a disabled multi-select tree still
lights up on hover and darkens on press while every interaction is refused
(`TreeDirective.select`/`expand`/`focus` all early-return on `disabled()`).
Both the tree-wide `disabled` input and a per-node `node.disabled` produce
the same `aria-disabled` host attribute (`tree-node.directive.ts`), so this
hits both.

Two ways out, and the second is probably the real one:

- Raise the reset's weight to match (scope it under the same
  `.et-tree:where([aria-multiselectable])` prefix, or bind it to
  `[data-disabled]` at equal depth).
- Follow the precedent instead: `select-option` and `cascader-panel` both
  give disabled rows `opacity: 0.4` (plus `cursor`), which mutes the fill,
  the label and the mark in one rule and doesn't need a reset per
  interaction state. Tree currently only recolors the label to
  `--et-surface-color-muted-solid` and leaves the selected accent fill at
  full strength - so a disabled tree with selections looks essentially
  identical to an enabled one. Adopting the opacity approach fixes the
  missing disabled affordance and the specificity leak together.

## Query devtools: a failed query vanishes instead of going stale

A `PUT` that comes back `401` is unreadable in the panel by the time you look
at it. Two separate mechanisms drop it, and they need separate fixes.

**The row itself is tied to the query's lifetime.** `registerQueryDevtoolsEntry`
returns an unregister callback and `base-query-factory.ts` wires it straight to
`deps.destroyRef.onDestroy` (same in `query-stack`, `paged-query-stack`,
`query-sequence`, `web-socket-client`, `bearer-auth-provider`,
`query-form-signals`); the callback filters the entry out of the `entries()`
signal in `query-devtools-registry.ts`. So a 401 that makes the app redirect to
login destroys the component holding the mutation, and the row - with its
stats, its run history and its route - is gone before the panel is opened. The
registry keeps no record that the query ever existed.

**The repository entry is destroyed, not retained.** `unbind` only retains an
orphaned entry when `keepUnusedFor > 0` **and** `request.response() !== null` -
"only data is worth keeping around". A mutation is uncacheable, so
`resolveKeepUnusedFor` returns `0` anyway; but even a failed `GET` fails the
second condition, which means failures are precisely the class of entry
retention never keeps. `destroyEntry` deletes the map entry and the Cache tab
reads `subtle.cacheEntries()` live, so the row disappears from there too. Note
`destroyEntry` emits no event at all - there is no `entry-destroyed` to pair
with `entry-created`, so the panel cannot even notice.

What survives is the run buffer: `recordError` takes the `QueryError`, so a run
keeps `status: 'error'`, its url, its attempts, the status code and a trimmed
body, and the detail drawer's History tab renders them. The buffer lives on the
stats recorder rather than on the query state, so it also outlives the
`resetExecuteState` a logout triggers through `unbindAllSecure` - a row blanked
by a logout stays readable. That only helps while the row is still there. The
Events tab keeps a `request-error` row with
`status` and `url` for the last 100 events, and that is currently the only
place a 401 is legible at all. Its `queryId` is resolved at event time by
identity-matching `subtle.request()` against the registered entries, so
clicking such a row calls `selectQuery` with an id nothing is registered under
any more - `findQuery` returns `null` and the click silently does nothing.

The fix, in the order it pays off:

- **Tombstone the registry entry.** Instead of filtering on unregister, set
  `destroyedAt` and keep it, capped, with a "Clear gone" action. A destroyed
  row should read like `stale` does - the muted chip and a dimmed row, not an
  error colour - be excluded from the live facet counts, and sit behind a
  facet chip that is off by default. Id collisions are not a concern:
  `idCounters` only ever increments within a page load, so a re-created query
  gets `#1` next to the tombstone's `#0`.
  - The trap: an entry holds `handle` (the query, and through it the request
    and its response body) and `meta.element` (a host DOM node). Retaining
    live entries would make the devtools a leak factory - the thing
    `MAX_UNUSED_ENTRIES` exists to prevent on the repository side. A tombstone
    has to be a frozen snapshot (method, route parts, last url, stats, runs,
    last error) with the handle and element dropped, which means the detail
    drawer needs to render from a snapshot as well as from a live handle.
    Today every tab reads `entry.handle` signals directly, so this is the
    actual work in the item.
- **Emit `entry-destroyed` from the repository** so the Cache tab can keep its
  own tombstone row the same way, and so "why did this entry go away" (logout
  vs. `keepUnusedFor` expiry vs. the unused-entry cap vs. a manual evict)
  becomes answerable at all. The repository must not keep the tombstones
  itself - it stays lean in production; the panel already subscribes to
  `events$` and is the right owner.
- **Fall back to key/url matching for an event row's `queryId`.** With
  tombstones in place the link resolves again, but an error event fired after
  the query was already gone still records `queryId: null` - match on the
  request url/key against tombstones as a second pass.

## Auth: what the consumer app had to rebuild around the bearer provider

Read against `fut-frontend` (`libs/domain/auth`, `libs/queries/*/…​.client.ts`)
and `libs/query/src/lib/auth`. All four of that repo's providers are configured
identically - `withRefreshQuery` + `withPersistentAuth({ autoLogin })` +
`withBearerAuthMultiTabSync()` - so everything below applies to each of them.
Ordered by how visible it is to a user.

### A 401 in a follower tab waits for the leader's timer

`withRefreshQuery`'s 401 listener (`bearer-auth-query-builders.ts:193`) calls
`executeRefresh`, which returns early on `!context.isLeader()`. So a secure
request that 401s in a follower tab triggers no refresh at all - it waits until
the leader refreshes on its own timer, up to 25% of the token lifetime later,
and broadcasts. Incoming broadcast tokens now go through `applyTokens`, so
`afterTokenRefresh$` fires and the tab's 401'd queries do retry once that lands
(`secure-query-execute-factory.ts` - that emission filtered on
`error()?.code === 401` is the only thing that re-executes an already-failed
secure query). What is left is the delay: give a follower a way to ask for a
refresh instead of dropping the event - post a `refresh-requested` message (the
presence channel in `leader-election.ts` already exists) rather than returning
early on `!isLeader()`. The leader gate is right about _who spends the refresh
token_; it is wrong as a way to discard the event.

### A failed refresh leaves the session looking valid

Nothing in the provider reacts to the refresh query failing. Tokens stay set,
`isAuthenticated()` stays `true`, and every secure query keeps firing with a
dead token - each 401 calling `executeRefresh` again, most of them swallowed by
the `minRefreshInterval` guard (30s default, and `lastRefreshTime` is stamped
_before_ the attempt and not rolled back when it fails). `fut-frontend` has to
watch for it from outside and log out itself:

```ts
const isRefreshFailure =
  execState?.state === 'error' && (execState.type === 'tokenRefresh' || execState.type === 'autoLogin');
if (isRefreshFailure) logoutService.logout({ quiet: true, via: 'system' });
```

That is policy every consumer of `withRefreshQuery` needs and none should have
to write. `withRefreshQuery` should own it - an `onRefreshFailure` option
defaulting to "end the session when the server was definite (401/403), keep
retrying otherwise", which is also what makes the `retryableStatusCodes` list
(0/408/425/429/5xx, `maxAttempts: 0` = unlimited) coherent: those are the
statuses worth retrying, everything else is terminal and should log out.

While there: a 401-driven refresh must not be dropped by `minRefreshInterval`.
The interval exists to stop refresh loops, but a real 401 within 30s of a
proactive refresh (revoked token, clock skew) is exactly when the swallowed
attempt strands the query. Throttle the _proactive_ path and dedupe the reactive
one (one refresh in flight at a time), rather than sharing one guard.

### `executionState` is one latched slot doing three jobs

It answers "which auth query is running", "how did the last one end", and "has
the session ended" at once, and it never returns to idle. Every consumer then
reverse-engineers what it actually needs, and `fut-frontend` does it three
separate times:

- `AUTH_LOGOUT_DEF` (`auth-state.ts`) exists solely to record _why_ the session
  ended - its own comment says "which the v3 provider does not model" - because
  a user-initiated logout must stay put while a system one redirects back with
  a `?go=` param. `BearerAuthExecutionStateLogout` carries no cause, and
  `withInactivityLogout` calls the same `context.logout()`, so an inactivity
  logout is indistinguishable from a click.
- `AppInitializedService` gates every app's entire template
  (`@if (initializedApp())`) on a heuristic over `executionState`: no state on a
  public route, or any `state === 'success'`, or an error on a public route. It
  is guessing at "has the session finished settling", which the provider knows
  precisely (was there a cookie? is the auto-login in flight?) and never
  publishes. With no cookie on a protected route no `executionState` is ever
  produced at all, so first paint waits on the redirect landing.
- The auth flow needs `debounceTime(1)` over `[executionState$, urlState$]`,
  plus a special case whose comment reads "a stale `logout` state never clears
  on its own, so treat it as no operation too - otherwise a second Entra
  attempt in the same page load silently no-ops".

Two additions would delete all three: a **`sessionStatus`** signal
(`unknown | restoring | authenticated | anonymous`) that an app can gate its
shell on, and a **cause on the session ending** (`user | inactivity | expired |
revoked | otherTab`) set by whoever ends it. Both are things the provider
already knows and currently throws away. Note also that `withTokenRevocation`
overwrites `executionState` with `{ type: 'revocation', state: 'loading' }`
immediately after a logout set `{ type: 'logout' }` - a single slot cannot
carry two concurrent concerns, which is the argument for splitting it rather
than adding a fourth state to it.

## Auth: the provider's execution model is what makes the app's flow brittle

Second pass, this time on why `fut-frontend` needs 250 lines of `combineLatest`
over router state and `executionState` (`libs/domain/auth/src/lib/auth-flow.ts`)
to keep a session coherent. The defensive shapes in there - a `debounceTime(1)`,
a `hasAttempted` latch in `dev-login-view.component.ts`, a special case for a
"stale `logout` state" - are all downstream of one thing: `setupBearerQueryRegistry`
in `bearer-auth-provider.ts` treats every auth execution as fire-and-forget and
funnels all of them through single mutable slots.

### Tokens and `executionState` can disagree across builder keys

Within one key the two writers now agree: every execution reuses that key's single
query, so `applyTokens` and `executionState` both read the snapshot of the latest
execution and a superseded attempt stops reporting altogether.

Across keys they still can't. `executionState` is one provider-global slot written
by whichever key's effect fires last, while `applyTokens` runs per key off that
key's own snapshot. A `tokenRefresh` triggered by a 401 burst while the user
submits a login therefore ends with one key's tokens applied and the other key's
outcome on display. The fix is the same shape as before: an execution should be a
value the caller can await rather than a side effect on a shared slot - or the
provider should refuse a second execution while one is in flight for any
token-issuing key, since a single-use refresh token cannot be spent twice anyway.

### The login form watches a provider-global slot for its own submit

`external-user-login-view.component.ts` derives its button state from
`executionState()` filtered by `type === 'login'`, and its comment explains why:
"The v3 auth provider reports progress through `executionState` rather than an
observable query". But `execute()` already returns a `QuerySnapshot`, and
`queries.login.snapshot` is a signal of the latest one (`QueryRegistryEntry`,
`bearer-auth-provider.ts:145`) - the per-attempt state exists and is simply not
the documented path, so the app's own `AuthProviderContract` erased it
(`execute(args): unknown`, `auth-state.ts`). Reading the global slot means any
concurrent auth activity of the same derived type is rendered as the form's own
outcome.

No new API needed - this is a docs and emphasis fix in `apps/docs/query`:
`executionState` answers session-level questions, the snapshot returned by
`execute()` drives the UI of the attempt that produced it. Worth doing at the same
time as the `sessionStatus` / logout-cause split proposed in the previous section,
since it is the same confusion from the other end.

### Smaller: `excludeRoutes` invites string matching

`withPersistentAuth`'s `autoLogin.excludeRoutes: string[]` is prefix-matched
against `injectRoute()`, so a consumer expresses route policy as substrings. In
`fut-frontend` that style has spread to the flow's own predicates -
`injectIsOnPublicRoute()` returns true for any URL merely _containing_
`reset-password`, so a hypothetical `/campaigns/reset-password-templates` would
count as public and skip auth entirely. The app also has two different meanings
for the query param `token` (`PASSWORD_RESET_TOKEN_QUERY_PARAM_NAME` and
`ENTRA_ACCESS_TOKEN_QUERY_PARAM_NAME`, `auth.routes.ts`), disambiguated only by
which route is active.

The app side of that is the app's business, but the SDK can stop leading: accept a
predicate (`shouldAutoLogin: (url: string) => boolean`) alongside the string list,
so a consumer can match on the router's parsed URL instead of on substrings of a
path.

## Query forms: the signals rewrite dropped the reset cascade

`fut-frontend` has 51 live uses of the class-based `QueryForm`
(`libs/query/src/lib/query-form/query-form.ts`), none of `defineQueryForm`
(`libs/query/src/lib/query-form-signals/query-form-signals.ts`), so the successor
has never been exercised against the app that would migrate onto it. The field
factories are at full parity - every `*QueryField` class has a `*QueryField()`
function, sharing the same transforms out of `query-form/query-form.utils.ts` -
and `libs/components` already binds signal-forms in 82 files, so neither the field
vocabulary nor the control binding is what blocks a migration. The `isResetBy`
graph is.

The legacy form resolves resets **transitively**. `_handleQueryFormResets`
(`query-form.ts:523`) writes the reset field through `control.setValue()`, flags
`didResetValues`, and pushes `didValueChanges$` - which re-enters
`handleFormChange()` and runs the whole comparison again against the newly reset
value. A field reset in pass one therefore counts as "changed" in pass two and can
reset a third field. `changedFieldsInLastResetLoop` exists purely to swallow the
intermediate `_changes$` emissions, so the graph settles before a single committed
change is published - one query execution, not one per hop.

`defineQueryForm` resolves them in **one pass**. `flush()`
(`query-form-signals.ts:350`) computes `changedKeys` once from committed → live,
then `applyResets` (line 318) tests every field's `isResetBy` against that frozen
list. Resets are written into the local `next` object and never re-enter the
comparison, so a reset can never trigger another reset.

Verified with a throwaway spec (added, run, deleted) over `country → league → team`,
where `league` is `isResetBy: ['country']` and `team` is `isResetBy: ['league']`.
Seed all three, then change `country` alone:

- legacy `QueryForm` → `{ country: 'en', league: null, team: null }`, and it
  publishes exactly one committed value (the intermediate passes are suppressed,
  as designed).
- `defineQueryForm` → `{ country: 'en', league: null, team: 'bvb' }`. `team` keeps
  a value that is no longer reachable from the selected country, and it is sent to
  the API on the next request.

The app has been papering over this without naming it: `player-overview.component.ts:192`
and `step-select-player.component.ts:166` both declare
`isResetBy: ['country', 'league', 'gender']` on a field whose only direct dependency
is `league` - the transitive closure, written out by hand. That workaround happens to
be exactly what the new form needs, which is why nobody has hit it yet, but it is
load-bearing and undocumented. `apps/docs/query/query-forms.md:78` describes
`isResetBy` as "sibling field(s) whose change resets this field to its default" and
says nothing either way.

The fix is to iterate `applyResets` to a fixpoint - re-derive `changedKeys` after each
pass and repeat until nothing changes, with an iteration cap for a cyclic graph (which
the legacy form also never guarded, it just converged because a field already at its
default stops re-triggering). The property to preserve is the one the legacy form works
hard for: the cascade must settle before `committed` is written once, or every hop
becomes another query execution.

## Auth: `executionState: 'success'` does not mean the session started

`canMatchAuthenticated` in the consumer's `libs/domain/hub/src/lib/hub.routes.ts` is
19 lines of guard carrying three comments, and each one is an SDK gap rather than an
app decision.

**The SDK ships no route guard at all.** There is no `CanMatchFn`, `CanActivateFn` or
`createUrlTree` anywhere in `libs/query/src` or `libs/core/src`, so every app that uses
the bearer provider hand-rolls "wait for auth to settle, redirect to login, come back
to the attempted URL". The consumer's version encodes the return URL under a param name
it must keep manually in sync with `redirectToPlatform()` in `auth-flow.ts` - a comment
says so explicitly. A `withAuthGuard()`-style helper that owns both halves of that
contract is the obvious missing piece.

**"Has auth settled?" is now reimplemented twice in the same app.** The `ready` computed
in the guard derives it from `executionState()?.state`, and
`libs/domain/auth/src/lib/services/app-initialized.service.ts` derives the same thing
the same way to gate the whole template. Both reconstruct a primitive the provider does
not expose. This is the second independent witness for the `sessionStatus` idea in the
section above - it is not one app's quirk, it is the same missing signal being rebuilt
wherever someone needs to know whether the startup attempt has finished.

**The `success` state can mean "not authenticated", permanently.** Two separate effects
in `setupBearerQueryRegistry` watch the same auth response: the one created per builder
at registry setup (`bearer-auth-provider.ts:384`) calls `applyTokens`, and the one created
inside `execute()` (line 422) sets `executionState`. Only the first is wrapped in
`try/catch` - when `extractTokens` throws, it logs in dev mode and swallows, while the
second still sets `{ type: 'login', state: 'success', response }`. Verified with a
throwaway spec: with a throwing `extractTokens`, `executionState` reports `success` and
`isAuthenticated()` stays `false` on every subsequent tick, indefinitely.

That combination is fatal for the guard as written. `ready` returns
`authProvider.isAuthenticated()` when the state is `success`, so it never becomes true,
the guard never resolves, and the route never matches - a blank screen whose only trace
is a dev-mode `console.error`. The state machine conflates "the HTTP call returned 2xx"
with "a session exists", and the discriminated union invites exactly the reading the
consumer gave it. Failing token extraction should put the execution into `error`; nothing
about it succeeded.

One claim in that file did **not** reproduce. The comment on `ready` says the tokens are
applied "in a separate effect that can still be pending for one tick after `executionState`
flips to `success`". On a plain login flush, `executionState: success` and
`isAuthenticated(): true` land in the same tick - the token effect is created first at
registry setup and Angular runs effects in creation order, so it always wins. The
`tokenSeed` path applies tokens synchronously before setting the state, too. Whatever the
author actually saw, that ordering is not it, and the extra `isAuthenticated()` condition
is what turns the extraction failure above into a hang instead of a redirect.

## Query audit: already fixed, do not re-report

Four findings were implemented on 2026-08-06 and their sections deleted from this file.
Listed here so the next pass does not rediscover them:

- **Paged stack signal contracts** - `isFirstPageLoaded` is now `loadedMinPage() === 1`, and
  both `canFetch*` signals gate on `stack.anyLoading()` (`paged-query-stack.ts:362`, `:468`,
  `:475`). Changeset `paged-stack-signal-contracts.md`.
- **Web socket room join counting** - `InternalWebSocketRoom.joinCount`, incremented in
  `join()` and decremented in `leaveRoom` (`web-socket-client.ts:203`, `:254`). Also fixes a
  latent prod-mode bug: the old `leaveRoom` fell through its dev-only `throw` and emitted
  `leave-room` for a room that was never joined. Changeset `ws-room-join-counting.md`.
- **Query stack `transform` / `lastQuery`** - the option is typed `(ResponseType | null)[]`,
  and `lastQuery` is recomputed from `finalQueries` after eviction (`query-stack.ts:160`,
  `:294`). Changeset `query-stack-transform-nulls-and-last-query.md`.
- **Bearer auth multi-tab namespacing** - the broadcast channel and the leader lock carry the
  provider's `name`. Not a finding from this file; it surfaced while fixing the others.
  Changeset `auth-multi-tab-namespacing.md`.

Still open above: the devtools stale-failure row (`:691`), the three auth sections (`:758`,
`:845`, `:1022`) and the query-form reset cascade (`:968`).

## A literal NUL byte makes `multi-tab-sync.ts` unreviewable

`libs/query/src/lib/auth/internal/multi-tab-sync.ts:59` builds the dedupe key that `:127`
compares against `lastSyncedState`:

```ts
const tokenState = (access: string, refresh: string) => `${access}<0x00 byte>${refresh}`;
```

The delimiter is a raw `0x00` byte in the source rather than the escape `\u0000`. Choosing NUL
is sound - it cannot occur inside a JWT, so two tokens can never run together into a false
match - but writing it literally costs what the escape does not.

Git classifies the file as binary: `git diff` reports `Bin 4231 -> 4623 bytes` and no hunks, so
nothing in it can be reviewed in a diff, and a merge conflict there cannot be resolved by hand.
Nothing catches it, either - `nx lint query`, `prettier --check` and all 984 tests of
`nx test query` pass with the byte in place. And it renders as nothing in an editor, so a
copy-paste, a reformat, or any tool that normalizes the file drops the delimiter silently; the
comparison at `:127` would then match across different token pairs with no error anywhere.

The fix is runtime-identical: `` `${access}\u0000${refresh}` ``. Prefer `\u0000` over `\0` -
`\0` followed by a digit is an octal escape, which is an error in a template literal, so
`\u0000` survives a later edit that appends to it.

## Two loose ends from the fixes above

`query-stack-transform-nulls-and-last-query.md` is marked `patch`, but widening `transform` to
`(ResponseType | null)[]` breaks consumer compilation: a
`transform: (responses) => responses.map((r) => r.items)` that compiled before now errors on
`r`. The old signature was a lie and the new one is right, so the change should stay - but the
bump belongs at `minor`.

`canFetchNextPage` / `canFetchPreviousPage` now return `false` whenever `stack.anyLoading()` is
true, while `blockExecutionDuringLoading` still defaults to `false` and lets `canFetchNewPage`
(`paged-query-stack.ts:437`) permit the fetch anyway. Under the default config the signals
therefore say no while `fetchNextPage()` would still run. `apps/docs/query/stacks.md:58`
documents the signal half deliberately, and signals-for-UI against methods-for-imperative is a
defensible split - but the two halves now disagree, and nothing states which of them
`blockExecutionDuringLoading` is meant to govern.

## Grid: the resize handles are hard to hit, you move the item instead

In edit mode every pixel of a grid item is a drag target and only a thin border strip is a
resize target. `GridDragDirective` is a host directive of `GridItemComponent`, so a
`pointerdown` anywhere in the item that nothing stops begins a move; the handles opt out of
that by stopping propagation on the `<et-resize-handles>` element
(`grid-item.component.ts:27`). The strips they cover are small: core's
`ResizeHandlesComponent` defaults to `--et-resize-handles-edge-size: 6px` and
`--et-resize-handles-corner-size: 12px`, and two more defaults shrink them further -
`--et-resize-handles-edge-inset: 8px` cuts 8px off each end of the n/s strips, and
`--et-resize-handles-side-bottom: 8px` stops the e/w strips 8px short of the bottom (a default
that exists for the pip window's title bar; pip is the only place that overrides any of these,
and only `--side-top`).

Nothing arbitrates after the pointer goes down. Resize starts on the `pointerdown` itself
(`startResizeGesture` feeds the gesture immediately), while a drag waits for 8px of travel
(`dragGestureFrom`'s default `commitThreshold`) - so missing the strip by one pixel is already
a committed move by the time the item visibly jumps, and there is no path back to resize
short of Escape.

Touch is the one case already handled: a `@media (hover: none)` block in
`resize-handles.component.ts` swaps in `--et-resize-handles-touch-edge-size: 20px` /
`--et-resize-handles-touch-corner-size: 28px`. That leaves the pointer case at 6px/12px, and
it also misses the touchscreen laptop, where the mouse is the primary input so `hover: none`
never matches - `any-pointer: coarse` is the query that covers both.

The invisible target can grow without touching the visuals: the affordance a user aims at is
only the `::after` bar drawn by the grid item (`grid-item.component.ts:90-183`) - 3x24px per
edge, 8x8px per corner, `opacity: 0.2` - which is already smaller than the hit strip, and part
of why aiming is hard is that the bar's ends say nothing about where the strip ends. Two
directions to grow into, with different costs:

- **Outward, into the gap.** The grid's `gap` defaults to 16px (`grid.directive.ts:144`) and
  is dead space today - handles are inset within the item, and neither the grid nor the item
  sets `overflow: hidden`, so negative offsets would work. Cap the growth at half the gap:
  adjacent items are absolutely positioned siblings at the same z-index, so overlapping strips
  would be resolved by DOM order rather than by which item the pointer is nearer, and the
  later item would swallow its neighbour's handle. 8px out per side still triples a 6px edge.
- **Inward** costs content area, and the corners are already contested: `.et-grid-item__actions`
  sits at `top: 4px; right: 4px` and comes after `<et-resize-handles>` in the template, so it
  wins the top-right over the 12px `ne` handle regardless of what that handle's size becomes.

Worth checking against a real pointer before picking numbers - the strips are configurable via
the `@property` custom properties, so the grid can raise them for itself without changing
core's defaults for the pip window.

### Cross-checked against the only real consumer

The partner dashboard in `fut-frontend` is the sole `et-grid` in the app
(`libs/domain/hub/.../partner-detail-grid/`; the platform's `CampaignGridComponent` only
matches on its class name and is a plain CSS grid). It overrides none of the
`--et-resize-handles-*` properties, so it runs on the 6px/12px defaults, on the default 16px
`gap`, with `rowHeight: 60` and breakpoints 1/2/3 columns at 0/636/950px. Four things in it
make the target smaller in practice than the defaults suggest:

- **A 60x32px toolbar sits on the `ne` corner.** `DashboardWidgetToolbarComponent` re-anchors
  `.et-grid-item__actions` to `top: 0; right: 0` and fills it with two `xs` icon buttons
  (2.4rem each) in an `et-grid-item-toolbar` (4px padding, 4px gap). It renders for the whole
  of edit mode, not on hover, and both it and the actions wrapper stop `pointerdown`. So every
  item permanently loses its `ne` handle plus the last 60px of the `n` strip and the top 32px
  of the `e` strip - and on a typical widget (1 col x 2 rows = 136px tall) the east edge is
  down to 96 of its 128 usable pixels.
- **The edit-mode affordance points at the whole perimeter.** The app draws
  `outline: 0.2rem dotted; outline-offset: -0.1rem` around each item in edit mode, so the cue
  is a continuous 2px dotted border 1px inside the box. It says "this whole edge is grabbable"
  when only a 6px band is, and the n/s bands stop 8px short of each end. It also lands directly
  on top of the SDK's own hover hint - the `::after` bars are drawn at a 2px inset in
  `--et-surface-color-solid` at `opacity: 0.2`, which against a solid dotted outline in
  `--et-surface-border-solid` is not a distinguishable marker.
- **Every widget is at its minimum height most of the time.** All three production types set
  `minRowSpan: 2, maxRowSpan: 8` and new widgets are created at `rowSpan: 2`, so
  a correctly-grabbed `n` or `s` handle does nothing at all unless dragged outward. Grab-did-
  nothing and grabbed-the-wrong-thing are indistinguishable to the user, which is part of why
  this reads as "the handle doesn't work" rather than "I missed it".
- **Below 636px the e/w strips cannot do anything.** The `sm` breakpoint is one column, so
  `resizeSpanBounds` clamps `colSpan` to 1..1 - but `resizeEdges()` is a constant eight-edge
  array, so those two strips still exist and still consume the `pointerdown`. Deriving
  `resizeEdges()` from `activeColumns()` would drop them, which is a fix for the aim problem
  in its own right: it hands the whole left and right edge back to dragging.

Inward growth is also more constrained here than it looks. Every widget wraps its content in
`p-4` (16px) and puts an `overflow-auto` scroll region inside that padding, so an `e` handle
grown more than ~10px inward starts covering a scrollbar. Related, and worth confirming
separately: in edit mode a `pointerdown` on one of those inner scrollbars is not stopped by
anything (`blockPointerDownWhenReadOnly` only stops it when the grid is read-only), so dragging
a widget's scrollbar thumb may well move the widget instead of scrolling it.

Net: outward into the gap is the only direction with real room in this app, the `ne` corner is
unrecoverable while the toolbar owns it (the corner handle would have to move, or the toolbar
inset back to the SDK's 4px so the 12px handle is at least reachable), and dropping the dead
edges at `sm` is free.

## Grid: registering a widget forces the consumer to cast

Every entry in the same app's `widgets/widget.ts` is cast, against a local escape-hatch type
the file has to declare and lint-disable for:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WidgetComponent = Type<{ data: InputSignal<any> }>;

{ type: 'text', component: TextWidgetComponent as WidgetComponent, constraints: { minRowSpan: 2, maxRowSpan: 8 } },
```

`GridComponentRegistration<TData = unknown>` declares
`component: Type<{ data: InputSignal<TData> }>` (`grid.types.ts:53`) and the array is used at
its default, so the target is `InputSignal<unknown>`. `InputSignal<T>` is invariant in `T`:
`InputSignalNode<T, TransformT>` carries `transformFn: ((value: TransformT) => T) | undefined`,
which puts `T` in parameter position. So a widget declaring
`data = input.required<DashboardWidgetData>()` is not assignable, and `tsc` says so exactly
there:

```
The types of 'data[SIGNAL].transformFn' are incompatible between these types.
  Type '(value: Payload) => Payload' is not assignable to type '(value: unknown) => unknown'.
```

No amount of care at the call site fixes that - the only ways out are `any` (what the app
picked) or typing every widget's input as `unknown` and casting on each read.

The generic is not earning the cost. Rendering goes through
`[ngComponentOutletInputs]="{ data: entry.item.data }"` (`grid.component.ts:26`), a
`Record<string, unknown>` with no type relationship to the component, and `entry.item.data` is
already `unknown` because `GridItemConfig` defaults `TData = unknown` too. The single check the
declared type performs is "this component has an input named `data`" - and the `any` cast the
type forces is what throws that check away.

It shipped because nothing in-repo exercises it. All three dummy widgets behind the stories and
`apps/docs/components/grid.md` declare `data = input<unknown>()`, which matches
`InputSignal<unknown>` exactly, so the docs snippet is cast-free and no story ever registers a
widget with a real payload type.

The same hole exists on the actions side: `GridItemActionsComponent<TData = unknown>`
(`grid.types.ts:47`) has the identical shape, and the app worked around it the other way -
`DashboardWidgetToolbarComponent` declares `data = input.required<unknown>()` and casts at each
read (`this.data() as DashboardWidgetData`). One type problem, two different workarounds in one
folder.

The fix that fits is a per-entry factory that infers `TData` from the component and erases it,
so the one cast lives in the SDK:

```ts
export const gridComponent = <TData>(reg: GridComponentRegistration<TData>): GridComponentRegistration =>
  reg as GridComponentRegistration;
```

Verified with `tsc`: entries with different payload types coexist in one
`GridComponentRegistration[]`, and a component whose input is named anything other than `data`
is still rejected - the presence check survives, which is more than the status quo manages.

A mapped-tuple generic on `provideGridConfig` would be nicer still (no helper at the call site
at all) and also type-checks, but it only infers from an array literal passed inline, and this
app exports its registrations as an annotated `const` from another module and spreads a
dev-only tail into it. It would also mean `provideGridConfig` can no longer come from
`toProvideFn`, which hands back the definition's non-generic `provide` function verbatim
(`di.ts:139`).

## Grid: the item/state API is there, but the integration can't find it

The rest of the partner dashboard's friction is one theme - `et-grid` already has the API the
app needs, and every piece of it is either misnamed, undocumented, or subtly wrong at the edge
the app hits.

**`initialItems` is a live input that says it isn't.** The effect at `grid.directive.ts:305`
reconciles the input against `itemConfigs` on every change - adds go through `placeItem`,
removals through `removeItem`, and a same-item-set change with different positions restores
`itemConfigs` and rebuilds `layoutOverrides` for every visited breakpoint (its own comment:
"e.g. the host reset its signal to a saved snapshot after the user cancelled edits"). The name
says one-shot, `apps/docs/components/grid.md` shows only `[initialItems]="items()"` and never
mentions reconciliation, so the app concluded the opposite and built around it:

```ts
// `et-grid` consumes its items once via `[initialItems]`, so it can't observe changes to `gridItems`.
// Bumping this counter re-keys the grid's `@for` in the template, forcing a full rebuild after a save.
const gridRevision = signal(0);
```

paired with `@for (revision of [partnerDashboard.gridRevision()]; track revision)` wrapped
around `<et-grid>`. Every widget add, edit or delete therefore destroys and rebuilds the whole
grid - all items re-run their enter animation, and any scroll or focus inside a widget is lost.
Renaming to `items` (keeping `initialItems` as a deprecated alias) and documenting the
reconciliation is most of the fix.

**Two things must be fixed with it, or removing the workaround makes things worse.**

- The reconcile path bails on an empty array (`if (initial.length === 0) return;`), so a host
  that clears its items keeps rendering the old ones. Deleting the last widget is the case that
  hits it - masked today by the re-key, which starts a fresh grid.
- `placeItem` ends in `emitLayoutChange()` (`:870`), so items arriving _from the input_ emit
  `layoutChange` exactly like a user drag. This app treats that event as its dirty flag
  (`pendingLayout.set($event)`, `hasUnsavedLayout = pendingLayout() !== null`) and gates a
  "Discard dashboard changes?" route guard on it - so as soon as the grid observes a server
  refresh instead of being rebuilt, navigating away prompts about changes the user never made.
  Also masked by the re-key: a fresh grid takes the `current.length === 0` branch, which does
  not emit. Either suppress the emit on the input-reconciliation path, or tag the event with
  its origin.

**Cancelling edit mode does not revert the layout.** `toggleEditMode` clears `pendingLayout`
and flips `readOnly` back on, but the grid keeps the positions the user dragged to, so the
screen and the server disagree until a reload. The reconcile comment advertises the snapshot-
reset pattern as the answer, but it cannot work from a computed over unchanged server state:
nothing changed, so there is no new input to react to. `restoreState()` (`:745`) is the actual
answer and is public, but appears nowhere in the docs - nor do `getSerializedState()` or
`addItem()`. Documenting the imperative half of the API, or adding an explicit `resetLayout()`,
is what stops the next integration from re-deriving this.

**The state round-trip loses the item type.** `initialItems` and `layoutChange` both use the
erased `GridItemConfig` / `GridSerializedState`, so what goes in typed comes back `unknown`:

```ts
(pendingLayout?.items as GridItemConfig<string, DashboardWidgetData>[] | undefined) ?? toGridItems(widgets);
```

Threading `TData` through `GridSerializedState` and the directive removes it. Same family as
the registration cast above - the generic parameters exist on the types and are dropped at
every public boundary.

**The documented `createGridAdapter` call does not compile.** `grid.md` shows an object
argument with a two-parameter `toExternal`:

```ts
createGridAdapter<BackendWidget>({ fromExternal: (w) => …, toExternal: (item, position) => … });
```

The real signature (`grid-adapter.ts:8`) takes two positional functions,
`(fromItem: (item: TExternal) => GridItemConfig, toItem: (item: GridItemConfig) => TExternal)` -
no object, and `toItem` gets no position. The app uses `toGridPosition`/`fromGridPosition` and
hand-rolls `toGridItems`/`toWidgetPayload` instead, which is the outcome a wrong snippet
produces. Fix the doc, and reconsider the signature while there: the app's mapping is
per-breakpoint (`sm`/`md`/`lg` at once), which the single-position adapter shape doesn't
express.

**Nothing ties an item's layout keys to the configured breakpoints.** `GridItemConfig.layout`
is `Record<string, GridItemPosition>` and `assertValidItemConfigs` (`:792`) only checks for
duplicate ids; a missing breakpoint entry silently becomes `{ col: 0, row: 0, colSpan: 1,
rowSpan: 1 }` in two places. The app hand-writes all three keys and then still guards with
`item.layout['sm'] ?? fallbackPosition('sm')` on the way back out. Cheap fix: assert coverage
of the configured breakpoint names in the dev-mode check. Real fix: a `TBp extends string`
parameter on `GridItemConfig` so `[breakpoints]` and the items have to agree.

## Grid: span constraints are global, but every breakpoint has its own column count

`minColSpan: 2` against a one-column `sm` breakpoint is not expressible today - constraints are
one flat `{ minColSpan, maxColSpan, minRowSpan, maxRowSpan }` per registration (or per
`et-grid-item`), while the column count is per breakpoint. The grid already knows this is
wrong, and papers over it in four places, each differently:

- `placeItem` clamps on the way in: `colSpan: Math.min(constraints.minColSpan, bp.columns)`.
- The breakpoint effect refuses to enforce min at all after a breakpoint switch, with a comment
  explaining that doing so would fight `registerConstraints`.
- `resizeSpanBounds` clamps min against a max that is itself clamped to the column count, so a
  pointer resize bottoms out at 1.
- `registerConstraints` passes an unclamped `Math.max(pos.colSpan, minColSpan)` to `autoPlace`,
  which happens to clamp it internally (`layout-engine.ts:122`).

The fifth path does not. `clampPosition` applies the minimum _after_ the column clamp:

```ts
const colSpan = Math.max(constraints.minColSpan, Math.min(constraints.maxColSpan, position.colSpan, columns));
```

so `minColSpan: 2` at one column yields `colSpan: 2` - an item wider than the grid. All three
callers inherit it: `moveItem` (`:708`, the Ctrl+arrow keyboard path), `updateResize` (`:584`)
and the live `layout` computed that renders a drag in progress (`:241`). The SDK's own `Default`
story can reach it - the chart registration asks for `minColSpan: 3` while the default `sm`
breakpoint has two columns.

So the invariant "a minimum span cannot exceed the breakpoint's columns" is enforced four times
by accident and violated once. Fixing that is the prerequisite, and it belongs in one place:
`resolveItemConstraints` (`grid.directive.ts:102`) is already the single merge point for
registration and per-item constraints, and it does not currently take the column count. Give it
the active columns, clamp `minColSpan` (and `maxColSpan`) there, and the ad-hoc clamps at the
other four sites become redundant rather than load-bearing.

That alone makes the common case behave: `minColSpan: 2` degrades to full width at a
one-column breakpoint, which is what anyone writing it means. Per-breakpoint constraints are
then the smaller, additive step for what clamping cannot express - "two columns at `md` but
full width at `sm`", or a different row minimum where the layout is stacked. Additive shape,
base plus overrides, rather than a union that has to be discriminated:

```ts
constraints?: Partial<GridItemConstraints> & {
  perBreakpoint?: Record<GridBreakpointName, Partial<GridItemConstraints>>;
};
```

Two things to settle while designing it. `resolveItemConstraints` currently returns
`{ ...DEFAULT_CONSTRAINTS, ...registration.constraints }` and **returns early** when a
registration exists, so a registered type's constraints cannot be refined per item - the
`et-grid-item` `minColSpan`/`maxColSpan`/`minRowSpan`/`maxRowSpan` inputs are silently ignored
for any item whose type is registered. And the resolved value is currently breakpoint-
independent, so once it varies by breakpoint, `registerConstraints`' first-registration
re-placement and the breakpoint-switch effect both need to re-resolve on a breakpoint change
instead of reading a cached registry entry.

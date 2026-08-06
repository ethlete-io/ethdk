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

### The sync channel and the leader lock are global constants

`channelName` defaults to `'ethlete-auth-sync'` and the Web Locks name is the
module constant `'ethlete-auth:leader'` (`leader-election.ts`), neither derived
from the provider's `name`. All four `fut-frontend` providers call
`withBearerAuthMultiTabSync()` with no `channelName` - while every one of them
_does_ namespace its cookie by hand (`hub_`, `platform_`, `toty_`, `voting_`),
which is the same problem solved once at the call site because the SDK doesn't
solve it. Two providers reachable from one origin would share a token channel
and elect one leader between them. Default both names off the provider `name`
that is already required.

## Auth: the provider's execution model is what makes the app's flow brittle

Second pass, this time on why `fut-frontend` needs 250 lines of `combineLatest`
over router state and `executionState` (`libs/domain/auth/src/lib/auth-flow.ts`)
to keep a session coherent. The defensive shapes in there - a `debounceTime(1)`,
a `hasAttempted` latch in `dev-login-view.component.ts`, a special case for a
"stale `logout` state" - are all downstream of one thing: `setupBearerQueryRegistry`
in `bearer-auth-provider.ts` treats every auth execution as fire-and-forget and
funnels all of them through single mutable slots.

### Every auth execution leaks a query, an injector and a repository entry

`execute()` (`bearer-auth-provider.ts:404`) calls
`builder.config.queryCreator({ onlyManualExecution: true, injector })` per call,
where `injector` is the provider's - i.e. the root one. `setupQueryDependencies`
gives each query its own child `EnvironmentInjector`, destroyed only when the
_scope_ destroyRef is (`query-dependencies.ts:78`), and nothing ever destroys the
query. The `effect()` registered inside `execute()` to mirror that snapshot into
`executionState` is bound to the same injector, so it outlives its own execution
too.

So one login attempt, or one token refresh, permanently adds: a child injector, a
query object, a live effect that still writes `executionState`, a devtools
registry entry (`base-query-factory.ts:283` unregisters on a `DestroyRef` that
never fires here - the mirror image of the vanishing-row problem above), and a
repository cache entry whose consumer never unbinds. The refresh query runs every
~45 minutes, and each 401 can trigger another, so this is not a rounding error in
a long-lived tab.

The retained cache entry is the part that bites hardest, because it holds the
request body and the response body: the login POST keeps the username and
password, the refresh POST keeps a refresh token and the tokens it was exchanged
for, indefinitely. `MAX_UNUSED_ENTRIES` cannot reclaim any of it - the entries
still have a consumer.

Fix: an auth execution should own its query and destroy it when it settles (or
reuse one query per builder key and re-execute it, which is what the per-key
`querySnapshot` signal already implies). Either way the per-execution `effect`
has to go with it.

### `refreshQueriesInUse()` replays every past login and token refresh

Both auth builders clone their creator with `subtle: { useQueryRepositoryCache: true }`
(`bearer-auth-query-builders.ts:141` and `:302`) so the POST gets a real cache
key. But `QueryRepository.refreshInUse` uses that exact flag to decide what is
safe to re-fire - its comment reads "Re-firing a mutation would be a side effect
nobody asked for, so only reads are refreshed - 'read' meaning cacheable". The
flag means "cache me" to one caller and "you may re-run me" to the other, and the
auth queries end up on the wrong side of it. Combined with the leak above - every
past auth execution still has a consumer - `client.refreshQueriesInUse()`
re-fires all of them.

`fut-frontend` calls exactly that, on the same client the auth provider is
attached to, whenever preview mode is toggled
(`libs/domain/voting-public/shared/src/services/preview.provider.ts`), and its
comment states the assumption the SDK breaks: "it re-runs every bound
`GET`/`HEAD`/`OPTIONS`". What actually happens is a replay of the login POST with
the old credentials and of the refresh POST with a long-spent refresh token. That
second one 401s, the still-alive per-execution effect sets
`{ type: 'tokenRefresh', state: 'error' }`, and the app's own refresh-failure
handler logs the user out. Toggling preview mode can end the session.

Two candidate fixes, and the first is worth doing regardless: make `refreshInUse`
skip anything whose method is not a read, so the docstring becomes true and the
flag stops carrying two meanings. Then, if the auth queries still need to opt out
of a URL-scoped invalidation, give them an explicit `subtle.neverAutoRefresh`
rather than inferring it.

### Tokens and `executionState` can disagree about which attempt won

There are two writers per builder key. The shared effect at
`bearer-auth-provider.ts:384` watches the per-key `querySnapshot` signal - which
only ever holds the **most recently executed** snapshot - and calls `applyTokens`
from it. Each execution's own effect (`:422`) writes `executionState` from **its
own** snapshot, whichever settles last. Two overlapping executions therefore
resolve differently: the last one executed decides which tokens are applied, the
last one to come back decides what `executionState` reports. A 401 burst across
several secure queries, or a login submitted while an auto-login is still in
flight, is enough to produce it.

That is the race the app is defending against without naming it. The fix is for an
execution to be a value rather than a side effect on shared slots: token
application and state reporting should both read the snapshot the execution
returned, and a superseded execution should be abandoned explicitly (or the
provider should refuse to start a second one for the same key while one is in
flight - a single-use refresh token cannot be spent twice anyway).

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

## Paged query stack: two of its public signals do not mean what they say

`createPagedQueryStack` (`libs/query/src/lib/http/paged-query-stack.ts`) is the pagination
primitive behind infinite scroll and "load more". Two of the six signals it exposes disagree
with their own JSDoc, and the existing spec cannot see either problem because every test in
`paged-query-stack.spec.ts` starts at page 1 and never asserts anything while a request is
in flight.

### `isFirstPageLoaded` is a tautology

`isLastPageLoaded` (`:365`) is `loadedMaxPage() === max.totalPages` - a real question, with
`totalPages` coming from the server. `isFirstPageLoaded` (`:359`) is
`loadedMinPage() === min.currentPage`, and those two are the same number by construction:
`loadedMinPage` _is_ the page the first query in the stack fetched, and `min.currentPage` is
that same query's response echoing it back. It answers "does the server agree with our
bookkeeping", not "is page 1 loaded".

Verified with a throwaway spec (added, run, deleted). Starting at `initialPage: 5` with a
`{ currentPage: 5, totalPages: 10 }` response:

- `isFirstPageLoaded()` → `true`
- `canFetchPreviousPage()` → `true`
- `items()` → `[{ id: 50 }]` - page 5 only

So the stack simultaneously reports that the first page is loaded and that a previous page
can be fetched, while holding exactly one page that is not page 1. The fix is the mirror of
its sibling: `loadedMinPage() === 1`.

### `canFetchNextPage` / `canFetchPreviousPage` never look at `loading`

Both JSDoc blocks (`:230`, `:237`) promise "this will be false if the paged query is already
at the first/last page **or if the paged query is loading**". Neither implementation (`:465`,
`:472`) reads `stack.anyLoading()` or any other loading signal - the loading half of the
contract simply is not there.

It looks correct in the common case by accident. While a _new_ page is being fetched, the
freshly created query has no response yet, so `maxPagination` / `minPagination` fall to `null`
and both signals short-circuit to `false`. That coincidence disappears the moment a response
already exists, because a re-executing query keeps its previous response
(`apps/docs/query/caching.md:32`). Verified with the same throwaway spec: after settling page
1 of 3 and calling `stack.execute()` to refresh, `loading()` is `true` and `canFetchNextPage()`
is still `true`.

`blockExecutionDuringLoading` does not help - it gates the internal `canFetchNewPage` guard
(`:426`), not the two public signals a template binds to. A "load more" button driven by
`canFetchNextPage()` therefore stays live through a refresh, and the devtools story already
writes the pattern that trips on it
(`query-devtools-storybook.component.ts:326`: `if (canFetchNextPage()) fetchNextPage()`).
Either add the loading term to both signals or drop the sentence from both JSDoc blocks; today
the two disagree.

## Web socket rooms: the first unmount kills the room for everyone else

`createWebSocketClient` (`libs/query/src/lib/ws/web-socket-client.ts`) keeps one
`rooms` map (`:155`) for the whole client, and `join()` (`:192`) deliberately shares: a second
caller joining a room that already exists gets the _existing_ room object back rather than a
new one, so both subscribers read the same `latestMessage`. That sharing is the intended
design. The teardown never learned about it. `joinRoom`'s `onDestroy` (`:230`) calls
`leaveRoom`, and `leaveRoom` (`:242`) unconditionally emits `leave-room` to the server and
does `rooms.delete(room)`. There is no reference count anywhere - N joiners, and the first one
to unmount evicts the room for all of them.

Verified with a throwaway spec (the ws client has **no spec of its own** - `libs/query/src/lib/ws`
ships only the client, its errors and a barrel). Two subscribers join `match-42` through
separate injectors:

- both receive the first message
- subscriber A's injector is destroyed → one `leave-room` reaches the server
- a second message for `match-42` arrives → subscriber B is still mounted, still holding a
  live room handle, and still reads the **first** message

B is silently dead. Nothing throws, nothing logs, and `latestMessage` keeps serving a stale
value, so a match view that happens to be the second one opened just stops updating. The
emitted traffic shows the asymmetry directly: two `join-room` frames, one `leave-room` that
undoes both.

The fix is a join count per room - increment in `join()`, decrement in `leaveRoom`, and only
emit `leave-room` plus delete the map entry when it reaches zero. The reconnect handler
(`:257`) already iterates `rooms.keys()` to re-join everything, so it picks up the corrected
lifetime for free.

Minor, same function: the `!rooms.has(room)` branch in `leaveRoom` throws in dev mode but has
no `return`, so in production a `subtle.leaveRoom()` for a room that was never joined falls
through and emits a `leave-room` frame anyway - potentially evicting a room another part of
the app is using.

## Query stack: a lying `transform` signature and a `lastQuery` that can point at a corpse

Two independent problems in `createQueryStack` (`libs/query/src/lib/http/query-stack.ts`), the
base every paged stack is built on. Both verified with a throwaway spec (added, run, deleted).

### `transform` is typed as if responses were never null

`transform` is declared `(responses: ResponseType<QueryArgsOf<TCreator>>[]) => TTransform`
(`:160`) - a non-nullable array. What it actually receives is
`queries().map((q) => q.response())` (`:391`), and `response()` is null for any query that is
loading or errored. The same file says so 100 lines earlier, in the doc for the `response`
signal (`:60`): "Will be `null` for queries that are loading or errored."

Verified: a stack with one in-flight query calls `transform` with `[null]`.

Both shipped transforms already work around it - `transformArrayResponse` (`:192`) and
`transformPaginatedResponse` (`:196`) each open with `.filter((r) => !!r)`. That filter is the
tell: the author knew nulls arrive, but the type never learned. Anyone writing a custom
transform against the signature - `(responses) => responses.flatMap((r) => r.items)` is the
obvious one, and it is exactly what `transformPaginatedResponse` does after filtering - gets a
`TypeError` on the first render, before any request settles. The fix is one `| null` in the
option's type; the two built-ins are already correct and the default `TTransform`
(`(ResponseType<TArgs> | null)[]`, `:81`) already admits null, so only the callback's input
type is wrong.

### `maxQueries` with `removeStrategy: 'newest'` leaves `lastQuery` dangling

The eviction block (`:282`) destroys the excess queries and rewrites `finalQueries`, but
`lastQuery.set(lastAppendedQuery)` (`:295`) runs afterwards with the value `appendFn` returned
_before_ the eviction. Under `removeStrategy: 'newest'` the query just appended is by
definition the newest, so it is the one evicted - and `lastQuery` is then set to it.

Verified with `maxQueries: 2`, `removeStrategy: 'newest'`, appending pages 1, 2, 3:

- `queries()` → `[{ page: 1 }, { page: 2 }]`
- `lastQuery()` → `{ page: 3 }` - destroyed, and not a member of `queries()`

Every consumer that reaches through `lastQuery` is then reading a torn-down query.
`createPagedQueryStack` derives `maxPagination` from `stack.lastQuery()?.response()`
(`paged-query-stack.ts:342`), so a paged stack configured this way would compute its pagination

- and therefore `canFetchNextPage`, `isLastPageLoaded` and the guard in `fetchNextPage` - from a
  query that no longer exists. It does not pass `maxQueries` today, which is the only reason this
  is latent rather than shipped.

`lastQuery` should be recomputed from `finalQueries` after eviction, the way the non-append
branch already does it (`:337`: `finalQueries[finalQueries.length - 1] ?? null`). Worth asking
separately whether `removeStrategy: 'newest'` earns its keep at all - it makes an append a no-op
that destroys the thing it just built.

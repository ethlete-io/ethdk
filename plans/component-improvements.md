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

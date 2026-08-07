# Existing components: improvement backlog

Shower-thought pass over Storybook/mobile UX, written down 2026-08-05 and
checked against source in `libs/components/src/lib/{scheduler,accordion,
avatar,badge,button,copy-button,description-list,filter-overlay,forms}`,
`libs/core/src/lib/{theming,utils/swipe.ts}` and `libs/query/src/lib/
{paged-query-stack.ts,legacy/infinite-query}`. Unprioritized backlog, same
spirit as the older `opportunities.md` pass - pick items into real plans as
needed. To be continued; this pass didn't reach every domain.

`opportunities.md` (research from 2026-07-23) was merged into this file on
2026-08-06 and deleted - its live items are the four cross-cutting sections at
the end (platform modernization, DX/tooling, the removal checklist, tech debt),
its shipped work is recorded under "Already fixed", and its don't-rebuild list
was folded into "Already covered". `plans/component-improvements-triage.md` is
the ranked view of everything here.

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

## Query devtools: the Queries list repeats the same query

Noted from real use 2026-08-07. The Queries tab lists the same query two or more times,
because the same query gets used by several consumers in one rendered context and the
registry keeps **one entry per instance** - `registerEntry` derives ids from a descriptor
(`query|<client>|<method>|<route>`) plus a per-descriptor counter, so N instances of the
same route are N rows by design. The list is what should hide that, not the registry: the
ids have to stay one-per-instance for the detail pane, pinning, tombstones and
reload-restore to keep working.

Proposal to evaluate: a **"network only" chip, on by default**, leaving only the instances
that actually issued a request - so the repeats that only read a shared cache entry drop
out of the default view, and the chip can be turned off to see every consumer. Two things
to settle first:

- **There is no per-entry "did this instance request" flag today.** No `fromCache` /
  request-count lives on `QueryDevtoolsEntry`; the closest signals are the event log's
  `request-success` / `request-error` events and `query-devtools-stats.ts`'s response
  history. Whether an instance can be attributed cheaply and reliably decides if this is
  `S` or bigger.
- **Every existing chip widens** (`matchesFacets` is an OR, and the counts are computed
  before the active chips apply). A default-on chip that _narrows_ is a different kind of
  control - it likely wants to sit apart from the status chips rather than join them, and
  `isQueryListNarrowed` / `scopedQueryCount` have to keep telling the truth about a list
  that is narrowed before the user touches anything. Alternative worth weighing: collapse
  same-descriptor rows into one row with an instance count, which needs no new signal at
  all and loses nothing.

## Query devtools: locate the selected query in the app

Noted 2026-08-07, alongside the repeats item above - the same confusion is what makes both
worth doing. Inspect only runs one way today: arm it, hover an element, and the list is
filtered to that element's queries (`updateInspectHover` walks up from `event.target`
through `elementQueryMap`, keyed on `entry.meta.element`). The reverse - a **"locate" button
on the selected query** that points at roughly where it lives - does not exist.

**The data is already there and works in prod.** `entry.meta.element` is the creating
injector's `ElementRef` (`query-dependencies.ts` reads `hostInjector.get(ElementRef, null,
{ optional: true })`), not a debug API - so locate is the same `elementQueryMap` read
backwards: scroll the element into view and draw the hover box (`inspectHover` already
holds a `{ rect, entries }` pair and the CSS for it, `.et-query-devtools-inspect-box`,
already exists). That makes this small. What to settle:

- **`element` is nullable, and null is common.** A query created outside a
  component/directive injector - a root service, a resolver, anything in the root injector -
  has no host element. The button has to be absent or disabled with a reason, not silently
  do nothing.
- **The element can be gone or invisible** - detached, `display: none`, inside a collapsed
  panel, or outliving the query's own tombstone. Locate needs a "couldn't find it on screen"
  state; `checkVisibility()` plus the existing rect drawing covers the cheap version.
- **A component's host element is a rough answer by construction** - it is where the query
  was _created_, which is not necessarily where its data is rendered. Say so in the label
  ("created here"), so nobody reads it as the consumer.

**On hooking Angular DevTools metadata:** only as an enhancement, never as the mechanism.
Angular's debug APIs (`ng.getComponent()` and friends) are dev-mode only, and the devtools
panel is explicitly meant to work in a production build - where component class names are
mangled anyway. If it is used at all, it can only enrich the label when available and must
degrade to the element rect otherwise.

## Query system: long polling

Noted 2026-08-07. `@ethlete/query` has three ways to get fresh data and none of them is long
polling: `withPolling` is a fixed `setInterval` clock (`query-features.ts`), `withAutoRefresh`
re-executes when a signal changes, and websockets (`libs/query/src/lib/ws` + `withResponseUpdate`)
push. Long polling is a fourth shape - the server holds the request open until something changes
or its own timeout fires, and the client re-issues the moment it completes. **`setInterval`
cannot express that**: a request open for 30-60s under a 5s interval stacks ticks, so this is a
new feature, not an option on `withPolling`.

What it needs, roughly in order of how much design each one wants:

- **A completion-driven chain.** The next execution starts when the previous one _ends_ -
  success, "nothing changed", or error - not on a clock. Nothing in the feature set chains off
  completion today; the closest precedent for a chain of executions is `paged-query-stack.ts`.
- **Next-args-from-last-response.** A long poll normally carries a cursor / `since` / etag from
  the response into the following request. `withArgs` pulls args from a signal source and
  `withResponseUpdate` writes the response back, but nothing derives the _next args_ from the
  _last response_. This is the actual new primitive, and it is useful well beyond long polling.
- **An empty cycle has to be a no-op.** A 204 / "nothing changed" must not overwrite the cached
  response, must not move the cache entry's freshness, and must not re-render. Related: the
  query has to stay out of a loading state across cycles, or a consumer shows a spinner for a
  minute at a time - `state.loading` is bound straight to the live request, so a "background
  poll" notion is needed for this to be usable in UI at all.
- **Backoff vs. re-issue.** `withDefaultRetry` already retries connection failures indefinitely
  and 5xx up to three times with a backing-off delay. Decide whether the chain sits above or
  below that layer, so a dead server backs off instead of hot-looping - and so a normal
  re-issue is not mistaken for a retry.
- **No request timeout exists client-side.** I found no per-request timeout in the http layer,
  so an abandoned long poll has nothing to cut it off. A client-side ceiling is new work.
- **Multi-tab dedupe works differently.** `withPolling`'s Web Locks dedupe lets a follower tab
  keep its interval and skip each tick. A chained long poll has no tick to skip - a follower has
  to not open a request at all and take data through response sharing, so the hold logic in
  `withPolling` is not reusable as-is.
- **Devtools will misread it.** One cycle is an open request for up to a minute: the timeline
  and stats would show it as a very slow request, and the events log grows an entry per cycle.
  Both need to know a poll cycle is not a slow request.

Positioning is worth writing down with it: websockets already exist and are the better answer
when the infrastructure allows them. Long polling is the fallback when they don't - the docs
should say which to reach for (`apps/docs/query/features.md` for the feature,
`apps/docs/query/ws.md` for the socket side).

## Overlay responsiveness: resolved, and it was not systemic

The premise of this section was wrong; recorded here so the next pass does not
re-open it. Of the "three that don't", only one was ever a gap:

- `rich-text-editor-floating-toolbar.directive.ts` **never opens on touch at all**
  (`if (hasTouchInput()) return null`, with the reasoning in a doc comment: the
  platform's own selection menu covers the same space, and the static toolbar
  covers formatting there). It is a pointer-device-only enhancement, so a
  breakpoint would have nothing to swap to.
- `rich-text-editor-triggers.directive.ts` is a caret-anchored autocomplete that
  stays live while typing (`autoFocus: false`, repositioned per keystroke). A
  bottom sheet lands under the keyboard and a top sheet with a backdrop blocks the
  editor it is completing into - anchoring to the caret is the requirement, not an
  oversight.
- `menu.directive.ts` stays anchored **by decision** (2026-08-06). The reasoning:
  the finger is already at the trigger, so an anchored menu opens where the hand
  already is, while a sheet forces the whole reach down to the bottom of the
  screen. The iOS fly-in action sheet was the appealing precedent, and Apple
  dropped it - nested menus were the thing that broke. Same category as
  `select.directive.ts`: deliberate, not missing.

The scheduler's edit surface - the one real gap - shipped; see "Already fixed".

## Duplicated pointer-drag logic: carousel

Slider and rating shipped onto `dragGestureFrom` (see "Already fixed"). Carousel is the
remaining reimplementation, and a more distinct one: `cursor-drag-scroll.ts` (behind
`ScrollableDragDirective`, opt-in for mouse-drag-to-scroll) hand-rolls its own
`mousedown`/`mousemove`/`mouseup` pipeline with its own deadzone concept - carousel's touch
path needs no gesture code at all, since touch scrolling there is native CSS scroll-snap. Its
deadzone/threshold semantics differ enough that it may not fold in cleanly; folding it in is a
separate call, not a follow-up to the slider/rating pass.

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

From the merged `opportunities.md` pass, these were checked in 2026-07-23 and
already exist - don't propose them as new components: date-range picker,
segmented control, loaders, popover-as-API (the overlay system), rating, switch,
banner/inline alert, avatar (+ group), card, badge, empty state, description
list, copy-to-clipboard button (`copy-button`), stepper/progress-steps.
**Back-to-top** belongs here too: `floating-action`'s generic floating trigger
already covers it.

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

## Password input: caps-lock warning stays on after the key is released

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

**Blocked on a human at a Mac keyboard (checked 2026-08-06).** No automated
route can settle it: a synthetic CapsLock keyup - WebDriver, CDP,
`adb shell input`, whatever - always reports the post-toggle modifier state
correctly, because the quirk being reported is in how macOS delivers the
_physical_ key, not in how the DOM handles the event. Driving the team Mac
over LAN does not help either: `verify-on-apple-devices` reaches its iOS
Simulator and the iPad, neither of which has a Mac's CapsLock. So this needs
someone to press the key on a Mac and say what happens - anything else would
be a fix designed against a guess.

No duplication elsewhere - `otp-input` and every other password-adjacent
control have no caps-lock logic of their own; `password-input` owns this
exclusively.

## Storybook structure

Every story sits under a flat `Components/<Name>` (or `Components/<Domain>/
<Name>`) - nothing groups categories like Forms/Overlays/Data-display as
siblings above `Components`, which is the likely source of the "big dump"
feeling. The two misplaced titles found this pass are fixed (see "Already
fixed"). Whether `Components/*` should gain real top-level categories at
all is the part still open - a bigger, separate call, and one that moves
every story id the docs site embeds.

## Auth: `excludeRoutes` invites string matching

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

## Already fixed, do not re-report

Implemented on 2026-08-06, sections deleted from this file. Listed so the next pass does
not rediscover them.

The three auth items the triage opened with (2026-08-06, one pass):

- **`sessionStatus()` + `sessionEndCause()`** - `unknown | restoring | authenticated | anonymous`,
  and `logout(cause?)` with `user | inactivity | expired | otherTab`. Added _alongside_
  `executionState`, which keeps its shape: splitting it would have been a breaking change to a
  signal that still has a real job (which auth query is running, how did it end). What moved out of
  it is only the session-level question. The load-bearing detail is that `sessionStatus` reaches
  `anonymous` **during provider construction** when nothing tries to restore - that is the case
  `executionState` could never answer, because with no cookie it stays `null` forever.
  `withTracking`'s `logout` event gained `{ cause }` at the same time.
- **The cross-key race** - fixed by a provider-wide execution id: only the most recently started
  token-issuing execution applies tokens or writes `executionState`, and a revocation is exempt
  (`id: null`). The second half matters as much as the first: an _automatic_ refresh now refuses to
  start while any token-issuing execution is in flight (`hasTokenIssuingExecutionInFlight`), so a
  login already under way is never superseded by a refresh that began after it. Without that, plain
  "last started wins" would have silently dropped a successful login whenever a stray 401 fired.
  A manual `queries.refresh.execute()` is explicit intent and still runs.
- **The snapshot-vs-`executionState` docs fix** - `apps/docs/query/auth.md` now has a "Don't drive
  a form off `executionState()`" section. No API was needed; `queries.<key>.snapshot` already was
  the per-attempt path.

**Auth: `createAuthGuard`** (2026-08-07) - `libs/query/src/lib/auth/auth-guard.ts`. The SDK shipped
no `CanMatchFn`/`CanActivateFn` at all, so every app hand-rolled "wait for auth to settle, redirect to
login, come back to the attempted URL" and kept the return-URL param name in sync with its own login
page by hand. `createAuthGuard(providerRef, config)` returns both halves off one param:
`canMatch`/`canActivate`, their `…Anonymous` inverses for the login route, `returnUrl()` and a cold
`navigateAfterLogin()`. Three things worth not rediscovering. **The wait is on `sessionStatus()`, not
`executionState()`** - the guard pends only while `'unknown' | 'restoring'`, which is why a visitor
with no cookie answers synchronously instead of waiting for a state that never arrives. **The
attempted URL is captured before the wait**, because by the time the session settles
`router.currentNavigation()` has moved on. And **the return URL is not hand-encoded** - Angular's URL
serializer encodes the query param and parses it back, so the consumer's `encodeURIComponent` /
`decodeURIComponent` pair was double work; what is needed instead is rejecting a captured URL that
does not start with `/`, or starts with `//`.

One claim in the consumer's guard did **not** reproduce, and the replacement deliberately drops it.
The comment on its `ready` says the tokens are applied "in a separate effect that can still be pending
for one tick after `executionState` flips to `success`". On a plain login flush, `executionState:
success` and `isAuthenticated(): true` land in the same tick - the token effect is created first at
registry setup and Angular runs effects in creation order, so it always wins. The `tokenSeed` path
applies tokens synchronously before setting the state, too.

**Form field: one suffix stack** (2026-08-07) - the clear button and picker trigger of date /
date-time / date-range / time input, the phone input's clear button and the password input's reveal
toggle now render inside `.et-form-field-suffix`, ahead of the consumer's `[etInputSuffix]` and the
busy spinner. Content projection cannot go child → ancestor, so the route is a registration: a
`ng-template[etControlSuffix]` partial (`form-field/partials/control-suffix.directive.ts`) sets
`FormFieldDirective.registeredControlSuffix`, and the field renders it through `ngTemplateOutlet`.
With no field to hand it to the directive renders the template where it stands, which is what keeps a
standalone control working. Four things worth not rediscovering. **The phone input's barrier was too
broad** - its component-level `viewProviders: [{ provide: FORM_FIELD_TOKEN, useValue: null }]`, there
to stop the nested country `[etSelect]` registering as the outer control, also hid the field from the
phone input's _own_ template, so its suffix silently self-rendered in place. It is now a
`[etFormFieldBarrier]` directive on the country picker div - narrow enough that the rest of the
template still reaches the field, which is also what any future control-inside-a-control will need.
**The affix's dim moved from the box to its children**: `opacity` on `.et-form-field-affix` is a group
opacity no child can raise itself out of, so it now targets
`> :is([etInputPrefix], [etInputSuffix], .et-form-field-busy-spinner)` - projected content and the
spinner recede, a control's own affordances do not. The affix also gained
`gap: var(--et-form-field-control-affix-gap)`, without which the clear and the trigger touched (their
8px used to come from the control's own host) - and because that token is size-scoped, their spacing
now tracks the field's `size` (6/8/10px) instead of being pinned at 8px. And the CSS deduped: the five identical `-clear`
blocks and four identical `-picker-trigger` blocks are one
`FormFieldControlSuffixStylesComponent`, mounted by `date-picker-input.directive.ts`,
`date-range-input.directive.ts` and `phone-input.directive.ts` - a **breaking** rename to
`.et-input-clear` / `.et-input-picker-trigger`. Verified in Storybook across all six controls:
stack order, opacity, 16px icons, 8px gap, the trigger's -14px hit area, the focus ring, the
enter/leave keyframes, and that clear still clears while keeping focus.

**Selection card: one presentation instead of three** (2026-08-07) - `SelectionCardStylesComponent`
(`libs/components/src/lib/forms/selection-card-styles.component.*`), mounted via
`injectStyleManager()` by all three of `et-radio`, `et-checkbox-option` and `et-choice-field` when
the variant is `card`. The hook is a **class**, `.et-selection-card`, not three per-component
`[data-variant='card']` selectors - which is what let the choice field join rather than keep a
parallel file. Three things are worth not rediscovering. The panel is the **host** for the two
options and a **child div** for the choice field, so every state guard is a union
(`:where([aria-checked='true'], :has(:is([aria-checked='true'], [aria-checked='mixed'])))`); the
inapplicable branch is inert, not wrong. The two rules that reset the plain variant's control
(`transform: none`, `outline: none`) must stay **outside `:where()` and keep chained `:not()`s** -
collapsing them to `:not(a, b)` drops a class column and hands the win back to the plain rule. And
the choice field keeps a small file of its own for what only a wrapper needs (the stretched hit
area, the one-unit dim, `width: auto`), but no token names of its own. Tokens are now
`--et-selection-card-*` - a **breaking** rename of all three old sets. Verified by diffing computed
styles across 15 story/state combinations (card + plain, disabled, readonly, checked,
hover, active, for radio / checkbox-option / choice-field-checkbox / choice-field-switch): identical
before and after.

Note the bundle claim is narrower than the original write-up assumed: the styles component is a
static import, so the CSS is still in the bundle for anyone importing radio at all. What the move
buys is one copy instead of three, one token set, and no injection into the document for an app
that only uses `variant="plain"`.

**Badge: `size` + icon slot** (2026-08-06) - `size` is `sm | md | lg`, and the icon slot is
button's exact pattern (`<ng-content select="[etIcon]" />` through an `ngTemplateOutlet`, so one
projected icon can render on either side), with `iconAlignment` alongside it. Two things worth not
rediscovering. The stylesheet emits **no `md` block** - `md` _is_ the `@property` initial values,
and because the badge tokens are `inherits: true`, emitting one would put a rule on the element
that beats an ancestor's `--et-badge-font-size` override. Button does emit its `md` block and has
that flaw. And the badge's `variant` handling was already correct; the "no `size`" gap was the only
real one - tooltip/toggletip compose as directives on the badge today and needed nothing.

From the merged `opportunities.md` (its "New components", "DX / tooling", "Next major" and
"Tech debt" sections were almost entirely shipped). Each note below is kept for the premise
that turned out to be wrong, which is the part worth not rediscovering:

- **Tree view** (2026-08-05) - `et-tree` + headless `[etTree]`. The premise was wrong:
  `cascader-tree.ts` was already public, and it is only a data-source contract - no expand
  state, no focus model, no rendering. The tree defines its own structurally identical
  `TreeDataSource`, so one source object drives both without coupling the domains.
- **Toolbar** (2026-08-05) - `et-toolbar` + headless `[etToolbar]`; the RTE's static toolbar
  dropped ~78 lines adopting it. `et-grid-item-toolbar` was left alone (a visual wrapper, no
  `role="toolbar"`, no keyboard model). The RTE's floating toolbar is `role="toolbar"` but every
  button is `tabindex="-1"` by design, so it needs no roving focus.
- **Divider** (2026-08-05) - `et-divider`. Premise wrong again: the other sites it named (tabs,
  split-button, select-option-group, select-panel, overlay-container) are borders on structural
  elements, not separators, and were left alone.
- **Kbd** (2026-08-06) - `et-kbd`, platform-aware glyphs, `KBD_PLATFORM`. Neither existing
  shortcut site became an adopter: `et-menu-item-shortcut` is a trailing _slot_ (it also carries
  the submenu chevron), and the devtools' caps are deliberately isolated (`ShadowDom`, its own
  `--_et-qdt-*` chrome). What did consolidate is the Apple detection both hand-rolled.
- **Timeline** (2026-08-06) - `et-timeline` + `et-timeline-item`. Deliberately vertical only: a
  horizontal connected row is what `et-progress-steps` already is. No state enum, for the same
  reason - `complete`/`current`/`upcoming` belongs to a process, not a history. Worth
  remembering: drawing the connector below each marker segments the rail, because the marker box
  pads the dot; each item's line spans from its own marker's centre to the item's bottom instead.
- **Component scaffolding generator** (2026-08-05) - `nx g @ethlete/components:component <name>`.
  Self-registration was left out: it only applies to sub-directives, which a fresh domain has none of.
- **`core/seo.directive.ts` deleted** (2026-08-05), with a per-`SeoConfig`-key migration table in
  the SEO guide. The other `core` global-access stragglers (`scrolling/scrollable.ts`,
  `animations/animation-utils.ts`) were guarded instead, since they stay. Still open on the
  _consumer_ side: 15 view components in `fut-frontend` (`libs/domain/voting-public/campaigns`)
  must migrate off it.
- **`bracket/index.ts`** (2026-08-05) - `./core` and `./linked` are explicit named re-exports of
  the data types; the engine builders stay internal.
- **Docs coverage** - complete; every public domain has a docs page. The codebase carries 0 TODOs.

Query pass:

- **Paged stack signal contracts** - `isFirstPageLoaded` is `loadedMinPage() === 1`, and both
  `canFetch*` signals gate on `stack.anyLoading()`. `blockExecutionDuringLoading` is now
  documented as governing the methods only, which is what closed the "the two halves
  disagree" loose end. Changeset `paged-stack-signal-contracts.md`.
- **Web socket room join counting** - `InternalWebSocketRoom.joinCount`, incremented in
  `join()` and decremented in `leaveRoom`. Also fixed a latent prod-mode bug: the old
  `leaveRoom` fell through its dev-only `throw` and emitted `leave-room` for a room that was
  never joined. Changeset `ws-room-join-counting.md`.
- **Query stack `transform` / `lastQuery`** - the option is typed `(ResponseType | null)[]`,
  and `lastQuery` is recomputed from `finalQueries` after eviction. Bumped to `minor`, since
  the widened signature breaks consumer compilation.
  Changeset `query-stack-transform-nulls-and-last-query.md`.
- **Bearer auth multi-tab namespacing** - the broadcast channel and the leader lock carry the
  provider's `name`. Changeset `auth-multi-tab-namespacing.md`.
- **A literal NUL byte in `multi-tab-sync.ts`** - the delimiter is the `\0` escape, so git
  reads the file as text again.

Bugfix pass:

- **Counter over-limit** - `CounterComponent.isOverLimit` reads the control's `maxLength`
  validation error; only an explicit `[max]` (which has no validator) still compares lengths.
  Changeset `counter-over-limit-from-validator.md`.
- **Tree disabled rows** - interaction states carry a zero-weight `:not(:where([aria-disabled]))`
  guard instead of a reset that lost a specificity race in multi select, and a disabled row
  mutes at `opacity: 0.4` like `select-option`. Changeset `tree-disabled-row-states.md`.
- **Password input caps-lock** - the icon carries `[etTooltip]` with the already-resolved
  label. Changeset `password-input-caps-lock-tooltip.md`.
- **Standings story** - the width control renders as `min(width, 100%)`.
- **Grid** - `resolveItemConstraints` caps both column spans at the active breakpoint's
  columns (and `clampPosition` no longer applies a minimum after the column clamp);
  `resizeEdges()` drops the axis that cannot move; an empty `initialItems` clears the grid;
  reconciling that input no longer emits `layoutChange`. `constraintsRegistry` became a
  signal so everything derived from a constraint sees a late registration.
  Changeset `grid-constraints-and-input-reconcile.md`.
- **Bearer auth token extraction** - a throwing `extractTokens` puts the execution into
  `error` instead of `success`. Changeset `auth-token-extraction-failure.md`.
- **Query form reset cascade** - `applyResets` iterates to a fixpoint (cap 10, dev warning),
  so `country → league → team` clears the whole chain in one committed change.
  Changeset `query-form-signals-reset-cascade.md`.
- **Query devtools override menu on empty values** - `null`/`undefined` rows get `set`-backed
  "set to text / number / true / empty object / empty array" items, `Reset` renders only when
  `hasQueryDevtoolsOverridesAtPath` says something is armed, and `arm({ type: 'reset' })` now
  clears the subtree so it undoes a recursive fill. The rest of that section (custom values,
  paste, randomized presets, `longWord`) is still open.
  Changeset `devtools-override-menu-empty-values.md`.
- **Query devtools tombstones** - a destroyed `query` entry is kept as a frozen snapshot
  (`query-devtools-tombstone.ts`) instead of being filtered out: the same handle shape
  answering with constants, the host element dropped, capped at 50. The Queries tab hides
  them behind a `gone` chip that is off by default, the drawer drops every action that
  would run or edit, and `clearQueryDevtoolsTombstones()` backs "✕ Gone n". The repository
  emits `entry-destroyed` with a cause for all five teardown paths, which feeds an Events
  row and the Cache tab's "Dropped" list; an event row's `queryId` falls back to url
  matching so a failure fired during teardown still opens its tombstone.
  Changeset `devtools-query-tombstones.md`.
- **Docs** - the `createGridAdapter` snippet compiles, `grid.md` documents the live
  `initialItems` reconciliation and the imperative API (`restoreState`, `getSerializedState`,
  `addItem`), and `query-forms.md` states that `isResetBy` is transitive.

Narrow-viewport pass:

- **Tree multi select slab** - a multi selectable tree no longer fills a selected row.
  Selection is a leading 16px check box (`.et-tree-node-check`) rendered on every row in
  multi mode, so ticking one never shifts its label; the accent fill is now a
  single-select-only rule. Changeset `tree-multi-select-check-box.md`.
- **Query devtools below `md`** - `paneAxis` returns `'block'` for a narrow viewport as well
  as a right dock, and the pane-stacking CSS is keyed on a new `[data-pane-axis]` attribute
  instead of `[data-dock='right']`. Both header strips scroll sideways instead of wrapping.
  Changeset `devtools-narrow-viewport-layout.md`.
- **Toast width** - at `≤480px` the stack spans both edges and the card drops its
  `min-width: 300px` / `max-width: 420px`, which overflowed a 320px viewport outright.
  Changeset `notification-narrow-viewport-width.md`.
- **Query devtools pins** - a pin is keyed on `entry.id` rather than the endpoint
  (`pins:v1` → `v2`), and a `gone` chip hides tombstones by default.
  Changeset `devtools-hide-gone-and-per-query-pins.md`.

Devtools overrides pass (2026-08-06):

- **Query devtools: response overrides are presets-only** (was its own section) - all four items
  shipped. "Custom…" renders an in-menu input (`etMenuSearch`, so the menu's typeahead skips it) and
  arms `set` or the `custom` preset; "Paste value" reads the clipboard, kind-checks containers, and
  shows read/parse errors inside the open menu; presets generate a varied sample per arm via
  `generateQueryDevtoolsStringPreset`/`...NumberPreset` (stored in the op's `custom` field at arm
  time - `custom` now wins over the preset label - so replay stays reproducible); `longWord` is a
  new preset (compound word / URL / hex blob, no whitespace); "fill recursively" became per-preset
  submenus. Changeset `devtools-override-custom-paste-randomized.md`. Verified headlessly against
  the devtools story: 16/16 checks (menu contents, custom commit, number validation error, paste
  mismatch error, fill).

Bug pass 2:

- **Object URLs** - `injectFileDownload()` and `createObjectUrlHandle()` in `@ethlete/core`
  replace the four hand-rolled copies. The devtools exports pick up the Firefox fix (the anchor
  is appended before it is clicked) and the SSR guard; dropzone's `objectUrl` is a handle whose
  `revoke()` cannot be orphaned. Changeset `core-file-download.md`.
- **Auth: a failed refresh** - a refresh error that survives `retryConfig` ends the session,
  overridable with `onRefreshFailure`. `minRefreshInterval` now throttles the proactive path only;
  a 401-driven refresh is deduplicated (one in flight) instead.
  Changeset `auth-refresh-failure-and-follower-401.md`.
- **Auth: a 401 in a follower tab** - posts `refresh-requested` on the leader channel, which only
  the lock holder acts on, rather than returning early on `!isLeader()`. Same changeset.
- **Grid resize handles** - new `--et-resize-handles-outset` grows every strip outward without
  moving its inner edge or the hover marker; a grid item spends half the gap on it, capped at 8px,
  so an edge is a 14px target at the default `gap: 16`. The touch sizes moved from `hover: none`
  to `any-pointer: coarse`, and a grid item drops core's pip-only `--side-bottom: 8px`.
  Changeset `grid-resize-handle-hit-area.md`.
- **A cancelled drag committed the move** - `dragGestureFrom` merged `pointercancel` into the
  same terminator as `pointerup`, so a gesture the browser takes away was reported as a drop.
  It now emits `cancelled` (and `ResizeHandlesComponent` a `resizeCancelled`), which the grid,
  the table's column reorder and its column resize revert on; a cancelled press below the
  commit threshold is no longer reported as a tap. The pip window only had to _terminate_ -
  before this its move stream had no end on the cancel path at all, so a cancelled pip drag
  stayed stuck in drag mode, which is the closest thing found to the touchend report below.
  Changeset `drag-resize-cancelled-gesture.md`.

Grid typing pass (2026-08-06):

- **Grid: registering a widget forces the consumer to cast** (was its own section) -
  `GridComponentRegistration.component` and `GridItemActionsComponent` now take a read-only
  `Signal<TData>` instead of an `InputSignal<TData>`, so a widget declaring
  `data = input.required<MyPayload>()` is assignable at the default `TData = unknown` with no cast
  and no helper. `InputSignal` can never be made covariant - `transformFn` _and_
  `SignalNode.equal` both put `T` in an invariant position, so the `gridComponent` factory this
  section proposed (and an `InputSignalWithTransform<T, any>` target) were both dropped in favour
  of the plain `Signal`. What is given up: a component whose `data` is a `computed` rather than an
  input now type-checks. Narrowing the list (`GridComponentRegistration<MyPayload>[]`) still
  checks every entry. `DummyTableComponent` in the grid stories carries a real payload type so the
  registration path is exercised in-repo. Changeset `grid-registration-typed-data-input.md`,
  `grid.md` documents both sides.

Storybook structure (2026-08-06):

- **Two misplaced story titles** (the concrete half of that section) - `Components/Copy button`
  became `Components/Button/Copy`, joining `FAB`/`Icon`/`Split`/`Surface`/`Text`/`Window Control`,
  and `Components/Forms/Form field/Counter` became `Components/Forms/Counter`, the only
  three-level nesting in the SDK. Both story ids moved with the titles, so the two `<StoryEmbed>`
  ids in `apps/docs/components/copy-button.md` and `forms.md` were updated - grep `apps/docs` for
  the old id whenever a title changes. Story-only, so no changeset.

Scheduler overlay + drag-to-create (2026-08-06):

- **Full-screen edit on mobile, anchored on desktop** and **add-new stays a plain dialog** (both
  from the Scheduler section) - the edit surface is full screen below `md`; above it, it anchors to
  the appointment clicked or the range dragged, and the toolbar's add opens a centered dialog since
  it has nothing to anchor to. Two definitions in `scheduler-edit-surface.component.ts`
  (`SCHEDULER_EDIT_SURFACE_OVERLAY` anchored, `SCHEDULER_ADD_SURFACE_OVERLAY` plain); `strategies`
  is fixed per definition (`OverlayOpenConfig` omits it) but `origin` is per-open, which is what
  makes one anchored definition serve both the edit and drag paths.
- **Drag to create** (asked for mid-session) - on week/day it draws a 15-minute-snapped time range
  down a day column; on month it draws an all-day span across cells, either direction. Agenda has
  no geometry to drag across and was deliberately skipped (the user's call). `draftRange` +
  `begin/extend/commit/clearDraftRange` (time axis) and `setDraftRange` (whole days) live on
  `SchedulerDirective` so any view can drive it; `SchedulerTimeGridDirective.draftBlock` places the
  time-grid preview, the month view marks cells with `data-draft`. Notes for whoever extends this:
  a press on an appointment or a "+N more" trigger stops propagation so it cannot draw over it
  (there is no move/resize yet - that is the natural next feature); a sub-threshold press stays a
  click; `pointercancel` clears without opening.
- **Touch needed its own gesture** (reported mid-session: "drag to create doesn't work with touch").
  The time-grid body scrolls vertically, so a finger drag is a pan - the browser claims it and fires
  `pointercancel`. It now arms on a ~400ms stationary long press (`armOnTouch`), which is early
  enough that panning has not begun, and a **non-passive** `touchmove` listener `preventDefault()`s
  from then on so it cannot begin. Do not swap that for `touch-action: none` on the column: it kills
  the grid's own scrolling, and changing `touch-action` mid-gesture does not affect the in-flight
  one. `Input.dispatchTouchEvent` cannot verify scrolling - it never drives the compositor; use
  `Input.synthesizeScrollGesture`. The arming lives in
  `headless/internals/scheduler-draft-gesture.ts`; both views share it. On month the long press was
  also selecting the date numbers (reported from a real Android device), hence
  `-webkit-touch-callout: none` / `user-select: none` on the cells and the day columns.
  **Not verified on real iOS Safari** - `idb` is not installed, so the simulator cannot be driven;
  WebKit's long-press callout and `preventDefault` handling are the remaining risk.
- Anchoring deliberately avoids DOM queries - a view hands its element to
  `SchedulerDirective.surfaceAnchor`, which the host consumes and clears, so a later programmatic
  `selectedAppointmentId` write cannot inherit a stale anchor. `ethlete/no-dom-query` forbids the
  `querySelector` approach anyway, and `signalElementChildren` is direct-children-only.
  Changeset `scheduler-drag-to-create-and-anchored-edit.md`. Verified headlessly: 14/14 on the
  drag/edit/add/mobile paths, 6/6 on click, cancel and press-on-appointment.

Pointer-drag consolidation (2026-08-07):

- **Slider and rating onto `dragGestureFrom`** (was "Duplicated pointer-drag logic", the slider and
  rating half) - `slider-track.directive.ts` and `rating.component.ts` each dropped their
  `pointermove`/`pointerup`/`pointercancel` bindings, their `setPointerCapture` try/catch and their
  `dragging` flag for one `dragGestureFrom(event, el, { commitThreshold: 0 })` per press. The
  threshold is `0` on purpose: both controls follow the pointer from the first pixel, so the 8px
  default that keeps a click a click on a drag handle would give them a dead zone. What they gain is
  the cancelled-gesture path - the slider reverts to the value the press landed on, the rating
  commits nothing. Two things the primitive needed for this: `end` now carries the release position
  (`DragEndEvent`, also the payload of `DragHandleDirective.dragEnded`), because the slider committed
  at the pointerup coordinates and the last `pointermove` can lag those by a frame; and
  `setPointerCapture` is called through a `try`/`catch` inside the primitive, which is what the two
  consumers were each doing by hand. Rating also stopped starting a gesture on a secondary button.
  Changeset `slider-rating-drag-gesture.md`. Verified headlessly against the slider, vertical slider,
  range slider and rating stories: 20/20 (press, drag, release, sub-threshold move, cancel-reverts,
  thumb non-crossing, hover preview, clear-by-repick). Note when reading those results: signal writes
  from the gesture's `document` listeners flush on the next frame (~6ms), so a Playwright assertion
  in the same tick as the release reads the previous attribute value - settle before asserting.
  Carousel stays out, as the section said: `cursor-drag-scroll.ts`'s deadzone semantics differ.

Found not to reproduce:

- **"Grid reordering doesn't finish on touchend"** (was its own section). Driven on the real
  Android emulator (Pixel, Chrome, `adb shell input swipe` and CDP touch): a clean lift, a
  second finger landing mid-drag, a drag past the fold, and a browser `touchCancel` all
  terminate the gesture and clear `--dragging`. `pointerup` is delivered every time. The
  answer to the backlog's question - does `pointercancel` fire and route back to `cancelDrag`?
  - is that it fired and was _handled_, but routed to settle; that is fixed above. If the
    original report resurfaces, capture the device, browser version and gesture, because the
    obvious paths are now covered by `drag-gesture.spec.ts`.

## Grid: the item/state API is there, but the integration can't find it

The rest of the partner dashboard's friction is one theme - `et-grid` already has the API the
app needs, and every piece of it is either misnamed, undocumented, or subtly wrong at the edge
the app hits.

**`initialItems` is still called `initialItems`.** The behaviour and the documentation are
fixed - the input reconciles, an empty array clears the grid, the reconcile path is silent, and
`grid.md` now says all of that plus how `restoreState()` reverts a cancelled edit. What is left
is the name, which is what made the app conclude the opposite in the first place:

```ts
// `et-grid` consumes its items once via `[initialItems]`, so it can't observe changes to `gridItems`.
// Bumping this counter re-keys the grid's `@for` in the template, forcing a full rebuild after a save.
const gridRevision = signal(0);
```

paired with `@for (revision of [partnerDashboard.gridRevision()]; track revision)` wrapped
around `<et-grid>` - so every widget add, edit or delete destroys and rebuilds the whole grid,
re-running every enter animation and losing any scroll or focus inside a widget. Renaming to
`items` with `initialItems` as a deprecated alias is the remaining step, and it collides: the
directive already exposes a public `items` computed over `itemConfigs`, so the rename has to
resolve that first.

**The state round-trip loses the item type.** `initialItems` and `layoutChange` both use the
erased `GridItemConfig` / `GridSerializedState`, so what goes in typed comes back `unknown`:

```ts
(pendingLayout?.items as GridItemConfig<string, DashboardWidgetData>[] | undefined) ?? toGridItems(widgets);
```

Threading `TData` through `GridSerializedState` and the directive removes it. Same family as
the registration cast (fixed, see "Already fixed") - the generic parameters exist on the types
and are dropped at every public boundary.

**`createGridAdapter` maps one position per item.** The doc snippet that did not compile is
fixed, but the signature is still worth reconsidering: the app's mapping is per-breakpoint
(`sm`/`md`/`lg` at once), which a single-position adapter shape does not express - which is why
it hand-rolls `toGridItems`/`toWidgetPayload` off `toGridPosition`/`fromGridPosition` instead.

**Nothing ties an item's layout keys to the configured breakpoints.** `GridItemConfig.layout`
is `Record<string, GridItemPosition>` and `assertValidItemConfigs` (`:792`) only checks for
duplicate ids; a missing breakpoint entry silently becomes `{ col: 0, row: 0, colSpan: 1,
rowSpan: 1 }` in two places. The app hand-writes all three keys and then still guards with
`item.layout['sm'] ?? fallbackPosition('sm')` on the way back out. Cheap fix: assert coverage
of the configured breakpoint names in the dev-mode check. Real fix: a `TBp extends string`
parameter on `GridItemConfig` so `[breakpoints]` and the items have to agree.

## Grid: per-breakpoint span constraints

The clamping half is fixed: `resolveItemConstraints` (`grid.directive.ts`) now takes the column
count and caps `minColSpan`/`maxColSpan` against it, `clampPosition` no longer applies a minimum
after the column clamp, and `getConstraintsForColumns` covers the paths that write a breakpoint
other than the active one. So `minColSpan: 2` degrades to full width at a one-column breakpoint,
which is what anyone writing it means, and the four ad-hoc clamps that used to enforce that by
accident are now redundant rather than load-bearing.

What clamping cannot express is still open: "two columns at `md` but full width at `sm`", or a
different row minimum where the layout is stacked. Additive shape, base plus overrides, rather
than a union that has to be discriminated:

```ts
constraints?: Partial<GridItemConstraints> & {
  perBreakpoint?: Record<GridBreakpointName, Partial<GridItemConstraints>>;
};
```

One thing to settle while designing it: `resolveItemConstraints` **returns early** when a
registration exists, so a registered type's constraints cannot be refined per item - the
`et-grid-item` `minColSpan`/`maxColSpan`/`minRowSpan`/`maxRowSpan` inputs are silently ignored
for any item whose type is registered. (The other one is handled - the resolved value already
varies by breakpoint, and `constraintsRegistry` is a signal, so every reader re-resolves on a
breakpoint change instead of reading a cached entry.)

## Selection list: the tile variant that is missing

The card duplication this section opened with is fixed - see "Already fixed". What is left is the
tile.

### The tile

The shape the SDK has no answer for is the picker grid: a row of equal tiles, each a preview area
carrying an image (a club crest, a template thumbnail, a colour swatch) with a footer strip under
it holding a title and a secondary line - a filename, a size, a price. There is no visible
checkbox anywhere. Selection is an accent check badge overlaid on the preview's top-right corner,
the footer lifting to a tinted surface, and the title going accent; an unselected tile is just the
image and a muted footer. The whole tile is the target. Multi-select in the case that prompted
this ("select the crests you want to download"), but the same tile is right for a single-select
template picker.

The existing card cannot be bent into it, and the reasons are structural rather than cosmetic:

- **The layout is a settings row, not a stack.** The card sets
  `flex-direction: row-reverse; justify-content: space-between; align-items: center` on the host,
  with the control box as a flex sibling of the content column. A tile is a column - media block,
  then footer - with the two on different surfaces.
- **The control is mandatory and in the wrong place.** `.et-checkbox-option-box` /
  `.et-radio-circle` are unconditional children of the template. A tile does not want a box at
  all; it wants that state rendered as a badge floating over the media area, which nothing in the
  current template can express without absolutely positioning a child from the outside.
- **There is nowhere to put the image.** The content model is a label `ng-content` plus
  `<ng-content select="et-description" />`, both inside the content column, both restyled by the
  card (`font-weight: 500`, muted until checked). Media has no slot.
- **The card deliberately has no fill.** `choice-inputs.md` documents "no tinted fill - the
  background stays the surface, so a selected card differs from its neighbours by its border
  alone". That is right for a settings row and wrong for a tile, where the footer tint is half the
  selection cue and the media area needs a surface of its own so a transparent-background logo is
  still legible.

So this is a third variant - `variant="tile"` on `et-checkbox-option` and `et-radio`, the two
components that _are_ the panel - not an extension of `card`. Not on `et-choice-field`: its panel
is a wrapper around a control that stays visible.

```html
<et-checkbox-option value="crest-alt" variant="tile">
  <img [src]="crest.url" etSelectionMedia alt="" />
  Main Crest (Alt)
  <et-description>d_111235.png</et-description>
</et-checkbox-option>
```

The template gains a media slot ahead of the footer and moves the control into the media area as a
badge. Explicit `select="[etSelectionMedia]"` rather than "anything that is not the label falls
into the media area" - the projection rule should be readable at the call site.

The tile owns its aspect and its surfaces, not its grid: `--et-selection-tile-aspect-ratio`,
`--et-selection-tile-media-background`, `--et-selection-tile-footer-background`, and a
`width: auto` host so any `display: grid` wrapper the consumer writes decides the column count.
No tile-group layout component.

Three things to settle. **The unchecked tile still has to read as selectable** - with the box gone,
the only difference between "nothing selected yet" and "these are just pictures" is the badge slot
and the footer, so decide whether the badge has a resting state (an empty ring) or whether a
border plus the hover response carries it; in the reference only the selected tile shows a badge,
which works because the footer tint moves with it. **The projected image is the consumer's** - the
media area sets `object-fit: contain` and a background from surface theming, and it should not
assume a square. And the badge is decoration (`aria-hidden`): the tile keeps `role="checkbox"` /
`role="radio"` and `aria-checked`, and the focus ring belongs to the whole tile, as it already
does for the card.

### Still open around the card

`et-card` should back none of it. It is a container with `ProvideSurfaceDirective` and three chrome
variants of its own, while the selection card's chrome is driven by the option's `aria-checked`
and interaction state; reusing it would mean nesting an element inside the option and moving the
focus ring and the border onto a child. Stating it here so the question is not re-opened.

Leading and trailing slots (`[etSelectionCardLeading]`, `[etSelectionCardTrailing]`) for the plan
icon and the price that a "choose your plan" row is actually made of are still unbuilt - they force
`row-reverse` to become a decision rather than a constant (a `controlPosition` input, or accepting
that leading media and a leading control cannot coexist), which is why they sit in the triage's
"decide before building" table.

The tile lands as a second sheet mounted the same way as `SelectionCardStylesComponent`, so a
consumer who never writes `variant="tile"` never injects it. It needs its own story in both the
checkbox-group and radio-group story files.

## New components still open

Merged from `opportunities.md`; everything else its "New components" section listed has
shipped (see "Already fixed") or already existed (see "Already covered").

- **Stat tile** - low / opportunistic.
- **Command palette** - leans on the existing overlay + menu, so cheaper than it looks, but
  carries real scope-creep risk. Decide the scope before starting, not during.

## Platform modernization - team decisions recorded 2026-07-23

Merged from `opportunities.md`. The repo has no browserslist config, so the baseline is
implicitly evergreen. Already adopted, don't re-plan: `:has()` widely, `@starting-style` in
rating + otp-input, `container-type` in stream/pip.

- **Animated lifecycle stays. Decided - do not plan a replacement.**
  `animatable.directive.ts` + `animated-lifecycle.directive.ts` took a long time to fine-tune
  (interrupts, batching, nested trees, forced-instant states); `@starting-style`/`allow-discrete`
  cannot replace all of it. New simple show/hide cases may use `@starting-style` directly
  (precedent: rating, otp-input), but the directive pair is not a migration target.
- **`<dialog>` / top layer: rejected.** The native top layer breaks consumer apps that rely on
  z-index layering to push their own elements above modals. The overlay system keeps its portal +
  z-index approach. The same reasoning rejects the **Popover API** for tooltip/toggletip/menu.
- **View Transitions: agreed in principle, not yet baseline** (Firefox lacks same-document VT).
  Highest-value target when it lands: `overlay/strategies/fullscreen-animation.ts` - 733 lines of
  origin→viewport transform math plus trigger cloning, and VT snapshots pixels, which may also
  sidestep the Angular style-unload constraint that forced the cloning in the first place. Also
  `flip-animation.ts` (tab underline, segmented button). **Re-check browser support before any
  planning.**
- **Chrome-only for now - re-scan when Firefox and Safari ship.** CSS anchor positioning (would
  shrink `overlay-position.ts`'s floating-ui usage - do **not** swap yet); `interpolate-size` /
  `calc-size` (would replace `animated-block-size.ts`; a `@supports` progressive-enhancement fast
  path is possible); `field-sizing: content` (would delete `textarea-autosize.ts` plus ~70-90
  lines of `textarea.directive.ts`).

## DX / tooling

- **Test harnesses.** `forms/testing/` has exactly one utility (the `mixed-state-contract`).
  There are no CDK-`ComponentHarness`-style drivers - every spec talks to the DOM directly.
  Worth considering as more controls land; not urgent.

## Next major - removal checklist

Nothing else tracks this, so it lives here until a real changelog/migration doc exists.
The one entry so far (`core/seo.directive.ts`) is done - see "Already fixed" for the consumer
migration it still implies.

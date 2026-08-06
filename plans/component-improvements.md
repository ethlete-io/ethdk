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

## Auth: what the consumer app had to rebuild around the bearer provider

Read against `fut-frontend` (`libs/domain/auth`, `libs/queries/*/…​.client.ts`)
and `libs/query/src/lib/auth`. All four of that repo's providers are configured
identically - `withRefreshQuery` + `withPersistentAuth({ autoLogin })` +
`withBearerAuthMultiTabSync()` - so everything below applies to each of them.
Ordered by how visible it is to a user.

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

## Auth: the app hand-rolls its route guard and its "has auth settled" primitive

`canMatchAuthenticated` in the consumer's `libs/domain/hub/src/lib/hub.routes.ts` is
19 lines of guard carrying three comments, and each one is an SDK gap rather than an
app decision. (The third - a `success` state that never authenticated - is fixed;
`extractTokens` throwing now puts the execution into `error`.)

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

One claim in that file did **not** reproduce. The comment on `ready` says the tokens are
applied "in a separate effect that can still be pending for one tick after `executionState`
flips to `success`". On a plain login flush, `executionState: success` and
`isAuthenticated(): true` land in the same tick - the token effect is created first at
registry setup and Angular runs effects in creation order, so it always wins. The
`tokenSeed` path applies tokens synchronously before setting the state, too. Whatever the
author actually saw, that ordering is not it, and the extra `isAuthenticated()` condition
is what turns the extraction failure above into a hang instead of a redirect.

## Already fixed, do not re-report

Implemented on 2026-08-06, sections deleted from this file. Listed so the next pass does
not rediscover them.

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
- **Drag to create** (asked for mid-session) - dragging empty grid in a day column draws a
  15-minute-snapped range and opens the create surface anchored to it. `draftRange` +
  `begin/extend/commit/clearDraftRange` live on `SchedulerDirective` so any view can drive it;
  `SchedulerTimeGridDirective.draftBlock` places it. Notes for whoever extends this: a press on an
  existing appointment stops propagation so it cannot draw over it (there is no move/resize yet -
  that is the natural next feature); a sub-threshold press stays a click; `pointercancel` clears
  without opening. Month-view drag across days (an all-day range) is **not** done.
- Anchoring deliberately avoids DOM queries - a view hands its element to
  `SchedulerDirective.surfaceAnchor`, which the host consumes and clears, so a later programmatic
  `selectedAppointmentId` write cannot inherit a stale anchor. `ethlete/no-dom-query` forbids the
  `querySelector` approach anyway, and `signalElementChildren` is direct-children-only.
  Changeset `scheduler-drag-to-create-and-anchored-edit.md`. Verified headlessly: 14/14 on the
  drag/edit/add/mobile paths, 6/6 on click, cancel and press-on-appointment.

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

## Selection list: the card exists three times, and the variant that is missing is a tile

The card preset is already there - `et-radio` (`radio.component.ts:5`), `et-checkbox-option`
(`checkbox-option.component.ts:6`) and `et-choice-field`, documented together in
`apps/docs/components/choice-inputs.md:145`. The problem is that it is there three times.

`radio.component.css:160` and `checkbox-option.component.css:176` are the same ~75 lines with the
names swapped: same `flex-direction: row-reverse`, same `:where()` hover/active/checked ordering,
same focus-ring-moves-to-the-panel reset, same `data-can-animate` transition list - and the same
comments, copied verbatim down to "so a list of cards is scannable without reading every
box/dot". `choice-field-card-styles.component.css` is a third rendering of the same design,
differing only where it has to (`:has()` instead of `aria-checked`, because the wrapper does not
own the state). Three token sets follow from that - `--et-radio-card-*`,
`--et-checkbox-option-card-*`, `--et-choice-field-card-*` - so an app that wants a different card
radius sets it three times, and any change to the preset is three edits with two chances to
drift.

Only the choice-field one is mounted the cheap way, as a styles-only component
(`ChoiceFieldCardStylesComponent`). The radio's and the checkbox option's card chrome sits inside
the always-injected option stylesheet, so a consumer whose whole app uses `variant="plain"` ships
it anyway - roughly 40% of each of those two files.

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

### One card presentation instead of three

The duplication and the new variant land in the same place - a shared styles-only component the
option mounts via `injectStyleManager()` when the variant is set, keyed off a hook on the host
(`data-variant`) rather than three per-component selectors, with one `--et-selection-card-*` token
set. The control's own tokens stay where they are; the duplication is the panel, not the box or
the circle. `et-choice-field` joins it by mapping its `:has()` guards onto the same rules - it may
keep its own file if the state selectors do not merge cleanly, but not its own token names. The
tile is a second sheet mounted the same way, so a consumer who never writes `variant="tile"` never
ships it.

Worth doing for the row card at the same time, since it is the same edit: leading and trailing
slots (`[etSelectionCardLeading]`, `[etSelectionCardTrailing]`) for the plan icon and the price
that a "choose your plan" row is actually made of. That forces `row-reverse` to become a decision
rather than a constant - a `controlPosition` input, or accepting that leading media and a leading
control cannot coexist.

`et-card` should back none of it. It is a container with `ProvideSurfaceDirective` and three chrome
variants of its own, while the selection card's chrome is driven by the option's `aria-checked`
and interaction state; reusing it would mean nesting an element inside the option and moving the
focus ring and the border onto a child. Stating it here so the question is not re-opened.

All of this changes the card-presets section of `choice-inputs.md`, which currently documents the
label-carries-selection and no-fill behaviour as rules, and the tile needs its own story in both
the checkbox-group and radio-group story files.

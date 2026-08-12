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

- **Start/end as a date-time range picker** shipped 2026-08-12 as
  `et-date-time-range-input` - see "Already fixed".
- **Infinite-scrolling agenda** shipped 2026-08-12 - see "Already fixed".

## Buttons

Button's CSS has no `data-color`/`data-theme` switch - color comes from whatever
`--et-theme-color-*` is in scope via `ProvideColorDirective`, or, since 2026-08-11,
from the surface when `tone="surface"` is set (a third theming axis on
`ButtonDirective`, not a generated `ColorTheme`). `mutedUntilPressed` is the same
look, released as soon as the button is pressed.

Copy button (`copy-button.directive.ts`) is already a bare directive with
no `.css` of its own - its doc comment says to compose it with `et-icon-
button`/`et-text-button`, and its stories already do exactly that. If it
looks messy, that's the demo/story, not the directive reimplementing button
styles. Moving its story from the standalone `Components/Copy button` entry
into `Components/Button/*` is a pure story-organization move (see Storybook
structure below), no component change.

## Color input

`ColorInputComponent`/`ColorInputDirective` (`forms/color-input/`) already
exists as a custom control - swatch, text value, and a native `<input
type="color">` synced underneath, with `readonly`/`disabled`/`mixed`
handling. A custom picker replaces that native input while keeping the same
directive/value contract - still open, still an `L`.

The **hex/RGB validators shipped 2026-08-10** and the **contrast validator
on 2026-08-12** (both under "Already fixed"). Nothing about validation is
left open here; only the custom picker is.

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

Outcome states, vertical orientation, steps-as-links and the detailed sub-steps ask (shipped as the
`[etProgressStepDescription]` slot) are all done - see "Already fixed". **Nothing is open on this
component.**

## Segmented button group: two tab divergences left in place on purpose

The rest of this shipped 2026-08-11 (see "Already fixed"). These two were deliberate:

- **The focus ring is still the segment box** (at the tab's `2px` offset), where tabs ring an inner
  label-hugging span. Matching it needs a wrapper element inside `et-segmented-button`, which changes
  the pill variant's DOM too.
- **`data-orientation` / `data-fit` / `data-divider` / `variant="primary"`** stay tabs-only. The
  variant is a radiogroup that looks like tabs; giving it a vertical mode and a stacked-icon variant
  is rebuilding tabs inside a selection list.

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

## Storybook structure

Both halves of this shipped: the two misplaced titles on 2026-08-06, and the
eleven categories on 2026-08-12 - see "Already fixed" for the scheme and the
id-mapping method. **Nothing is open here.**

## Auth: `excludeRoutes` invites string matching - fixed 2026-08-10

The SDK half shipped; see "Already fixed". The app-side observations below are kept
because they are the evidence for _why_, not because anything here is still open.

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

**Date-time range picker** (2026-08-12, the scheduler row above) - `et-date-time-range-input`, a
start/end control with time-bearing wire strings on the date range input's `{ start, end }` shape.
The four calls the user settled before any code:

- **Panel layout: a range calendar plus one time picker per side**, captioned `Start time` /
  `End time`, all three panes side by side on the anchored panel and three tabs
  (`Dates / Start time / End time`) on the bottom sheet. A single side-switched time picker was
  rejected (which side you are editing becomes one more piece of hidden state, and setting both
  times costs an extra click); two full tabbed date-time panes were rejected because they throw
  away the range band, which is the reason to have a range control at all.
- **The shipped `DateRangeInputDirective` was refactored onto a shared base**,
  `internals/date-range-picker-input.directive.ts` (+ `-input-field`), mirroring what
  `internals/date-picker-input.directive.ts` already does for the three single-value controls.
  Both range controls extend it; the 633-line range spec passed unchanged, which is what made this
  the cheap option over a ~90% copy. `date-time-parse.ts` and the pane-compensation directive moved
  to `internals/` for the same reason (the latter now queries `contentChildren`, one time picker per
  side), and `withTimeOfDay` is one helper both controls use.
- **Ordering is not enforced** - no swap-on-commit, no implicit clamp of the end picker. Same
  contract as the date range input: a schema validator's job. What the picker _can_ say is
  `timeFilter(candidate, side)` - the side is the second argument, which is the only way to express
  "the end must be after the start" as a picker bound. Auto-bounding the end time picker was
  rejected as hidden magic that fights `minTime`/`maxTime` and cannot be turned off.
- **The picker never closes on its own.** A completed day range is only half this value, so
  completing it leaves the panel open (the plain date range input closes there). A picked day range
  keeps each side's committed time of day; a picked time writes only its side, falling back to the
  _other_ side's day when its own has none.

It deliberately does **not** take `rangeSelectionStrategy` or `comparisonStart`/`comparisonEnd` -
week snapping and comparison bands belong to reporting filters, not appointments - and has no
`precision`, like the single date-time input. `scheduler-edit-time-range.component.ts` now stamps one
field instead of two; its label is the new `SchedulerLabels.timeRangeField` (`'When'`), with
`startField`/`endField` demoted to the two halves' accessible names.

Follow-up the user asked for the same day, also shipped: **`et-time-range-picker`**
(`time-picker/time-range-picker.component.ts`), two time pickers as one element - a start and an end
column set under their own headings, sharing one format/step/bound/filter. Both sides still render
(a column shows one value, so a start and an end cannot share one), but the panel mounts, labels and
filters them once, and the piece is a general standalone picker in its own right. A true
`mode="range"` **inside `TimePickerDirective` was rejected**: `value`, `anchorTime`, `selectedParts`,
`columns`, `selectPart` and the whole availability model are single-value, and `track column.unit`
plus the roving-focus/keyboard model all assume one column per unit - a rewrite of 412 intricate
lines for no visual difference. It exposes `rangeValue` as a model (so `[(rangeValue)]` stands alone)
**plus** a side-tagged `(timeSelect)` output, because a consumer whose value is a pair of wire
strings cannot infer which half moved. Its two headings live in `TIME_PICKER_LABELS.startTime`/
`endTime`, which the range input's two time tabs read as well, so the strings are defined once.

**Trap found by driving the story:** a new text-shell control must be added to
`FormFieldDirective.usesTextFieldShell`'s control-type allowlist. Miss it and nothing errors - the
label area just stays `position: static` instead of going out of flow, so it sits _in_ the control
row and squeezed the two fields to 17px each. Two `Pp` values also simply need room: the story had
to go to `max-w-3xl`, and the playground's Tailwind resolves `max-w-md` to **280px**, not 448px
(root font-size is 10px there).

Noticed while building it and **not** fixed: the other four picker templates hardcode their
`dialogLabel` (`"Choose a date"`, …), so those four strings bypass `DATE_TIME_LABELS` entirely - the
`chooseDate` fallback exists but nothing reaches it. The new control binds
`chooseDateTimeRange` from the label set instead. Worth a small localization sweep.

**Storybook top-level categories** (2026-08-12, the last "Decide before building" row) - `Components/*`
now has eleven categories: Actions, Data display, Date & time, Dev tools, Feedback, Forms, Layout,
Media, Navigation, Overlays, Sports. The calls the user settled first:

- **The category level sits _inside_ `Components`**, not in place of it: `Components/Data display/Table`,
  with `CDK` and `Query` still the top-level siblings. Promoting categories to the top level was
  rejected - the first level would stop saying which library a story belongs to, and `Forms/` would
  sit next to `CDK/`.
- **The seven families that were already grouped got re-parented too** (`Components/Actions/Button/*`,
  `Components/Media/Stream/*`, `Components/Feedback/Loader/*`, `Components/Overlays/Menu/*` and
  `/Overlay/*`, `Components/Navigation/Tabs/*`), so every story sits under exactly one category rather
  than the tree being mixed-depth. **`Forms` is the exception on purpose** - it already _is_ a category,
  so its 32 stories and their 54 docs embeds did not move at all.
- 69 `*.stories.ts` titles plus **7 `*.docs.mdx` `<Meta title=…>`** moved. The mdx companions are easy
  to miss: they carry their own title and a `.stories.ts`-only sweep leaves them behind, which shows up
  as a phantom leftover category in the built index rather than as an error.
- **363 story ids changed; 162 references were rewritten** across 53 files - 155 `<StoryEmbed>` ids in
  `apps/docs`, plus `.agents/skills/docs/SKILL.md`, a comment in
  `table-keyboard-nav.directive.spec.ts` and two headless-verification notes in this file. The mapping
  was derived by matching Storybook's own `index.json` before and after on
  (`importPath`, `exportName`) - 716/716 entries matched, so no id was guessed from slug rules.
- **The generator now takes `--category`** (`libs/components/generators/component/`): `COMPONENT_CATEGORIES`
  is the source of truth, `schema.json` prompts for it, and `storyIdPrefix` became
  `components-<category-slug>-<name>` so a generated docs page embeds an id that actually exists. A
  twelfth category means editing that array **and** the schema enum together.

**Progress steps: detailed sub-steps** (2026-08-12, the last "Decide before building" row that was not
Storybook categories) - shipped as `[etProgressStepDescription]`, a second muted line under the label.
The calls the user settled before any code:

- **A projected slot, not a `description` string input.** Same precedent as `[etBannerHeading]` /
  `[etTimelineMarker]` / `[etSelectionCardLeading]`: a plain projection selector with **no directive
  class**, so it can carry a link, emphasis or an interpolated value. A string input would have capped
  it at text.
- **Not a nested sub-step _list_.** "Sub-steps" in the original ask meant a step carrying more detail,
  not a tree. Nesting an `et-progress-steps` inside a step (with `counters(et-progress-step, '.')`
  numbering children `2.1`, `2.2` for free) was raised as an option and **not taken** - it is a
  separate, larger build with its own connector geometry, and vertical-only. Not scheduled; do not
  treat it as owed.
- **Both orientations, with no code path blocking either.** A horizontal step is only as wide as its
  share of the row, so a description of more than a few words wraps and grows the row - the docs say
  so and the `--descriptions` story shows it, rather than a dev-check forbidding it. Vertical-only
  would have needed an `ET19xx` code and an orientation dependency the step does not have.
- **The description stays neutral in the outcome states** (`--et-surface-color-muted-solid`, not
  `--et-theme-color-ink-solid` like the label) - the call `et-banner` already makes for its own
  description, so an outcome reads off the marker and label rather than off every line at once.

Implementation notes: label and description share a new `.et-progress-step-text` wrapper, so the
step's 8px marker gap does not also fall between them and the vertical orientation's optical
centering (`padding-block-start: calc((marker-size - 1lh) / 2)`) shifts the pair together. That
`padding` moved from the label to the wrapper, and **the wrapper carries
`font-size: var(--et-progress-step-label-font-size)`** - `1lh` is measured on the element it sits on,
so without that the padding would be computed from the inherited page font-size and the label would
sit off-center. New `--et-progress-step-description-font-size` token (12px).

**Selection card: leading/trailing slots** (2026-08-12, a "Decide before building" row) - shipped as
`[etSelectionCardLeading]` / `[etSelectionCardTrailing]` plus a `controlPosition` input on all three
card components (`et-radio`, `et-checkbox-option`, `et-choice-field`). The calls:

- **`row-reverse` became `order`, not a `flex-direction` toggle.** Source order is control, leading,
  content, trailing, and only the control is moved (`order: 1` by default). Reversing the line would
  have put the two slots on the ends they are not named for, and this way the plain variant needs no
  ordering rule at all. `et-choice-field`'s control slot got the `.et-selection-card-control` class so
  the same rule keeps its existing layout.
- **`controlPosition` is card-only**, `'end'` by default, so nothing about an existing card changes.
  The attribute is not emitted at all in the plain variant, where the control already leads.
- **All three components got it**, not just the two options - the docs page treats the card as one
  preset shared by three components, and an exception would have needed a paragraph of its own.
- **The card sizes a projected `.et-icon`** via a new `--et-selection-card-icon-size` (`20px`). An
  `.et-icon` carries no size of its own, so the first headless run had a 300px-wide star and a
  zero-width label; `et-banner` and `et-empty-state` size their icon slots the same way.

Slots are plain projection selectors with no directive class behind them, as `[etBannerHeading]` and
`[etTimelineMarker]` already are. Tests live in `libs/components/src/lib/forms/selection-card.spec.ts`
(one file over all three components); story `components-forms-selection-list-radio-group--card-slots`.
`apps/docs/components/choice-inputs.md` gained an "Ends of the card" subsection - **no new embed**,
that page already carries 8 against a cap of ~4.

**Color input: contrast validator** (2026-08-12, a "Decide before building" row) - the row's premise
was wrong: `validate`'s field context already carries `valueOf(path)`, and our own `warn()` gets the
same context, so a cross-field read needed no new mechanism. What was actually open was the API
shape, settled with the user as `colorContrast(path, { against, min, severity, message })` in
`forms/color-input/color-input-validators.ts`. Four calls worth keeping:

- **`against` takes a path or a plain color string**, discriminated at runtime by `typeof`. The
  literal form covers a page background the form doesn't own.
- **`min` is a number (default 4.5), not a `'AA' | 'AAA'` enum**, with `WCAG_CONTRAST_RATIOS`
  exported to name the five thresholds. It also accepts a `LogicFn` - the shape signal forms' own
  `min()`/`maxLength()` take - so the requirement can follow another field (a "large text" switch
  relaxing 4.5 to 3). That reactive form is what the story demos; without it a Storybook arg could
  not drive it at all, since options are read once at schema-build time.
- **One function with `severity: 'error' | 'warning'`**, routing to `validate()` or `warn()`, rather
  than two exported functions. Contrast is often a brand judgment call, and the warning channel
  already exists; both report `kind: 'colorContrast'`, so one resolver entry localizes either.
- **Passes when either color is blank _or unparseable_.** A malformed value is `hexColor`'s error to
  report; failing here too would put two errors on one field. Same reason `getColorContrastRatio()`
  returns `null` rather than throwing.

`getColorContrastRatio(a, b)` is exported for use outside a form (live previews, palette tooling).
**Alpha is ignored** by both - compositing needs a backdrop neither is given. Story
`components-forms-color-input-contrast--default` demos both severities plus the reactive `min`;
`apps/docs/components/forms.md` gained a "Color contrast, across two fields" section.

**Grid: projected items are a supported composition** (2026-08-12, a "Decide before building" row) -
the decision the row asked for is **projection is supported**, and the check was wrong. It was already
half-documented: `grid.md` tells consumers to set `ariaLabel` / `minColSpan` / the `remove` output on
`et-grid-item`, none of which the grid's own loop binds, so you can only reach them by writing the
item yourself. Registrations render a widget _by type_ (backend-driven dashboards); projection is for
a widget set known where the template is written. What shipped:

- **The `ET1904` check now asks "does anything render this item"**, not "is its type registered" - a
  `contentChildren(GridItemDirective)` query supplies the ids a projected item covers. It moved from
  `effect` to `afterRenderEffect`: a projected item's required `itemId` is not readable during the
  pass that creates it (`NG0950`).
- **New `ET1905` for the opposite mistake.** Verifying the fix showed both stories were _also_
  double-rendering: the meta's `provideGridConfig` registers `chart`/`table`/`text`, so the two
  `text` widgets in `Grid → Partner Dashboard` and the `chart` one in `→ Backend Integration` were
  stamped from the registration _and_ projected - two `et-grid-item`s per id, perfectly stacked, both
  registering constraints. Invisible without counting DOM nodes. Both stories now override the config
  with empty registrations.
- **Rejected: making projection win automatically** (skipping the stamped item when a projected one
  covers the id). `registeredItems` would have to read the content query, so the first pass stamps
  the item and the second removes it - a mount/unmount flash plus the entering animation. A dev-mode
  error is the cheaper contract: exactly one mechanism per item.

**Grid: `createGridAdapter` maps every breakpoint** (2026-08-12, a "Decide before building" row) - the
signature question this file asked ("one position per item cannot express the per-breakpoint mapping
apps write") turned out to be the wrong diagnosis. The arity was never the problem: both stories
_could_ map three breakpoints, they just repeated `toGridPosition` per breakpoint and invented a
fallback position per breakpoint in the reverse direction, because `layout` was
`Record<string, GridItemPosition>` - untyped keys, so nothing was total and every read needed a `??`.
What shipped:

- **`GridItemConfig` gained a third parameter, `TBp extends GridBreakpointName`**, defaulting to
  `string` so every existing usage still compiles, with `layout: Record<TBp, GridItemPosition>`.
  `GridBreakpointConfig<TBp>` gained the same. Nothing was threaded into `GridComponent` /
  `GridDirective`: `Record<'sm'|'md'|'lg', P>` is assignable to `Record<string, P>` (a mapped type
  gets an implicit index signature), so a typed config array binds to `[items]` untouched.
- **`createGridAdapter` takes one options object** - `{ breakpoints, fromExternal, toExternal }` -
  where `breakpoints` is the single source of truth for the names, `NoInfer<TBp>` keeps the mappers
  from widening it, and `adapter.breakpoints` hands back the `{ name, columns, minWidth }[]` for the
  grid's input so the two cannot drift. Breaking, no alias - changeset
  `grid-adapter-per-breakpoint.md`.
- **`breakpoints` is a record keyed by name, not the config array.** With an array,
  `const TBp` only preserves literals for an array written _at the call site_ - the moment an app
  hoists `const BREAKPOINTS = [...]` (which is what the partner dashboard does, since it also binds
  it), `TBp` silently widens to `string`, the totality guarantee evaporates, and the only symptom is
  an obscure error in the reverse mapper. Object _keys_ always infer as literals, wherever the record
  is declared. Verified both ways before switching.
- **New `mapGridLayout(layout, map)`** maps a whole layout record through one function, keeping the
  keys - the per-breakpoint repetition in both stories collapsed to one line per direction.
- **Rejected: a dev-mode throw when `toExternal` gets an incomplete layout** (it was written, as
  `ET1906`, then removed). `layout: {}` is the documented "place this for me", the `items`
  reconciliation places such an item _silently_, so a host that adds a widget and then serializes its
  own array legitimately holds one unplaced item - driving `Grid → Backend Integration` headlessly
  showed exactly that, and the throw fired on a blessed flow. `mapGridLayout` carries the gap through
  as an empty layout instead of inventing a position, and the grid's existing
  `warnAboutUncoveredBreakpoints` still covers the genuinely suspicious case (some breakpoints but
  not all). The `as` cast in `toExternal` is the one place the types outrun the runtime; it is
  commented there.
- **Still open: nothing links `[breakpoints]` to `[items]` at the `et-grid` level.** An app that
  writes its items by hand rather than through an adapter gets the runtime warning, not a compile
  error. Doing better needs `GridComponent<TData, TBp>` plus template-inference across two inputs -
  a bigger, separate call.

**Grid: `initialItems` renamed to `items`** (2026-08-12, the first "Decide before building" row) -
the input was already a live, reconciling one; only the name still said otherwise, and it is what
talked the partner dashboard into re-keying the whole grid on every save. Two calls settled the
collision the triage flagged:

- **The existing public `items` computed became `currentItems()`** rather than the input picking a
  different name. It reads as "what the grid holds now" next to "what you passed in", and it is the
  minority name - the input is on every `<et-grid>`, the computed on a handful of handles.
- **No deprecated `initialItems` alias**, contrary to what this file proposed. Two inputs both
  defaulting to `[]` cannot tell "unset" from "cleared" without a third state, and `@ethlete/components`
  is still `1.0.0-next` and renames outright elsewhere (`loadMoreRequested` → `loadMore`,
  `opened`/`closed` → `afterOpen`/`afterClose`). Changeset `grid-items-input-rename.md`, marked
  breaking.

**Scheduler: infinite-scrolling agenda** (2026-08-12, the first `M` triage row) - the triage's
"paging belongs to the query, not scheduler" call held, but was not sufficient on its own: the agenda
derived its days from `visibleRange()`, which is hardcoded to the week view's 7-day window, so no
amount of loaded data could put more days on screen. What shipped:

- **`agendaDays` on `[etScheduler]`** (forwarded by `<et-scheduler>`): the agenda's day span, counted
  from `focusedDate`'s own day, `null` keeping the week window. Deliberately on the _scheduler_
  directive rather than on `[etSchedulerAgenda]`, so the header label, `visibleAppointments()` and
  prev/next (which steps by the span once set) all stay consistent with what the list shows - and so
  the feature works inside the full `<et-scheduler>` shell. A range override on the agenda directive
  would have forced consumers into a bare `[etScheduler]` composition, where `SCHEDULER_FEATURE_HOST`
  is absent and badges therefore render with **no adornments at all** - no title. That trap is still
  there for any other reason to compose headlessly.
- **Month headings** in the agenda wherever the list crosses into another month (never above the first
  day - the toolbar label already names it). Without them a 100-day list repeats "Mon 3" every month.
- **The pattern is documented, not built**: a `paged-query-stack` over an open-ended "from this date
  on" endpoint, `agendaDays` derived from how far the loaded appointments reach, and a sentinel
  driving `fetchNextPage()`. The trap worth keeping: reading the growing signal inside the stack's
  `args` resets it to page 1, so the day span must follow the data, not feed the query.
- `Scheduler → Infinite Agenda` in Storybook runs it against a local generator. Not embedded in the
  docs page - it is already at its live-story budget.

**Scheduler: move and resize existing appointments** (2026-08-11, was the `L` triage row the
drag-to-create work called "the natural next feature") - four design calls were put to the user first
and all taken the recommended way; the last two are the ones worth remembering:

- **Scope**: week/day blocks move (down for a time, sideways for a day) _and_ resize by their top/bottom
  edge; month badges move only. A month badge renders per covered cell rather than as one span, so it
  has no edge to grab - the all-day strip does span, and was left out of this pass.
- **A dedicated `appointmentReschedule`** carrying `{ appointment, previous }` rather than reusing
  `appointmentSave`. `previous` is what makes rollback and an undo affordance possible, and a
  "saved" toast no longer fires on a drag.
- **The preview drops on release** rather than being held optimistically until `appointments`
  answers. Honest - a consumer that ignores the event cannot end up showing an appointment somewhere
  it is not - at the cost of a documented snap-back for an async persister.
- **On by default**, disabled with `[etSchedulerAppointmentDrag]="{ enabled: false }"`, because a bare
  `<et-scheduler>` already opens an editable surface on click; it is already an editing UI.

Notes for whoever extends this:

- **Every layout derives from a new `effectiveAppointments`** (the list with the in-flight drag
  applied), so the preview is automatic in every view - including the re-pack of a day column's
  overlap groups as the block passes over its neighbours. The gesture measures the _day column_, never
  the block, so a re-pack that shifts the block sideways mid-drag cannot break the math.
- **The click after a drag must be swallowed, and the flag has to be view-local.** A first attempt put
  it on the headless directive; because the gesture's pointer capture lives on the day column, the
  click retargets to the column and the block's handler never consumed it, so the flag went stale and
  ate the _next_ genuine click on any appointment. A private field per view cannot: only a
  `pointerdown` sets it, and one always precedes the click it belongs to.
- **A resize stops a slot short of the other edge** instead of flipping - flipping would silently
  swap which end the pointer is holding. A move is unclamped, so it can cross midnight, where the grid
  already clips a timed appointment into one block per day.
- `scheduler-draft-gesture.ts` is now `scheduler-drag-gesture.ts` (`startSchedulerDragGesture`, with
  `draw` renamed `track`) - one armed gesture serving both drawing and dragging, so the touch long
  press, the non-passive `touchmove` guard and the cancel path are shared rather than copied.
- Verified headlessly against the real stories: 20/20 on mouse (move, cross-day move, both edges, the
  minimum, cancel-reverts, click-still-opens, drag-to-create unbroken), 6/6 with the feature off, and
  7/7 on touch (flick still scrolls, long press arms, the armed drag does not pan the body, tap still
  opens). Changeset `scheduler-move-and-resize-appointments.md`.

**Scheduler: the all-day strip moves and resizes too** (2026-08-11, the follow-up the row above left
out) - the state, the armed gesture and the `[etSchedulerAppointmentDrag]` gate all already existed, so
this was one method, one template block and one CSS rule:

- **Whole days on one axis.** An entry moves sideways and resizes by its leading/trailing edge; both are
  applied as a day offset via `addDays`, so whatever times of day the appointment carries survive the
  drag rather than being normalised to midnight. An edge stops on the other end's day instead of
  flipping, leaving a one-day entry - the analogue of the timed resize's one-slot minimum.
- **Vertical is deliberately inert.** Dragging an entry down into the hour grid does _not_ convert it to
  a timed appointment (nor the reverse) - that is a separate design call about what `allDay` means when
  the drag chooses the times, not a gap in this.
- **The day under the pointer comes from `columnAt`**, which hit-tests the body's rendered day columns
  rather than dividing the lane's width by seven. That is what makes it RTL-correct, since the columns
  are laid out by the grid; the month view's own `dateAt` still divides and is still LTR-only.
- The click-suppression flag is the same view-local `hasDragged` the timed blocks use, which is safe for
  the same reason - a `pointerdown` always precedes its click. Verified headlessly on
  `components-date-time-scheduler--week`: a move lands one column across, a resize-end grows by exactly one column,
  a resize-start dragged far past the end clamps to a single day, a plain click still opens the surface,
  the feature off renders no handles and a 300px drag moves nothing, and a 600ms touch long press then a
  drag moves exactly one day. Changeset `scheduler-all-day-move-and-resize.md`.

**Query devtools: the mock designer, phase 3 - the OpenAPI export** (2026-08-10, user-raised) - the last
phase, so the whole "mock designer" section is gone from this file. Three design calls, all put to the user
first and all taken the recommended way:

- **A route seeded from the description references the schema it was seeded from** (`$ref`), and the
  whole-library export copies that schema plus everything it transitively `$ref`s into its own
  `components.schemas` - so the document resolves on its own while a seeded route keeps the API team's own
  type name. Only a route that was never seeded gets an inferred inline schema. The single-route fragment
  keeps the `$ref` without the copy, since it is merged into the description that declares it.
- **YAML and JSON, picked at export time.** YAML is what a specification repository takes, so it is the
  default; the subset a generated OpenAPI document needs is a ~120-line serializer
  (`query-devtools-yaml.ts`), no dependency. It was verified by round-tripping a deliberately nasty
  generated document through the real `yaml` parser and asserting it equals the JSON tree - `yaml` is not a
  declared dependency, so that check stayed a throwaway rather than becoming a spec.
- **A row copies, the library downloads.** `⧉ OAS` next to the existing `⧉ TS` puts one `paths` entry on
  the clipboard; **Export OpenAPI** in the **Designed** head downloads the whole library. Needed one new
  host method (`downloadTextFile`), which the panel's own `downloadFile` now goes through.

Everything not seeded is inferred from one example and **the document says so in its `info.description`**:
observed properties are `required`, nothing is nullable, a `null` example carries _no type at all_, and
`format` is only `date-time` or `uuid` - the two a value cannot hold by accident. Two mocks differing only
by query string export as named `examples` under the first one's schema. Every such resolution is reported
under the library, the way a seed reports what it guessed.

Verified headlessly in the real panel (18 checks): seeding `/authors/{authorId}` from the demo description,
copying it as YAML and as JSON, the `$ref` and the transitive `AuthorView` → `PostView` → `PostId` copy, a
captured route's inferred schema alongside it, and the downloaded file's name. Changeset
`query-devtools-mock-openapi-export.md`.

**Query devtools: the mock designer, phase 2** (2026-08-10, user-raised) - the designer and the
generated-API-types seed. The user settled the type source before building: **an OpenAPI/JSON Schema
document handed in lazily**, not a runtime registry the app has to codegen.

- **The designer is the override menu pointed at a draft** (`query-devtools-mock-designer.component.*`),
  which is what phase 2 was always meant to be: a standalone `createQueryDevtoolsOverrides()` records the
  edits, the tree renders `applyQueryDevtoolsOverrides` of them, and **Apply flattens** so what is stored
  stays a value rather than a recipe. `createQueryDevtoolsOverrides` had to stop being `@internal` for the
  panel to reach it.
- **`provideQueryDevtools({ schema })`** takes a loader, called once and only when the Mocks tab opens, so
  the document ships as the app's own lazy chunk. `query-devtools-schema.ts` follows `$ref`s, merges
  `allOf`, reads OpenAPI 3.x / Swagger 2 / bare JSON Schema, and matches a route pattern even when the
  param names differ or the client carries a base path the document does not.
- **Generation is deterministic and says what it guessed** - which `oneOf` branch it took, where it cut a
  self-referencing schema, which prefix it ignored. A string with no `format` takes its own field name, so
  a seed reads as obviously unreal.
- **Fields are labelled with their declared type** (`MatchId`, not `string`; `?` for what the schema does
  not require) via a new `annotations` input on the value explorer, keyed with `*` for array indices so one
  label covers every element. The mock stores its `schemaName`, so the labels survive a reload.
- **Routes the app has never called are offered**, which is the case a mock exists for - the seed list is
  the document's `paths`, not the registry.

**Query devtools: copy/paste around response overrides** (2026-08-10, user-raised) - built both
readings the write-up split out, op-set first, plus four gaps the user added on review.

- **The op-set transfer** (`libs/query/.../query-devtools-override-transfer.ts`) - copy every rule armed
  on a query as one versioned envelope, paste it onto another. Lives in the detail toolbar's existing
  **Override ▾** as an `Override set ›` submenu, not a second top-level button: that row's own comment
  says everything a query can be _made_ to do belongs behind Override.
- **Paste is additive and reports what did not land** - how many ops armed, how many resolve against
  nothing here (`countUnresolvedQueryDevtoolsOverrides`), how many types this build cannot replay. A bare
  `[...]` array of ops parses too, so a set hand-trimmed out of a ticket still pastes.
- **The kind guard now confirms instead of refusing** (the design call put to the user) - a differing
  kind asks "This replaces the string with array", then goes through. It still catches a copied _path_
  pasted over a body, which is what it was there for.
- **A blocked `readText()` falls back to a real paste event** - the menu turns into a focused box that
  takes `⌘V`. A `ClipboardEvent` needs no permission anywhere; this is what "no paste support" looked
  like from outside.
- **One new op covers deletion**: `deleteAt` removes whatever sits at a path from its parent - a key from
  an object, an element from an array by splicing. Making a field _absent_ rather than empty is the only
  way to exercise optional-property handling. `pasteArrayItem` splices too (an absent `index` means "at
  the end") rather than writing at an index, which a shorter refetch would turn into `null` holes.
- **`Set to null` and `Empty this array`** round it out - null, `[]` and absent are three different lies.

**Number input: coarse and fine stepping** (2026-08-10, user-raised) - drag-to-scrub plus the
step modifiers, built as one feature over `stepBy(direction, { multiplier, markTouched })`. Settled
with the user before building:

- **The stepper buttons own the drag**, via `dragGestureFrom(event, button, { commitThreshold: 8 })` -
  no new chrome, same primitive as slider/rating/table-reorder. The press has already stepped once and
  armed the repeat by the time a drag can be told from a click, so `start` cancels the repeat and that
  first step stands. The catch-up move that arrives with `start` is swallowed, or the value jumps two
  steps the instant the drag commits.
- **No pointer lock** - the scrub ends at the viewport edge. `requestPointerLock` would take
  `dragGestureFrom`'s coordinates out of play, show Chrome's notification bar and hide the cursor.
- **Touched once at gesture end**, not per step, so scrubbing past a bound does not flash a validation
  error mid-drag. Keyboard and button steps still touch immediately.
- **Fine pointers only** (`event.pointerType === 'mouse'`), and `cursor: ew-resize` under
  `@media (pointer: fine)` is the affordance.
- **4px per `step`**, with the sub-step remainder carried across moves so a slow drag still moves.
  Sensitivity is per-`step`, never per-unit - `step="0.01"` and `step="1000"` both stay usable.
- **Arrow keys were taken over from the native input** so clamping, mixed state and `touched` are
  shared by every route into the value. `Shift` 10x, `Alt` 0.1x, `PageUp`/`PageDown` a flat 100x;
  `Ctrl`/`Cmd` left alone as a browser-zoom collision.
- The multiplier is read at press and holds for the whole gesture - `DragMoveEvent` carries positions,
  not key state.

Changeset `number-input-coarse-fine-stepping.md`. Verified headlessly in Chromium (19 checks: the
whole key vocabulary with no native double-step, scrub up/down, the document scrub cursor added and
cleared, repeat cancelled on commit, shift-scrub at 10x).

**Query devtools: a Settings tab** (2026-08-10, user-raised) - the scattered switches, and where
state is kept. Settled with the user before building:

- **A gear in the header, not a tab.** `isTabPrimary()` hides tabs holding nothing, so a Settings tab
  would push itself behind **More**. `'settings'` is a `DevtoolsTab` that is deliberately absent from
  the `tabs` array, so the body switch and the persisted `activeTab` work unchanged.
- **`queryDevtoolsSettings()` in `libs/query`, not the panel**, because the override store's scope and
  the response-history override are both read before the panel exists. Always `localStorage`, whatever
  the scopes say. `provideQueryDevtools()` inits it **first** - the calls under it read from it.
- **Scopes**: view state `session`, pins `local`, overrides **`none`** (unchanged default - the safety
  promise). `local` for overrides is allowed and loud; the restored bar names the scope. Changing a
  scope moves the store and clears the copy the old one left. IndexedDB is a disabled button carrying
  its reason.
- **Limits are live**: `maxEvents` (trims the log at once), `maxDroppedCacheEntries`, `responseHistory`
  (overrides the provider value, with a way back to it).
- **Mirrored, not moved** - the user's call. Search boxes are not mirrored: a filter term is not a
  setting. About stayed its own tab, also the user's call, so Settings does not host it after all.
- **Reset devtools resets the live state too**, not just the keys: the persistence effects would write
  the current state straight back.

Changeset `query-devtools-settings-tab.md`. Verified headlessly: scope migration between both stores,
the events cap trimming 16 → 10, response history handed back to the app, reset returning to Queries
with the settings intact.

**Query devtools: touch and sticky-toolbar fixes** (2026-08-10, user-raised while Settings was being
built) - every `:hover` in the panel is behind `@media (hover: hover)` so a tap no longer leaves a
control lit, the controls a row-hover reveals (copy, pin, override trigger) are always visible under
`(hover: none)`, and a sticky toolbar in the padded `.et-query-devtools-scroll` gets
`inset-block-start: -1rem` so it sticks flush instead of leaving the container's padding as a gap.
Changeset `query-devtools-touch-hover-and-sticky-toolbar.md`.

**Query devtools: an About tab** (2026-08-10, user-raised) - what is running, for a bug report.

- **Per-lib version constants**, generated by `tools/scripts/generate-version.js` from each lib's
  `package.json` and wired as a `generate-version` `dependsOn` of `build`. Committed, per the user.
  `@ethlete/types` was **left out on purpose**: it is types-only, so a constant there would be the
  first runtime JS it emits, and a compile-time package's version says nothing about behaviour.
- **The build/bump order was verified** (see the note kept below) - the publishing run always builds
  an already-bumped tree, so the constants are truthful.
- **`window.ethlete`**, the user's addition mid-build: the same object the tab shows, installed by
  `provideQueryDevtools()` (never at import time), so the versions read from the console like `ng`.
- **The app's own build info is generated, not typed** - `nx g @ethlete/core:devtools-about <app>`
  writes a `build-info` target, makes `build` and `serve` depend on it, and points an argument-less
  `provideQueryDevtools()` at the constant. Gitignored, because its SHA would otherwise change in
  every commit. 7 generator tests, one of which executes the emitted script for real.
- **The tab body is `<et-query-devtools-about>`, a section with no tab chrome**, so the Settings work
  can host it verbatim rather than growing a second near-identical tab.

Changeset `query-devtools-about-tab.md`. Verified headlessly: tab renders all three groups, Copy
flips to "Copied", `window.ethlete` reports the three loaded packages.

**The publish build/bump order** (kept - the Settings and mock items rest on the same reasoning):
`publish.yml` builds _before_ `changeset version`, which reads as "always one release behind". It is
not: the bump lands as its own commit (`chore: 🤖 update prereleases`), that commit triggers the next
run, and that run finds no changesets left and builds already-bumped sources. Verified 2026-08-10
against the registry: every `@ethlete/core` prerelease was published minutes _after_ the commit that
wrote that exact version into `libs/core/package.json` - `next.42` 10 min after `77f0a7759`, `next.43`
26 min after `e211c12cf`, `next.44` 11 min after `c51c80f37`.

**Query devtools: two pointer/window defects** (2026-08-10, both user-reported):

- **Resizing the float selected the whole panel.** Fixed in `@ethlete/core`, not the panel:
  `suppressTextSelection(doc)` counts concurrent gestures and sets `user-select: none` on the
  document root for the life of one, released on `end` **and** on `cancelled`. Wired into
  `dragGestureFrom()` and `ResizeHandlesComponent`, so every consumer of either gets it - the panel's
  own `--resizing` class stays for the docked-edge and pane-divider paths, which never went through
  the primitives. Changeset `drag-resize-suppress-text-selection.md`.
- **A pop-out orphaned on reload.** The host document's `pagehide` now closes the pop-up.
  `destroyRef.onDestroy` never ran because Angular does not destroy the application on unload.
  Re-adopting the named window across a reload - `window.open('', 'et-query-devtools')` - was **not**
  attempted and remains unverified; it is pop-up-blocker governed, and getting it wrong opens a second
  blank window. Verified headlessly both ways (the window survives a reload without the listener,
  closes with it).
  Changeset `query-devtools-popout-closes-on-reload.md`.

**Query devtools: the Queries list nests by path** (2026-08-10, was an `M` triage row with no section) -
an opt-in **⑂ tree** toggle beside the sort arrow, flat still the default. `query-devtools-query-tree.ts`
is pure and separately tested; two rules do the work the row warned about:

- **A node nothing branches off gets no folder row** (`flattenQueryPathTree`). The first build headed
  every route - `/flaky` above one `GET /flaky` - which is exactly the "tree is worse than the list"
  failure the row predicted, and it was only obvious once it was driven in the story. Only a node that
  splits the list earns a heading.
- **Single-child chains compress** (`buildQueryPathTree`), so `/api/v1/teams` is one row, not three.
- The tree is built from the route a row **shows**, the same string `groupKey` folds on, so `/post/1`
  and `/post/2` are two leaves under `/post`. Folders store **collapsed**, not expanded - a tree that
  opens closed shows one segment per route and answers nothing.

- **Rows drop the prefix their folder already states** (user-raised): under `/post` a row reads `…/1`,
  with the full route on the `…`'s `title`. `trimRouteSegments` splits whichever route segment the
  prefix ends inside and **refuses** a prefix the route does not start with, or one that would trim the
  whole route away - either would produce a tail that reads as a different endpoint.

The list template was restructured for it: the fold-group block and the empty state are `ng-template`s
now, shared by the flat and tree branches instead of duplicated. Changeset
`devtools-nest-queries-by-path.md`; 23 unit tests; verified headlessly 12/12.

**Query devtools: the Web Locks inspector** (2026-08-12, was the last `M` query devtools row, `A`+`D`)

- a **Locks** tab over `navigator.locks.query()`, which is origin-wide and therefore the only view in
  the panel that shows something outside its own tab. One row per lock **name**, not per `LockInfo`:
  held plus queued on a name is the number of tabs in that election, which is the same arithmetic
  `instanceCount` does. `query-devtools-locks.ts` is pure and separately tested (11 tests). The design
  calls the row was waiting on, all settled here:

- **`LockInfo` has no tab identity**, so the panel holds a **probe lock** under a name only this tab
  can have produced (`ethlete-devtools:probe:<randomId()>`) and reads its `clientId` out of the
  snapshot. Without it every row would read _some tab_ and the tab would be strictly worse than the
  `isLeader` chip. Probe locks are filtered out of the list - every open panel on the origin holds one.
- **It is its own tab, not a section on Auth or Cache.** It spans both (auth leader locks and poll
  locks) and it is the only thing in the panel that polls, so folding it into either would give that
  tab a refresh model it does not otherwise have. It carries **no badge count** deliberately: a count
  would mean polling the whole origin whenever the panel is open, so the tab folds behind **More**
  until it is opened - which is exactly the gate that keeps the polling cheap.
- **Web Locks has no change event**, so it polls the existing 1s clock, gated on the panel being open,
  the Locks tab being the active one and the page being visible. Composed as one RxJS stream off a
  `computed` gate rather than a `locks.query()` inside an `effect`, per the styleguide.
- **Read-only, and the tab says so.** A tab cannot release another tab's lock - the platform has no
  such call - so the "force an election" idea in the old section was dropped rather than built; the
  only lock this tab could drop is its own, which belongs with faults/tampering if it is ever wanted.
- **The no-Web-Locks case renders a sentence, not an empty table**, keeping the distinction the
  leadership chip's `every tab refreshes` makes: no locks and no coordination mean opposite things.

`QueryDevtoolsLeadership` was renamed `QueryDevtoolsChip` - the leadership chip and a lock standing are
one shape. Changeset `query-devtools-locks-tab.md`; verified headlessly across two tabs (leader reads
`holds it`, the second `waiting · #1`, a hand-taken `et-query-poll:` lock decodes to its key + channel,
and leaving the tab releases the probe).

**Query devtools: the layout menu, plus left and top docks** (2026-08-10, user-raised while the float
was being built) - the header's dock-cycle and Pop out buttons became one menu naming where the panel
is. `dock` grows `left` and `top`; `sideDocked()` is what both the pane axis and the resize maths key
on, and the resize is "distance from the pointer to the attached edge", which is the pointer's own
coordinate for a leading edge and the viewport minus it for a trailing one. The menu is a **plain
absolutely-positioned list**, not an `et-menu` overlay - for the same reason the tab overflow menu is:
an overlay renders into the app's document, and the panel can be living in the pop-up's. Changeset
`devtools-layout-menu.md`; verified headlessly 13/13.

Two bugs the headless runs missed and the user hit, both fixed there and both worth remembering:

- **`<et-resize-handles>` blankets its host on a coarse pointer.** Its `@media (any-pointer: coarse)`
  rule swaps the bands to `20px`/`28px`, which covered the float's whole title bar and the header's
  trailing edge - nothing in either could be pressed. The float now caps the touch sizes and carries a
  frame exactly their thickness (`padding-inline` / `padding-block-end`), because the handles are
  pinned to the **padding box**, so a frame their width keeps them off the panel's own controls. Any
  future host of that component needs the same treatment.
- **A dropdown inside the header strips was clipped.** Below `md` both strips are `overflow-x: auto`,
  and a scroller clips absolutely-positioned children - so the layout menu opened invisibly. Both
  strips now go `overflow: visible` while a menu is open (`:has()`). The tab overflow menu had the
  same latent bug and is fixed by the same rule.

**Query devtools: the panel floats in the page** (2026-08-10, was "pop out to a window _or_ float inside
the page") - `dock` grows a third value, `float`, with a persisted `{ x, y, width, height }`. The one
dock button now cycles bottom → right → float, always naming the next one. Worth not rediscovering:

- **It reuses the stream pip's primitives**, on the user's prompt: `[etDragHandle]` for the title bar
  and `<et-resize-handles>` for all eight edges, both from `@ethlete/core`. The first draft hand-rolled
  pointer tracking through the panel's own `ResizeDrag` union; that is gone. Both primitives bind to the
  global `document`, which is safe here only because `floating()` is false while popped out - the docked
  edge and pane dividers still need `ResizeDrag`'s `doc`, because they run in the pop-up's document.
- **The clamp is one pure function**, `resizedFloatRect` → `clampFloatRect`, and three things run into
  it: a drag, a viewport resize, and a rect restored from `sessionStorage` into a smaller window. The
  restore case is the one that is easy to miss - it is covered by the effect that watches `viewport()`.
- **The title bar is a move handle, not a resize one.** It first shipped with the docked handle's pill
  grip and immediately read as a duplicate control; it is a dot grid now. The `n` edge handle still
  overlays its outermost 6px, which is how a real window behaves.
- **`paneAxis` keys on the float's own width** (620px), not the viewport - a float is sized by the user.
- **Parking came from the pip too**, on the user's second prompt: a drag more than halfway past the
  left, right or bottom edge stays there with a ~44px grab strip, and a click on the title bar
  (`dragTapped`, which is why `commitThreshold` is the default 8 rather than 0) brings it back. **North
  is never a parking edge** - the title bar is the only handle that drags it back. A parked panel
  disables its resize handles, or they would eat most of the peek there is to click. The pip's snap
  animation, `viewportPadding` and sticky-edge resize behaviour were **not** ported: that is
  video-player UX and a lot of surface for a debug panel.
- Fixed alongside, as the section asked: a **blocked pop-up no longer fails silently**. It raises a
  neutral notice bar with "Float instead", which is exactly the fallback floating gives it.

Changeset `devtools-float-the-panel.md`; 9 unit tests on the resize maths; verified headlessly 18/18
(cycle, drag, resize, clamp, reload, pointer pass-through, blocked pop-up), 4/4 on restoring a stale
rect, and 6/6 on the pop-out round trip from a float.

**Query devtools: the value explorer copies the key and the path** (2026-08-10, was its own section) -
the user settled the open call in favour of a **menu on the copy button**: `⧉` still copies the value
in one click, and a caret (`▾`) beside it opens Value / Key / Path / `"key": value`. Notes:

- **The menu only picks.** `QueryDevtoolsCopyMenuComponent` emits a `pick` output and the explorer
  node owns the clipboard write, so all four payloads share one implementation and one tick.
- **`copied` is no longer a boolean** - it holds which payload landed, and `copyLabel()` reads
  "Copied the path". That was the section's last open point and it falls out of the same change.
- **The path format now has one home.** `appendJsonPathStep` / `formatJsonPath` live in
  `query-devtools-diff.ts` and the diff's own walk uses the first of them, so the Path column and
  "Copy path" cannot drift.
- **Nodes without an address get no caret**: the explorer root and a folded slice. An array element
  gets one, but only Value and Path - its key is an index.
- Fixed in passing: `DEFERRED_STYLES` was missing the override menu's stylesheet, so a popped-out
  panel lost the `✎` chrome. Both menu style sheets are in it now.

Changeset `devtools-copy-key-and-path.md`; 3 unit tests on the formatter; verified headlessly: 12/12.

**Query devtools: response overrides survive a reload** (2026-08-10, was its own section) - a
panel-wide **Keep across reloads** toggle beside "Reset all overrides", backed by
`query-devtools-override-persistence.ts` in `libs/query`. Four notes worth not rediscovering:

- **The wrap happens in the registry, not the panel.** `registerEntry` passes each query's recorder
  through `withQueryDevtoolsOverridePersistence(id, recorder)`, which both replays the stored ops
  and writes on every later arm/clear. Replay has to happen at registration - a query can run long
  before the panel is ever opened, and the panel is not what the ops belong to.
- **Turning the toggle on captures what is already armed**, so it reads as "keep these" rather than
  "keep the next ones". That is why the module tracks `armedRecorders` (only recorders holding at
  least one op, so it stays bounded) rather than reading the registry - which would be a cycle.
- **The banner's subject is the previous load, not the store.** `carriedOver` is frozen at init and
  `replayed` fills as entries claim ids, so a freshly armed op never shows up in it. An id nothing
  claims is reported as "matched no query" - the failure mode the section asked to make visible -
  and `describeEntryId` in the panel turns `query|<client>|<method>|<route>#<n>` back into prose.
- **Armed faults deliberately stay out.** A fault is a client-wide switch with no path to point at,
  so a persisted one fails every request from the first load with nothing on screen to attribute it
  to. The Faults tab already told the user its arming is not persisted; that stays true.

Changeset `devtools-overrides-survive-a-reload.md`; 9 unit tests; verified headlessly against the
devtools story across a real reload: 15/15.

**Auth: `shouldAutoLogin`** (2026-08-10) - `withPersistentAuth`'s `autoLogin` config takes
`shouldAutoLogin?: (url: string) => boolean` next to `excludeRoutes`. The two are **independent
vetoes** - either refusing skips auto-login - chosen so a predicate can never re-enable a route the
prefix list excluded, which makes the two safe to introduce in either order. `excludeRoutes` keeps
its prefix matching and now says so in its JSDoc, naming the `/reset-password` vs
`/reset-password-templates` case the section was written about. The devtools panel gains an "auto
login predicate" row when one is set. **This was the last open auth item.**

**Color input: hex/RGB validators** (2026-08-10) - `hexColor()` and `rgbColor()` in
`forms/color-input/color-input-validators.ts`, following `requiredLanguages`' shape (a `validate()`
wrapper taking a derived path type, a `kind`, and an overridable `message`). `hexColor` is strict
`#rrggbb` by default - what the control documents and what the native picker emits - with
`allowShorthand` and `allowAlpha` as opt-ins; `rgbColor` takes both the comma and the space form and
range-checks the channels in code rather than in the pattern. Both **pass on a blank value**, so
`required` stays the one validator that reports emptiness. The **contrast validator stays unbuilt** -
it needs a cross-field read that nothing in `libs/forms` does yet.

**Accordion: the header's hover response** (2026-08-10) - the edge-to-edge tint kept its 7% wash and
gained two companions, both through the `--_et-*` indirection button uses for `border-color`: the
accordion's own bottom hairline mixes 35% of `--et-surface-interaction-solid` into the border colour,
and the hint and chevron share a `--_et-accordion-secondary-color` that goes muted → solid. The three
are paced by a new public `--et-accordion-color-duration` (120ms), split out from
`--et-accordion-duration` so the pointer response is tunable separately from the collapse. Hovering
the trigger has to reach the host for the hairline, hence `:has()`. Two deliberate extras: all hover
states moved behind `@media (hover: hover)` (they used to stick on touch), and reduced-motion now
drops only the chevron's rotation, not its colour fade. Disabled headers respond to none of it.

**Progress steps: outcome states** (2026-08-10) - `ProgressStepState` grows by `success`, `warning`
and `error`. Each is a _resolved_ state: it fills the marker and the connector after it the way
`complete` does, but with its own icon (check / triangle-exclamation / times, so the outcome never
rests on colour alone) and with the app's matching semantic theme forced onto the step through
`ProvideColorDirective` - the same per-`type` mechanism banner uses. No new colour rules were needed;
the existing accent declarations already read `--et-theme-color-primary-solid`, which now resolves
inside the step's own scope. Labels use `--et-theme-color-ink-solid`. Themes are injected only for
the state actually rendered, so a flow that never fails still needs no `type: 'error'` theme.

**Query error rebuilt on banner** (2026-08-09) - `et-query-error` is now an `et-banner` of
`type="error"` rather than a second implementation of the same tinted card. The duplicated
`color-mix` surface, the icon slot and the `ProvideColorDirective`/`injectErrorTheme()` wiring are
gone from query error; `type="error"` already resolves the app's error theme and provides the colour
scope, so `color` just forwards. Banner grew the two slots the composition needed -
`[etBannerHeading]` and `[etBannerBody]` - because query error needs a real `<h3>` (and its
`etQueryErrorTitle` template) and a violation `<ul>` where banner had only string inputs. Two calls
the user settled: the panel **adopts banner's row layout** (icon beside the content, 16px padding,
14px heading) rather than banner growing a stacked orientation, and the seven `--et-query-error-*`
tokens are **retired** in favour of `--et-banner-*` rather than aliased - hence the `major`
changeset. Two things worth keeping in mind: a nested live region announces twice, so banner also
gained `liveRegion` and query error passes `null` (the host keeps `role="alert"`); and banner's
`> [etBannerAction]` rule had never matched, because the action projects into `.et-banner-content`
and was never a child of `.et-banner`.

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

**Scheduler: the mobile trio** (2026-08-07) - swipe navigation, the today button as an icon button,
and add-appointment as a FAB, all three at once because they share the same width question. Four
things worth not rediscovering. **The narrow branch needs a signal, not just a container query** -
a FAB is a different component from a text button, not a restyled one, so the swap is `@if`, and
`signalHostElementDimensions()` is what gives the component the same 480px the stylesheet already
reflows the header at. The two now have to move together. **A projected icon cannot sit inside an
`@if` in the consumer's template** - `ng-content select="[etIcon]"` never matches it, and it lands
in the default slot instead, which for a collapsed `et-fab` means an invisible button. The
conditional therefore wraps the whole `<button et-fab>`, once per shape. (The pre-existing
`et-button` toolbar action has the same bug, harmlessly - its icon renders inside
`.et-button-contents`.) **`floating-action` had to go inside the narrow branch**, not on the
scheduler host: `disabled` is an `input()` a host directive cannot bind, and its dev-mode
missing-anchor assert fires when the wide branch renders no anchor. The cost is giving up
`etFloatingActionScope` (the body is not a DI descendant of a directive inside the header), so the
FAB floats for the rest of the page - the primitive's documented default, and right for a
page-filling scheduler. And **the swipe is touch-only and listens through the renderer**: a
horizontal mouse drag is drag-to-create, and `preventDefault()` on a non-passive `touchmove` is what
both stops the page panning and swallows the tap the browser would synthesize on release - without
it, swiping across an appointment opens it. It drops out entirely once `draftRange()` is set, so a
long press that armed the view's own gesture keeps it.

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
  `resizeEdges()` drops the axis that cannot move; an empty `items` clears the grid;
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
  `items` reconciliation and the imperative API (`restoreState`, `getSerializedState`,
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
  (it moves or resizes that appointment instead, shipped 2026-08-11 - see "Already fixed"); a
  sub-threshold press stays a click; `pointercancel` clears without opening.
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
  **Verified on real iOS Safari 18.6** (iPhone 16 Plus simulator, 2026-08-12), which closes the last
  blocked row: the long press draws its range, every `touchmove` comes back `defaultPrevented` and
  the grid's `scrollTop` never moves, a quick swipe still scrolls instead of drawing, the month long
  press selects no text (`getSelection().rangeCount === 0`, so `-webkit-touch-callout` holds), and
  release opens the create surface. A press that starts on an appointment moves it and draws
  nothing. Nothing had to change.
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

Query pass 2 (2026-08-07):

- **Persistence store ordering** (`e7ffcfc50`, no backlog section - found by the source audit). Store
  mutations were not ordered against writes in flight, so a logout purge or `clearPersistedQueries()`
  starting while a batched write was on its way to disk left the secure response on disk. Every store
  task now runs through one `enqueue` chain in `query-persistence-engine.ts`. `maxEntries` is applied
  at startup too, not only by a write, so a store left over the cap by a lowered limit or by several
  tabs enforcing against their own in-memory index shrinks back. Two regression tests in
  `query-persistence.spec.ts`, both verified failing first. Also corrected two docs claims: the
  `maxEntries` row, and "Gating the first paint", which implied `whenPersistenceReady` removes the
  empty first tick - it does not, it only takes the index load off that path.
- **Query devtools: Execute throws ET003 on a function-route query** (was its own section, `f523fb264`) -
  **Execute** passes `queryArgs(query)` instead of letting `execute` fall back to its default, so a
  query executed imperatively replays the args the panel is showing. The precondition the section
  omitted: the lib refuses to create a function-route query without `withArgs` (`ET100`, guard at
  `libs/query/src/lib/http/base-query-factory.ts:58`), so the bug was only reachable through the
  `silenceMissingWithArgsFeatureError` escape hatch - which is why reproducing it needed a new
  `QdImperativeCardComponent` demo card. Changeset `devtools-execute-replays-shown-args.md`.
- **Query devtools: "Forget" shows while the Gone chip is off** (was its own section, `33e705bfb`) -
  gated on the chip being lit, so what it deletes is what is on screen, and styled as the destructive
  action it is rather than borrowing `.et-query-devtools-filter-clear` and its `✕`. The section
  described a gating slip; the button was also clearing the **whole registry** - every client, past
  any active search - because `clearQueryDevtoolsTombstones()` was all-or-nothing. It now takes an
  optional id list and the panel passes the rows it is listing, so the label (`Forget n`) states
  exactly what goes. Changeset `devtools-forget-gated-on-gone-chip.md`. Verified headlessly: 12/12.
  Carried over from that section, because it is not a bug and should not be re-reported: the tab
  badge reading 17 while the toolbar count reads 18 is correct. The badge counts live entries
  (`liveQueryEntries`), and `scopedQueryCount` adds the one tombstone the detail pane has selected -
  `listsTombstone` keeps a query that died under the detail in the list on purpose.
- **Query devtools: the args explorer renders `HttpHeaders` inside out** (was its own section,
  `7d6bc17bb`) - both scope calls the section left open were settled by the user: teach the explorer
  about non-plain objects generally (not just headers), and keep **Args** raw - no merged
  `resolveHeaders()` node, since a heading that says args must not quietly show where a header came
  from. `query-devtools-exotic.ts` reads `HttpHeaders`, `Map`, `Set`, `FormData`, `File`, `Blob` and
  `Date`, and names a function (`fn(headerProvider)`) instead of dumping its source; `entriesOf`,
  `displayOf`, `matchesDeep`, the container preview and `copyValue` all go through it, so search and
  copy stopped lying too. The editor half needed more than the section expected: headers round-trip
  as a plain record and are rebuilt with `new HttpHeaders(...)`, but `FormData`/`File`/`Blob`/`Map`/
  `Set`/a header provider **cannot** survive JSON at all, so they are left out of the draft and
  restored verbatim at any depth - a key the user deletes still stays deleted. A `Date` is
  deliberately editable, since its ISO string is what the request would send anyway. Changeset
  `devtools-exotic-arg-values.md`, 10 unit tests, verified headlessly 19/19 against a new
  `QdExoticArgsCardComponent`. Still true and worth keeping: interceptor-added headers are invisible
  to the SDK, so no view here can claim to be the complete set.
- **Query devtools: copy the route from the query detail header** (was its own section) - a `⧉`
  beside the route, matching the value explorer's, resolved the way the section proposed: the
  absolute URL of the last request when there is one, the rendered route as the fallback, and the
  `title` naming which plus the exact string. `queryRoute()` stayed private; `copyableRoute` /
  `copyableRouteTitle` / `copyRoute` are the public surface. The section's worry about a fifth
  `copied` boolean did not bite - `copiedRoute` joins the existing four on the one `copiedReset$`,
  and keying by action is still only worth doing when two of them can be on screen at once. One
  layout note the section did not anticipate: `.et-query-devtools-route` is `flex: 1 1 auto`, which
  would have parked the button at the far edge of the head, so the detail head scopes it to
  `flex: 0 1 auto` and the button's `margin-inline-end: auto` keeps the chips right-aligned. The
  list rows are still a separate call, as the section said. Changeset
  `devtools-copy-route-from-detail-head.md`. Verified headlessly: 22/22, both branches.
- **Query devtools: show `isLeader` on the auth tab** (the cheap half of the Web Locks inspector
  section, which stays for the inspector itself) - a `leader · ~2 tabs` / `follower · ~2 tabs` chip
  beside `authenticated`. The section's "**no new plumbing in `libs/query`**" was wrong, and the
  section's own "both fallbacks have to be legible" is why: `isLeader` reads `true` in three
  different situations - a won election, `leaderElection: false`, and a browser without Web Locks -
  and the feature exposed nothing to tell them apart. The panel could sniff `navigator.locks`
  itself, but not the config, and string-matching the `devtools()` description is exactly what
  `QueryDevtoolsFeatureDetail`'s "pre-rendered strings so the panel never has to know a feature's
  option shape" forbids. So `BearerAuthMultiTabSyncFeature` gained
  `leadership: 'election' | 'off' | 'unsupported'` (`@ethlete/query` minor, fed by a new
  `isSupported` on `InternalLeaderElection`), and the two non-election cases render as
  `every tab refreshes` with the reason in the `title`. The count is prefixed `~` and the tooltip
  says it is counted on the last announce. Changesets `auth-multi-tab-leadership-field.md` and
  `devtools-auth-leadership-chip.md`; two unit tests; verified headlessly 12/12 across **two real
  browser tabs**, including the follower's promotion when the leader closes.

- **Query devtools: the Queries list repeats the same query** (was its own section) - the user picked
  **collapse over the "network only" chip**, so no new signal was needed. Rows fold on **what the row
  shows** (live-or-gone + method + resolved route), deliberately _not_ on the registry descriptor the
  section pointed at: that descriptor is the route template, so `/post/1` and `/post/2` share it and
  folding on it would have hidden real data. Folding only identical-looking rows cannot hide a
  distinction the list was making. A group head reports the **worst** state among its members and
  carries `stale`/`tampered` if any does, and it stays open while it holds the selected query - a
  detail pane with no matching row reads as the list having lost it. `expandedQueryGroups` is on the
  host and persisted, because the tab component is destroyed on every tab switch. The section's other
  worry - that the counts would start lying - did not apply: the toolbar count still counts queries,
  not lines. Two lint traps on the way: `ethlete/class-member-order` (methods after properties) and
  `ethlete/no-trivial-wrapper-method`, which is why the host exposes the `expandedQueryGroups` signal
  rather than an `isQueryGroupExpanded(key)` forwarder. Changeset
  `devtools-fold-identical-query-rows.md`. Verified headlessly: 22/22, three real groups in the demo.

- **Query devtools: locate the selected query in the app** (was its own section) - a `⌖ Locate` action
  in the detail's action row, ungated by the Gone chip the way the exports are. All three of the
  section's "what to settle" points are handled as it proposed: an elementless query (root service,
  resolver, guard) gets the button **disabled with the reason in its tooltip** rather than absent,
  `checkVisibility()` turns a detached / `display: none` / collapsed-panel element into
  `⌖ Not on screen` instead of a box over unrelated page, and the tag reads **created here** so nobody
  reads it as where the data is rendered. One thing the section did not anticipate: with
  `behavior: 'smooth'` a rect measured once is stale for the whole scroll, so the box tracks the
  element per frame (`animationFrames()` under a `takeUntil(timer(LOCATE_HOLD_MS))`, 2.5s) rather than
  being positioned once. Angular's debug APIs were not used, as the section required. Changeset
  `devtools-locate-the-selected-query.md`. Verified headlessly: 17/17, including the hidden-element
  branch.

- **Query devtools: timestamp the Queries list, and let it be sorted** (was its own section, `A`,`D`) -
  the user settled the decision the section called "the actual decision": the column shows
  **`lastTimeExecutedAt`**, the control flips **direction only**, and never-executed rows rest at the
  bottom in _both_ directions rather than piling up at whichever end `null` falls. Every other point
  the section raised was honoured: `pinnedFirst` still runs last so pins survive the sort, tombstones
  tiebreak on `destroyedAt` (their `lastTimeExecutedAt` is frozen), the column is absolute
  (`host.formatTime`, no ticking signal), and the control sits beside the search box printing
  `recent ↓` rather than joining the OR-ing status chips. A folded group head shows the time of the member that placed it. Direction is persisted as
  `queryRecentFirst`. One thing to know when testing this: **every demo query loads in the same
  second**, so a flip changes nothing visible unless two queries are run seconds apart first.
  Changeset `devtools-queries-list-timestamps.md`. Verified headlessly: 17/17.

- **Query devtools: the History tab's diff is a scroll away from its own controls** (was its own
  section) - the section's first two "cheapest fix" bullets, both of them: the bodiless tail folds
  behind `Show N older runs with no body`, and `◂ Older` / `Newer ▸` in the diff header step the whole
  pair (keeping its gap, disabled at the ends of what is retained) so re-picking never returns to the
  table. **Split, not filtered** - a dead row between two live ones stays put, so the log keeps its
  order; folding is by "last row that still holds a body", not by predicate. The other two bullets were
  deliberately skipped: with the tail folded the table is at most a handful of rows, so its own scroll
  area and a second resizable pane would both be machinery for a problem that no longer exists.
  Measured 254px from table to diff folded against 429px unfolded. The section's open question -
  whether `setQueryDevtoolsResponseHistory` deserves a panel control - is **answered no**: the cap is
  applied as bodies are recorded, so raising it in the panel cannot recover the bodies already dropped,
  and a control that only helps future runs promises reach it does not deliver. It stays a
  `provideQueryDevtools({ responseHistory })` decision the app makes once. Changeset
  `devtools-history-diff-reachable.md`. Verified headlessly: 22/22.

**Auth: the proactive refresh never fired, and a missed one now comes back** (2026-08-09) - both
`S` auth rows, one pass. The scheduler in `bearer-auth-query-builders.ts` ended in
`timer(t).pipe(tap(() => true))` and its subscriber gated on that value - `timer` emits `0`, so the
gate was never open. Only an access token already past its refresh point when it arrived triggered a
refresh, through the separate `of(true)` branch. Every session was being renewed by the reactive 401
path alone, which is the missing piece the "logged out after being idle" chain needed: nothing was
refreshing ahead of expiry, so the refresh token was routinely spent long after the server had
rotated it. No test covered the timer - the two that now do are in `bearer-auth-provider.spec.ts`.
The re-arm sits on top: `executeRefresh` returns _why_ it declined
(`executed | noToken | delegated | busy | throttled`) and the schedule recurses through
`concatMap` for up to five attempts, at the throttle's remaining time, 5s, or `minRefreshInterval`
depending on the reason. Worth not rediscovering: **a token that is already due when it is applied
is declined as `busy`**, because the login that issued it still counts as in flight for the tick in
which the token lands - so before the re-arm, a short-lived token stranded its session on the very
first hop.

**Auth: a synced logout carries its cause** (2026-08-09) - the `{ type: 'logout' }` sync message
gained `cause`, read off `sessionEndCause()` untracked in the broadcasting effect. The receiving tab
reports `'inactivity'` / `'expired'` as they are - a session that ended on its own ended for every
tab - and only a deliberate `logout()` elsewhere still reads as `'otherTab'`, so "someone signed out
in another tab" stays distinguishable. A message without a cause (an older tab) falls back to
`'otherTab'`.

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

**`createGridAdapter` and the untyped layout keys - fixed 2026-08-12**, see "Already fixed, do not
re-report". The adapter now declares its breakpoints and types both directions against them, and
`GridItemConfig` takes a `TBp` parameter. What that fix does _not_ reach is the `et-grid` level: an
app writing items by hand still gets a runtime warning rather than a compile error when `[items]`
and `[breakpoints]` disagree.

**The `ET1904` dev check assumed registrations were the only composition** - fixed 2026-08-12, see
"Already fixed, do not re-report".

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

The early-return half is fixed (2026-08-11): `resolveItemConstraints` merges three layers -
defaults, the registration for the item's type, then the item's own inputs, which are unset
unless a consumer writes them - so refining one bound of a registered type no longer resets the
other three. What is left is the `perBreakpoint` shape above.

## Selection list: the tile variant that is missing

**Dropped on 2026-08-12** - the user removed it from the triage rather than settling its three
design questions. Kept here as research only; do not re-add it to the triage. The card
duplication this section opened with is fixed - see "Already fixed". What follows is what the
tile would have been.

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

The tile lands as a second sheet mounted the same way as `SelectionCardStylesComponent`, so a
consumer who never writes `variant="tile"` never injects it. It needs its own story in both the
checkbox-group and radio-group story files.

## Forms: time-zone handling and local-time UX

Raised by the user 2026-08-10; not yet researched against the source.

The date/time controls and the scheduler all deal in some notion of "when", and there is no stated
answer for which zone that is. The concrete want is **a way to show an input's date/time in local
time** - typically alongside the value the user actually typed, when the two differ.

The user's own constraint, verbatim: _"though we need to make sure this doesn't get confusing."_ That
is the whole difficulty. Two clocks on one field is a reliable way to make a form worse, so the
design has to earn each one:

- **Show the second reading only when it differs**, and only when the field's zone is genuinely not
  the viewer's - a field that already is local should look exactly as it does today.
- **Name both.** An unlabelled second time is worse than none; if it says `14:00` it must also say
  which zone, or it just reads as a contradiction.
- **Decide what the value _is_** before designing the display. Whether the control's model is a zoned
  instant, a wall-clock time plus a zone, or a naive local string changes every one of the above, and
  it is the thing to settle first.

Scope this against `forms/date-time/`, `DateRangeInputComponent` and the scheduler together - a
per-control answer would guarantee they disagree.

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

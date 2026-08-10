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
- **Infinite-scrolling agenda.** The agenda directive takes a plain array,
  no paging concept. `libs/query`'s `paged-query-stack.ts` and the legacy
  `infinite-query` module both exist, neither wired to scheduler. This
  should land as a documented consumer pattern against `paged-query-stack`
  - paging state belongs to whatever query backs the appointment list, not
    inside scheduler itself.

## Accordion

The border/label transition shipped 2026-08-10 - see "Already fixed". Nothing
else in this section is open.

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
directive/value contract - still open, still an `L`.

The **hex/RGB validators shipped 2026-08-10** (see "Already fixed"). A
**contrast validator** is the part that did not: it needs to read another
control's value, and nothing in `libs/forms` does a cross-field read today,
so its shape is a design question rather than a missing regex. Left open.

## Query devtools: a mock designer, with an export for the API team

**Phase 1 shipped 2026-08-10** (serve + author + a TypeScript export). What is left is phases 2 and 3.
Settled with the user before starting:

- **Export format: OpenAPI 3.1 path item** with a schema inferred conservatively from one example plus the
  designed body as `example`, and the document says it was inferred. Not TypeScript-only - though the TS
  side arrived in phase 1 as `⧉ TS` (`query-devtools-typescript.ts`), because a pasteable definition is
  what the frontend wants back.
- **Its own Mocks tab**, not a section of Faults and not a drawer entry.
- **Phasing: serve → design → export**, each with docs and a changeset.

### What phase 1 built

- `libs/query/src/lib/devtools/query-devtools-mocks.ts` - the library (persisted, scope
  `queryDevtoolsSettings().mocks`, default `local`) and the armed set (**never** persisted). Matching is
  client + method + path pattern (`:param` = one segment) + declared query params, and the armed mock
  naming the most query params wins.
- `resolveQueryDevtoolsMock` in the hook, consulted from `sendOrMock()` inside `sendWithFaults` - a mock
  emits a real `HttpResponse` (or `HttpErrorResponse` at 400+), through `timer` even at zero latency.
  `isQueryDevtoolsFaultInjectionEnabled` became `isQueryDevtoolsRequestInterceptionEnabled`.
- The tab: **New mock** (client, method, path, query, status, latency, JSON body - nothing checked against
  the registry, which is the point), the library list with arm/body/status/latency/delete, **Capture** from
  a live response (one row per route), the armed bar above every tab, the tampered badge on mocked queries,
  and armed mocks in the session export.
- 21 query tests, 10 for the TS snippet. Verified headlessly: authoring a route the app never calls, arming
  it, and the network staying quiet.

### Phase 2 - the designer

The reuse is the override menu's vocabulary (string/number/date presets, fill-recursively, duplicate array
item, duplicate array, pagination shrink/extend, the four pagination shapes it detects): today it only runs
against live data, and pointing it at a draft body is the authoring tool. Two seeds exist already (capture,
empty); **"start from the route's declared response type" is not possible** - TS types are erased, so there
is nothing to read at runtime.

**The user's ask, 2026-08-10:** seed and annotate from the app's **generated API types** - `MatchView` as
the base shape, `MatchId` as a field's type - so a designed body is a real view model rather than a guess.
That needs a source of truth for those types (a generated `.d.ts`, an OpenAPI document the app already has,
or a registry the app hands in); settle which before building.

### Phase 3 - the export

Raised by the user 2026-08-10. The big one: **design a response for a route, serve it to the app, and
hand the result to the API team as a spec.** Survives a reload by definition - the authoring is the
work.

None of the three things the panel already does is this, and the gap is worth being precise about:

- **Response overrides** are path-addressed edits replayed against a real response
  (`query-devtools-overrides.ts`). They need the route to exist and to return something first.
- **The JIT editor** freezes a body into one query's signals - panel-side only. The pipeline, the
  cache and every error feature never see it.
- **Faults** inject latency and failures per client, but only a status - never a body.

So the missing piece is a **route-level stub that replaces the request**. The hook point already
exists and is exact: `sendWithFaults` in `libs/query/src/lib/http/http-request.ts:352` resolves a
devtools decision per attempt, inside a `defer`, so retries re-roll it and the cache and error
features see the result exactly as they see a real one. A mock resolver is the same shape one level
up: given `{ clientName, method, url }`, return a response or `null`.

What that implies, concretely:

- **The request observes `events`, not a body.** A mock has to emit a real `HttpResponse` (and
  respect `reportProgress` where it is on), because `updateState(event)` consumes the event stream.
  Returning a bare object will not work.
- **A mock bypasses the interceptor chain.** No auth header is attached, so a mocked secure route
  does not exercise the token flow at all. That is usually what you want and occasionally a trap -
  it must be visible on the row.
- **Matching is by route pattern, not by devtools entry id.** Overrides key off an id that only
  exists once a query has registered; a mock has to be armable for a route that has never run - which
  is the entire point when the endpoint does not exist yet. Method + client + a path pattern with
  `:param` segments, matched against the parsed `routeParts` the registry already produces.
- **Everything must be labelled as fake, everywhere.** The Queries list already has a tamper dot and
  the shell already has a red "Faults armed" bar. A mocked response is a stronger lie than either and
  reuses both.

The **designer** half is where the reuse is, and it is substantial: the override menu's vocabulary -
string/number/date presets, fill-recursively, duplicate array item, duplicate array, pagination
shrink/extend, and the four pagination shapes it already detects - is a response generator that
currently only runs against live data. Point it at a draft body and it is the authoring tool, with
three seeds: capture a real run (one click from the Timeline's response history), start from the
route's declared response type, or start empty.

The **export** is a genuine design decision and should be settled first, because it determines what
the designer must capture:

- **OpenAPI 3.1 path item** with an inferred schema plus the designed body as an `example` is what an
  API team can actually merge. It needs types inferred from one example, and one example does not
  tell you what is nullable or optional - so either infer conservatively and say so, or let the
  designer mark fields.
- **A TypeScript type** is what the frontend wants back and is nearly free once a schema exists.
- **Insomnia/cURL already exist** (`query-devtools-insomnia.ts`, `query-devtools-curl.ts`) and export
  the _request_. The mock export is the response side of the same envelope, and exporting all
  designed routes as one document is what makes it a deliverable rather than a screenshot.

On persistence, the split that resolves the tension the override store documents: **the library of
designed mocks persists (`localStorage`, or IndexedDB if the size settings above land); whether a
mock is _armed_ does not.** Losing an hour of authoring to a tab close is unacceptable; an app that
silently serves fake data tomorrow morning is worse. Same restored-banner treatment as overrides,
and a size cap with a real message rather than a swallowed quota error.

**Scope boundary, and it needs stating up front: this is not MSW.** MSW intercepts at the network
layer, works in tests and in any framework, and is the right tool for a permanent fixture. What this
has that MSW does not is the registry - the panel already knows every route, its params, its
features, its auth provider and its last _n_ real responses, so seeding a mock from something that
actually happened is one click. Mock at the query-client layer, keep it a debugging and design tool,
and do not grow it toward being a test fixture runner.

## Query devtools: copy/paste around response overrides

Raised by the user 2026-08-10, asking for "copy and/or paste support for query response overrides,
including objects and arrays". **Checked against the source first, and most of it already ships** -
so the item is the four gaps, not the feature.

What exists today:

- **Copy of a whole subtree.** `copyTextFor()` in `query-devtools-json.component.ts:384` - containers
  copy their entire subtree as JSON, slices copy only the entries they cover, leaves copy a raw
  pasteable string. The `⧉ ▾` menu offers Value / Key / Path / `"key": value`.
- **Paste onto a node.** `Paste value` is an unconditional item in the override menu
  (`query-devtools-override-menu.component.html:83` → `pasteValue()` at
  `query-devtools-override-menu.component.ts:198`). It arms `{ type: 'set', path, value }`, and
  `set` already carries an arbitrary value, so an object or an array pastes with no change to the
  op model.

So the round trip works. The gaps:

- **Clipboard reads are the fragile half, and they fail silently-ish.** `pasteValue()` goes through
  `navigator.clipboard.readText()`, which is permission-gated and unavailable or prompt-gated in
  several browsers; the menu then says "Clipboard access is unavailable here" or "The clipboard read
  was blocked" and stops. That is very likely what "no paste support" looked like from the outside.
  A real `paste` event (`ClipboardEvent`) needs no permission anywhere and is the standard way out:
  keep `readText()` as the one-click path, and fall back to a focused box that accepts a genuine
  ⌘V. The `Custom…` inline editor is already the shape of that box.
- **A paste may not change a node's kind.** `armPastedText()` (line 241) rejects a paste whose kind
  differs from the node's - no array over an object, no object over a `null`. It reads as a
  safeguard against pasting a copied _path_ over a body, which is a real mistake to protect against.
  But "this field became an array" is exactly the API change worth rehearsing, and the panel's whole
  job is to lie to the app on purpose. **Decide**: keep the guard, drop it, or demote it to a
  confirmation on the menu item. Leaving it as a hard refusal is the one option that should not
  survive review.
- **No paste into an array as a new element.** `Duplicate this item` exists; its sibling does not.
  `set` at `path + [index]` covers append with no new op type, and insert-at-position is the same op
  with the tail shifted - or a `pasteArrayItem` next to `duplicateArrayItem` if the ordering has to
  survive a refetch that returned a different length.
- **The armed ops themselves cannot be copied.** This is the reading of the request that is
  genuinely unbuilt, and probably the more valuable one: copy the whole override set armed on query
  A and paste it onto query B, or into a ticket. `QueryDevtoolsOverrideEntry[]` is already plain
  JSON, and `query-devtools-override-persistence.ts` already serializes exactly that shape into
  `sessionStorage` - so the export is a formatting job, and the import is `arm()` in a loop. Paths
  are relative to the response root, so a paste onto a differently-shaped query simply reports the
  ops that no longer resolve, which `applyQueryDevtoolsOverrides` already computes as `staleIds`.

Both readings are worth building and they do not overlap; **ask which one is wanted first**. The
per-node gaps are an `S`; the op-set copy is the interesting half and shares its serialization with
the mock designer's import/export.

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

- ~~**Success/warning/error states**~~ - shipped 2026-08-10, see "Already
  fixed".
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

## Dropzone: the file-name bar sits on the preview permanently

Requested 2026-08-07. In the single-file preview, `.et-dropzone-preview-info` is pinned to the
bottom edge (`inset: auto 0 0 0`) as a dark blurred band over the image, and it never leaves - so
the bottom of every picked image is behind it for as long as the file is selected. Wanted: it
hides, or slides out under its own edge, while the pointer is over the preview, so the image can
be checked unobstructed.

This is CSS only - `.et-dropzone-preview:hover` needs no component state - but three things
decide whether it is correct:

- **The bar carries the upload progress.** `.et-dropzone-entry-progress` lives inside it and is
  the single-entry preview's only progress indicator, so revealing on hover during an upload
  hides live progress from the one pointer position a user is most likely to be in. Gate it: the
  bar stays while the entry is `uploading` (the progress row already exposes exactly that as
  `[data-active]`).
- **And on error it is the explanation.** `[data-status='error']` deliberately dims the image to
  `opacity: 0.15` "to keep the failure message readable"; hiding the bar there leaves a washed-out
  image and nothing saying why. Error keeps the bar too.
- **Hover-only means touch and keyboard never get it.** Wrap it in `@media (hover: hover)` the way
  the trigger's hover rule already is, so a touch device keeps a bar it can never reveal, and pair
  `:hover` with `:focus-within` - the preview holds the replace/remove buttons, so a keyboard user
  reaching them is in the same situation as a pointer over the image.

Not part of it: `.et-dropzone-preview-actions` (replace / remove, top-right) stays - it is the
affordance the hover is for. And the multi-file list needs nothing; `.et-dropzone-item-info` is a
flex sibling of its thumbnail, not an overlay.

On slide versus fade: a plain opacity fade is this repo's default for enter/leave, but the band
has `backdrop-filter: blur(12px)`, so a partial opacity leaves a half-blurred stripe mid-transition
and a `translateY(100%)` off its own edge reads cleaner - worth looking at both in the story before
picking. Either way it should animate on `--et-dropzone-transition-duration`, which the sheet's
`prefers-reduced-motion` block already collapses to `1ms`, so reduced motion comes for free.

## Dropzone: removing a prefilled value deletes it on the server

Found 2026-08-07, from an app that prefills a form with assets a partner had already submitted.

`resolveExisting` exists so a control can start with a value the server already holds. `removeEntry`
(`dropzone.directive.ts`) then treats that value exactly like one this session uploaded:
`isValueInControl` is true for both `SUCCESS` and `EXISTING`, so removing it fires the configured
`delete` request. For a file uploaded a moment ago that is correct cleanup. For a value that arrived
through `resolveExisting` it destroys a record something else already owns - in the case that
surfaced this, the media of a still-pending submission that another view renders.

The consumer cannot intervene. `DropzoneDeleteOptions` carries `{ value, injector }` and nothing
about where the value came from, and `executeDelete` is built from `config.delete` inside
`createDropzoneUpload`. The app worked around it by spreading the resolved config and replacing
`executeDelete` - an `@internal` field - which is the clearest evidence the seam is missing.

The directive already has what it needs at the call site: the entry's status is `EXISTING` rather
than `SUCCESS`. Two shapes for exposing it:

- **A flag on `DropzoneDeleteConfig`** - `includeExisting?: boolean`. Smallest change, reads at the
  call site as a policy, and keeps `executeDelete` internal.
- **An origin on `DropzoneDeleteOptions`** - `origin: 'uploaded' | 'existing'`, letting
  `executeDelete` decide per value. Only pays off if an app wants a _different_ request per origin,
  which nobody has asked for.

Take the flag. The default is the actual decision: `false` is what a form editing an existing record
wants and what the surfacing app needed, `true` preserves today's behaviour for anyone relying on
the delete firing. Deleting a value the control was _initialized_ with is destructive by nature, so
defaulting to `false` and making the cleanup case opt in is the safer asymmetry - but it changes
behaviour on a released API, so it needs a changeset that says so.

Either way, `deleteSucceed` / `deleteFail` must stay silent when the delete is skipped. A consumer
counting those outputs to reconcile its own state would otherwise be told about a deletion that
never happened.

## Segmented button group: `variant="tabs"` only half-looks like tabs

Reported 2026-08-07. The variant is documented as "underlines the selected segment instead
of filling it and drops the tonal track for a baseline rule" (`choice-inputs.md`), and it
does exactly that and no more - the shape changed, the tab _styling_ did not. Put the two
side by side and they read as different components, which is the one place the variant is
meant to be used.

**Nothing is shared between them, and there is nothing to share.** The tab styles are an
inline `styles:` block in `tab-group.component.ts`, scoped to `.et-tab-group__*`; the
segmented ones are `segmented-button-group.component.css` + `segmented-button.component.css`,
scoped to the element selectors. The two were written independently, so every value below
diverges by accident rather than by decision.

What actually differs, all of it checkable in those three files:

- **The underline is a different object.** Tabs: `--et-tab-group-underline-size` is 2px at
  `sm`/`md` and 3px at `lg` (3/3/4 under `variant="primary"`), with a 1px
  `--et-tab-group-underline-radius`. Segmented: a flat
  `--et-segmented-button-tab-underline-size: 3px`, radius equal to the thickness, so it is a
  fully rounded bar - and it does not respond to `data-size` at all, where the whole point of
  the tab token is that it does.
- **The baseline rule is thinner and darker.** Tabs draw it as the header's `::after`, at the
  underline's own thickness, in `--et-surface-border-solid` at `opacity: 0.2`, and let
  `data-divider="false"` remove it. Segmented hardcodes `box-shadow: inset 0 -1px 0 0` in the
  same token at full opacity, with no opt-out. A 1px full-strength hairline under a 3px
  underline is most of why the two rows don't match.
- **The accent tokens are swapped.** Tabs put the accent in the underline
  (`--et-theme-color-ink-solid`) and keep the active label neutral
  (`--et-surface-color-solid`). Segmented does the reverse: the underline is
  `--et-theme-color-primary-solid` and the active _label_ takes
  `--et-theme-color-ink-solid`. Idle labels differ too - `--et-surface-interaction-solid`
  vs `--et-surface-color-muted-solid`.
- **The row is half as tall.** Tabs at `md` are 16px inline / 12px block at `1.4rem`;
  segmented at `md` is 14px / 6px at `14px`. Same size name, and `FORM_FIELD_SIZES` vs
  `TAB_SIZES` are the same three keys, so a consumer reasonably expects the same rhythm. The
  px-vs-rem split matters as well: the tab scale tracks the root font size and the segmented
  one does not.
- **Interaction feedback is the loudest mismatch.** Segmented paints a filled
  `color-mix(… --et-surface-interaction-solid 10% …)` rectangle behind any hovered _unchecked_
  segment - a tab bar never fills a tab. Tabs tint only the **active** trigger, at
  `rgb(var(--et-color-primary) / 0.08 | 0.12 | 0.16)` for hover/focus/press. And segmented
  presses with `transform: scale(0.97)`, so a whole tab shrinks under the pointer.
- **The focus ring lands somewhere else.** Tabs ring the inner
  `.et-tab-group__trigger-content` at `outline-offset: 2px`, so it hugs the label; segmented
  rings the full segment box at 1px. In a tall tabs row those look nothing alike.
- **Structure tabs has and this cannot express**: `data-orientation="vertical"`, `data-fit`,
  `data-divider`, and `variant="primary"` (label stacked under an icon, underline inset to
  the middle 50%). Not necessarily in scope - but "follows the tabs style" has to say which
  of these it means.

**The fix is a shared token set, not copied declarations.** Lifting the tab metrics into
`--et-tab-*` custom properties the segmented tabs variant can point at is what keeps them
from drifting again; copying the numbers across reproduces the same bug in a year. Two
things to settle before that:

- **How far the match should go.** The variant is deliberately _not_ tabs - it is a
  radiogroup, and the docs carry a warning saying so. Matching the pixels while behaving like
  a form control is the intent; matching `data-orientation` and `primary` starts rebuilding
  tabs inside a selection list. Draw that line first.
- **The tab styles are not in `@layer components`.** They are an unlayered `styles:` block
  under `ViewEncapsulation.None`, so they currently outrank Tailwind utilities - against the
  repo rule the segmented sheet already follows. Extracting shared tokens is the moment that
  gets fixed, and it is a visible-to-consumers specificity change, so it wants its own
  changeset line.

## Query devtools: a Web Locks inspector

Requested 2026-08-07. **The `isLeader` half of this section shipped** - see the Query pass 2
entry. What is left is the inspector, which is a genuinely different thing: `navigator.locks.query()`
is **origin-wide**, so it sees the locks held and queued by every other tab, worker and service
worker - the one place in the panel that can show something outside its own tab. What it would
list, in full, today:

- `ethlete-auth:leader:<provider name>` - one per auth provider (`leader-election.ts`). Held plus
  pending on that one name **is** the tab count; that is exactly how `instanceCount` is derived.
- `et-query-poll:<channel>:<key>` - one per polled cache key
  (`query-client-features.ts` → `createQueryKeyLockManager`).

What decides whether this is worth building:

- **`LockInfo` has no tab identity.** It is `{ name, mode, clientId }`, and there is no API for
  "my `clientId`" - so a raw dump can say _three tabs want this lock_ but not _you are the second
  in the queue_. The way out: hold a uniquely-named probe lock when the panel opens, find that name
  in the snapshot, and read its `clientId`; every other row can then be marked as this tab or
  another one. Without that step the inspector is strictly worse than the `isLeader` chip.
- **Web Locks has no change event.** That absence is why `leader-election.ts` runs a presence
  channel (`ethlete-auth-leader:<name>`) and recounts on a message instead of listening. An
  inspector therefore polls. The panel has a 1s `clock` already, but it ticks whether the panel is
  open or not and a `locks.query()` per second is not a `Date.now()` read - gate it on the panel
  being open and the tab being visible.
- **Decode the names, don't dump them.** The cache tab already answers "is this tab polling this
  key" from `lockManager.keyStates()` (`cacheSync`), so a flat list of `et-query-poll:…` strings is
  a step backwards from what exists. The value is the row saying which provider or which cache key
  a lock belongs to, and who is doing the work.
- **It is read-only by nature, and that is worth saying.** A tab cannot release another tab's lock;
  the platform offers no such call. The only lock this tab can drop is its own, so "force an
  election" means releasing the local hold and letting the queue promote whoever is next - which is
  a real way to test follower behaviour, and belongs with the faults/tampering vocabulary if it is
  built at all.
- **Both fallbacks are already legible, and the inspector must not undo that.** The shipped chip
  reads `every tab refreshes` rather than `leader` when there is no election, and prefixes the tab
  count with `~`. A lock dump that presents `isSupported: false` as "this tab holds everything", or
  a count as exact, walks both of those back.

Related, and already there: `withTracking` emits `leaderStatusChange` when leadership moves
(`bearer-auth-tracking.ts`), so the events tab has a source for "this tab became the leader" with
nothing new to record.

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

## Auth bug: logged out after being idle, with multi-tab sync on

Reported from real use 2026-08-07: a user came back from being away for a while and was logged
out. Multi-tab sync is enabled. Traced in source, not reproduced yet. **Three different mechanisms
produce exactly this symptom**, so the first step is a read, not a fix.

**`sessionEndCause` already names which one it was.** `logout(cause)` records it
(`bearer-auth-provider.ts`), and the union is the whole differential diagnosis: `inactivity` means
`withInactivityLogout` did what it says on the tin (15 minutes by default) and this is not a
refresh bug at all; `expired` means a refresh failed for good; `otherTab` means the logout arrived
over the sync channel and was decided somewhere else; `user` means it was a click.

**Fix the thing that makes it undiagnosable first: `otherTab` erases the reason.** `SyncMessage`
is `{ type: 'logout' }` with no cause on it, and the receiver calls `context.logout('otherTab')`
(`internal/multi-tab-sync.ts`). In the multi-tab setup this report comes from, the tab the user was
actually looking at can therefore only say _another tab did this_ - while the tab that decided is
most likely a background one nobody will ever inspect. Put the originating cause on the message and
keep it on the receiving side (`otherTab` plus an origin cause, or a separate signal). It is small,
and without it this class of report cannot be answered from the app at all. The devtools half of
the same gap: the auth tab renders neither `sessionStatus` nor `sessionEndCause` today.

**The reporting app rules the inactivity mechanism out.** `hubApiClientAuthProvider` in
`fut-frontend` (`libs/queries/hub/src/lib/hub-api/hub-api.client.ts` - the provider behind the
reported `ethlete-auth-sync:hubApiClient` channel) configures exactly two features:
`withPersistentAuth({ defaultRememberMe: true, cookie, autoLogin: { queryKey: 'tokenRefresh' } })`
and a bare `withBearerAuthMultiTabSync()`. **No `withInactivityLogout`.** And
`withRefreshQuery('tokenRefresh', …)` passes no `refreshStrategy`, no `minRefreshInterval` and no
`onRefreshFailure`, so every default below applies as written - including the one that logs out.

That leaves `expired` as the cause to expect, and makes the chain concrete: leader election is on;
the leader tab goes hidden while the user is away and its single `timer()` does not fire; a visible
follower's secure queries 401 and its `executeRefresh('unauthorized')` posts `refresh-requested`,
which a frozen holder never acts on and nothing re-posts; whenever a refresh does finally run, it
spends a refresh token the server has long since rotated or expired, the status is non-retryable,
and the default `onRefreshFailure` calls `logout('expired')` - which `syncLogout` then broadcasts to
every tab, where it reads as `otherTab`. **Confirm by reading `sessionEndCause` in the tab the user
was in and in the others**; `expired` in any tab points at this chain, `user` anywhere points
somewhere else entirely.

**The per-tab inactivity timer below is therefore not this bug - but it is still a bug**, and it is
the one that bites the moment any app turns the feature on.

**If inactivity logout is enabled, an idle tab logs out an active one.** `withInactivityLogout` tracks `mousedown`/`keydown`/`scroll`/`touchstart` **on its own
document**, so activity in one tab never resets another tab's timer, and `syncLogout` then
broadcasts whichever tab gives up first to all of them. A forgotten second tab times out after 15
minutes and logs the user out of the tab they are typing in. Two defects in that file feed it:

- **The timer is armed by activity only.** `inactivityLogout$` is
  `activity$.pipe(switchMap(() => timer(inactivityTimeout)))`, so a tab that never sees one of those
  four events never arms it - while `lastActivityTime`, which `resetTimer()` and the `accessToken`
  effect write, is read **only** by `calculateTimeUntilLogout`. So the public `resetTimer()` (and
  `enable()`) move the reported countdown without postponing the logout they claim to reset. Drive
  the timer off `lastActivityTime` and the two stop disagreeing.
- **Nothing is visibility-aware**, so a hidden tab counts down toward a logout its user had no way
  to prevent.

The design call underneath both: idleness is a property of the **session**, not of a tab - so
activity has to be shared (announced on the sync channel, or the timer owned by the leader) before
a per-tab timer is allowed to end a shared session.

**And the refresh path did have a real hole - it was bigger than the hypothesis.** Fixed 2026-08-09,
see "Already fixed"; the proactive refresh had never fired at all. What is still open here is only
the visibility half: there is no re-check on `visibilitychange`, and a `refresh-requested` message
is still fire-and-forget.

So the sleeping-leader story holds up in shape: a hidden leader tab that the browser freezes keeps
its Web Lock - the platform releases it when the client goes away, and a frozen page has not gone
away - while its timer does not fire. Followers do hand the event over rather than drop it
(`refreshCoordination.request()` posts `refresh-requested`, and only the lock holder acts on it),
but that message is fire-and-forget: no ack, no retry. If the holder is frozen, or leadership is
mid-handover, it is simply lost, and the follower has now burned its own timer too.

What that does **not** explain by itself: a session that stops refreshing produces 401s, not a
logout. It becomes a logout only through the `expired` path - once a refresh finally does run,
against a refresh token that has since expired server-side. That junction is the one worth
instrumenting first.

Verify before changing any of it: whether the browser in question actually freezes a page that
holds a Web Lock (holding one is a documented bfcache blocker; Energy-Saver freezing is a separate
policy), and whether a frozen page's `BroadcastChannel` messages are queued or dropped. If frozen
pages keep their locks, "the leader must prove it is awake" becomes a design requirement rather
than a nicety - and the Web Locks inspector item is the other half of answering it, because "which
tab is the leader, and has it been hidden for an hour" is not a question the panel can answer
today. `withTracking` already emits `leaderStatusChange`, so leadership moves have a recorded
source to correlate against.

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
an opt-in **⑂ tree** toggle beside the sort arrow, flat still the default. With it, the **Web Locks
inspector** is the only query devtools item left open. `query-devtools-query-tree.ts`
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

## Forms: validity is binary, and there is no warning state

Raised by the user 2026-08-10; not yet researched against the source.

A control is valid or invalid, and nothing in between. The missing middle is a **warning**: a value
that is accepted and submittable, but that the user should look at anyway - a password that meets the
rules yet is weak, a date far enough in the future to be a likely typo, a quantity above what is
normally in stock. Today the only way to say that is to render your own text under the field, which
means it neither reads like the field's own message nor takes the error styling's place in the layout.

The colour language exists already (`injectWarningTheme()`, `BANNER_TYPES.WARNING`, and now progress
steps' `warning` state), so this is not a theming question. The open questions are on the form side:

- **Where does the state come from?** Signal forms model validity, not advisories. Is a warning a
  separate signal the consumer sets on the control, a validator that returns a distinct severity, or
  purely a presentational input on `et-form-field`?
- **What happens to the error slot?** A field can be invalid _and_ warned. Do the two messages stack,
  does the error win outright, and does a warning survive submit the way an error does?
- **Does it block anything?** It must not - the point is that the form still submits. Worth stating
  in the guide, since `aria-invalid` must stay `false` and the message wants `role="status"` rather
  than the error's assertive announcement.

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

- **`CLEAR_QUERY_ARGS`** - only if the `withArgs` change above ships as a deprecated alias for
  `null`. Removing the alias (and the `ClearQueryArgs` type) is the major-version half.

# 10 — Rich filter (floating filter button)

**Status: DONE (2026-07-30). Layer 1 as `floating-action`, Layer 2 as `filter-overlay`.**
Size: S. Research done 2026-07-23 against `libs/cdk/src/lib/components/filter/`
(~290 lines — only `rich-filter/` exists).

## Layer 1 outcome (2026-07-30)

Shipped as `libs/components/src/lib/floating-action/` — the name chosen with the
team over `sticky-trigger` / `floating-trigger`, since the pattern is the FAB one
and "floating action" says so.

Renames: `et-rich-filter-host` → `[etFloatingAction]`, `et-rich-filter-button-slot`
→ `[etFloatingActionAnchor]`, `etRichFilterButton` → `[etFloatingActionTrigger]`,
`etRichFilterContent` → `[etFloatingActionScope]`, `etRichFilterTop` →
`[etFloatingActionTop]`.

Improvements over the cdk original:

- **One derived `data-state`** (`inline` / `floating` / `hidden`) instead of cdk's
  ten boolean state classes across two observed elements, with the combining left
  to consumer CSS.
- **The hidden trigger is properly unfocusable.** cdk scaled it to zero and left
  it in the tab order, so tabbing landed on an invisible button. `visibility:
hidden` is now applied, delayed to the end of the scale-out.
- **Reduced motion** honoured (cdk animated unconditionally).
- **Safe-area inset** added to the bottom offset, so the trigger clears a phone's
  home bar.
- `disabled` input, for turning the behaviour off per breakpoint/route without
  unwinding the markup.
- Structural CSS mounted via `injectStyleManager()`, so the directive-only
  composition works — same pattern as masonry.

**CSS-first alternative rejected, as the plan expected**: `position: sticky` can
pin to an edge but cannot move an element to a viewport corner, and cannot express
"and the region this acts on is still on screen" — which is the condition that
stops a pinned button following the reader onto unrelated content. Two
intersection observers it is.

Verified headlessly: all three states reached (the story's page had to be
lengthened before `hidden` was reachable at all — the results list could not
scroll fully past), `position`/`scale`/`visibility` per state, a stable tab-order
index across states, `scrollToTop()`, and `disabled` staying inline while scrolled.

## What it actually is (investigation result)

**Not a filter UI and not query-coupled at all** — zero `@ethlete/query`
imports. It's a scroll/visibility coordination pattern: a "Filter" trigger
button that becomes `position: fixed` (floating, scale-in animated) once its
inline slot scrolls out of view while the related content is still visible.
Built from `signalHostElementIntersection` + `signalHostClasses` (both
`@ethlete/core`) toggling state classes consumed by CSS; plus a
`scrollToTop()` helper. Five pieces: host component, button/button-slot/
content/top directives. No colors (structural/animation CSS only).

Table filter headers (originally lumped under "filter") are covered by
`01-table.md`; this file is only about this floating-button pattern.

## Real-world usage context (from the team, 2026-07-23)

In consuming apps, rich-filter is used **together with routed overlays**: the
floating filter button opens a filter panel as an overlay whose content is
router-driven. The glue util exists in cdk:
**`libs/cdk/src/lib/components/overlay/components/overlay/filter-overlay.ts`**
(`provideFilterOverlayConfig` + `FilterOverlayService`). Read it before
designing — its semantics are the spec:

- Config: `{ form: FormGroup, defaults?, searchPreviewQueryFn?,
totalHitsExtractorFn?, submitButtonConfigFn? }`, provided at the overlay
  component via DI token.
- **Draft isolation**: the service `cloneFormGroup`s the config's form — the
  overlay edits a copy; only `submit()` writes the draft value back to the
  real form and closes with `{ didUpdate: true, formValue }` (else
  `{ didUpdate: false }`). So the established apply model is **explicit
  submit**, with dismiss = discard.
- **Live results preview**: draft value → `searchPreviewQueryFn(formValue)`
  (via `queryComputed`/`switchQueryState`, legacy client types) → total hits
  (default `response.totalHits`, overridable) → **submit button config**:
  "Loading results..." (disabled), "An error occurred" (disabled),
  "No results found" (disabled), "Show one result" / "Show N results" /
  "Show more than 250 results". Hardcoded EN/DE tables selected via a
  `locale` param.
- `reset()` patches the draft to `defaults` (throws if none given).

The components lib already ships the overlay half:
`libs/components/src/lib/overlay/routing/` (overlay router, outlets,
`overlay-back-or-close`), `query-param-overlay-link.directive.ts`,
`sidebar-overlay.ts`, and `overlay-unsaved-changes-guard.ts`. What's missing
is this packaged pattern on top of them.

## Rewrite plan — two layers

### Layer 1: floating trigger primitive (the actual cdk port)

- **Generalize the name, drop the "filter" branding**: a generic floating
  action trigger (filter buttons, back-to-top, "save changes" bars).
  Suggested: `floating-action` / `sticky-trigger` domain; do not carry over
  `rich-filter` (it renders no filter). Stories could use a fab / extended fab.
- Port is mostly mechanical: the intersection-driven state classes
  (`signalHostElementIntersection` + `signalHostClasses` are already in core),
  CSS moved to `@layer components` `.css` with `:where()` modifiers, keep
  `scrollToTop()`.
- Consider `position: sticky` + scroll-driven animations as a CSS-first
  alternative; keep the IO-based approach if sticky can't express the
  "content still visible" condition (likely — IO version is fine).
- A11y: sensible focus order for the floating button, fixed variant must not
  cover content for keyboard users, reduced motion on the scale-in.

### Layer 2: the "filter overlay" composition (the improvement)

A modernized `FilterOverlayService` family in `libs/components` (follow
core's `createProvider` pattern), keeping cdk's proven semantics and fixing
its weak spots:

- **Keep**: draft-clone isolation with explicit submit/discard, `defaults` +
  `reset()`, the `FilterOverlayResult` contract, and the live
  results-preview-driving-the-submit-button UX — that's the feature's soul.
- **Modernize the form layer — signal forms, required**: cdk clones a raw
  reactive `FormGroup`; the new version is built on **signal forms** via the
  signals QueryForm (`00-query-form-signal-forms.md`) as the page's filter
  state owner — draft = clone of the query-form's fields (the signals
  QueryForm needs a clone/branch capability for this; add it to 00's API
  sketch); submit writes back through `queryForm.setValue` so
  `isResetBy`/URL sync fire correctly. No reactive-forms path in the new
  util — apps still on reactive forms keep using the cdk original until they
  migrate.
- **Modernize the query layer — reuse the shared query-adapter core**:
  `searchPreviewQueryFn` is typed against legacy clients
  (`AnyV2Query`/`queryComputed`/`switchQueryState`). The new preview query
  should be another thin wrapper over the **generic adapter core extracted
  from the select adapters in `01-table.md` Phase 0** (query lifecycle,
  reactive args rebuild from the draft value, loading/error derivation,
  per-client variants) — the same machinery behind `selectOptionsFromQuery`
  and the planned `tableRowsFromQuery`. The filter overlay only needs the
  non-paginated slice: draft value → args → single query, `loading`/`error`/
  response signals, from which `totalHits` and the submit-button state
  derive. This makes the filter overlay the third consumer of that core —
  factor the extraction with it in mind.
- **Locale**: `injectLocale()` instead of the `locale: 'en'|'de'` param
  (same fix as `09-query-error.md`); keep `submitButtonConfigFn` for full
  override.
- **Trigger**: the Layer-1 floating button, pre-wired to open the overlay,
  with an **active-filter-count badge** fed by QueryForm's
  `activeFilterCount`.
- **Overlay**: opened via the components overlay opener with **overlay
  routing** for multi-page filter panels (category list → options page →
  back), responsive positioning (bottom sheet on mobile / sidebar or dialog
  on desktop via the overlay system's existing responsive config), and
  optionally `query-param-overlay-link` so the open panel survives
  reload/back. cdk's util never handled the routed case explicitly — the new
  one should demonstrate it first-class in stories/docs.
- **Unsaved changes**: with draft isolation, dismissing with edits discards
  silently today — optionally integrate `overlay-unsaved-changes-guard`
  (config flag) to prompt instead.
- **Scroll restoration**: keep `scrollToTop()` reachable from the util (after
  applying filters, scroll the list back to top).
- Relationship to `01-table.md`: table filter _headers_ are per-column; this
  is the page-level filter panel. Both should express their state through the
  same QueryForm so URL serialization stays single-writer.

Dependency: **`00-query-form-signal-forms.md` is a hard prerequisite for
Layer 2** (the form layer is signal-forms-only). Layer 1 has no dependency
and can ship any time.

## Deliverables

Layer 1: directives + host, story with a long scrolling list. Layer 2:
provider util + directives, story demonstrating a routed filter overlay with
badge + apply/reset, docs page covering the full pattern (trigger → routed
overlay → QueryForm → URL). Changesets per layer (can ship separately;
Layer 1 first). cdk rich-filter stays untouched.

## Layer 2 outcome (2026-07-30)

Shipped as `libs/components/src/lib/filter-overlay/`: `provideFilterOverlay` /
`injectFilterOverlay`, `filterOverlayPreviewFromQuery`, the
`etFilterOverlaySubmit` / `etFilterOverlayReset` controls, locale-derived labels,
`ET4200`. Plus `apps/docs/components/filter-overlay.md`, 2 stories, 13 unit
tests, and a `minor` changeset.

Kept from cdk, as the plan required: draft-clone isolation with explicit submit
and dismiss-as-discard, `reset()`, the `FilterOverlayResult` contract, and the
live-results-preview-driving-the-submit-button UX including its label thresholds
(0 / 1 / n / more-than-N).

Modernized as planned:

- **Signal forms.** `queryForm` replaces cdk's `form` + `defaults`; the draft is
  `queryForm.branch()` rather than `cloneFormGroup()`. `branch()` already existed
  — the signals QueryForm was built with this pattern in mind (00's plan).
  `submit()` writes back via `queryForm.setValue()`, so the `isResetBy` graph and
  URL sync fire; verified by a test asserting `page` resets when `search` changes.
- **Current query client.** `filterOverlayPreviewFromQuery` replaces
  `searchPreviewQueryFn`'s `AnyV2Query`/`queryComputed`/`switchQueryState`. It is
  a factory-of-a-factory so the query is created in the _overlay's_ injection
  context; the shared adapter core from 01 Phase 0 was never extracted, and this
  needs only the non-paginated slice (creator + `withArgs`), so it does not
  depend on it.
- **`injectLocale()`** instead of `locale: 'en' | 'de'`; `submitButton` still
  overrides the resolver wholesale.
- **Routed panel** demonstrated first-class: `provideFilterOverlay` in the
  overlay's providers means every routed page injects the same draft. The story
  is a three-page panel with the submit/reset buttons in the shell footer.
- **Badge** fed by `activeFilterCount`.

### Deviations and findings

- **`reset()` needs no configured defaults** (cdk threw without them) — the query
  form knows its own.
- **cdk's no-preview bug fixed.** Its default resolver returned the _loading_
  state when query state and total were both null, which is exactly the
  no-preview case — so a filter overlay without a search preview had a
  permanently disabled submit button. There is now an explicit `hasPreview`
  branch. Covered by a test.
- **`isPristine()` added, and it is what the reset button uses.**
  `activeFilterCount` deliberately excludes navigation state (`search`, `page`,
  `sort`), so a reader who has typed a search has nothing to show in a badge but
  plenty to reset — using the count would have left reset disabled. Found while
  writing the tests.
- **`maxCountedHits`** is configurable (cdk hardcoded 250).
- **Typed by the filters' value shape, not their field map.** Naming the field map
  explicitly does not typecheck: `QueryFieldDef<T>` can hold a
  `valueToQueryParam: (value: T) => unknown`, making it contravariant in `T`, so a
  concrete field map does not satisfy `Record<string, QueryFieldDef<unknown>>`.
  Fixed at the source in `@ethlete/query` (that member is now method-syntax, hence
  bivariant — a `patch`), and the public API is typed via
  `FilterOverlayValueOf<…>` so consumers never have to name either.
- **Unsaved-changes guard integration deliberately not wired.** `hasChanges()` is
  exposed, which is the input such a guard needs, but making dismissal prompt by
  default would undo the "dismiss = discard" contract that is the point of the
  pattern. A consumer can compose `createOverlayUnsavedChangesGuard` with
  `hasChanges()` themselves.
- `scrollToTop()` stays on the Layer 1 floating action, reachable from the trigger
  after applying — no need to duplicate it here.
- The story uses plain buttons rather than form controls for the draft fields: it
  is about the draft/apply contract, and binding a draft field to an `<et-input>`
  is the forms guides' subject. Docs show the `[formField]` form.

### Also fixed in passing

Every story added in this port sequence used `etButton` (the _headless_ button
directive) with `variant`/`size`, which live on the `et-button` **component** — so
those attributes were silently inert, and one `[variant]` binding logged NG0303.
All five stories now use `et-button`.

# 10 — Rich filter (floating filter button)

**Status: planned, not started.** Size: S. Research done 2026-07-23 against
`libs/cdk/src/lib/components/filter/` (~290 lines — only `rich-filter/`
exists).

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
  `rich-filter` (it renders no filter).
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

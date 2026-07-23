# 00 — QueryForm, signals-first (prerequisite, lives in `libs/query`)

**Status: planned, not started.** Size: M–L. Not a cdk port, but a prerequisite
for `01-table.md` Phase 7 (URL state restore) and helpful for Phase 2
(server-side sort/filter). Research done 2026-07-23 against the current source.

## Current state (what exists)

Source: `libs/query/src/lib/query-form/` — `query-form.ts` (~740 lines,
`QueryField` + typed subclasses + `QueryForm` orchestrator),
`query-form.types.ts`, `query-form.utils.ts` (pure transforms + `Sort` type),
no specs. The only real consumer in-repo is
`apps/playground/src/app/query/form/form.component.ts`. Docs mention it in one
bullet each in `apps/docs/query/index.md` / `legacy.md` — no guide page.

Key facts a rewrite must respect:

- **Fields wrap `FormControl`**: `QueryField<T>.control: FormControl<T|null>`;
  subclasses (`SearchQueryField`, `SortQueryField`, `StringArrayQueryField`,
  `BooleanArrayQueryField`, `NumberArrayQueryField`, `DateQueryField`,
  `DateArrayQueryField`) preconfigure debounce + transform fns.
- **Field options** (`QueryFieldOptions<T>`): `defaultValue`, `debounce`,
  `disableDebounceIfFalsy`, `appendToUrl`, `appendDefaultValueToUrl`,
  `isResetBy` (fields whose change resets this one — how `page` resets on
  filter change), `skipInFilterCount`, `skipAutoTransform`,
  `queryParamToValueTransformFn` / `valueToQueryParamTransformFn`.
- **`QueryForm`** builds a real `FormGroup`, **monkey-patches its
  `setValue`/`patchValue`** (anti-pattern — drop in rewrite), exposes
  `observe()`/`unobserve()`, `setValue`/`patchValue` (with `skipResets`),
  `resetFieldToDefault` & friends, `changes$`/`changes`,
  `currentValue`/`previousValue`, `activeFilterCount$` (RxJS only), and
  `IGNORED_FILTER_COUNT_FIELDS = ['page','skip','take','limit','sort','sortBy','sortOrder','query','search']`.
- **URL sync**: writes via `router.navigate([], { queryParamsHandling:
'merge' })` inside `zone.run(() => queueMicrotask(...))`; default values are
  elided from the URL (unless `appendDefaultValueToUrl`); `null` uses the
  `'ET_NULL__'` sentinel; per-field debounce with **shortest-debounce-wins**
  when multiple fields change in one tick; `disableDebounceIfFalsy` makes
  clearing a search immediate; `syncOnNavigation` (default true) re-applies
  URL → form on back/forward via `injectQueryParamChanges()` (already
  signal-native, from `@ethlete/core`); `queryParamPrefix` namespaces keys so
  multiple forms coexist on one route.
- **Sort serialization**: `"active:direction"` (e.g. `"name:asc"`) via
  `transformToSortQueryParam` / `transformToSort`;
  `Sort = { active: string; direction: 'asc'|'desc'|'' }`. **The table's
  `TableState` URL adapter must serialize sort identically** so both systems
  stay interoperable.
- **Deserialization**: best-effort auto-coercion (numeric strings → number,
  `'true'/'false'` → boolean, sentinel → null) unless `skipAutoTransform` or a
  transform fn is given; `equal()` from `@ethlete/core` guards redundant writes.
- **Legacy client coupling is one-way and tiny**: `QueryForm` itself is
  client-agnostic; only `resetPageOnError` (in
  `libs/query/src/lib/legacy/query/query.utils.ts`) imports `QueryForm` and
  patches `form.controls[pageKey].patchValue(1)` on HTTP 416 / Pagerfanta
  out-of-range 500.

## Target design

**A signals-first sibling, not an in-place rewrite.** The reactive-forms
`QueryForm` is public API with external consumers — keep it untouched
(maintenance mode, like cdk). Ship a new implementation alongside, sharing the
pure parts.

Decisions for the implementer (with recommendations):

1. **It must stay a real form, built on Angular signal forms.** The primary
   use case is binding on-screen controls (a search input, a sort select, a
   filter checkbox group) directly to query-form fields — today that's
   `control` handed to `[formControl]`/`[formField]`. A plain-signals bag with
   DIY binding would lose exactly that, so: each query field wraps/exposes a
   **signal-forms field** that templates bind like any other control. The
   debounce/URL-sync/reset machinery layers on top of the field's value signal
   (signal forms makes that natural — field state _is_ signals), replacing the
   old `valueChanges` plumbing.
   - Verify at implementation time: signal forms' API status in the Angular
     version this repo targets (it was experimental through 2025 — check
     stability + our version), and **whether the components lib's `[formField]`
     bindings accept signal-forms fields**. If they don't yet, that adapter
     work is a prerequisite task inside this plan (the SDK's own inputs/selects
     must bind to these fields, or the feature is pointless).
   - Validation/touched/dirty semantics remain non-goals — we use signal forms
     for its binding + signal-native field model, not to validate.
2. **Naming/shape sketch** (align with the query lib's creator-function style):
   `createQueryForm({ fields, prefix? })` with field creators
   `searchQueryField()`, `sortQueryField()`, `queryField<T>({...})`,
   `stringArrayQueryField()`, … Each field exposes its bindable signal-forms
   field (the `control` analogue) plus `value: Signal<T|null>` and
   `setValue(v)`; the form exposes
   `value: Signal<QueryFormValue>`, `setValue`/`patchValue({ skipResets? })`,
   `resetField(s)ToDefault`, `activeFilterCount: Signal<number>`,
   `observe()/unobserve()` (or an `autoObserve` option — decide; keep explicit
   `observe()` if construction-vs-activation split has proven useful).
   Additionally a **draft/branch capability**: create a detached clone of the
   form (fields + current values, no URL sync) whose value can later be
   written back via `setValue` — required by the filter-overlay pattern
   (`10-filter.md` Layer 2, replacing cdk's `cloneFormGroup` usage).
3. **Reuse as-is** (framework-agnostic, import from current files or move to a
   shared internal module): `transformTo*` fns, `Sort` type, sentinel
   encoding + default-elision logic, `equal`/`clone` from core,
   `injectQueryParams`/`injectQueryParamChanges` for the read side.
4. **Feature parity checklist** (all of it is used or load-bearing):
   per-field debounce with shortest-wins batching, `disableDebounceIfFalsy`,
   `isResetBy` graph (+ `skipResets`), default elision,
   `appendToUrl`/`appendDefaultValueToUrl`, auto-coercion + custom transforms,
   `queryParamPrefix`, `syncOnNavigation`, filter count with the ignored-keys
   default, URL cleanup on destroy/unobserve.
5. **Known hard parts** (from research — design deliberately):
   - Debounce: **Angular signal forms reportedly has a built-in debounce
     feature — check it first** and prefer it over hand-rolling if it fits.
     Verify it can express the current semantics: per-field debounce times,
     shortest-debounce-wins when multiple fields change in the same tick, the
     immediate path when any changed field is undebounced, and
     `disableDebounceIfFalsy` (clearing a search syncs immediately). Whatever
     the built-in doesn't cover gets a thin custom scheduler on top — don't
     bend the semantics to fit the primitive.
   - The current reset flow (`isResetBy` resets folded into the same emitted
     diff via a subject-replay trick) is intricate — reformulate: compute
     resets + final value in a single pass before publishing the change, rather
     than replaying.
   - `zone.run(queueMicrotask(...))` around `router.navigate` — check the
     repo's zoneless posture at implementation time; prefer a zone-free
     formulation.
6. **`resetPageOnError` equivalent**: provide a signals-native counterpart that
   works with the current client (watch a query's error signal, reset the page
   field). Keep the legacy operator untouched.
7. **Table interop contract** (`01-table.md` Phase 7): sort serializes as
   `"active:direction"`; filters/search/page as individual params; a
   `TableState` URL adapter should be expressible as a thin mapping onto a
   query form instance (table state ↔ form fields), not a parallel URL writer —
   two systems writing query params independently will fight.

## Deliverables

1. New directory, e.g. `libs/query/src/lib/query-form-signals/` (final name up
   to implementer — must not break the existing barrel exports).
2. Specs — the old implementation has **none**; the new one must cover: URL
   round-trip per field type, sort format, debounce batching, `isResetBy`,
   default elision, prefix coexistence, back/forward sync, filter count,
   **and template binding of a field to a real control** (e.g. an input and an
   `et-select` bound to a search/sort field end-to-end).
   (Consider porting a few cases against the old implementation too if cheap,
   as a behavioral reference.)
3. Docs: a dedicated QueryForm guide page under `apps/docs/query/` covering
   both variants (new one primary, legacy one referenced), since none exists.
4. Changeset (`@ethlete/query` minor).
5. Playground: add a signals-variant example next to
   `apps/playground/src/app/query/form/form.component.ts` (it exercises every
   feature — use it as the parity test bed).

## Non-goals

- Deprecating/removing the reactive-forms QueryForm (separate decision, later).
- Validation semantics, touched/dirty state — out of scope; it's not a form.
- The table's `TableState` itself (lives in `01-table.md`); only the interop
  contract above.

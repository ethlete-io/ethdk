# Forms opportunities roadmap

Follow-up plan to `FORM_CONTROLS_PLAN.md` (what shipped) and
`FORM_COMPONENTS_REVIEW.md` (what was fixed). Those two are essentially done —
this file tracks the _next_ round of form work: convergence, ecosystem gaps, and
consistency debt found in the 2026-07 opportunities research. This file is the
tracking artifact: update the status table and check off work as it lands.

Decisions baked into this plan (do not re-litigate without a reason):

- **Tag input is not deprecated.** It stays as the deliberately tiny, overlay-free
  free-text control. The convergence work (item 2) makes select-with-custom-values
  a strict superset for every case that involves suggestions; only after that ships
  do we revisit whether tag-input's remaining niche justifies its existence.
- **Select convergence replaces the planned standalone Autocomplete.**
  `FORM_CONTROLS_PLAN.md` deferred Autocomplete until it was decided whether the
  unified select's search covers it. Decision: it does, once item 2 lands. Mark the
  Autocomplete row there as superseded by this plan when item 2 ships.
- **Mask adoption is opt-in, never default.** The lenient date/time parsers
  (`930` → 09:30) accept shapes a mask would block mid-typing; masking date inputs
  is an opt-in layer for fixed numeric formats only. Locale-aware formats (`P`,
  `p`) never get auto-derived masks.
- **Zero new runtime dependencies** (unchanged from the controls plan): no
  libphonenumber-style metadata for phone masks; per-country live formatting stays
  out of scope.

## Status

| #   | Item                                                | Size | Status  | Notes                                     |
| --- | --------------------------------------------------- | ---- | ------- | ----------------------------------------- |
| 1   | Server violations → signal-forms bridge             | M–L  | shipped | in `@ethlete/query` + resolver hook       |
| 2   | Select custom-values convergence                    | M    | shipped | supersedes Autocomplete; settles tag q.   |
| 3   | Filter / choice chip group                          | S–M  | shipped | carried over from `FORM_CONTROLS_PLAN.md` |
| 4a  | Mask host-contract generalization                   | S–M  | shipped | + completeness signal                     |
| 4b  | Date-input opt-in guide masks                       | M    | shipped | first internal mask consumer              |
| 5a  | `readonly` for checkbox / switch / selection groups | S    | shipped | consistency                               |
| 5b  | `clearable` for date/time/phone inputs              | S    | shipped | consistency                               |
| 5c  | Docs: masked-input StoryEmbed                       | S    | shipped | signal-forms note already existed         |
| 6   | Cascader follow-ups (promised in public docs)       | M    | shipped | flat search, `cascaderFromQuery`, multi   |
| 7   | Review item #2 partial workaround                   | S    | shipped | `wireFormSupport()` effect-body extract   |
| 8   | Form wizard / stepper                               | L    | idea    | undecided — needs a consumer use case     |

---

## 1. Server violations → signal-forms bridge (M–L) — shipped

Home decided at implementation: **`@ethlete/query`** (owns the error types and
already peers `@angular/forms`), in `libs/query/src/lib/http/query-signal-forms.ts`.
Built on the existing guards in `query-error-response-utils.ts`, not duplicated.

- [x] `mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })`
      — resolves each violation's `propertyPath` (dot + bracket notation) against
      the field tree and returns `ValidationError.WithOptionalFieldTree[]` with
      `kind: 'etServerViolation'` (the raw violation rides along on the error).
      Unmapped violations become form-level errors (customizable via
      `onUnmappedViolation`); a violation-free failure degrades to form-level
      `kind: 'etServerError'` entries from the normalized message, so a `submit()`
      action returning the result never silently succeeds on failure.
- [x] `extractFormViolations(error)` — accepts `QueryErrorResponse`,
      `HttpErrorResponse`, raw body, or a plain violation array. Plus an
      `isQueryErrorResponse` guard in `query-error-response.ts`.
- [x] `executeUntilSettled(query, executeArgs?)`
      (`libs/query/src/lib/http/query-snapshot-utils.ts`) — executes and resolves
      with a settled `QuerySnapshot`, built on `createSnapshot().isAlive` so a
      later execution can't swap the awaited result. This is the awaiting half of
      the `submit()` pattern (caveat: a cancelled-and-never-retried execution
      leaves the promise pending).
- [x] Message-resolver DI hook: `provideFormErrorMessageResolver()` /
      `FORM_ERROR_MESSAGE_RESOLVER` in `form-error.component.ts`
      (`et-form-error` is the single render point for all field errors);
      verbatim `message` stays the default.
- [x] Specs (`query-signal-forms.spec.ts`, `query-snapshot-utils.spec.ts`,
      `form-error.component.spec.ts`) · docs (`apps/docs/query/errors.md`
      bridge section, `queries.md` method note, `apps/docs/components/forms.md`
      server-violations + custom-messages sections) · changeset
      `signal-forms-violations-bridge.md` (minor, query + components).

## 2. Select custom-values convergence (M) — shipped

Ported the tag-input ergonomics into select's `allowCustomValues` mode;
select-with-custom-values is now a strict superset of "tags with suggestions".
Naming settled at implementation (deviations from the original sketch):

- [x] **Separator commit** — `customValueSeparators` input (default `[]`, e.g.
      `[',']`; single characters only — Enter stays the built-in commit key via
      the active item, so a fake `'Enter'` entry is not needed). Commits the
      pending query mid-typing; a rejected commit (duplicate/normalized away)
      keeps the text minus the separator for editing.
- [x] **Custom value while options match** — `customValueCandidate` computed on
      the headless directive + a **"Create …" row** in `et-select`'s panel. The
      row is a _real option_ (label = the candidate), so virtual focus, Enter
      commit, aria-activedescendant and the label cache all work unchanged; it is
      marked `customValueOption` so the candidate's duplicate check excludes it.
      Hidden when the candidate duplicates a visible option label
      (case-insensitive), an existing selection, or the selection is full.
      Row text via `createLabel`.
- [x] **Paste splitting** — pastes split on separators/newlines and bulk-commit
      (multi mode).
- [x] **Commit on close (opt-in)** — `commitCustomValueOnClose` (close ≈ blur
      for this control: Tab/outside click commit, Escape clears first and never
      commits; option picks and add-new clear the query before closing so they
      can't be double-committed).
- [x] **`maxSelection`** + public `isFull` — blocks option picks and custom
      commits at the cap and sets the search input readOnly (tag-input parity).
- [x] **`normalizeCustomValue` hook** — raw → stored value, `null` rejects;
      default trims.
- [x] **Public `commitCustomValue(raw): boolean`** — imperative add path.

Explicitly **not** ported: `allowDuplicates` (select's identity-based selection
model has no meaningful duplicate semantics) and the overlay-free mode (that _is_
tag-input; see decisions).

Shipped with: 9 new/updated directive specs · `CustomValues` story extended +
new `MaxSelection` story · `select.md` Custom values section rewritten (with
StoryEmbed) + `forms.md` tag-input positioning updated · Autocomplete marked
superseded in `FORM_CONTROLS_PLAN.md` · Storybook-verified headlessly (17
checks: create row visuals/focus order, separator/paste/close commits, Escape
non-commit, maxSelection lockout cycle).

## 3. Filter / choice chip group (S–M) — shipped

Shipped as the composition the spec called for (no new component):
`etSelectionList` + `etSelectionOption` directly on `et-chip`, with tonal
selected/hover/focus chip styles keyed off the option's role/aria-checked, a
late-binding guard on the option's required `value` (NG0950 in directive
compositions), a `FilterChips` story, and a "Filter chips" section in
`apps/docs/components/chip.md`. Promote to an `et-chip-group` Tier 3 only if
the wiring proves repetitive across apps (unchanged decision).

Carried over verbatim from `FORM_CONTROLS_PLAN.md` (spec at plan line 963, error
block: shares `chip` 1100 / likely none). Also retires the cdk `rich-filter`
migration debt (`libs/cdk/src/lib/components/filter/rich-filter/`). Track
progress here; keep the spec there.

## 4. Mask system adoption

The mask system (`forms/masked-input/`) is built, tested, and documented but has
**zero internal consumers**. Two slices:

### 4a. Host-contract generalization (S–M) — shipped

Done: the mask injects a public `INPUT_MASK_HOST` token (`InputMaskHost`
contract: `value` model, `focused`, `nativeControl`, `suppressNativeSync()`)
instead of `InputDirective` directly; `InputDirective` provides the token, so
existing usage is unchanged. Pattern masks now implement the completeness gap:
`MaskSpec.isComplete` (`0`/`a`/`*` required, `9` optional, positional) is
exposed as `complete(): boolean | null` on the directive. Custom slot classes
remain deferred until a consumer needs them. Specs cover a custom host and the
completeness semantics; docs updated in `forms.md`.

Original notes:

`InputMaskDirective` hard-requires an `InputDirective` host (throws ET3200,
`masked-input/headless/input-mask.directive.ts:82-91`) and relies on
`suppressNativeSync()`. Phone/date/time/duration fields are their own field
directives, so nothing else can adopt it. Generalize the host contract (small
interface: native element + suppress-sync + value signals) or compose
`InputDirective` into the field bases. While in there, consider the two engine
gaps that gate real adoption:

- a **completeness signal** (required `0` vs optional `9` slots are currently
  untracked, `masked-input/headless/internals/pattern-mask.ts:8-9`) — date commit
  wants "is the mask fully filled";
- custom slot classes in the pattern language (no hex slot today) — only if 4b or
  a concrete consumer needs it.

Segmented behaviors (per-slot ranges, arrow-increment) stay out of scope — that
is a new control paradigm, not an adoption.

### 4b. Date-input opt-in guide masks (M) — shipped

Shipped as an opt-in `mask` boolean input on the **date, time and date-time**
inputs (headless directives, forwarded by the styled components).
`maskPatternFromDisplayFormat` (`date-time/internals/display-format-mask.ts`)
derives the pattern from fixed-width numeric `displayFormat`s only (`dd.MM.yyyy`
→ `00.00.0000`; quoted literals supported) and refuses locale formats (`P`/`p`),
variable-width and text tokens — refusal warns in dev mode and leaves typing
unmasked. `DatePickerInputDirective` exposes `maskPattern`; the styled templates
bind it to `[etInputMask]` with `maskValueMode="masked"` + `placeholderChar="_"`,
and masked fields get `inputmode="numeric"`.

Mechanics: the three field directives were deduplicated into a shared
`DatePickerInputFieldDirective` base (`date-time/internals/`) that implements
`INPUT_MASK_HOST` — its `value` is a `linkedSignal` holding the display-shaped
field text (resets to `displayValue`/kept parse-error text on commit; mask edits
write it while typing and mirror into `inputText` so `hasValue`/clear behave like
native typing), and blur/Enter commits read that value instead of the element
text (which may hold guide placeholders). Supporting mask API shipped alongside:
`[etInputMask]` accepts `null` (inert, suppression follows mask presence) and
`InputMaskHost` gained optional `resumeNativeSync()`.

**Duration input: deliberately excluded** (plan originally said date/time/
duration). Two hard conflicts with its entry model: the first segment is
unbounded (`100:00` under `mm:ss`), so any fixed slot layout blocks commits the
parser accepts; and its lenient parse is right-anchored (`130` → `01:30`) while a
mask fills left-to-right (`130` → `13:0_`), silently changing what typed digits
mean. Documented in `forms.md`. The **date-range input** (two fields, own field
directives) was initially left out of this slice; it has since adopted the mask
too — each `etDateRangeInputField` side implements `INPUT_MASK_HOST` itself
(the shared field base doesn't cover it), with `mask`/`maskPattern` on
`DateRangeInputDirective`.

Original notes:

An opt-in mask layer when the `displayFormat` is fixed-width numeric — guide
placeholders (`__.__.____`), auto-inserted separators, paste filtering.
Auto-derive the pattern from the format; refuse (no mask) for non-fixed/locale
formats. The lenient commit parsers stay authoritative — the mask only shapes
typing, never blocks commit paths the parser would accept.

Phone input: cosmetic group-of-3 live mask is feasible after 4a, but the semantic
layer (trunk-`0` stripping, `+` country re-derivation,
`phone-input/headless/phone-input.directive.ts:127-142`) violates the mask's
round-trip contract and stays bespoke. Treat as optional follow-up, not part of
this slice. OTP, time-picker, and color-input are confirmed non-fits — do not
mask them.

Done (per slice) = specs · stories showing the masked date input · docs
(`forms.md` masked-input + date sections) · changeset.

## 5. Consistency pass (S each) — shipped

- [x] **5a. `readonly`** for checkbox, switch, and the three selection-list
      groups (`forms/checkbox/headless/checkbox.directive.ts:28-35` has only
      disabled/invalid/required). Inconsistent today: rating and slider — the same
      non-text class — support it. Alternatively, document the omission
      deliberately; pick one.
- [x] **5b. `clearable`** for the date/time/date-time/duration inputs and
      phone-input (today only select and cascader have it). One-click clear on the
      text shell, hidden when empty/readonly/disabled.
- [x] **5c. Docs**: give the masked-input section a `<StoryEmbed>` (it is the
      only section with just a text pointer to Storybook). ~~Signal-forms-only
      note~~ — already covered: `forms.md` opens with a "Signal forms only" info
      box (the original audit missed it).

## 6. Cascader follow-ups (M)

Already promised publicly in `apps/docs/components/cascader.md` (Scope section):

- [x] flat search augment (search across all levels, not just the active column).
      Shipped as an optional `search(query)` hook on `CascaderDataSource` returning
      root → match path chains (the tree is lazy, so only the source can search
      unloaded branches — same reasoning as `resolvePath`). New headless
      `etCascaderSearch` (panel input, takes initial focus, menu-style typing
      redirect) + `etCascaderSearchOption` (`[path]`/`[index]`, roving focus);
      panel `role` flips tree→listbox while searching. Activating a result commits + closes; a branch-only match in leaf mode re-roots the columns onto its path
      instead. Escape now clears the query first, then closes (overlay
      `closeOnEscape: false` + `onDocumentKeydown`, mirroring select — the runtime
      Escape handler is capture-phase, so `stopPropagation` can't work). Styled
      `et-cascader` renders the input automatically when the hook exists
      (`searchPlaceholder` input; loading/error+Retry/"No matches" states). Story
      `components-forms-cascader--search`, docs "Flat search" section, error codes
      3307/3308, changeset `cascader-flat-search.md`.
- [x] `cascaderFromQuery` convenience (mirror `selectOptionsFromQuery`). Shipped as
      `forms/cascader/cascader-from-query.ts`: builds a `CascaderDataSource` from
      query creators — one query **per level load** (query-stack pattern via
      captured `Injector` + `runInInjectionContext`, since levels load
      concurrently; client dedup/cache coalesces repeats), settled via
      `executionState` first non-loading emission, destroyed on finalize (early
      unsubscribe cancels the request). Optional `search` block wires flat search
      with `timer()`-based debounce (the directive's switchMap cancels stale
      timers) + `minQueryLength`; `resolvePath` passes through. Failures throw
      `Error(toErrorMessage(queryError))`; the cascader's **default
      `toErrorMessage` now unwraps `Error#message`** so these show verbatim.
      Spec `cascader-from-query.spec.ts` (real client + HttpTestingController;
      note: query lib bakes params into `req.url`, match with `includes`). Docs
      "Query-backed levels" section; changeset `cascader-from-query.md`.
- [x] multi-select with indeterminate parent states. Shipped as a `multiple` input
      on the headless directive: value model widened to `T | T[] | null`
      (`values()` normalizes; select precedent), activations **toggle** (leaves on
      click; branches drill-only in leaf mode, toggle+drill in any mode; never
      close). `selectedPaths` holds the known chain per selected value (in-panel
      toggles record it; programmatic values resolve via `resolvePath`, one merge
      stream per unknown value). `isSelected` = exact value in multi;
      `isIndeterminate` = unselected ancestor of a selection →
      `data-indeterminate` on nodes; panel gets `aria-multiselectable`. Search
      results toggle in place and keep the query/result list (unlike select's
      clear-per-commit — columns aren't a list fallback). Trigger joins selected
      labels; `displayValue` falls back to string values before chains resolve.
      Styled check squares are pure CSS (`.et-cascader-check`, primary/on-primary
      tokens). Stories `--multiple`, `--multiple-with-search`; 8 directive specs;
      docs "Multi-select" section; changeset `cascader-multi-select.md`.

## 7. Review item #2 partial workaround (S) — shipped

Done as described: `wireFormSupport(support, refs)` + `FormSupport` type exported
from `form-field/headless/form-support.ts`; all 9 sites converted, review status
block updated, changeset added.

`FORM_COMPONENTS_REVIEW.md` item #2 (form-support wiring duplicated across ~9
components) is marked "Not fixable as specified" because NG8110 forbids moving
`viewChild()` into a helper. Partial extraction is still possible: keep the four
`viewChild` refs as class fields and extract only the effect body into a
`wireFormSupport(support, refs)` function next to `injectFormSupport`
(`forms/form-field/headless/form-support.ts`). Sites: choice-field, dropzone,
otp-input, rating, the three selection-list groups, slider, range-slider. Update
the review's status block when done.

## 8. Form wizard / stepper (L) — idea only

Exists in neither `components` nor `cdk`; genuine gap versus mature libraries,
but no known consumer need yet. Do not start without a driving use case — record
the request here if one appears.

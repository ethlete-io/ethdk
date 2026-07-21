Task: ✅ DONE — Add a one-shot (optionPicked) output to et-select
(Shipped as `pickOnly` input + `optionPicked` output; forwarded on et-select; docs + changeset + specs added.)

Repo: ethlete-sdk — libs/components/src/lib/forms/select/

Why: Single-select is sometimes used as a fire-and-forget "add" picker (search → pick → append to an external list → the select must not retain the value). Today the only pick signal is valueChange, which forces consumers to set-then-clear value, racing the [(value)] write-back and needing a nextFrame/effect reset hack. A dedicated command output that emits the picked option without ever mutating value removes the hack.

What to do:

1. In headless/select.directive.ts, add an output optionPicked = output<TValue>() (or the option item). Emit it from commitOption in single-select mode only, at the point the user commits an option — before/independent of the value.set(...) selection path (ideally: when optionPicked has observers, emit it and skip the value mutation so the select stays valueless; otherwise keep current behavior for backward-compat).
2. Forward the new output through select.component.ts's hostDirectives outputs array.
3. Document it in apps/docs/components/select.md (Outputs table + a short "command picker" note under Async options): "emits the picked value without retaining it — use when the select adds to an external list."
4. Add a spec in headless/select.directive.spec.ts: picking an option emits optionPicked once with the value, and value remains null (no retention, panel behavior unchanged).

---

Task: ✅ DONE — Enhance UX of single select with custom value template
(In a searchable single select the rich value template is now the resting display only; while
focused the input shows the option's editable plain-text label — parity with a plain searchable
single select, so Backspace edits visible text instead of nuking an empty-looking field.)

Why: Upon pressing backspace in a filled single select with custom value template (so custom html inside the select field) the whole option gets deleted.

---

Task: ✅ DONE — Add optional directive to selects with a eg. selectOptionsQuery binding that passes all data down to the individual select inputs() automatically
(Shipped as `[etSelectOptions]` — bind the `selectOptionsFromQuery` / `selectOptionsFromV2Query` bundle
once; the directive forwards loading/error/hasMoreItems, forces filterMode=external, and wires
setQuery/loadMore from the select's outputs. Consumer still renders options. Docs + changeset + spec added.)

To support: selectOptionsFromQuery, selectOptionsFromV2Query

---

Task: Fix overlay closing due to clicking a select body (or any popover) created from within that overlay

---

Task: Add the missing overlayCloseDismissChecker logic to the new components lib overlay system

---

Task: An legacy v2 query adapter is needed for the dropzone component

---

Task: Logical DOM level auto elevation not working
given this: a select body has options that themself have etAutoSurface. Since the injector will be the component injector the select is inside and not the one the select body (which in turn has a etAutoSurface) we will be off by 1 level

---

Task: ✅ DONE — popovers wont match their host form field in size from a certain point on
(The select panel carried a `max-inline-size: 400px` cap, so width-mirrored panels stopped
matching fields wider than 400px. The cap is now scoped to compact `mirrorPanelWidth={false}`
triggers via an `et-overlay--select-content-width` container class; mirrored panels are sized by
the pane width alone. Changeset added; docs already described the mirroring behavior.)

![alt text](image.png)

---

Task: ✅ DONE — optionPicked is a lint warning. rename it
(Renamed `optionPicked` → `pickOption` — present-tense, verb-first like `loadMore`/`addNew`, satisfies
`ethlete/prefer-present-tense-output`. Updated directive/component/spec/docs/changeset.)

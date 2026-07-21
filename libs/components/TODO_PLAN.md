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

Task: ✅ DONE — Fix overlay closing due to clicking a select body (or any popover) created from within that overlay
(An anchored panel's outside-pointer check counted a click in a nested popover — which mounts as a
sibling pane, not a DOM descendant — as an outside dismissal. New `isTargetInsideOverlayTree` helper
resolves the whole nested overlay tree via each pane's `origin`; wired into `anchored-panel-controller`
(covers select, cascader, date/time pickers). Unit + integration specs, docs note, changeset added.)

---

Task: ✅ DONE — Add the missing overlayCloseDismissChecker logic to the new components lib overlay system
(Shipped as the `unsavedChanges` family, not a 1:1 cdk port. Core: a close-veto seam on the overlay
runtime (`registerCloseGuard`/`forceClose`, exposed on `OverlayRef` too; `reference-detached` always
bypasses), plus `createUnsavedChangesTracker` (snapshot/deep-equal, signal-forms `FieldTree` first-class
+ `Signal<FieldTree|null>`/`AbstractControl`/`WritableSignal`, async confirm→Promise, refresh/restore)
and `createUnsavedChangesGuard` (router flavor + `canDeactivate` bridge). Components:
`createOverlayUnsavedChangesGuard` wires the tracker to close events (per-source opt-out, honors
disableClose, auto-destroy). Specs (core seam + tracker all-sources + overlay guard e2e via the real
runtime), Storybook story verified headlessly, docs (overlays.md, core/overlay-runtime.md,
core/utilities.md), changesets (core + components) all added.)

---

Task: ✅ DONE — An legacy v2 query adapter is needed for the dropzone component
(Shipped as `createV2DropzoneUpload` — the legacy `V2QueryClient` twin of `createDropzoneUpload`,
slotting into the same `upload` input. The per-file query lifecycle was first abstracted behind an
internal upload-handle (`DropzoneUploadHandle`) so both flavors share the directive/entry code;
failure display normalizes `QueryErrorResponse` and `RequestError`. New-query path behavior
unchanged (existing specs stay green). Story `LegacyV2Query` + docs section + changeset + V2 specs
added. Note: `createLegacyQueryCreator` interop creators are typed-accepted but carry a known
LegacyQuery teardown re-entrancy — genuine v2 creators are the recommended path.)

---

Task: ✅ DONE — Logical DOM level auto elevation not working
given this: a select body has options that themself have etAutoSurface. Since the injector will be the component injector the select is inside and not the one the select body (which in turn has a etAutoSurface) we will be off by 1 level
(Root cause: projected/portaled overlay content keeps its declaration (trigger) injector, so
`AutoSurfaceDirective` resolved the parent surface one elevation too low. Fix: the directive now also
consults the root `surfaceContextTracker` — which each overlay registers its surface into — and takes
the higher of injector-context vs. innermost-overlay elevation. The 6 overlay panels (menu,
select/date/cascader panels, tooltip, toggletip) call the new
`AutoSurfaceDirective.ignoreOverlaySurfaceContext()` so they still adopt their overlay's elevation
rather than stacking above it. Verified in Storybook: content=dark-elevated-2 vs panel=dark-elevated
(was equal before). Changeset + docs updated.)

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

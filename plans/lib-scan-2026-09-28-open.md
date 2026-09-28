# lib scan 2026-09-28 — open decisions and queue

The High findings are fixed. The Medium pass is done. Each domain plan file keeps its
own open lines; this file lists what needs a user decision and what is still queued.

## Decisions for the user

- chart: `CHART_IMPORTS` imports every chart. The guides now import one component per chart
  (3717a3956). Exported per-chart tuples (`BAR_CHART_IMPORTS`) would be new public API.
- notification: the stack has `role="log"` around items that are also `status`/`alert` regions.
  Pick one region on the stack or a hidden announcer; only a screen-reader run can check it.
- stream: the Facebook SDK URL hard-codes `de_DE` and `v3.2`. Pick a version, and a config API or
  `injectLocale` for locale and version.
- stream: `DEFAULT_STREAM_CONFIG` always bundles the default overlays. The fix is an opt-in
  provider or a lazy loader type, both breaking.
- query-devtools: `pushEvent` measures the body twice and resolves the owner eagerly. The fix
  needs a type change in `libs/query` and can change which query a row points at.
- phone-input: DO +1829/+1849, PR +1939 and JM +1658 show as US, because each country holds one
  dial code. More needs a new field on the public `PhoneCountry` type.
- timetrack: the picker Lucene escaping finding is unverified; it needs a live Jira Cloud call.
- timetrack: the codex reasoning command. A per-command spec, or drop `codex`.
- timetrack: Codex `INJECTED_PREFIXES` needs a real Codex log, and `askedBy: 'machine'` is a
  design call.
- cli: git-flow `parse.ts` reads a lowercase `<word>-<number>` as a key when `keyPrefixes` is
  empty. Existing specs test this on purpose (`chore/angular-22` → `ANGULAR-22`).
- date-time: `minTime`/`maxTime` compare against the zone's wall clock, not as instants.
- date-time: an empty time picker starts from the current time, so on the runtime's own DST day a
  pick in the skipped hour still lands an hour late.

- overlay: 6592a0627 changed the exported `DragToDismissContext`: `overlayRef` now needs
  `beforeClosed`, which breaks custom mocks. Check that its changeset bump is right.

- contentful: `provideContentfulConfig` bundles all five default components. Lazy defaults or an
  opt-in `withContentfulDefaultComponents()` change the public API; the size is not measured.

- select: `compareWith` makes the options sync O(n²). The fix needs a new public value-key input.

- calendar: range strategies can return a range past `max`. Clamp or reject; both break a case
  (a filtered week pick ends on a disabled day; a clamped 7-day range gets shorter).

- tooltip: each tooltip adds one body node. A lazy node loses the description for a screen
  reader that reads without moving focus, and `aria-description` is ignored when the consumer
  sets `aria-describedby`.

- time-picker: `min` > `max` now wraps past midnight (3b5a77fe9). The other option was a
  dev-mode error.
- icons: `provideIcons()` now merges the parent icons, and `rich-text-editor.component.ts` uses
  `.useFactory()` (3b5a77fe9). Check that both changes are wanted.
- form-field: `TEXT_FIELD_CONTROL_INPUTS` lists `'aria-label'` and `'aria-labelledby'` directly
  (1a0c0805f), because Angular cannot build a spread of `ACCESSIBLE_NAME_INPUTS` in an IIFE. A
  change to `ACCESSIBLE_NAME_INPUTS` must be copied by hand.
- bundle: `STATE_ICONS` (progress-step) and the scheduler time-grid minute constants are still in
  the floor bundle; see `components-lib-scan/bundle.md`.

- standings: form results differ only by opacity (WCAG 1.4.1). A non-colour mark is a design call.
- bracket: `resolveBracketComponents` bundles the default cards. Where they live (layout
  factories, config, or an opt-in provider) is an API decision.
- bracket: swiss `MODE_UNSUPPORTED` is unverified. Does the API leave out undrawn rounds?

- loader: no default `aria-progressbar-name`. 6d1d90fe8 made "no default name" deliberate, and a
  default name is read twice next to visible "Loading" text.

- rich-text-editor: an upload of a route-provided image tool keeps going after its editor is
  destroyed. A cancel needs `RichTextEditorDirective` to expose its `DestroyRef`/`Injector`, or a
  per-editor hook on the tool definition.

- timetrack: the tray uses `DEFAULT_ROUND_OPTIONS.incrementMs` (15 min), the same as the rows. A
  configured increment needs a new setting.

- table: the selection checkbox, expander button and error icon are separate Tab stops. Add the
  utility columns to the roving grid (this changes the `activeCell()`/`focusCell()` indexes), or
  take their controls out of the Tab order.
- table: keyboard column resize. A focusable `role="separator"` grip with arrow steps, or a
  width step in the column menu.

- bundle goldens: rich-text-editor (3 entries) and dropzone are each about 1.6 kB over. The rich
  text growth comes from new features (862468765, b645e827e, 267f7bdb1); the dropzone growth is
  not checked. Accept with `nx run treeshake:bundle-goldens:update` on a fresh build?
- menu: in a multiple group, a new value among values with filtered-out items now goes before the
  first later value in option order, else at the end (330e1bbf4).
- table persistence: a change in the same tick as a switch to a new store is not saved there
  (from 2b62c6e3e). Left alone.
- dropzone: the readonly file list focus (766bb1f52) is not checked in Storybook (focus ring, axe).

## Low pass (in progress)

Each domain plan file keeps its open Low lines; the decisions are listed there. Flags to check:

- toggletip: b4b194925 removed the public `pressedVariant()`. Check the changeset bump.
- stream: 5ff13041e removed the directives without a selector from the platform barrels. Check
  the bump. The PiP `minHeight`/`maxHeight` options are now read nowhere.
- cli: `CI_JOB_TOKEN` is no longer a GitLab token; `et update --ai` passes the prompt in env vars;
  registry lookups read `~/.npmrc`. The `isPortFree` fix is not proven (the bug is macOS-only).
- timetrack: `googleCalendarPaged$` now fails at the page cap, because a capped read deleted real
  meetings. `isNudgeDue`/`dayNudge` now need a `DayBoundary`.
- skeleton: the `aria-busy` e2e checks were changed but not run.
- A stream agent ran prettier over other agents' uncommitted files (whitespace only).

## Queue

- timetrack `stillFocused` tail order: real, but no failing test was found.

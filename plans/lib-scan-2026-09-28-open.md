# lib scan 2026-09-28 — open decisions and queue

The High findings are fixed. The Medium work is in progress. Each domain plan file keeps its
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
- date-time: `libs/components/vite.config.mts` now sets `TZ=Europe/Berlin` for every components
  spec, so DST tests can fail in CI. Keep it, or scope it to the date-time specs.
- date-time: `minTime`/`maxTime` compare against the zone's wall clock, not as instants.
- date-time: an empty time picker starts from the current time, so on the runtime's own DST day a
  pick in the skipped hour still lands an hour late.

- table: `[error]="false"` now means no error (fc8221e51). The docs and a spec treated `false`
  as an error on purpose before; `0` and `''` still count. Revert `isError` there for the old
  behaviour.

- overlay: `syncUrl` does not deep-link. Add a stable param key (new API), or drop the
  deep-link claim from the JSDoc and the docs.
- overlay: 6592a0627 changed the exported `DragToDismissContext`: `overlayRef` now needs
  `beforeClosed`, which breaks custom mocks. Check that its changeset bump is right.

- contentful: `ContentfulRestAsset.fields.file` is now optional (a9b3f3947). A consumer that
  reads `fields.file.url` no longer compiles under strict mode; the changeset says patch.
- contentful: `provideContentfulConfig` bundles all five default components. Lazy defaults or an
  opt-in `withContentfulDefaultComponents()` change the public API; the size is not measured.

- select: `compareWith` makes the options sync O(n²). The fix needs a new public value-key input.

- calendar: range strategies can return a range past `max`. Clamp or reject; both break a case
  (a filtered week pick ends on a disabled day; a clamped 7-day range gets shorter).

- tooltip: each tooltip adds one body node. A lazy node loses the description for a screen
  reader that reads without moving focus, and `aria-description` is ignored when the consumer
  sets `aria-describedby`.

## Queue

- dropzone: a readonly multi-mode dropzone with files has nothing focusable.
- timetrack `stillFocused` tail order: real, but no failing test was found.
- When all agents finish: run `tsc -p libs/components/tsconfig.spec.json`, and the
  `forms-cascader` and `menu-selection` scenario specs, on the committed state. Then update the
  counts in `lib-scan-2026-09-28.md` and `components-lib-scan/README.md`.

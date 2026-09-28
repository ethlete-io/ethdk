# lib scan 2026-09-28 — open decisions and queue

The High findings are fixed. The Medium pass is done. Each domain plan file keeps its
own open lines; this file lists what needs a user decision and what is still queued.

## Decisions for the user

- timetrack: the picker Lucene escaping finding is unverified; it needs a live Jira Cloud call.
- timetrack: the codex reasoning command. A per-command spec, or drop `codex`.
- timetrack: Codex `INJECTED_PREFIXES` needs a real Codex log, and `askedBy: 'machine'` is a
  design call.
- cli: git-flow `parse.ts` reads a lowercase `<word>-<number>` as a key when `keyPrefixes` is
  empty. Existing specs test this on purpose (`chore/angular-22` → `ANGULAR-22`).

- overlay: 6592a0627 changed the exported `DragToDismissContext`: `overlayRef` now needs
  `beforeClosed`, which breaks custom mocks. Check that its changeset bump is right.

- contentful: `provideContentfulConfig` bundles all five default components. Lazy defaults or an
  opt-in `withContentfulDefaultComponents()` change the public API; the size is not measured.




- form-field: `TEXT_FIELD_CONTROL_INPUTS` lists `'aria-label'` and `'aria-labelledby'` directly
  (1a0c0805f), because Angular cannot build a spread of `ACCESSIBLE_NAME_INPUTS` in an IIFE. A
  change to `ACCESSIBLE_NAME_INPUTS` must be copied by hand.
- bundle: `STATE_ICONS` (progress-step) and the scheduler time-grid minute constants are still in
  the floor bundle; see `components-lib-scan/bundle.md`.

- bracket: swiss `MODE_UNSUPPORTED` is unverified. Does the API leave out undrawn rounds?



- timetrack: the tray uses `DEFAULT_ROUND_OPTIONS.incrementMs` (15 min), the same as the rows. A
  configured increment needs a new setting.


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

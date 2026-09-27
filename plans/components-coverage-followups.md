# Components consumer coverage - follow-ups

## Goal

The open items left after the components consumer-coverage work (tasks 1-8) finished on 2026-09-27: the bugs
and user calls the scenarios and E2E suites found but did not fix, and the E2E gaps no suite covers.

## Open user calls

The clear bugs were fixed on 2026-09-27. Each item below needs a decision first; the proposal comes from the
investigation.

### Errors thrown out of change detection

Icon (unknown name, bad SVG; "no icons provided" from the constructor), scheduler ET4505/ET4506, grid ET1902,
carousel MISSING_ITEMS, most chart dev errors (while `MISSING_PLOT` goes to the ErrorHandler), ET1500, ET4900 and
ET2600/2601. Decide one policy for all of them.

### New public API

- Stream: a slot exposes state but no playback control; the stream error codes are not exported.
- Rich-text editor: a headless `[etRichTextEditor]` cannot attach its editable element (`editorDom` is `@internal`).
- Scheduler: a custom feature or edit-surface host re-implements register/filter/sort.
- Form field: `createAnchoredPanelController` needs the unexported `OverlayTemplateHostComponent`.
- Dropzone: no `exportAs`; `createFileDropzoneEntry` needs the `@internal` `createUploadHandle`.
- Colour: a custom surface cannot commit (`picker.commitColor` is `@internal`).
- Selection list: `SelectionState` has no selected count. Tree: labels are plain inputs, no `provideTreeLabels`.
- Query: `@ethlete/query` sends every failed request to the ErrorHandler with no opt-out
  (`libs/query/src/lib/http/http-request.ts`), so a failed `selectOptionsFromQuery` also reaches it.
- Cascader: `cascaderFromQuery` infers `TValue` as `{}` when an unannotated `args` comes before `toNodes`. The
  examples now put `toNodes` first; a real fix changes the API.

### Behavior

- Headless native hosts: `[placeholder]`, `[disabled]`, `[readonly]`, `[required]` and `[min]`/`[max]`/`[step]` on
  number input do not reach the DOM. Proposal: extend `mirrorOntoNativeHost` in `text-field-control.directive.ts`.
- `et-description` in `et-choice-field` describes nothing. Proposal: a `select="et-description"` slot and a
  `describedById` that joins many ids, or document `et-hint` as the only secondary line.
- Phone input: the trigger's `aria-label` hides the country and dial code. Proposal: `aria-labelledby` on the label
  and the dial-code span. Display groups by 3 for every country; the lib has no per-country format data.
- Cascader: in leaf mode a node without `isLeaf` counts as a branch (lazy discovery). Proposal: keep and document
  (a docs note exists), or treat the last node of a search path as a leaf.
- Tabs: a nav link with `[queryParams]` is active only when the URL carries them (`RouterLinkActive` default
  `subset`). Proposal: default to `queryParams: 'ignored'`, or document `routerLinkActiveOptions`.
- Kbd: `parseKbdKeys('mod++')` drops the `+`, as documented (`plus`). Proposal: read a doubled or lone `+` as plus.
- Standings: `textContent` of a participant includes the `aria-hidden` emblem initial. Proposal: render it with
  `::before { content: attr(data-mark) }`.
- Breadcrumb: only a separator projected into `<et-breadcrumb-outlet>` renders (docs corrected). Proposal: a dev
  warning for other nodes, or a named slot on `et-breadcrumb`.
- Accordion: `openAll()` does nothing with `autoCloseOthers`, as documented. Proposal: a dev warning.
- Table: state saved before 53497453e loses numeric row keys once. Recommendation: leave it; a fix needs the row
  data, which arrives after the restore.
- Query error: a legacy error offers no retry without `setDefaultQueryRetryFn`. Filter overlay: a preview without
  `totalHits` shows "Show results" silently.
- Input: the password reveal needs `et-form-field`. `et-icon-button` projects only `[etIcon]`.
- Chart: `xHeader` falls back to "Category". Slider: a tap with no move commits the press value.

## E2E gaps not covered

- Nested toolbar: needs a story first.
- Picture: `<source>` choice by type and DPR needs a story with those sources.
- The 11 E2E-only entries in `tools/export-coverage/components.allowlist.json`.
- Command palette: colour context (the story has no colour provider).
- Calendar: month and header transitions. Select: the leave animation. Grid: auto-scroll while dragging.
- Rating: fill animation timing. Badge: icon sizing. Phone input: clear animation.
- Masked input: dead keys and soft keyboards on a real device.

## Rules kept

- Never run `check.mjs --update` on the allowlist.
- A new public export is a `minor` changeset.

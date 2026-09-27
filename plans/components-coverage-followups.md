# Components consumer coverage - follow-ups

## Goal

The open items left after the components consumer-coverage work (tasks 1-8) finished on 2026-09-27: the bugs
and user calls the scenarios and E2E suites found but did not fix, and the E2E gaps no suite covers.

## Open bugs and user calls

- Headless `etTextarea`/`etInput` never write `[(value)]` into the native host (`it.fails` in
  `libs/components/src/scenarios/forms-textarea.scenario.spec.ts`).
- A bare `input[etPasswordInput]` does not clear Caps Lock on blur (`handleNativeBlur` skips `syncCapsLock`).
- Table state saved before 53497453e loses numeric row keys once.
- Floating action: the anchor holds the fixed size if the page first renders scrolled past it
  (`libs/components/src/lib/floating-action/headless`).
- Calendar: the leaving header label is not `inert`, text only (`libs/components/src/lib/calendar/calendar.component.html`).
- Stream: a slot exposes state but no playback control; `width="480"` on Vimeo or Facebook gives an invalid CSS
  width; the stream error codes are not exported.
- Icon: an unknown name or a bad SVG throws during change detection; "no icons provided" throws from the constructor.
- Date-time: in a required field unparseable text shows `required`, not `parseErrorMessage`; an hour alone does not
  commit; an open picker at destroy leaves a pending frame.
- Rich-text editor: a headless `[etRichTextEditor]` cannot attach its editable element (`editorDom` is `@internal`).
- Scheduler: a custom feature or edit-surface host re-implements register/filter/sort; ET4505/ET4506 throw out of
  change detection.
- Grid: renders nothing before its host has a width; ET1902 throws out of change detection.
- Form field: a schema-`hidden` field logs NG01916; `createAnchoredPanelController` needs the unexported
  `OverlayTemplateHostComponent`.
- Tabs: a nav link with `[queryParams]` is active only when the URL carries them.
- Select: select-all appends in click order; a failed `selectOptionsFromQuery` request also reaches the ErrorHandler.
- Menu: a menu open at destroy leaves the overlay leave frame pending. Match: `normalizeEthleteParticipant` returns
  a nullable type for a non-null input.
- Cascader: in leaf mode a result without `isLeaf` counts as a branch (the `cascaderFromQuery` `toResults` JSDoc
  example has this flaw); `cascaderFromQuery` infers `TValue` as `{}` unless `args` is annotated.
- Dropzone: `createDefaultDropzoneArgs` returns untyped args; no `exportAs`; `createFileDropzoneEntry` needs the
  `@internal` `createUploadHandle`; a remove followed by navigation cancels the server `delete`.
- A static `aria-label` on a headless select, cascader or colour trigger is erased; a custom colour surface cannot
  commit (`picker.commitColor` is `@internal`).
- Breadcrumb: anything but the separator projected into `<et-breadcrumb-outlet>` disappears. Carousel:
  MISSING_ITEMS throws from an effect into change detection.
- Query error: a legacy error offers no retry without `setDefaultQueryRetryFn`. Filter overlay: a preview without
  `totalHits` shows "Show results" silently.
- Selection list: `SelectionState` has no selected count. Scrollable: `isAtStart`/`isAtEnd` start `true`; element
  mode rounds a 0.5 intersection to fully visible and skips that child when paging.
- Accordion: the default header joins label and hint with no space; `openAll()` does nothing with `autoCloseOthers`.
- Pagination: the page size select does not reset the page; `PaginationSeoDirective.pageTitle` waits for a first
  navigation.
- Input: a bound `[type]` on a native `input[etInput]` does not reach the DOM; the password reveal needs
  `et-form-field`.
- Phone input: display groups by 3 for every country; the country `aria-label` lands on the trigger.
- Picture: the missing-`defaultSrc` warning comes from a computed and can repeat.
- Chart: most dev errors throw into change detection while `MISSING_PLOT` goes to the ErrorHandler; `xHeader`
  falls back to "Category".
- Slider: a tap with no move commits the press value. Standings: the participant text includes the emblem initial;
  two zone notes join with no space.
- Kbd: `parseKbdKeys('mod++')` drops the `+`. Tree: labels are plain inputs, no `provideTreeLabels`; the E2E "lazy
  tree shows a loading state" is flaky under parallel load.
- `et-icon-button` projects only `[etIcon]`; an `et-description` in `et-choice-field` describes nothing.
- Rating: `et-rating` in `et-form-field` throws ET2200/ET2201 with no hint. ET1500, ET4900 and ET2600/2601 throw out
  of change detection.

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

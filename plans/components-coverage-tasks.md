# Components consumer coverage (S8b) - task list

Branch: next. Other sessions share the checkout and may have uncommitted files. Do not touch or commit them.

## Goal

Consumer coverage (S8b): scenario tests for what apps use of
`@ethlete/components`, guarded by `tools/export-coverage` (`node tools/export-coverage/check.mjs`). Each bug a
scenario finds gets a fix, a changeset, and a test that fails without the fix. This file is a task list for one
agent that works alone, batch by batch.

## State

- Done: button, overlay, stream, table, icon, forms/date-time, forms/rich-text-editor, scheduler, grid,
  forms/form-field, bracket, tabs, forms/select, notification, menu, match, forms/cascader, forms/dropzone,
  forms/color-input, breadcrumb, command-palette, carousel, scrollable, forms/selection-list, query-error,
  filter-overlay, forms/phone-input, forms/input, accordion, picture, pagination. `KBD_PLATFORM` and `DescriptionComponent` are covered by the palette and selection-list scenarios. Components: 959 of 1381 covered. Per-domain notes are under "Domain notes" below.
- Removed on 2026-09-26 by user decision: `GridItemRef` and `configComponent` (e519882bc). Added:
  `FormFieldDirective.controlSuffixTemplate` (e38133536).
- Done 2026-09-27: the 36 non-constant S8b entries that tasks 6 and 7 missed (1f9f8e8d5, 465da426b, a932b4e55).
  Components: 1370 of 1381 covered; the 11 left are E2E-only. Open: headless `etTextarea`/`etInput` never write
  `[(value)]` into the native host (`it.fails` in `forms-textarea`), and they set no touched/focused on blur.
  `etFocusRing` press state needs an E2E check.
- Done 2026-09-27: task 8 for date-time, overlay, tabs (3327a7bd9, 219ca0ddb, a91567691; fix d25a6db1e).
- Done 2026-09-27: the 8 accepted fixes (56faa5290, 96b529406, 6d1d90fe8, 0011859ab, b4c48fb96, 53497453e, 89a61f0a6,
  8559a833f). Open: a bare password input does not update Caps Lock on blur; state saved before 53497453e loses
  numeric table keys once.
- Done 2026-09-27: task 8 for button + focus ring (c7a047ba3, window-control focus ring fix), form field (02b29b09e),
  table (f8b697d5d), icon (17fedf28e). User decision 2026-09-27: table column reorder on touch starts after a ~400 ms still
  long press (non-passive `touchmove` `preventDefault()` once active); keep `touch-action: auto`, no `pan-y`, no grip.
  In progress.
- User 2026-09-27: finish ALL of task 8 before "b7 done".
- In progress 2026-09-27: task 8 for stream + notification, scheduler + grid.

## Rules for every batch

- Before a batch: add or update the line `In progress <date>: <domains>` at the end of the `## State` section in
  this file, and commit it alone. A usage limit then loses nothing.
- Name files `libs/components/src/scenarios/<domain>*.scenario.spec.ts` (forms: `forms-<control>*`). Pattern files:
  `forms-select.scenario.spec.ts`, `bracket.scenario.spec.ts`, `menu.scenario.spec.ts`, `grid.scenario.spec.ts`.
- An export counts as covered when the scenario imports it from `../index` and uses it as an app would. Test real
  behavior (DOM, keyboard, aria, emitted values), not existence.
- Get a batch's exports: `node tools/export-coverage/check.mjs components --list | grep -E "S8b (a|b|c)$"`.
- After the scenarios are committed: remove only the entries that `check.mjs components` reports as
  "allowlisted but covered" AND whose reason is `S8b <domain>` of this batch. Never `check.mjs --update`. Commit the
  allowlist and a plan note (a `### <domain>` block under `## Domain notes`: open friction, E2E gaps) together. Stale entries fail
  `.husky/pre-push` for every session, so commit the removal at once.
- Checks per batch: `npx vitest run --config libs/components/vite.config.mts <files>`;
  `npx tsc --noEmit -p libs/components/tsconfig.spec.json` (vitest does not type-check); `npx eslint <changed files>`
  with zero new warnings; `npx prettier --write <changed files>`.
- Git: NEVER `git stash`, `git add -A`, `--amend` or worktrees. `git add -- <new>` then
  `git commit -m "type(scope): Subject" -- <paths>`. No Co-Authored-By trailer. Generic fixtures (team-a), no client
  names. `export TMPDIR=/Users/tom/.cache/tmp-s8b NX_NO_CLOUD=true`.
- Comments: almost none (AGENTS.md allowlist).
- If you delegate a batch, use `model: "opus"`, a fresh subagent per batch, and pass these rules verbatim. The
  subagent must not edit the allowlist or this file.

## Task list

1. Done 2026-09-27: breadcrumb, command-palette, carousel.
2. Done 2026-09-27: scrollable, forms/selection-list, query-error, filter-overlay.
3. Done 2026-09-27: chart, calendar, standings, forms/slider.
4. Done 2026-09-27: forms/phone-input, forms/input, accordion, picture, pagination.
5. Done 2026-09-27: tree, time-picker, chip, kbd, floating-action, forms/masked-input, loader.
6. forms/multi-language-rich-text-editor 7, banner 7, toggletip 6, overlay 6, stream 5, scrollbar 5,
   progress-steps 5, masonry 5, badge 5, avatar 5, tooltip 4, toolbar 4, skeleton 4, forms/tag-input 4,
   forms/rating 4 (76).
7. timeline, forms/textarea, forms/form, forms/choice-field, description-list, card (3 each), forms/switch,
   forms/otp-input, forms/description, forms/checkbox, empty-state, divider, copy-button (2 each), version,
   forms/selection-card, focus-ring (1 each) (35). Then `check.mjs components --list | grep -c S8b` must be 0.
   Delete this file.
8. E2E: turn the "E2E gaps" of each `## Domain notes` block into `apps/storybook-e2e` suites. Read the
   `component-behavior-tests` skill first. One commit per domain, biggest user impact first (select, menu,
   date-time, overlay, tabs).
9. Before any push: ask the user, then run the `ci-check` skill.

## Accepted fixes (user decision 2026-09-27, all done)

1. `TextFieldControlDirective`: add focus/blur host listeners so a bare native `input[etInput|etNumberInput|
etPasswordInput]` sets `focused`/`touched` and shows signal-form errors.
2. `etSlider` `min`/`max`: add `numberAttribute`; keep the names.
3. Spinner: keep no default accessible name; correct the `LoaderLabels.loading` JSDoc to match the loader guide.
4. Add label keys for the rating `aria-valuetext` ("No rating", "N of M") and the multi-language RTE switcher dots
   ("has content"/"empty") to their existing label sets.
5. `et-progress-steps`: set `aria-current="step"` on the current step; update the guide.
6. Table: keep a numeric `rowKey` as the consumer's type and compare by value; flip the `it.fails` in
   `table-features-rows.scenario.spec.ts`.
7. Headless tab bar: arrow keys move from the focused trigger (WAI-ARIA), not the selected one.
8. `@ethlete/bracket` `BracketMatchComponent`: widen the type with `bracketRoundSwissGroup`.

## Gotchas

- /tmp is a tmpfs with few inodes. The classifier blocks `rm -rf` in /tmp; ask the user to run it.
- Harness: no per-test providers; `s.flush()` never settles while a timer or query client lives (use
  `s.tick(); s.flush()`); a dev `RuntimeError` element log lands in `s.errors` only after `s.tick(1)`; jsdom lacks
  `ResizeObserver`, `matchMedia`, `Element.animate` (polyfills in `libs/components/src/scenarios/test-helpers`)
  and component CSS (inject `display:block` against "display of 'inline'" errors); menus and overlays throw
  without an `error`-typed colour theme.
- `check.mjs` scans the working tree, so an untracked scenario of a running agent makes entries look covered.
  Remove only entries whose scenario is committed.

## Verify

- `node tools/export-coverage/check.mjs`
- `npx vitest run --config libs/components/vite.config.mts libs/components/src/scenarios`
- `npx tsc --noEmit -p libs/components/tsconfig.spec.json`

## Domain notes

### button

- Friction: `it.fails` (two specs): a template `(click)` on an `et-button` still runs while it is loading or a
  disabled link. `ButtonDirective`'s host listener runs after it, so `stopImmediatePropagation` is too late.
- E2E gaps: split-button focus and keyboard; focus ring on icon, fab and window-control buttons; pressed toggle via
  Space; hover and active colour states.

### overlay

- Friction: none open.
- E2E gaps: the full-screen morph from its origin (`OverlayOriginCloneComponent`, the five
  `*FullscreenAnimation*` functions); the inline sidebar above `renderSidebarFrom` (pane width); focus moving into
  a pane by `first-tabbable` (jsdom has no client rects).

### stream

- Friction: a slot exposes state but no playback control; `width="480"` on Vimeo or Facebook gives an invalid CSS
  width; the stream error codes are not exported.
- E2E gaps: `PipCollapseOverlayDirective` and `PipTitleBarDirective`; PiP drag, collapse and resize; the FLIP and
  scale animations; an iframe that moves between slots; the placeholder pulse (needs a real IntersectionObserver).

### table

- Friction: `it.fails`: a numeric `rowKey` is turned into a string, so `new Set([3])` in the selection or expanded
  signal matches nothing. Scenarios take no per-test providers; a dev `RuntimeError` in render adds a stray
  `console.error({ element })` to `s.errors`; a failed signals-client query reports to the ErrorHandler;
  `s.flush()`/`s.settle()` never settle while a query client lives (use `s.tick()`); menus throw without an
  `error`-typed colour theme.
- E2E gaps: virtual scroll windowing and measured row height; the group row sticky offset; the refetch busy bar;
  the real CSV download; reorder, resize and drag-scroll by pointer; sticky offsets on a narrow viewport; page
  sticky header pinning; the detail-row animation.

### icon

- Friction: an unknown name or a bad SVG throws during change detection and takes the view down; "no icons
  provided" throws from the constructor.
- E2E gaps: real sizing (`width/height="100%"`) and `currentColor` from the theme.

### date-time

- Friction: in a required field unparseable text shows the `required` message, not `parseErrorMessage`; an hour
  alone does not commit; `DATE_TIME_LABELS` holds only the partial override (read `injectDateTimeLabels()`); an
  open picker at destroy leaves a pending frame.
- E2E gaps: masked typing; calendar and time-column keyboard navigation; panel layout and animation; other time
  zones; focus return after close.

### rich-text editor

- Friction: a headless `[etRichTextEditor]` cannot attach its editable element (`editorDom` is `@internal`); the
  token popup's host `id` overwrites TestBed's root id; rAF loops need an `s.flush()` at the end.
- E2E gaps: caret, IME and soft breaks; toolbar and popover positioning; the touch-docked toolbar; image drag and
  drop; real clipboard events; `beforeinput historyUndo`; table picker hover.

### scheduler

- Friction: a custom `SchedulerFeatureHost` or `SchedulerEditSurfaceHost` re-implements register/filter/sort (no
  helper); an `appointments` input collides with the host's `appointments()` method; ET4505 and ET4506 throw out of
  change detection; `nowIndicator` keeps a timer, so `s.flush()` never settles.
- E2E gaps: pointer drag-to-create, move and resize; edit surface placement and the fullscreen dialog below `md`;
  scroll to the initial hour; RTL swipe; long-press drag versus swipe; the "+N more" overflow menu.

### grid

- Friction: the grid renders nothing before its host has a width; ET1902 throws out of change detection.
- E2E gaps: pointer drag and resize; auto-scroll; CSS transitions; container resize; reduced motion.

### form field

- Friction: a schema-`hidden` field logs NG01916 (the docs say to remove it with `@if`);
  `createAnchoredPanelController` needs the unexported `OverlayTemplateHostComponent`; `FORM_FIELD_LABELS` holds
  only the overrides; `s.flush()` runs no change detection when nothing is pending.
- E2E gaps: support region animations; floating label layout; busy spinner timing; anchored panel position; the
  bottom sheet below `md`; the focus ring.

### bracket

- Friction: the `BracketMatchComponent` type in `@ethlete/bracket` lacks `bracketRoundSwissGroup`, which
  `et-bracket` always binds, so a custom card typed by it fails with NG0303; `BRACKET_LABELS` holds only the
  overrides.
- E2E gaps: hover journey highlight and connector animation; card pixel layout (final at `size: auto`, compact
  emblems below 150px); pin drop on a click in empty space; horizontal scroll to `focusRoundId`; a measured width
  for `bracketFitsWidth`; pick-card focus rings.

### tabs

- Friction: in the headless tab bar, after `.focus()` on a trigger the arrow keys move from the selected tab, not
  the focused one (check whether this is a bug); a nav link with `[queryParams]` is active only when the URL
  carries them.
- E2E gaps: the underline FLIP animation; scrolling the selected trigger into view; the overflow scroll buttons;
  the focus ring.

### select

- Friction: select-all appends in click order, so chips follow value order; the first Escape in a searchable
  select only clears the query; `SELECT_LABELS` holds only the overrides; a failed `selectOptionsFromQuery` request
  also reaches the ErrorHandler.
- E2E gaps: panel position and width mirroring; real windowing; the `etSelectViewport` min-width lock; pointer
  hover; touch and bottom sheet; busy animations; the clear button on hover; the leave animation.

### notification, menu, match

- Friction: `normalizeEthleteParticipant` returns a nullable type
  for a non-null input; a menu open at destroy leaves the overlay leave frame pending.
- E2E gaps: menu placement, flip, arrow and context-menu repositioning, resize animation, focus ring; notification
  stack FLIP, enter and leave animations, swipe distance thresholds, RTL swipe; match container-query layouts under
  `auto`, score roll and flash timing, picture fallback.

### forms/cascader, forms/dropzone, forms/color-input

- Friction: in leaf mode a search result without `isLeaf` counts as a branch, so Enter browses into it (the
  `cascaderFromQuery` JSDoc `toResults` example has this flaw); `cascaderFromQuery` infers `TValue` as `{}` unless
  `args` is annotated; `createDefaultDropzoneArgs` returns `RequestArgs<QueryArgs>`, so typed args need
  `body as FormData`; `DropzoneDirective` has no `exportAs`; `createFileDropzoneEntry` needs a handle only the
  `@internal` `createUploadHandle` builds; the dropzone `delete` request is cancelled on destroy, so a removed file
  is never deleted on the server if the user navigates away; a static `aria-label` on a headless select, cascader or
  colour trigger is erased (put it on the control host); a custom colour surface cannot commit a colour
  (`picker.commitColor` is `@internal`).
- E2E gaps: colour area drag; real drag and drop with a native DataTransfer and hover styling; focus return and
  position in anchored mode (jsdom always picks the bottom sheet); cascader column slide and window animation;
  sheet back-navigation and title animations; dropzone remove and FLIP animation, progress bars, image preview;
  the eyedropper; focus rings.

### breadcrumb, command-palette, carousel

- Friction: anything but the separator projected into `<et-breadcrumb-outlet>` disappears (`et-breadcrumb` has no
  `ng-content`); breadcrumb collapse needs patched `clientWidth`/`scrollWidth`; `mod` shortcuts need `KBD_PLATFORM`
  pinned; carousel movement needs fake rects, a resize, a real macrotask for the MutationObserver, and the
  scroll-observer edge markers reported by hand (zero-size rects mark them visible); carousel MISSING_ITEMS throws
  from an effect into change detection.
- E2E gaps: breadcrumb collapse on resize, overflow toggletip focus and return; Ctrl/Cmd+K on real platforms, active
  row `scrollIntoView`, palette focus return and colour context; carousel touch swipe with snap, loop seam jump,
  dim/wipe transitions, autoplay ring, hover/focus pause, reduced motion.

### scrollable, forms/selection-list, query-error, filter-overlay

- Friction: two bugs fixed (scrollable edge in c1bae1a1f, query-error `retryState` in d414289ef); a legacy error offers no retry without
  `setDefaultQueryRetryFn`; a module-level `V2QueryClient` leaks its GC interval; `provideFilterOverlay` needs
  `FilterOverlayConfig<typeof FIELDS>`, not `Partial<Parameters<...>>`; a preview without `totalHits` shows "Show
  results" in production silently; `SelectionState` has no selected count; selection-list `aria-checked` needs
  frames drained before destroy; scrollable `isAtStart`/`isAtEnd` start `true` (buttons start disabled); element
  mode rounds a 0.5 intersection to fully visible and skips that child when paging.
- E2E gaps: query-error `role="alert"` and error theme; filter-overlay animation, focus in and back, routed sub
  pages, floating-action badge; segmented sliding background, checkmark/radio animations, card hover and focus
  rings, tabs-variant underline; real scroll snap, smooth scroll, mask gradients, sticky buttons, dot track past 5
  dots, drag momentum, vertical direction, `scrollOrigin`/`scrollMargin`.

### forms/phone-input, forms/input, accordion, picture, pagination

- Friction: fixed in f3db50c36: `etNumberInput`/`etPasswordInput` on a native host ignored typing. Open: the default
  accordion header joins label and hint with no space ("Returns30 days"); `openAll()` does nothing with
  `autoCloseOthers`; the page size select does not reset the page; `PaginationSeoDirective.pageTitle` waits for a
  first navigation; a bound `[type]` on a native `input[etInput]` does not reach the DOM; the password reveal needs
  `et-form-field`; phone display groups by 3 for every country; the phone country `aria-label` lands on the trigger;
  the picture missing-`defaultSrc` warning comes from a computed and can repeat.
- E2E gaps: accordion collapse animation, find-in-page with `visibility`, chevron, `inert` focus; pagination
  responsive trimming and compact switch, stable readout width, modified-click links; picture `<source>` choice by
  media/type/DPR, lazy loading, `object-fit`; input stepper hold-to-repeat, scrub drag cursor, real Caps Lock,
  reveal icon swap; phone country panel keyboard and search, focus to the number after a pick, clear animation, emoji
  flags.

### chart, calendar, standings, forms/slider

- Friction: many dev errors throw into change detection (`MARKS_TOO_DENSE`, `OVERLAPPING_ZONES`, `MIXED_X_TYPES`, the
  sankey errors) while `MISSING_PLOT` goes to the ErrorHandler; `DUPLICATE_MARK_TEMPLATE` throws from the
  constructor; a slider tap with no move commits the press value; the standings participant text includes the emblem
  initial, and two zone notes join with no space; calendar Enter/Space needs the native button click; `xHeader`
  falls back to "Category"; a plot needs a faked `clientWidth`.
- E2E gaps: slider pointer drag with capture, touch pan, RTL, vertical, focus ring after press, value label position;
  standings drag reorder, container-query density, zone colours, zone notes in a screen reader; calendar month and
  header transitions, focus during re-render, hover preview, multi-month layout; chart touch drag on a line plot,
  tooltip placement and hover, horizontal bars, sankey labels and scroller, pie entry animation.

### tree, time-picker, chip, kbd, floating-action, forms/masked-input, loader

- Friction: fixed in ec0d0ada3: a leading minus in `createCurrencyMask({ allowNegative: true })` was dropped. Fixed in 3f8119efd: the mask broke an IME composition
  in `et-input`. Open: `parseKbdKeys('mod++')` drops the `+` (write `plus`);
  chip does not move focus after a remove; the harness `s.intersect` sends `rootBounds: null` (floating-action wraps
  it); time-picker column focus waits for a microtask and `new Date()` is read at construction; tree
  `loadingLabel`/`emptyLabel`/`retryLabel` are plain inputs, no `provideTreeLabels`.
- E2E gaps: macOS Option keys and spoken kbd labels; spinner/brand animations, reduced motion, `currentColor` in
  colour scopes; chip remove focus ring and Backspace focus handoff; real IME, dead keys, caret after paste, soft
  keyboards; floating-action move and scale, no anchor jump, smooth `scrollToTop`; time-picker selected-option
  centring, scrollbar auto-hide, RTL, range bands, touch scroll; tree chevron, indent, focused-row `scrollIntoView`,
  RTL keys, check mark.

### task 7 (timeline, card, description-list, divider, empty-state, copy-button, version, small forms parts)

- Friction: the empty-state JSDoc names a `title` input, the real one is `heading`; `et-icon-button` projects only
  `[etIcon]`, other content disappears; `DescriptionComponent` is read only by selection options, so an
  `et-description` in `et-choice-field` describes nothing; `[etForm]` needs `scrollIntoView` and `getClientRects`
  patched; checkbox, switch and textarea leave frames pending (end with `s.flush()`).
- E2E gaps: real clipboard permission and the `execCommand` fallback in Safari; vertical divider sizing; timeline rail
  geometry; choice-field card states and control positions; smooth scroll to the first invalid field; textarea
  autosize and resize handle.

### masonry, badge, avatar, tooltip, toolbar, skeleton, forms/tag-input, forms/rating

- Friction: see the rating open item; `et-rating` in `et-form-field` throws ET2200/ET2201 with no hint; masonry needs
  `createMasonryHarness` and a 150 ms debounce drained; tooltip keyboard focus needs a microtask after Tab; a throw
  from `show()` in a click listener becomes an uncaught error; tag-input paste needs a hand-built `clipboardData`.
- E2E gaps: badge icon sizing and theme visuals; avatar image load/failure and group rings; skeleton shimmer and
  reduced motion; toolbar Tab in/out, RTL, nested; masonry late image load, drag snap, RTL, fade-in; tooltip placement
  near edges, touch suppression, above a dialog; tag-input real paste, IME, soft keyboard Enter; rating pointer drag,
  hover preview, half-star hit areas, fill animation.

### banner, toggletip, progress-steps, scrollbar, forms/multi-language-rich-text-editor

- Friction: ET1500, ET4900 and ET2600/2601 throw out of change detection; binding a component instance to scrollbar
  `for` in a failing test hangs vitest; banner scenarios need `success`/`warning`/`error`-typed themes.
- E2E gaps: banner tints, dismiss focus ring, live region; toggletip placement, focus into a template panel and back,
  outside press, auto-hide on scroll; progress-steps counter numbers, connector, vertical layout, focus ring; scrollbar
  drag, paging, RTL, auto-hide, native bar hiding; RTE focus return after a language pick, touch menu focus.
- Left for E2E (not scenarios): the overlay `*FullscreenAnimation*` functions and `OverlayOriginCloneComponent`; the
  stream PiP chrome parts and managers.

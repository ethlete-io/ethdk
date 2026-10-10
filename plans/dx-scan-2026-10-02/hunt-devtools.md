# query-devtools hunt — DX scan 2026-10-10

Scope: `libs/query-devtools` (`.`, `/lazy`, `/toggle`). Checked against `git log --oneline -60 -- libs/query-devtools`
and the deleted `misc-libs.md` (MISC-06/07/14/15/16 are fixed and not repeated here).

Checked and clean: the toggle/shortcut matcher (repeat, AltGr, `code`/`key` fallback, a synthetic keydown without
`key` short-circuits on the modifier checks), the lazy shell's hand-over of the shortcut (`filter(() => !load())`),
the `setQueryDevtoolsUiMounted` counter (lazy shell and panel each count once), the pop-out tear-down (style
MutationObserver, `popOutEnded$`, `pagehide`), the probe lock release, the copied ticks, the event log and dropped
list caps, tombstones dropping `element`/`injector`, cache size measuring (WeakMap-memoized, so `cacheView`
recomputes stay cheap), and the Cache tab's `isUnused` count (every `bind`/`unbind`/`evict` bumps `cacheVersion`).

| ID     | Sev    | Kind     | Decision | Title                                                                                   |
| ------ | ------ | -------- | -------- | --------------------------------------------------------------------------------------- |
| HDV-01 | Medium | bug      | no       | Execute / Cached do nothing on a parked `withArgs` query, and the list shows it as idle |
| HDV-02 | Medium | bug      | no       | Closing the panel while Inspect is on leaves inspect mode armed and swallows app clicks |
| HDV-03 | Low    | bug      | no       | The lazy shell has no `@error` block: a failed panel chunk leaves an inert toggle       |
| HDV-04 | Low    | dx       | no       | Open and close move no focus: closing from the panel drops focus to `<body>`            |
| HDV-05 | Low    | test-gap | no       | No browser-level coverage for the shortcut, Inspect, pop-out or the lazy `@defer`       |

## HDV-01 Execute / Cached do nothing on a parked `withArgs` query, and the list shows it as idle

- Where: `libs/query-devtools/src/lib/query-devtools.component.ts:2042-2051` (`executeQuery`), `:1789-1791`
  (`queryArgs`), `:1810-1816` (`queryStatus`); `libs/query/src/lib/http/query-execute-utils.ts:18-34`
  (`resetExecuteState` clears `args` and `request`), `:126-137` (`skipParkedExecution`), `query-execute.ts:33`
  (`execute` returns `false` when dropped). Since `78c6bce64`.
- Problem: a query whose `withArgs` source returns `null` is parked: `resetExecuteState` sets `args()` and
  `subtle.request()` to `null`. In the panel, `queryArgs()` is then `null`, so **Execute** and **Cached** call
  `query.execute({ args: null })`. `skipParkedExecution` drops the call, logs a dev warning in the app console and
  returns `false`. `executeQuery` ignores the return value and only reacts to a throw, so the button does nothing
  visible. `apps/docs/query-devtools/index.md:572-574` promises that a query with no args to send opens the args
  editor instead - that only happens for the throwing function-route case. The list and detail also show a parked
  query as `idle` (`queryStatus` reads only `executionState()`, which a park resets), so nothing tells the developer
  that the query waits on its source - the one thing they open the panel to find out.
  Repro: `withArgs(() => (userId() ? { pathParams: { id: userId() } } : null))` with `userId` null, select the query,
  press **Execute**.
- Fix: in `executeQuery`, when `execute(...)` returns `false`, call `openArgsEditor(selection)` and set `editError`
  to a parked hint ("Parked: its withArgs source returns null. Run it with args from here, or set the source.").
  Add a `parked` status (`state.subtle.hasArgsSource() && query.args() === null && !executionState()`) to
  `queryStatus`, a chip for it, and a `parked` facet next to `idle` in `QueryListFacet`. Cover it in
  `query-devtools.component.spec.ts` (or `query-devtools-detail.component.spec.ts`) and update the Execute paragraph
  in the docs.
- Breaking: no. Decision: no.
- Status: fixed (status `parked`, Parked chip, Execute/Cached open the args editor with a hint; spec in query-devtools.component.spec.ts)

## HDV-02 Closing the panel while Inspect is on leaves inspect mode armed and swallows app clicks

- Where: `libs/query-devtools/src/lib/query-devtools.component.ts:1603-1611` (`toggleOpen`), `:1485-1509` (the
  capture-phase listeners), `:3485-3494` (`selectInspectedQuery`); `query-devtools.component.html:1` (the Inspect
  button lives inside `@if (open())`), `:361` (the highlight box renders outside it).
- Problem: `inspectActive` is only cleared by Escape, the Inspect button, or a successful pick. Close the panel while
  inspecting - **Close** button or `Ctrl/Cmd + Alt + Q` - and the document keeps its capture-phase `mousemove`,
  `click` and `keydown` listeners. `selectInspectedQuery` calls `preventDefault()` and `stopPropagation()` before it
  checks for a hovered query, so every click anywhere in the app is swallowed, and query-bound elements keep drawing
  the highlight box. The "Inspecting / Esc" hint is in the closed panel, so the app just looks frozen. Only the
  floating toggle (inside the host) still works. The existing spec
  (`query-devtools.component.spec.ts:209`) covers inspect with the panel open only.
  Repro: open the panel, press **Inspect**, press `Ctrl+Alt+Q`, click any button in the app.
- Fix: clear inspect mode whenever the panel closes - `if (!this.open()) this.inspectActive.set(false)` in an effect,
  or set it in `toggleOpen` and every `open.set(false)` path. Separately, move the `preventDefault`/`stopPropagation`
  in `selectInspectedQuery` below the `!hover` guard, or leave it and document that a miss is swallowed on purpose.
  Add a spec: inspect on, close, dispatch a click on an app element, expect it to reach the app.
- Breaking: no. Decision: no.
- Status: fixed (closing clears inspect mode; the miss-click swallow while inspecting is kept on purpose; spec + e2e)

## HDV-03 The lazy shell has no `@error` block: a failed panel chunk leaves an inert toggle

- Where: `libs/query-devtools/lazy/query-devtools-lazy.component.ts:39-48` (template), `:103-113` (the shortcut
  listener filters on `!this.load()`).
- Problem: if the panel chunk fails to load (offline dev server, a redeploy that changed the chunk hash under an
  open tab), Angular's defer runtime renders the `@error` template. Without one, the `@loading` view stays. That is
  the toggle without an `(openChange)` binding, so the button stays on screen and does nothing. `load()` is already
  `true`, so the shortcut listener ignores every further press. The only trace is an error in the console. The
  developer cannot retry without a reload.
- Fix: add `@error { <et-query-devtools-toggle [tampered]="tampered()" (openChange)="retry()" /> }` with a title that
  names the failure. Angular cannot re-run a failed `@defer`, so `retry()` reloads the page or re-mounts the block
  through a keyed `@for`/`@if` toggle. Add a spec in `tests/query-devtools-lazy.spec.ts` that makes the
  panel's dependency load fail (for example through `TestBed`'s `DeferBlockBehavior.Manual` and `DeferBlockState.Error`).
- Breaking: no. Decision: no.
- Status: fixed (`@error` toggle with `loadFailed`, click reloads the page; spec in tests/query-devtools-lazy.spec.ts)

## HDV-04 Open and close move no focus: closing from the panel drops focus to `<body>`

- Where: `libs/query-devtools/src/lib/query-devtools.component.html:1,183-193,357-358`; no `.focus()` call anywhere in
  `libs/query-devtools` (checked with grep).
- Problem: the panel and the floating toggle swap through `@if (open())` / `@if (!open())`. Press **Close** with the
  keyboard: the focused button is destroyed, and focus falls to `<body>`. A keyboard user is back at the top of the
  page and has to tab through the whole app to reach where they were. Opening via the toggle has the same effect in
  reverse: the toggle is destroyed and focus does not move into the panel.
- Fix: on open, remember `document.activeElement` (when it is outside the host) and move focus to the active tab.
  On close, give focus back to the remembered element if it is still connected, else to the floating toggle's
  button. Do this after render (`afterNextRender`). Skip it while popped out.
- Breaking: no. Decision: no.
- Status: fixed (open focuses the active tab, close restores focus or falls back to the toggle; spec + e2e)

## HDV-05 No browser-level coverage for the shortcut, Inspect, pop-out or the lazy `@defer`

- Where: `apps/storybook-e2e/src` has no devtools suite. The jsdom specs in `libs/query-devtools/tests/` and
  `src/lib/*.spec.ts` cover the matcher, the view-state read and the defer hand-over in jsdom (no failure path).
- Problem: real keyboard dispatch (macOS Option rewriting `key`, AltGr), capture-phase inspect listeners, real
  focus, the pop-out window and a real `@defer` chunk only behave as in production in a browser. HDV-02 and HDV-04
  show that this layer has regressions nobody would notice in jsdom.
- Fix: add a `query-devtools` suite to `apps/storybook-e2e` against the existing devtools story
  (`component-behavior-tests` skill). Open and close via the shortcut and the toggle, check where focus lands, and
  check that inspect, then close, does not swallow app clicks. Also open the pop-out (Chromium allows `window.open`
  in tests) and dock it back.
- Breaking: no. Decision: no.
- Status: fixed (apps/storybook-e2e/src/query-devtools: shortcut open/close, focus return, inspect off after close, lazy load; pop-out left out to keep the suite small)

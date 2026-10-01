# Lib scans - settled decisions

Findings a future scan must not report again. The scans themselves are closed; git history has them.

## query

From the `libs/query` scans of 2026-08-19 and 2026-09-27 (waves 1-3).

- `refreshStrategy` from 0 to 1 is a fraction of the token lifetime, above 1 it is milliseconds. Only a negative
  value clamps (to 0).
- The cookie token is obfuscated with a per-origin key, not encrypted. The legacy refresh cookie stays readable
  from JS.
- The legacy `QueryForm` keeps its BehaviorSubjects (`@deprecated`). `activeFilterCount$` / `activeFilterCount` and
  `defaultFormValue` / `defaultValue` both stay.
- The Promise APIs stay: `executeUntilSettled`, `QuerySequence.run`, `createQuerySubmission.action`,
  `whenPersistenceReady`, `clearPersistedQueries`.
- The cache key is a non-cryptographic 2x32-bit hash. It sorts `queryParams` keys (nested too); the URL keeps the
  written order.
- A `Date` in `queryParams` goes on the wire as `toISOString()`.
- Misuse errors throw in every mode, not only in dev.
- Legacy `fallbackInjector`: the first app wins, with a dev warning. `destroy()` of a shared legacy query is fine.
- Devtools: persisted override `ops` survive a reload; the vault's cross-tab `storage` listener is never removed
  (one per page).
- Multi-tab: a follower's snapshot-carrying `<key>Success` event fires locally with a dev warning. One logout
  raises `logout` in every tab (`user` once, `otherTab` in the rest).
- A GraphQL 200 with `errors` and no `data` fails with ET601.
- `retryFailed()` never resends an item an unsubscribe aborted in flight; queued items still resend.
- A legacy `[etInfinityQuery]` keeps `canLoadMore: true` while the current page failed or retries.
- `withPolling({ executeInitially })` passes `triggeredBy: 'polling'`, also after an args change.
- No consumer `HttpContext` tokens on queries until a consumer needs one (ea-frontend has none).
- `refresh()` / `startPolling()` on a released ngrx-toolkit handle are no-ops with one dev warning per handle that
  names the release; no throw, no re-create.
- The `withArgs` type check: generic helpers that pass `withArgs` compile, a `QueryFeature` annotation drops the mark (use `WithArgsQueryFeature`), a spread is left to ET100.

## core

From the `libs/core` scan of 2026-08-19, closed 2026-09-29.

- `object.ts` path reads accept an unterminated bracket (`'a.b.e[0'` returns the value). Kept lenient: it is a public util.
- `settleWatcher` in `auto-surface.directive.ts` stays alive until the element is connected: windowed lists mount it in an off-pane container first.
- unsaved-changes `runCheck` still returns a Promise; `canDeactivate` consumes it.
- The animation directives' `BehaviorSubject`s. `state$` is a stream of transition events whose ~20 consumers need every state synchronously inside `.next()`; the signal version (`toObservable(state)` plus effects) dropped the middle state of a synchronous `entering→entered` / `leaving→left` jump and was reverted in `6296a5b41`.

## components

- The rich text viewer keeps its table and image style imports (accepted 2026-09-29: base capability per AGENTS.md).
- A select with projected options keeps its static chip, virtual-row and select-all imports. They cost 2.8 kB gz of
  49.4 kB (chips 1.7 kB); measured 2026-10-01.
- Kept as is (2026-09-27, reopen only when a consumer needs it): the phone input groups by 3 for every country;
  cascader leaf mode counts a node without `isLeaf` as a branch; `cascaderFromQuery` infers `TValue` as `{}` when
  an unannotated `args` comes before `toNodes`; table state saved before 53497453e loses numeric row keys once; the
  password reveal needs `et-form-field`; `et-icon-button` projects only `[etIcon]`; a slider tap with no move
  commits the press value; the filter overlay shows "Show results" without `totalHits`.
- Masked input dead keys and IME composition have no e2e coverage. They need a hardware keyboard on a real
  device; soft keyboard, paste and backspace passed on the iOS Simulator.

## query-devtools

- The status colours (`--_et-qdt-success`, `-error`, `-loading`) stay literals. Semantic themes come only from DI, and
  the panel must stay readable in an app without them.

## eslint-plugin

From the `libs/eslint-plugin` scan of 2026-08-19, closed 2026-10-01.

- `no-window-location` leaves `inject(DOCUMENT).location` unreported.
- `no-subscribe-with-body` keeps reporting `subscribe(this.handle)`: the handler belongs in `.pipe(tap(this.handle)).subscribe()`.
- `no-dom-query` stays without a receiver check and without `innerHTML` / `className` / `textContent` reports: without types both false-positive on non-DOM objects.
- Telling an RxJS `.pipe`/`.subscribe`/signal `.set()` receiver from a Node stream, a store or another one-argument `set` needs type information the rules don't have (incl. the Node-stream `.pipe` case in `no-subscribe-in-pipe` and the store `.subscribe` false positive).
- `export *` and `import('…')` of a package where only some symbols are banned cannot name the symbol, so they stay unreported.
- `window` in `no-window-location` / `prefer-viewport-size`, shadowed `window`, and the name lists in `no-readonly-signal` / `class-constant-property` / `no-legacy-prepare-without-injector` match by name.
- The contract lookup's `extends`/`Pick` limit is harmless.
- `no-legacy-prepare-without-injector` treats `x.runInContext(cb)` as an injection context: `EnvironmentInjector.runInContext` still ships in Angular 22 (deprecated) and this repo's scenarios use it.

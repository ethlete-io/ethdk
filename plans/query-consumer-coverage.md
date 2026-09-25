# Query consumer coverage

85af9b224 fixed an endless request loop that shipped in `@ethlete/query@6.0.0-next.46`–`next.48`:
`LegacyQuery.execute()` read `rawState` tracked, so `queryComputed(() => q.prepare(x).execute())` re-ran on
every state change. The suite never called `execute()` inside a reactive context, so ~3000 tests passed.

Goal: every usage pattern real apps rely on has a scenario that reproduces it the way the app writes it.

## Rules for every new scenario

- Build the query **inside** the reactive function, the way the app does. Never pass a prebuilt `() => query`.
- Never wrap the call under test in `untracked()` - consumers do not.
- Use a POST or `s.liveQueries()` when checking for double execution; GET dedup hides a second execute.
- Change signal args at least 3 times; assert one request per change and that the superseded one aborts.
- Legacy patterns run on both clients: native `V2QueryClient` and the interop creator (`describe.each`).
- Every fix: the scenario fails without it (prove it), passes with it.

## Consumer exposure

| App                                           | Version       | Notes                                                          |
| --------------------------------------------- | ------------- | -------------------------------------------------------------- |
| bvb-frontend                                  | 5.9.0         | v2 native; infinity queries, QueryForm, bearer auth, gql       |
| vbl-frontend                                  | 5.41.5        | v2 native; ~57 files `queryComputed`, `.poll()` inside it      |
| dfb-frontend                                  | 5.44.0        | v2 call sites on `ExperimentalQuery` client/creators; gql      |
| dyn-frontend                                  | 5.44.0        | v2 native; 47 files `switchQueryState` → `toSignal`, QueryForm |
| fut-frontend (+ `-altcha`, `-cookie-consent`) | 6.0.0-next.51 | interop (222 legacy creators) + v3 (`withArgs`, `withPolling`) |

The 5.x apps run their unchanged v2 code through the interop layer once they upgrade to 6.x.

## Patterns, by exposure

| #   | Pattern                                                                                                            | Apps               | Covered                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------- |
| P1  | `queryComputed(() => q.prepare(args(sig)).execute())`, changing args                                               | all (~250 files)   | static args, GET, interop only                                   |
| P2  | `*etQuery="q() as x; loading as loading; cache: true"`, source query swapped                                       | all                | static query only                                                |
| P3  | `queryStateResponseSignal(q, { cacheResponse: true })` / `queryStateLoadingSignal`                                 | bvb, vbl, dfb      | partial; no source switch                                        |
| P4  | `queryComputed(() => q.prepare(x).execute().poll({ interval, takeUntil }))`                                        | vbl                | no                                                               |
| P5  | `creator.createSignal()` + `.set(q.prepare(x).execute())` from a handler                                           | bvb, vbl           | no                                                               |
| P6  | `of(q.prepare().execute()).pipe(switchQueryState(), filterSuccess(), …)` → `toSignal`                              | dyn, fut           | no                                                               |
| P7  | `effect(() => { sig(); q()?.execute({ skipCache: true, cancelPrevious: true }) })`                                 | dfb                | no                                                               |
| P8  | `tap(() => q()?.execute({ skipCache: true }))` after `switchQueryState()`                                          | fut                | no                                                               |
| P9  | Legacy `QueryForm` + `QueryField` (debounce, `isResetBy`) feeding `queryComputed`                                  | bvb, dfb, dyn, fut | `legacy-query-form-patterns`                                     |
| P10 | `queryArrayComputed`, `queryComputedTillTruthy`, `toQuerySubject`, `queryComputedWithForm`                         | fut                | no spec at all                                                   |
| P11 | Infinity query config + `InfinityQueryDirective`                                                                   | bvb, dfb           | `legacy-infinity-trigger`                                        |
| P12 | Bearer auth provider + `createQueryCollectionSubject` login/refresh + `takeUntilResponse`                          | bvb, dfb, dyn      | `legacy-auth-patterns`                                           |
| P13 | Client options off: `enableSmartPolling`, `autoRefreshQueriesOnWindowFocus`, `cacheAdapter: () => 0`               | vbl                | `legacy-client-options`                                          |
| P14 | Early v3 (`ExperimentalQuery` namespace, 5.x) client/creators, migrated by `prep-for-query-v3`, with v2 call sites | dfb                | `early-v3-patterns`                                              |
| P15 | v3 `creator(withArgs(() => …), withPolling(…), withSuccessHandling(…))` field init                                 | fut                | generic                                                          |
| P16 | `createQuerySubmission`, `.clone()`, `provideLegacyPrepareFallback()`                                              | fut                | `createQuerySubmission` covered (spec + 2 scenarios); rest check |
| P17 | Manual `query.subtle.destroy()` for detached queries                                                               | dfb                | `early-v3-patterns`                                              |

## Suspected defects (from reading; prove with a failing scenario first)

1. v3 `execute()` / `reset()` inside `effect`: tracked reads of `state.args()`, `previousKey()`,
   `defaultRunOptions()` then signal writes (`http/query-execute.ts:45`, `query-execute-utils.ts:75-99`).
2. `effectComputed` runs the computation twice (`legacy/utils/data.utils.ts:284-316`): two POSTs for P1 with a
   mutation; the first query may never register with the container.
3. Native `V2QueryClient` reads `rawState` tracked (`legacy/query/query.ts:157,228,239`): P1 on 5.x apps.
4. Stack `execute()` / `retryFailed()` / paged `execute({ where })` inside `effect` (`query-stack.ts:412-425`,
   `paged-query-stack.ts:505`).
5. Auth `logout()` inside `effect` calls `unbindAllSecure()` tracked (`bearer-auth-provider.ts:876`).
6. Creating a v3 query / `createSnapshot()` / `asObservable({ injector })` inside `computed` (NG0602; NG0600 with
   devtools on, `devtools/query-devtools-registry.ts:198`).

## Slices

- [x] S0 Harness: request-storm + effect-loop invariants
- [x] S1 Defects 1-3 with failing scenarios, then fixes (`reactive-contract.scenario.spec.ts`)
  - 1 real: `execute()`/`reset()` in an effect looped (ET800) or reset its own response; now untracked.
  - 2 real: `effectComputed` ran the computation twice (two POSTs, new query after the sync read); now one tracked run.
  - 3 not real: native `rawState` is a `BehaviorSubject`, so nothing is tracked; GET scenario kept as a guard.
- [x] S2 P1 on both clients with changing args (`harness/legacy-clients.ts`, `legacy-consumer-patterns.scenario.spec.ts`)
  - 1 real: legacy `QueryForm.observe()` re-emitted its unchanged value one debounce later, a second identical request; now skipped.
- [x] S3 P2, P3, P5 source switches; P4 poll inside `queryComputed` (`s.mount`, `legacy-template-patterns.scenario.spec.ts`)
  - 1 real: `*etQuery` over an interop query reported every failure to the `ErrorHandler` twice; now once.
- [x] S4 P6, P7, P8 RxJS and effect re-execute (`legacy-rxjs-patterns.scenario.spec.ts`)
  - 1 real: `*etInfinityQuery` over an interop query reported every failed page to the `ErrorHandler` twice; now once.
- [x] S5 P10 specs; defects 4-6 (`legacy-signal-helpers.scenario.spec.ts`, `reactive-contract.scenario.spec.ts`)
  - P10 real: `queryComputedTillTruthy` kept executing a query per change after the first; now the computation stops at it.
  - 4 real: `retryFailed()` and paged `execute({ where })` in an effect re-ran on their own results; stack `execute()` was fine. All three now untracked.
  - 5 real for login, not for logout: auth `execute()` created its query lazily inside the effect (NG0602); now untracked.
  - 6 real: creating a query in a reactive context now throws `ET001`; `createSnapshot()` and `asObservable({ injector })` work there.
- [x] S6 P9, P12, P13, P14, P17 (`legacy-query-form-patterns`, `legacy-auth-patterns`, `legacy-client-options`, `early-v3-patterns`)
  - P9 real: a legacy `QueryForm` field that reset an `isResetBy` field lost its debounce (a search typed on page 2 sent its first keystroke); now debounced.
  - P12, P13, P17 not real: collection login/refresh/logout, the three options off, and `subtle.destroy()` (aborts in flight, works from the query's own success handler) behave on both clients.
  - P14 open, generator owned by another session: `prep-for-query-v3` flattens `E.CLEAR_QUERY_ARGS` into an import v3 no longer has, and a 5.x `withArgs` `null` ("keep the previous args", dfb ~10 sites) now parks the query. `migrating-from-v2.md` mentions neither. The scenario uses the fixed-by-hand shape (`null`).
  - Harness gap: `s.mount` runs change detection at once, so an `input.required()` read by `queryComputed` needs a parent template (`legacy-client-options`).
- [x] S7 Release gate: build the SDK into one 5.x app and fut-frontend, smoke-run before publish
  - `yarn release:smoke` (`tools/release-smoke/`), local, before a publish: builds the libs, swaps them into fut-frontend's `node_modules/@ethlete/*` (restored after, also on Ctrl-C), runs `platform:build:production` (includes the type-check), serves it with the staging proxy and loads `/` (login) and a public collection page (P1 through the interop, 401 without a real token) in Chromium. Fails on a page or console error, >10 identical requests in 5s, or a main thread that stops answering.
  - Bites: with the 85af9b224 fix reverted in the built query, the public page hangs the main thread and the gate fails. `@ethlete/query@6.0.0-next.48` itself fails the app's type-check.
  - Limits: no login, so only the login and public pages run; the 5.x apps are on Angular 20 and `@ethlete/core` 4.x, while 6.0 peers on Angular 22.1.6 and core 5, so no 5.x app is in the gate until one is upgraded.
- [x] S9 Export coverage gate: every runtime export of `libs/query/src/index.ts` must appear in a scenario, or be on an allowlist with a reason; CI fails otherwise
  - `yarn query:export-coverage` (`tools/export-coverage/`), in CI Checks and pre-push. 500 runtime exports (incl. `query/testing`), 330 uncovered on the allowlist.
  - `queryComputedWithForm` is not exported by `@ethlete/query`; P10 names it wrongly.
  - Triaged: every allowlist reason is now `constant: …` (69: enums, values, tokens, error factories, type
    guards), `spec: <path>` (148), `internal: …` (72, plumbing reached through a covered public API) or
    `S10 <group>: needs a scenario` (29).
- [x] S10 Uncovered behavior exports: a scenario per group, in this order. Counts are app files importing the
      export (bvb, vbl, dfb, dyn, fut, fifagg).
  1. Legacy collections and pipes: `createQueryCollectionSignal` (fifagg 27, dfb 6, dyn 5, fut 3),
     `resetPageOnError` (fifagg 5, fut 3), `createQueryCollection` (fifagg 3, fut 1), `extractQuery` (dfb, dyn,
     fifagg; cdk and components), `filterNull` (dyn 2), `ignoreAutoRefresh`.
  2. Legacy infinity: `skipPaginationPageParamCalculator` (bvb 2, dfb 1, fifagg 1),
     `provideInfinityQueryResponseDelay` / `injectInfinityQueryResponseDelay` (read by the cdk and components
     infinity directives).
  3. Legacy devtools: mount `QueryDevtoolsComponent` (fifagg 3, dyn 2, dfb 1); only the migration spec names it.
  4. Legacy entity: `mapToPaginated` (fifagg 4), `removeFrom`, `paginatedEntityValueUpdater`.
  5. v3 HEAD and OPTIONS creators: `createHeadQuery`, `createSecureHeadQuery`, `createOptionsQuery`,
     `createSecureOptionsQuery` (public, documented siblings of `createGetQuery`; no app uses them yet).
  6. Testing helpers: `query/testing` `expectAndFlush`, `expectFlushAndWait` (documented in `testing.md`).
  7. Persistence: `createNoopQueryPersistenceAdapter` as a consumer-passed adapter (documented).
  8. Devtools contract, panel-only: `registerEthleteVersion`, `setQueryDevtoolsAppInfo`, `queryDevtoolsAbout`,
     `queryDevtoolsApiEnvScope`, `queryDevtoolsApiEnvIds`, `clearQueryDevtoolsAuthCredentials`,
     `removeQueryDevtoolsAuthAccount`, `logoutQueryDevtoolsAuthSession`, `queryDevtoolsAllowsLocalAuthSessions`.
  - Cheap extra: the legacy state guards are `constant: type guard` but heavily used (`isQueryStateFailure` 25
    files, `isQueryStateLoading` 21, `isQueryStatePrepared` 4, `isQueryStateCancelled` 2); name them in the S10.1
    scenario.
  - Done: 1-7 (`legacy-collections-and-pipes`, `legacy-infinity-patterns`, `legacy-devtools-panel`,
    `legacy-entity-patterns`, `head-options-creators`, `testing-helpers`, `persistence-noop-adapter`), 8
    (`devtools-panel-contract`). The state guards are named in `legacy-collections-and-pipes` (dyn's `UploadChunk`
    shape).
    - 1 real: on the interop, a load the query did not start (`refreshQueriesInUse()`, an invalidation) reported
      `triggeredVia: 'program'`, so `ignoreAutoRefresh()` let it through and `*etQuery` showed `loading`, not
      `refreshing`. Now `auto`, keyed on the request's `executeTime` (`legacy/interop/legacy-query.ts`).
    - 2-7 not real. `testing-helpers` is a plain TestBed spec (the helpers need `HttpTestingController`, not the
      fake API). The v2 devtools list keeps cached queries, so "Live Queries" counts every args value seen.
    - 8 not real: about, env scope and ids, account scoping, clear/remove, logout (keeps the session) and the
      dev-build-only local vault behave as the panel expects.
  - `@internal` candidates (no other lib or app imports them, not in `apps/docs`; not changed yet). User decision
    2026-09-25: tag these `@internal` in the next major release, not in 6.0.0.
    - v3 plumbing: `shouldAutoExecuteQuery`, `shouldAutoExecuteGqlQuery`, `getQueryFeatureUsage`, `maybeExecute`,
      `createQueryObject`, `applyQueryFeatures`, `splitQueryConfig`, `isCreateGqlQueryOptions`, `createBaseQuery`,
      `createBaseQueryCreator`, `setupQueryState`, `setupQueryExecuteState`, `resetExecuteState`, `queryExecute`,
      `createExecuteFn`, `createSecureExecuteFn`, `createSecureExecuteFactory`, `createQuerySnapshotFn`,
      `createHttpRequest`, `wrapAsObservableSignal`, `circularQueryDependencyChecker`,
      `createQueryPersistenceEngine`, `wrapQuerySyncMessage`, `unwrapQuerySyncMessage`,
      `createPersistentAuthFeature`, `createTrackingFeature`.
    - Error factories: the 30 functions in `http/query-errors.ts` other than `QueryRuntimeErrorCode`; apps only
      see the thrown error.
    - Devtools: `tombstoneOf`, `queryDevtoolsStorage`, `queryDevtoolsApiEnvScope`, `queryDevtoolsApiEnvIds`,
      `setQueryDevtoolsAppInfo` (set through `provideQueryDevtools({ about })`).
    - Legacy v2 (deprecated, removal in v7 anyway): `request`, `computeQueryMethod`, `computeQueryBody`,
      `computeQueryAuthHeader`, `computeQueryHeaders`, `computeQueryQueryParams`, `getDefaultHeaders`,
      `mergeHeaders`, `serializeBody`, `transformMethod`, `detectContentTypeHeader`, `forEachHeader`,
      `parseAllXhrResponseHeaders`, `getResponseUrl`, `transformExecStateToQueryState`, `QueryShortNamePipe`,
      `buildTimestampFromSeconds`, `isEmptyString`, `isNaN`; `deepFreeze` is used nowhere (delete).
    - Must stay public (imported by another lib): `emptyQueryArgs`, `createQueryKeyLockManager`,
      `resolveQueryHeaders` (query-devtools), `shouldRetryRequest`, `createQueryErrorResponse`,
      `symfonyQueryErrorParser` (components), `hasHeader`, `v2ShouldRetryRequest`, `isClassValidatorError` (cdk).
- [ ] S8 Same audit for `libs/core` and `libs/components`
  - S8a core: list the consumer patterns of `@ethlete/core` in the apps (exposure table above), write
    scenarios in `libs/core/src/scenarios` (`core-scenario-tests` skill), add `core` to
    `tools/export-coverage/config.json`, triage its allowlist like S9. About 1.5-2 h of agent time.
    - [x] Done: scenarios for router state, breakpoints, providers (fix efa7c8d04), template directives
          (`etRepeat`, `etClickOutside`), `signalDeferredLoading`, `injectFileDownload`, colour and surface
          provide directives, semantic themes, host bindings and synced signals. No new bug.
          `yarn core:export-coverage` in CI Checks and pre-push: 395 runtime exports, 94 covered, 301 on
          `core.allowlist.json` - `spec:` 68, `constant:` 39, `internal:` 119 (a building block of another lib,
          plumbing, or a DI accessor), `unused:` 52 (no app or other lib imports it; candidates for `@internal`
          or removal in the next major), `S8c <group>: needs a scenario` 23.
  - S8c core follow-ups: the 23 app-imported exports with neither a spec nor a scenario - element signals
    (`signalElementIntersection`, `signalElementScrollState`, `signalHostElementDimensions`, …), pipes
    (`ToArrayPipe`, `NormalizeMatchParticipantsPipe`, …), animations (`AnimatableDirective`,
    `createFlipAnimation`, `nextFrame`, `forceReflow`), utils (`clamp`, `createLogger`, `createComponentId`,
    `canUseSessionMemory`), seo (`applyTwitterCardBindings`, `provideTitleConfig`), `TypedQueryList`,
    `injectLocale`. `check.mjs core --list | grep S8c` lists them.
    - [x] Done in b29eb2a2e, 081cd6a23, 010c73ede: `element-signals`, `pipes`, `animations` and `utils`
          scenarios, twitter cards and title config/locale in `seo`. All 23 off the allowlist (plus
          `ANIMATABLE_TOKEN`, now covered): 277 left, no `S8c` entry. No bug. Friction: a `viewChildren` signal
          (`readonly ElementRef[]`) is not a `SignalElementBindingType`, so apps map it through a `computed`.
  - S8b components: the same for `libs/components`. Much larger; split by domain (overlay, forms, grid, …),
    one fresh agent per domain. Behavior belongs in `apps/storybook-e2e` (`component-behavior-tests` skill)
    where a scenario cannot drive it. About 3 h or more.
    - S8b progress: the harness is shared (`tools/testing/scenario-harness`, re-exported by
      `libs/components/src/scenarios/harness`); `yarn components:export-coverage` runs in CI Checks and pre-push.
      Button done (`libs/components/src/scenarios/button.scenario.spec.ts` is the pattern to copy): 1382 runtime
      exports, 22 covered, 1360 on `components.allowlist.json`, every entry tagged `S8b <domain>` (forms split
      per control, e.g. `S8b forms/select`). Largest left: overlay 127, stream 114, table 91, icon 69,
      forms/date-time 69, forms/rich-text-editor 56, scheduler 52, grid 51, forms/form-field 50, bracket 50.
      Bug, two `it.fails` specs: a template `(click)` on an `et-button` still runs while it is loading or a
      disabled link - `ButtonDirective`'s host listener runs after it, so `stopImmediatePropagation` is too late.
      E2E gaps: split-button focus and keyboard, focus ring on icon/fab/window-control buttons, pressed toggle via
      Space, hover/active colour states.
      Overlay done (`overlay-{dialog,strategies,headless,routing}.scenario.spec.ts`): 121 of 127 covered, 143
      covered in total, 1239 on the allowlist. Bug fixed (5f4566e51): destroying an app with a modal overlay open
      left `position: fixed` on `<html>`. Friction fixed (1a5f42eda): `enableDragToDismiss` takes a typed ref,
      and the overlay `provideX` functions return `StaticProvider[]`, so they spread into `providers`. E2E gaps: the full-screen morph from its origin (`OverlayOriginCloneComponent`, the five
      `*FullscreenAnimation*` functions), the inline sidebar above `renderSidebarFrom` (pane width), focus moving
      into a pane by `first-tabbable` (jsdom has no client rects).
      Stream done (`stream-{players,consent,custom-player,pip}.scenario.spec.ts`, 7525153ad): 109 of 114 covered;
      `PipCollapseOverlayDirective`, `PipTitleBarDirective` need e2e, `providePipManager`, `providePipChromeManager`,
      `injectPipChromeManager` are reachable only through `provideStreamPip`. Bugs fixed: the manager container
      stayed in `<body>` after destroy (0b3917340), retry kept the error card (66a1b95d5), destroy in PiP logged
      `NG0406` (1891c2e98), `provideStreamPip({ pipWindow: { desiredSize } })` did not type-check (85916c415).
      Friction: a slot exposes state but no playback control; `width="480"` on Vimeo or Facebook gives an invalid CSS
      width; the stream error codes are not exported. E2E gaps: PiP drag, collapse and resize; the FLIP and scale
      animations; an iframe that moves between slots; the placeholder pulse (needs a real IntersectionObserver).
- [x] S11 Follow-ups from S6 (hand-written skill `.agents/skills/query-scenario-tests/SKILL.md` documents `s.mount`)
  1. Done in 47f4d25da: `s.mount(Component, injector, { inputs })` sets inputs before the first change detection;
     `legacy-client-options` mounts `MatchListComponent` directly.
  2. Root cause found and fixed. Not the fake clock and not the flush loop: Angular's zoneless scheduler switches
     to `queueMicrotask` after every tick it runs itself (`switchToMicrotaskScheduler`) and back on the next real
     microtask. The harness never drains microtasks inside `tick()`, so an effect a timer dirtied runs at that
     fake instant only while no scheduler tick happened since the last `await`; otherwise it waits for the next
     `TestBed.tick()` (the 50 ms step in `flush()`). Probe: in the chat abort scenario with the POST delay at
     100, one `await Promise.resolve()` before `dfbMatchId.set('2')` moves the dependent `/gg/matches/gg-2`
     request from +50 to +31. At HEAD the scenario is deterministic (40 runs, also under load, also with shifted
     wall-clock starts); the S6 flip happened while another session edited `libs/query/src/lib/http` (the
     keepPreviousResponse work) under the same runs. Tried fix: wrap the fake `setTimeout`/`setInterval` so each
     callback is followed by `TestBed.tick()`. The chat case then no longer depends on the `await`, but four
     suites change timing (`dependent-queries` parks-then-executes, `auth` in-flight refresh, two
     `auth-features` expiry windows), so it was reverted. Done: the user took the harness change. All four were a
     timing shift, no bug: a zero-delay timer armed inside a timer callback is clamped to 1 ms by fake-timers, so the
     dependent GET, the refresh answer and the first expiry check land 1 ms later. Proof in `harness/scenario.spec.ts`
     (`timer-driven effects`): the dependent request goes out 30 ms after its dependency, with or without an
     `await`; without the wrap it is 50 and 31.
  3. Done in dfe00b5d7: v3 `defineQueryForm` does not have the P9 bug - the reset is resolved at commit time, so
     the debounce comes from the edited field only. Covered for a bound field and `patchValue({ debounce })`.

### Continue consumer coverage on 2026-09-26

Order: S11 (one fresh agent, about 45 min), then S8a, then S8b by domain. The `@internal` tagging waits for the
next major. P14's generator gap and the other migration gaps belong to the migration work below, not to this
list. Open question for the user: which 5.x app moves to Angular 22 first, so that S7 can smoke it.

Subagent rules that worked today: `model: "opus"`; one fresh agent per slice (stop it before its context passes
200k); stage only own paths and commit with `git commit -m … -- <paths>`, check `git diff --cached --name-only`
first; never amend, never `git add -A`, never `check.mjs --update` (it picks up other sessions' exports - trim the
allowlist by hand); stop and ask before an edit in `libs/query/src/lib/http/` while another session works there;
run `npx tsc --noEmit -p libs/query/tsconfig.spec.json`, because vitest does not type-check; zero new lint
warnings, lint only changed files.

Gotchas: a red `nx test query` is often another session's uncommitted work, so check `git status` before a
failure is blamed on a commit. Another session's plain `git commit` swept S6's fix into 499b0b8a2; the content is
correct, so leave it.

## v2 → v3 migration gaps (from ethlete-sdk-57)

Behavior an app loses or changes when it moves call sites from v2 to v3. Each needs a decision: accept and
document, add a feature, or teach the codemod. Some are deliberate (retry and error parsing went opt-in in
53fcc97ef).

Triage (ethlete-sdk-57):

- Done in 4b31a2308 + a569506d4: 1 (`withEthleteApiErrors()` added, remaining differences reported), 2 (mapping was
  exact; `keepUnusedFor` warned), 10 (`entity:` moved onto the legacy wrapper; gql and `ExperimentalQuery` helpers
  reported), 11 (`refreshBuffer` mapped, the guide's unit claim fixed), 13 (dropped defaults reported), 5 (guide warning
  only).
- Done in a80ef2411: 5 marker, `IS_QUERY_REQUEST` on every v3 `HttpClient` request.
- Done in 11490012c (+ docs in 499b0b8a2): 4. `QueryConfig.keepPreviousResponse`, default `true` for reads, `false`
  for mutations (a failed second submit must not report the first response). Parking calls `reset()`. No earlier
  implementation existed (checked all branches, stashes and `experimental/`).
  The `early-v3-patterns.scenario.spec.ts` was reported as broken, but it passes at HEAD (9f822f831 + 11490012c).
  The user confirmed the mutation default `false` on 2026-09-25.
- 7 done by ethlete-sdk-70 in 944092f44 (`executeUntilSettled$`).
- 6 done in 5d706cdba: `withPolling({ enabled })`, optional (default always on); the user chose it.
  `enabled` is also on `withLongPolling` and `withAutoRefresh` (user decision 2026-09-25), landed in d4884a9ec.
- 8 by design (user 2026-09-25): withArgs is the encouraged path for mutations; ET100 message, docs and agent skill
  updated in e2d93c484. Next: a type-level check at the creator call (withArgs required when the args have
  pathParams); ET100 stays as the runtime backup.
- 9 done in 1386121dc: `query.abort()`; the user chose no Cancelled state. After an abort `executionState()` is the
  value from before the aborted execution, or `null`; `executeUntilSettled$` completes empty and the Promise resolves a
  snapshot with a cancel event. The legacy interop keeps `reset()` for the v2 Cancelled state.
- 3 done in b62b57981: the user chose `triggeredBy` + docs, no new signal. `withPolling` executions pass
  `triggeredBy: 'polling'`, `withAutoRefresh` passes `'auto-refresh'`; `features.md` and `migrating-from-v2.md` show
  the `loading() && !response()` spinner and the background-refresh `executionState()`.
- Waiting on the user: nothing.
- Next generator item (from S6): `prep-for-query-v3` turns `E.CLEAR_QUERY_ARGS` into an import v3 does not export, and
  5.x `withArgs` returning `null` meant "keep the previous args" where v3 parks the query (dfb ~10 sites). Neither is in
  `migrating-from-v2.md`. See `early-v3-patterns.scenario.spec.ts`.
- To question: 14 (query button, EntityStore). Document only: 12, 15-18.

### Continue on 2026-09-26

Open work, in this order.

1. **Done:** the history rewrite finished on 2026-09-25, the shas above are the new ones, and `next` is pushed.
2. **Type error for a missing `withArgs`** (gap 8 follow-up, user decision 2026-09-25). Blocked yesterday: the
   permission classifier refused the edit to `query-features.ts`, so the user must allow it. Design, prototyped in
   a standalone copy only:
   - Brand the feature: `WithArgsQueryFeature<TArgs> = QueryFeature<TArgs> & { type: typeof QueryFeatureType.WITH_ARGS }`,
     defined in `query-features.ts`, and the return type of `withArgs`.
   - `QueryCreator` gets one call signature:
     `<const TInput extends QueryCreatorInput<TArgs>>(this: WithArgsCheck<TArgs, TInput>, ...args: TInput | QueryCreatorInput<TArgs>): Query<TArgs>`,
     with `QueryCreatorInput<T> = readonly [QueryConfig, ...QueryFeature<T>[]] | readonly QueryFeature<T>[]`. The
     union with the concrete type keeps contextual `TArgs` inference inside `withArgs(() => …)`; a bare generic rest
     loses it.
   - Required when `TArgs['pathParams']` is a non-optional object (the `RouteType` rule); `any` args never. Present
     when a tuple element has `type: 'WITH_ARGS'`; a spread of unknown length counts as present (ET100 catches it).
     Literal `true` for `silenceMissingWithArgsFeatureError` satisfies it; `true` + `withArgs` is a type error too.
   - The check is on `this`, so a zero-argument `getUser()` also errors. Message: `withArgs() is required: this
query's route uses pathParams. Pass withArgs(() => ({ pathParams: … })), or set
silenceMissingWithArgsFeatureError as an escape hatch.`
   - The gql creator returns the same `QueryCreator<TArgs>`, so it is covered too.
   - Risk: generic helpers that call a `QueryCreator<TArgs>` with an unresolved `TArgs` fail to compile. Count them.
   - Still to do: type tests, tsc (lib + spec), fix and count call sites across libs and apps, a codemod output
     check (report only), docs (`queries.md`, `http.md`, `features.md`), skill lines, changeset (check `pre.json`
     for minor vs major), plan note.
3. **`CLEAR_QUERY_ARGS` generator item** (the "Next generator item" bullet above). No design question. Check with
   ethlete-sdk-28 first, because it works in `libs/query/generators`.
4. **Document gaps 12, 15-18** in `migrating-from-v2.md`. Can run in parallel with 3.
5. **Ask the user about gap 14** (by design, or new v3 features). Could be a project of its own.

Rules learned on 2026-09-25: vitest does not type-check, so every slice also runs
`npx tsc --noEmit -p libs/query/tsconfig.spec.json`. Parallel subagents must own disjoint files; a commit by path
takes every hunk in that file, also another agent's. Known: `triggeredBy()` can be `'polling'` after an args change
with `executeInitially`; the docs name `null` only for a manual `execute()`.

1. Retries: v2 retried every method on 5xx ×4 (`legacy/request/request.util.ts:225`); v3 needs `withDefaultRetry()`.
   `migrate-to-query-v3` adds no features (`query-client-migration.ts:398`). Same for Symfony error parsing.
2. v3 `execute()` never reuses a fresh cache hit (v2 `legacy/query/query.ts:224-228`); vbl's `cacheAdapter: () => 0`
   no longer disables caching (inferred). Not so on the interop: with `cache-control: max-age` on the response, a
   revisit and a remount still refetch (`legacy-client-options`).
3. `withPolling` ticks call execute without `triggeredBy` (`http/query-features.ts:258`): `loading()` flips each tick;
   v2 kept `loading` false and set `refreshing`.
4. v2 `cacheResponse: true` / `*etQuery cache: true` kept the last value across arg changes; v3 `response()` follows the
   current request (`http/query-state.ts:140-164`). Conversely `withArgs(() => null)` keeps a stale response
   (`query-features.ts:118-123`); fut added ~20 guards.
5. v3 goes through `HttpClient`, so app interceptors see query requests: fifagg's `jwt.interceptor.ts:12-45` would send
   its bearer token to third-party hosts, and twice on secure queries.
6. `withPolling` has no stop predicate (`query-features.ts:134-170`); every app polls with `takeUntil`.
7. No per-call result Observable: `execute()` is void, `executeUntilSettled` is a Promise. fut 111 and fifagg 108
   `.execute().onSuccess` call sites.
8. ET100 for a function route without `withArgs`, also on mutations (`base-query-factory.ts:55-62`).
9. No abort and no cancelled state in v3 (compare `legacy/interop/legacy-query.ts:263-366`).
10. Codemod: drops `entity:` silently (`legacy-query-creator-migration.ts:729`), skips gql creators, and has no rewrite
    for `ExperimentalQuery` config helpers (`prep-for-query-v3/migration.ts:287`).
11. The dyn auth scaffold ignores `refreshBuffer` / `cookieEnabled`; `migrating-from-v2.md` and `auth.md` disagree on
    `refreshStrategy` units.
12. Devtools: v2 clients and v3 cannot share one panel; both use the `et-query-devtools` selector.
13. bvb relies on the v2 defaults `autoRefreshQueriesOnWindowFocus` and `enableSmartPolling` (both `true`); the codemod
    only warns about written-out options (`query-client-migration.ts:396-470`), and `pauseWhileHidden` defaults to
    `false`, so bvb's 8 polls run in hidden tabs.
14. No v3 replacement for the query button (cdk `QueryButtonDirective` accepts only v2/legacy queries; dyn 45, fut 39
    uses), query collections (dyn/dfb 27, fifagg 54), the infinite-scroll trigger (bvb 5, fifagg 16) or EntityStore
    (bvb 13, dyn 18, fifagg 8 stores, cross-store writes in fifagg `broadcast.queries.ts:24-62`).
15. dfb scopes its GG client, auth and WebSocket to a route (`match-lobby/match-lobby-initialization.ts:28-31`); v3
    providers are root-only (inferred).
16. `validateWithQuery` targets signal forms only; dfb and dyn run queries in reactive-forms `AsyncValidatorFn`s.
17. A client header function cannot `inject()` app state (fut `preview.provider.ts:51` keeps an interceptor; inferred).
18. v3 peers pin `@angular/core` 22.1.6 exactly (`libs/query/package.json:9`); fifagg is on 19.2.4.

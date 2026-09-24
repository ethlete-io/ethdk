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
| P9  | Legacy `QueryForm` + `QueryField` (debounce, `isResetBy`) feeding `queryComputed`                                  | bvb, dfb, dyn, fut | partial (`legacy-query-form`)                                    |
| P10 | `queryArrayComputed`, `queryComputedTillTruthy`, `toQuerySubject`, `queryComputedWithForm`                         | fut                | no spec at all                                                   |
| P11 | Infinity query config + `InfinityQueryDirective`                                                                   | bvb, dfb           | `legacy-infinity-trigger`                                        |
| P12 | Bearer auth provider + `createQueryCollectionSubject` login/refresh + `takeUntilResponse`                          | bvb, dfb, dyn      | partial                                                          |
| P13 | Client options off: `enableSmartPolling`, `autoRefreshQueriesOnWindowFocus`, `cacheAdapter: () => 0`               | vbl                | no                                                               |
| P14 | Early v3 (`ExperimentalQuery` namespace, 5.x) client/creators, migrated by `prep-for-query-v3`, with v2 call sites | dfb                | migration spec only; no scenario on the migrated output          |
| P15 | v3 `creator(withArgs(() => …), withPolling(…), withSuccessHandling(…))` field init                                 | fut                | generic                                                          |
| P16 | `createQuerySubmission`, `.clone()`, `provideLegacyPrepareFallback()`                                              | fut                | `createQuerySubmission` covered (spec + 2 scenarios); rest check |
| P17 | Manual `query.subtle.destroy()` for detached queries                                                               | dfb                | no                                                               |

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
- [ ] S6 P9, P12, P13, P14, P17
- [ ] S7 Release gate: build the SDK into one 5.x app and fut-frontend, smoke-run before publish
- [x] S9 Export coverage gate: every runtime export of `libs/query/src/index.ts` must appear in a scenario, or be on an allowlist with a reason; CI fails otherwise
  - `yarn query:export-coverage` (`tools/export-coverage/`), in CI Checks and pre-push. 500 runtime exports (incl. `query/testing`), 330 uncovered on the allowlist.
  - `queryComputedWithForm` is not exported by `@ethlete/query`; P10 names it wrongly.
- [ ] S8 Same audit for `libs/core` and `libs/components`

## v2 → v3 migration gaps (from ethlete-sdk-57, not yet triaged)

Behavior an app loses or changes when it moves call sites from v2 to v3. Each needs a decision: accept and
document, add a feature, or teach the codemod. Some are deliberate (retry and error parsing went opt-in in
53fcc97ef).

1. Retries: v2 retried every method on 5xx ×4 (`legacy/request/request.util.ts:225`); v3 needs `withDefaultRetry()`.
   `migrate-to-query-v3` adds no features (`query-client-migration.ts:398`). Same for Symfony error parsing.
2. v3 `execute()` never reuses a fresh cache hit (v2 `legacy/query/query.ts:224-228`); vbl's `cacheAdapter: () => 0`
   no longer disables caching (inferred).
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

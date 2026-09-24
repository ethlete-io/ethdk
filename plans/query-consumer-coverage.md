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
- [ ] S2 P1 on both clients with changing args (`describe.each([native, interop])` helper)
- [ ] S3 P2, P3, P5 source switches; P4 poll inside `queryComputed`
- [ ] S4 P6, P7, P8 RxJS and effect re-execute
- [ ] S5 P10 specs; defects 4-6
- [ ] S6 P9, P12, P13, P14, P17
- [ ] S7 Release gate: build the SDK into one 5.x app and fut-frontend, smoke-run before publish
- [x] S9 Export coverage gate: every runtime export of `libs/query/src/index.ts` must appear in a scenario, or be on an allowlist with a reason; CI fails otherwise
  - `yarn query:export-coverage` (`tools/export-coverage/`), in CI Checks and pre-push. 500 runtime exports (incl. `query/testing`), 330 uncovered on the allowlist.
  - `queryComputedWithForm` is not exported by `@ethlete/query`; P10 names it wrongly.
- [ ] S8 Same audit for `libs/core` and `libs/components`

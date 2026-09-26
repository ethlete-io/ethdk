# Query v2 → v3 migration gaps

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
2. **Done:** type error for a missing `withArgs` (gap 8 follow-up). `WithArgsQueryFeature` brand plus a
   `this: WithArgsCheck<TArgs, TInput>` signature on `QueryCreator`. No call site in libs or apps failed; every
   generic helper passes `withArgs` or the literal silence flag. Codemod output stays on the legacy wrapper, which
   silences, so it compiles.
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

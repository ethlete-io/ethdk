# Query test coverage map

Status: P1 and P2 shipped (2026-09-04). P3 and P4 are open. Delete this file when every open row has
a scenario or the user drops it.

## Why

A recent release made login impossible after an app added `@ethlete/query-devtools`: the session
vault kept the token pair of a session the server had refused, and a tab-local seed re-applied it on
every reload (`a533863ce`). A second vault bug ran every secure query as the previous user during
"log in as" (`67b612803`). Both had unit specs with a hand-built provider handle, and no test that
booted the real provider with the bridge attached. This map lists which documented behaviors of
`libs/query` have a scenario test, which have only a jsdom unit spec, and which have nothing.

Legend: **scenario** = `libs/query/src/scenarios/*.scenario.spec.ts`, real client against the fake
API. **unit** = `libs/query/src/lib/**/*.spec.ts`, may mock internals. **none** = no test found.

## Shipped in this pass

`auth-devtools.scenario.spec.ts` (18 tests): seven auth flows run once without and once with
`provideQueryDevtools()`, and the normalized request log and session state must compare equal.
Four vault regressions: expired session drops its tab-local seed and the next load logs in;
a shared session is never seeded; "log in as" clears data only after the new tokens land; a tab
that owns its session stands down the cookie auto-login and writes no cookie. Both fixes above
turn the matching test red when reverted.

`auth-persistent.scenario.spec.ts` (8): a rejected cookie auto-login ends `expired` and deletes the
cookie; logout deletes it; a 500 and a network error keep it and recover; `excludeRoutes` and
`shouldAutoLogin` veto independently; `setRememberMe` switches session and persistent cookies.

`auth-features.scenario.spec.ts` (7): the three-round refresh streak cap; `withTokenRevocation` on
logout, also when the revocation request fails; `withTokenExpirationWarning` flips and resets;
`createAuthGuard` redirects, passes, and waits for a pending restore; the devtools token TTL
override refreshes early and `clear` restores the schedule.

`auth-multi-tab-leadership.scenario.spec.ts` (6): a follower re-asks a slow leader three times; a
follower takes the refresh over from a frozen leader; two stale tabs refresh once; a visible tab
claims the leadership; idleness travels across tabs; a refresh is not activity.

`devtools-request-path.scenario.spec.ts` (12): an armed mock answers without a request and disarm
restores the API; a 401 fault refreshes once and retries once; a 500 fault fails without a request
and a 503 is retried; a response override survives a refetch and `clearAll` reverts it; the env
switch writes storage only, scopes the vault, and production hides accounts; destroyed queries
leave clearable tombstones.

Harness changes: `ScenarioConfig.providers` accepts a factory, because `provideQueryDevtools()`
enables the bridge process-wide the moment it is called. A `status: 0` response now fails as a
network error.

## Follow-ups found

- `bearer-auth-provider.ts` (the per-query effect, `else if (response)`): a 2xx login or refresh
  response with a `null` body sets neither success nor error, so `executionState()` stays
  `loading` while `sessionStatus()` turns `anonymous`. Same shape as a cancelled restore, so the
  fix needs `isAlive()` or the response event, not a truthiness check. No scenario yet.
- `QueryDevtoolsMock` has no `headers`; the docs do not promise them either. Nothing to test.
- The armed-mock scope cannot be checked across a reload from a test: the `init*` functions run
  only inside `provideQueryDevtools()`. The scenario asserts the storage key instead.

## Gaps by priority

### P3 - forms bridge

| Behavior                                        | Docs                                                      | Today     |
| ----------------------------------------------- | --------------------------------------------------------- | --------- |
| A 422 maps violations onto signal form fields   | errors.md#Mapping violations onto signal forms            | unit only |
| Submitting a form through a mutation            | errors.md#Submitting a form through a mutation            | unit only |
| Validating against the server as the user types | errors.md#Validating against the server as the user types | unit only |

### P4 - remaining

| Behavior                                                                                                      | Today                   |
| ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Reactive dependent queries (GET feeding GET)                                                                  | unit smoke only         |
| `execute()` on a destroyed query; `transformResponse` throwing; a second consumer's `retryFn` on a shared key | none                    |
| Persistence `maxEntries` eviction and write failure; custom adapter                                           | unit only               |
| Authoring custom features                                                                                     | unit only               |
| `parseHttpErrorCode` pipes                                                                                    | none                    |
| Legacy v2 interop                                                                                             | unit only (maintenance) |

### Known failing scenarios (`it.fails`, product calls)

- `http-lifecycle`: the `ET800` guard trips on five legitimate executions per 100 ms.
- `persistence`: a GraphQL query via POST is never persisted (`isRefreshable` missing on the event).

## Covered by scenarios today

Queries, args, caching, http lifecycle, errors and retry, features, stacks and batches, gql, ws,
persistence core, multi-tab query sync, query forms (signals, URL sync, branch), and the auth core:
login, secure header, proactive refresh, wait for refresh, 401 retry, refresh failure, external
tokens, logout, multi-tab token adoption and logout, inactivity in one tab, and everything under
"Shipped in this pass".

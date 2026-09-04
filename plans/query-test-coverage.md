# Query test coverage map

Status: in progress (started 2026-09-04). Delete this file when the P1 and P2 rows below have a
scenario each and the `query-scenario-tests` skill lists the new suites.

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

Harness change: `ScenarioConfig.providers` accepts a factory, because `provideQueryDevtools()`
enables the bridge process-wide the moment it is called.

## Gaps by priority

### P1 - auth (the bug class of the report)

| Behavior                                                                                   | Docs                                                       | Today                |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------- |
| Rejected cookie auto-login ends the session `expired` and deletes the cookie (`48488fbdc`) | auth.md#When a refresh fails for good                      | unit only            |
| Logout deletes the cookie; a 500 or offline keeps it                                       | auth.md#When the remember-me cookie is written and deleted | unit only            |
| `excludeRoutes` and `shouldAutoLogin` are independent vetoes                               | auth.md#Where auto-login should not run                    | unit only            |
| `setRememberMe` switches session cookie and persistent cookie                              | auth.md#Features                                           | unit only            |
| Stale 401 (sent with a replaced token) triggers no second refresh; 3-streak cap            | auth.md#Token refresh                                      | unit only            |
| Leadership hand-over when the leader stops answering (`a9bf39095`, `4c97b3e58`)            | auth.md#When the leader stops answering                    | unit only            |
| Inactivity measured across tabs; a refresh is not activity                                 | auth.md#Idleness belongs to the session                    | unit only            |
| `withTokenRevocation` calls the revocation query on logout                                 | auth.md#Features                                           | unit only            |
| `withTokenExpirationWarning` signals                                                       | auth.md#Features                                           | unit only            |
| Route guards against a real provider                                                       | auth.md#Route guards                                       | unit only            |
| Devtools token TTL override refreshes early, `clear` restores                              | query-devtools#Overriding the token lifetime               | unit (real provider) |

### P2 - devtools bridge in the request path

| Behavior                                                                       | Today     |
| ------------------------------------------------------------------------------ | --------- |
| An armed mock answers without a request; disarming restores the API            | unit only |
| An armed fault 401 on a secure query causes exactly one refresh and one retry  | unit only |
| A response override survives a refetch and is dropped on disarm                | unit only |
| API env switch scopes vault sessions and accounts; production refuses accounts | unit only |
| Registry retains nothing after every client is destroyed (tombstones, stats)   | unit only |

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
tokens, logout, multi-tab token adoption and logout, inactivity in one tab. Full inventory:
the agent report of 2026-09-04 in the handoff `.claude/handoffs/query-test-coverage.md`.

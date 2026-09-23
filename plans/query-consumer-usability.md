# Query: consumer usability audit

Audit of 2026-09-23. Almost every public feature of `@ethlete/query` has a scenario, but the
scenarios drive auth through the `s.auth()` harness, so they test behaviour, not how consumer code
has to be written. Trigger: `withTokenRevocation` passed its specs but needed Angular `HttpHeaders`
in consumer code (fixed in `577b1b65c`, whose message is wrong: it says `fix(core)`).

Rule for every fix below: a scenario that uses the feature only through the public API, with no
`@angular/*` import in the consumer code (fut-frontend's queries libs ban them).

| #   | Feature                                    | Problem                                                                                                       | Evidence                                                                | Sev    | Status      |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ----------- |
| 1   | Client `headers` option                    | Only `HttpHeaders`; fut sets headers in an interceptor and calls `refreshQueriesInUse()` by hand              | `http/query-client.ts:65`; fut `toty-api-token.interceptor.ts:7`        | high   | in progress |
| 2   | Per-request `args.headers`                 | `HttpHeaders` only, secure queries too                                                                        | `http/query.ts:20`; `http/secure-query-execute-factory.ts:127`          | medium | in progress |
| 3   | Auth docs quickstart                       | `export const [, injectAuthProvider] = authProviderRef` does not compile (TS2488); undefined `postQuery`      | `apps/docs/query/auth.md:15-27`                                         | medium | in progress |
| 4   | `createAuthGuard`                          | No timeout while `restoring`; refresh retries network errors forever; no permission predicate. fut rewrote it | `auth/auth-guard.ts:141-170`; fut `can-match-with-permissions.guard.ts` | medium | open        |
| 5   | Redirect when a session ends               | Nothing routes to login on `expired`/`inactivity`/`otherTab`; every app wires it                              | fut `libs/domain/auth/src/lib/auth-flow.ts:116-245`                     | medium | open        |
| 6   | `executionState` vs `isAuthenticated`      | `success` can come one tick before `isAuthenticated()`; consumers combine three signals                       | `auth/bearer-auth-provider.ts:605-614`; fut `hub.routes.ts:24-42`       | medium | open        |
| 7   | `withPersistentAuth` `autoLogin.buildArgs` | Required despite a JSDoc `@default`; not taken from the refresh query, so fut writes it twice per client      | `auth/features/bearer-auth-persistent-auth.ts:62-66`                    | medium | open        |
| 8   | `retryFn` / `withDefaultRetry`             | Retries POST/PATCH; the policy never sees the method; undocumented                                            | `http/query-retry-utils.ts:5-8`; `http/http-request.ts:479`             | medium | open        |
| 9   | `createWebSocketClient`                    | No public send (`emit` is devtools-only); no auth/handshake option; `withCredentials` always true             | `ws/web-socket-client.ts:162,190,365-377`                               | medium | open        |
| 10  | WS room `latestMessage`                    | Messages in one tick collapse; no stream of all messages                                                      | `ws/web-socket-client.ts:348`                                           | medium | open        |
| 11  | `defineQueryForm` `setValue`/`patchValue`  | `value()` stale until an effect commits; no `flush()`, undocumented                                           | `query-form-signals/query-form-signals.ts:670-697`                      | medium | open        |
| 12  | Query-form write to a debounced field      | A write from code waits the 300ms debounce; no skip option                                                    | `query-form-signals.types.ts:137-144`                                   | medium | open        |
| 13  | Query-form persistence                     | No restore when the URL is empty; fut hand-wrote ~100 lines of sessionStorage code                            | fut `hub-list-view-query-storage.ts`                                    | medium | open        |
| 14  | `BearerAuthProviderOf` JSDoc               | Example calls `provider.queries.login({...})`, should be `.login.execute(...)`                                | `auth/bearer-auth-provider.ts:1066`                                     | low    | open        |
| 15  | `withTokenExpirationWarning`               | Must repeat `expiresInPropertyName` from the refresh query                                                    | `auth/features/bearer-auth-token-expiration-warning.ts:18-23`           | low    | open        |
| 16  | GQL partial data                           | `errors` next to `data` are dropped                                                                           | `gql/gql-response.ts:3-13`                                              | low    | open        |
| 17  | Barrel exports internals                   | `setupQueryDependencies`, `createQuerySyncEngine`, `create(Secure)GqlExecuteFn` exported without `@internal`  | `http/index.ts`; `gql/index.ts`                                         | low    | open        |
| 18  | `withPolling`                              | Fixed interval, not a signal; polls while hidden; no refetch on focus or reconnect                            | `http/query-features.ts:134-211`                                        | low    | open        |
| 19  | `cacheAdapter`, `transformTo*` utils       | No scenario, only unit specs                                                                                  | `http/query-client.ts:25`; `query-form/query-form.utils.ts`             | low    | open        |
| 20  | Legacy `QueryForm`                         | Consumer must build `new FormControl`; deprecated, but fut still has 26                                       | `query-form/query-form.types.ts:28`                                     | low    | open        |

Paths without a prefix are under `libs/query/src/lib/`. "fut" is `/home/tom/dev/fut-frontend`.

Possibly stale in fut: `libs/domain/auth/src/lib/auth-flow.ts:123` handles a rejected cookie
auto-login (`<= next.42`); the docs say it now ends the session as `'expired'`. Not confirmed.

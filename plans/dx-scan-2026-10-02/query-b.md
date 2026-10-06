# query-b — DX scan 2026-10-02

Scope: `libs/query/src/lib/auth`, `libs/query/src/lib/ws`, `libs/query/src/lib/query-form-signals` (legacy
`query-form` only where shared), `libs/query/testing`, and `apps/docs/query/{auth,ws,query-forms,testing}.md`.

| ID    | Sev    | Kind | Decision | Title                                                                                                             |
| ----- | ------ | ---- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| QB-01 | High   | dx   | no       | The ws docs' `messages$` example never subscribes: `joinRoom()` is `null` until an effect runs                    |
| QB-02 | High   | dx   | yes      | The ws client cannot follow the auth session: no reconnect on login, rotation or logout                           |
| QB-03 | Medium | bug  | no       | The proactive refresh buffer is a fraction of the _remaining_ lifetime, so every recompute delays it              |
| QB-04 | Medium | dx   | no       | `withTokenExpirationWarning` defaults fire before every routine refresh of a token under 20 min                   |
| QB-05 | Medium | dx   | no       | A `bearerDecryptFn` that drops `exp` turns off proactive refresh, and the test setup hides the only warning       |
| QB-06 | Medium | dx   | no       | `setupAuthTest({ features })` loses feature typing: `buildArgs` becomes `never`, `queryKey` is unchecked          |
| QB-07 | Medium | dx   | yes      | The testing entry cannot authenticate the app's own provider: no token minting helper is exported                 |
| QB-08 | Medium | dx   | no       | `setupQueryTest` swallows every `ErrorHandler` error by default, not just failed requests                         |
| QB-09 | Medium | dx   | no       | `sessionStatus()` `'unknown'` is documented as never observable, but multi-tab sync holds it for up to 250 ms     |
| QB-10 | Medium | bug  | no       | `dateQueryField()` writes `Date.toString()` into the URL: locale text, and milliseconds lost on reload            |
| QB-11 | Low    | dx   | no       | `setupAuthTest` defaults `autoRetryOn401` to `false`, and production defaults it to `true`                        |
| QB-12 | Low    | dx   | yes      | `latestExecutedQuery` / `latestNonInternalQuery` are public, undocumented, and overlap newer APIs                 |
| QB-13 | Low    | dx   | no       | `persistence.fields` and `isResetBy` are plain `string[]`, and a typo in `persistence.fields` is silently ignored |
| QB-14 | Low    | bug  | no       | A custom `bearerDecryptFn` returning `null` falls back to the default JWT decoder                                 |
| QB-15 | Low    | dx   | no       | `withTokenExpirationWarning` runs two 1 s intervals per provider                                                  |

## QB-01 The ws docs' `messages$` example never subscribes: `joinRoom()` is `null` until an effect runs

- Status: fixed: a static room joins synchronously; ws.md shows the reactive-room pattern (toObservable + switchMap); scenario in ws.scenario.spec.ts. No `roomMessages$` API added.
- Review: ok

- Where: `libs/query/src/lib/ws/web-socket-client.ts:253-316` (`roomData` starts `null` and is only set inside
  `effect()`), `apps/docs/query/ws.md:111-115`.
- Problem: the documented pattern reads the signal synchronously right after joining:

  ```ts
  const room = this.socket.joinRoom('match:1');
  room()?.messages$.subscribe((message) => this.log.push(message));
  ```

  `room()` is `null` at that point, even for a static room name, because the join happens in an effect that
  only runs on the next change detection. The `?.` hides it: nothing subscribes, nothing throws, and the event
  log the docs give as the reason to use `messages$` stays empty forever. The docs' own test example
  (`ws.md:182`) needs a `TestBed.tick()` before it reads the room, which shows the delay.

- Fix: (a) join a static string room synchronously in `joinRoom` (only the function form needs the effect),
  and (b) add a client-level `roomMessages$(room: string | (() => string | null)): Observable<TMessageData>`
  built as `toObservable(roomSignal).pipe(switchMap((r) => r?.messages$ ?? EMPTY))`, or at least rewrite the
  docs example to that pattern. Add a spec: a static `joinRoom('x')` followed by an immediate
  `room()?.messages$` subscription receives the next server message.
- Breaking: no. Decision: no (the docs fix and synchronous static join need no API decision; a new
  `roomMessages$` would be additive).

## QB-02 The ws client cannot follow the auth session: no reconnect on login, rotation or logout

- Status: open: user decision.

- Where: `libs/query/src/lib/ws/web-socket-client.ts:205-211, 452`; JSDoc example at `:128-131`;
  `apps/docs/query/ws.md:63-80`.
- Problem: the socket connects as soon as the client is injected (`socket.connect()` at `:452`), and `auth` is
  only read on a (re)connect. So:
  - A socket injected before login does its handshake without a token and stays anonymous after the user logs
    in.
  - After `logout()` the socket stays connected under the previous user's handshake, and its joined rooms keep
    streaming that user's data into a page that now shows the login screen. Nothing in the auth provider
    (`bearer-auth-provider.ts:877-893`) or the ws client connects the two.
  - The JSDoc example `auth: () => ({ token: auth.accessToken() })` refers to an `auth` the module-level
    `createWebSocketClient({...})` call cannot reach: the provider is only reachable through `inject()`, and the
    `auth` callback runs inside socket.io, outside any injection context. The docs use an undefined
    `readAccessToken()` instead and never say how to bridge.
- Fix: add an `authProvider?: AnyCreateBearerAuthProviderResult` option. When set, read `accessToken()` for the
  handshake and, through an effect on `sessionStatus()` and `accessToken()`, (1) wait to connect until the
  status is not `'unknown'`/`'restoring'`, (2) reconnect when a session starts, (3) disconnect and complete
  the rooms on logout. Leave `auth` for the non-bearer case. Document the pairing in `ws.md` and `auth.md`, and
  add a scenario in `libs/query/src/scenarios/ws.scenario.spec.ts` covering login, logout and the reconnect.
- Breaking: no. Decision: yes (new API, and a choice about whether a token rotation should force a
  reconnect).

## QB-03 The proactive refresh buffer is a fraction of the _remaining_ lifetime, so every recompute delays it

- Status: fixed: the buffer uses the whole lifetime (`exp - iat`, else the lifetime measured when the token was first scheduled); scenario in auth-token-lifecycle.scenario.spec.ts.
- Review: ok

- Where: `libs/query/src/lib/auth/bearer-auth-query-builders.ts:549-562` (`calculateRefreshBuffer`),
  `:593-608` (`scheduledRefreshDelay` passes `expiresAt - Date.now()` as `tokenLifetimeMs`), `:676-701`
  (recomputed on every `visibilitychange` to visible). Docs: `apps/docs/query/auth.md:310-312, 324`.
- Problem: "refresh at 75% of the token lifetime" is computed against the time _left_ when the schedule is
  computed, not against the token's total lifetime. For a fresh token the two match. But the schedule is also
  recomputed whenever the tab becomes visible, and after a `setTokens()` seed with a token issued earlier:
  - 60 min token, numeric `refreshStrategy: 0.75`. Intended: refresh at minute 45. The tab is hidden and comes
    back at minute 44 with 16 min left. Recomputed delay = 0.75 × 16 = 12 min, so the refresh moves to minute 56. Every later visibility flip pushes it closer to expiry (each time to 75% of what is left).
  - With the default object strategy, the same return at minute 44 gives buffer = clamp(0.25 × 16 = 4 min, 1, 10)
    = 4 min, so the refresh lands at minute 56 instead of now.

  This contradicts `auth.md:324`: "refreshes right away if what is left of its lifetime is already inside the
  refresh buffer". Because the buffer is a fraction of what is left, what is left is never inside it until the
  `minBufferMs` clamp applies. The cost is either a refresh close to expiry or a `401` round trip the
  visibility recompute exists to prevent.

- Fix: compute the buffer from the token's total lifetime. Use `exp - iat` when the payload has a numeric
  `iat`; otherwise remember the lifetime measured when that token string was first scheduled (a
  `Map<token, lifetimeMs>` with one entry, or a variable keyed on the token). Add a scenario in
  `auth-token-lifecycle.scenario.spec.ts`: a 60 min token, hidden at minute 1, visible at minute 46, refreshes
  at once.
- Breaking: no. Decision: no.

## QB-04 `withTokenExpirationWarning` defaults fire before every routine refresh of a token under 20 min

- Status: fixed: with a refresh query and refresh token, `isExpiringSoon` turns true only once the scheduled refresh is overdue by min(10 s, buffer/2); specs + auth-features scenarios updated.
- Review: ok

- Where: `libs/query/src/lib/auth/features/bearer-auth-token-expiration-warning.ts:44, 80-85`; refresh defaults
  in `bearer-auth-query-builders.ts:556-562`.
- Problem: the warning's default threshold is 5 min. The default refresh fires at `clamp(0.25 × lifetime, 1 min,
10 min)` before expiry. For any access token shorter than 20 min, that is less than 5 min before expiry, so
  `isExpiringSoon()` turns `true` on every healthy rotation before the refresh replaces the token. A 15 min
  token (common) shows "your session is about to expire" for 1.25 min of every 11.25. The feature does not know
  a refresh is scheduled, and the docs (`auth.md:420`) do not say what the signal is meant to warn about.
- Fix: make `isExpiringSoon` mean "will expire and nothing is going to renew it". With a refresh query
  configured, only report `true` once the token is inside the threshold _and_ past its scheduled refresh time
  (or the refresh failed or was throttled). Otherwise default the threshold to below the refresh buffer. Document
  the intended use (a session that cannot be renewed: no refresh query, or a refresh query that gave up). Add a
  spec using a 15 min token with defaults.
- Breaking: no (behavior change of a signal). Decision: no.

## QB-05 A `bearerDecryptFn` that drops `exp` turns off proactive refresh, and the test setup hides the only warning

- Status: fixed: the expiry falls back to the raw JWT when `bearerDecryptFn` drops it; the unreadable-expiry warning is ET204 and names `bearerDecryptFn`; the `auto-refresh` console filter is gone from `setupQueryTest`.
- Review: ok

- Where: `libs/query/src/lib/auth/bearer-auth-provider.ts:354-358` (JSDoc only "decrypts the bearer token"),
  `bearer-auth-query-builders.ts:565-587` (expiry read off `bearerDecryptFn`'s result),
  `features/bearer-auth-token-expiration-warning.ts:52-60`, `libs/query/testing/query-test-setup.ts:45-53`.
- Problem: `bearerDecryptFn` is the obvious place to map claims to an app user (`(t) => toUser(decode(t))`).
  The proactive refresh, `isAccessTokenExpired()` and `withTokenExpirationWarning` all read the expiry claim off
  that function's _result_. A mapped object without `exp` silently disables all three. The only signal is a
  dev-mode `console.warn('Token does not contain valid exp property for auto-refresh')`, and `setupQueryTest`
  filters exactly that message (`message.includes('auto-refresh')`), so a consumer's spec never shows it. Docs
  `auth.md:73` say nothing about the requirement.
- Fix: decode the expiry from the raw JWT (`decryptBearer`) independently of `bearerDecryptFn`, which then only
  shapes `bearerData()`. If the coupling is kept, state the requirement in the JSDoc and in `auth.md`, and give
  the warning a `RuntimeError` code (2xx range) that names `bearerDecryptFn`. Remove the `auto-refresh` filter
  from `setupQueryTest`; the lib's own specs can filter it locally.
- Breaking: no. Decision: no.

## QB-06 `setupAuthTest({ features })` loses feature typing: `buildArgs` becomes `never`, `queryKey` is unchecked

- Status: fixed: `setupAuthTest` features are typed against its `login`/`refresh` builders (`AuthTestQueryBuilders`, `AuthTestFeatureBuilder`); all `@ts-expect-error` workarounds removed; typo type test in auth-test-utils.spec.ts.
- Review: ok

- Where: `libs/query/testing/auth-test-utils.ts:17-20` (`AnyFeatureBuilder` context typed with
  `readonly AnyQueryBuilder[]`), `:51, 91-101`; evidence: 9 `// @ts-expect-error - Type inference issue in
setupAuthTest` in `libs/query/src/lib/auth/features/bearer-auth-persistent-auth.spec.ts` (`:50, 75, 104, …`)
  and `bearer-auth-persistent-auth-cookie-scope.spec.ts:57`.
- Problem: verified with `tsc`:

  ```ts
  setupAuthTest({
    querySetup,
    features: [withPersistentAuth({ autoLogin: { queryKey: 'refresh', buildArgs: (token) => ({ body: { token } }) } })],
  });
  // TS2322: '(token: string) => { body: { token: string } }' is not assignable to '(token: string) => never'
  setupAuthTest({ querySetup, features: [withPersistentAuth({ autoLogin: { queryKey: 'refersh' } })] }); // compiles
  ```

  Inside `createBearerAuthProvider`, the same call is typed correctly (a typo is TS2820). So the test helper is
  the one place a consumer copies a production config and gets a type error back. The lib's own specs work
  around it with `@ts-expect-error`.

- Fix: type the feature context in `AuthTestSetupConfig` / `setupAuthTest` with the concrete builder tuple
  `[AuthQueryBuilder<'login', TLoginArgs>, TokenRefreshQueryBuilder<'refresh', TRefreshArgs>]`, so features
  infer their `TBuilders` contextually as they do in `createBearerAuthProvider`. Then delete the
  `@ts-expect-error`s and add a type test (`expectTypeOf` or a `@ts-expect-error` on the typo case).
- Breaking: no. Decision: no.

## QB-07 The testing entry cannot authenticate the app's own provider: no token minting helper is exported

- Status: fixed (per product decision): `mintTestToken` exported from `@ethlete/query/testing`; the harness `mintToken` is that function; testing.md "Testing a view behind auth". No `signInForTest`.
- Review: ok

- Where: `libs/query/testing/auth-test-utils.ts:132-156` (fixed name `test-auth`, fixed keys `login`/`refresh`,
  its own scratch creators), `libs/query/src/scenarios/harness/tokens.ts:31-41` (`mintToken`, internal only),
  `apps/docs/query/testing.md:115-135`.
- Problem: a consumer's component spec has to run against the app's real `authProviderRef`: its secure
  creators take that definition. `setupAuthTest` builds a separate provider, so it cannot make the app's secure
  queries run. The route that works (`authProviderRef.inject().setTokens(jwt, refresh)`) is not documented in
  `testing.md`, and it needs a decodable JWT with `exp`/claims for `bearerData()`, the refresh schedule and
  permission guards. The lib has exactly that helper (`mintToken({ expiresInMs, claims })`) but keeps it in the
  scenarios harness.
- Fix: export `mintTestToken(options?: { expiresInMs?: number; claims?: Record<string, unknown> })` from
  `@ethlete/query/testing` (move `tokens.ts`'s mint and decode into `libs/query/testing`). Add a
  `signInForTest(authProviderRef, { claims?, expiresInMs? })` that calls `setTokens` in an injection context.
  Document both in `testing.md` under "Testing a view behind auth". Optionally let `setupAuthTest` accept an
  existing `authProviderRef` instead of building its own.
- Breaking: no. Decision: yes (shape and naming of the new testing API, and whether `setupAuthTest` takes a
  ref).

## QB-08 `setupQueryTest` swallows every `ErrorHandler` error by default, not just failed requests

- Status: fixed: default handler swallows only `HttpErrorResponse`/`QueryErrorResponse` and rethrows the rest; `mockErrorHandler: 'all'` keeps the old behavior; console filter auto-restores on TestBed reset.
- Review: ok

- Where: `libs/query/testing/query-test-setup.ts:96-111` (`mockErrorHandler` defaults to `true`, providing
  `{ handleError: () => undefined }`), `:45-90` (process-wide console filter), `apps/docs/query/testing.md:96`.
- Problem: the docs give the default as "so failed requests do not fail the spec". But the no-op handler also
  swallows every other error routed to `ErrorHandler`: a throwing effect, a template error, an error from a
  subscribe. A consumer's spec built on `setupQueryTest` passes while the component under test throws. The
  console filter also stays installed for the rest of the file unless `restoreConsole()` is called. Since
  `bb4c0586b` a creator can keep failed requests out of the `ErrorHandler` (`reportErrors`), so the blanket
  mock is broader than it needs to be.
- Fix: default to a handler that drops only `HttpErrorResponse` / `QueryErrorResponse`-shaped errors and
  rethrows (or collects into a `reportedErrors()` array on the setup) everything else. Keep
  `mockErrorHandler: 'all'` as the old behavior. Restore the console filter automatically through
  `TestBed`'s teardown (`TestBed.inject(DestroyRef).onDestroy(restoreConsole)` or an `afterEach` registered
  when the test runner exposes one). Update the option table in `testing.md`.
- Breaking: yes (specs that relied on the swallow start failing; that is the point). Decision: no.

## QB-09 `sessionStatus()` `'unknown'` is documented as never observable, but multi-tab sync holds it for up to 250 ms

- Status: fixed: JSDoc and auth.md table corrected; shell example gates on `unknown` too. No `isSessionSettled` added.
- Review: ok

- Where: `libs/query/src/lib/auth/bearer-auth-provider.ts:96-104` (JSDoc "Never observed from a component"),
  `:1006-1016` (stays `'unknown'` while `sessionAdoption.isPending()`), `internal/multi-tab-sync.ts:88`
  (`sessionAdoptionTimeoutMs = 250`); docs `auth.md:106` vs `auth.md:385`.
- Problem: `auth.md:106` says `'unknown'` is "Not observable from a component - it is resolved by the time
  `inject` returns", and the shell example at `auth.md:111-124` only gates on `'restoring'`. With
  `withBearerAuthMultiTabSync()` and a remember-me cookie, a second tab stays `'unknown'` after `inject` returns,
  until the leader answers or 250 ms pass (`auth.md:385` says so, contradicting `:106`). The documented shell
  renders `<router-outlet />` during that window. The guards handle it (`auth-guard.ts:286`), but anything else
  in the shell that branches on `'authenticated'` vs `'anonymous'` (a header, a "log in" button) flashes the
  anonymous state.
- Fix: correct the JSDoc and the `auth.md` table row ("`'unknown'`: startup, including a multi-tab join
  handshake of up to 250 ms"), and change the shell example to
  `@if (status === 'unknown' || status === 'restoring')`. Optionally export an
  `isSessionSettled` computed (`status === 'authenticated' || status === 'anonymous'`) so apps stop
  re-deriving it.
- Breaking: no. Decision: no.

## QB-10 `dateQueryField()` writes `Date.toString()` into the URL: locale text, and milliseconds lost on reload

- Status: fixed: `dateQueryField`/`dateArrayQueryField` write ISO strings; scenario asserts the URL and millisecond round trip.
- Review: ok

- Where: `libs/query/src/lib/query-form-signals/query-form-signals.fields.ts:141-168` (no `valueToQueryParam`
  for the `Date` variant), `:170-174` (`dateArrayQueryField`, same), `query-form-signals.ts:541-547`
  (`serialize` passes the `Date` through). Angular's `normalizeQueryParams`
  (`@angular/router/fesm2022/_router-chunk.mjs:676-683`) turns it into `String(date)`.
- Problem: a committed `new Date(2026, 0, 15, 10, 30, 0, 123)` reaches the URL as
  `?from=Thu%20Jan%2015%202026%2010%3A30%3A00%20GMT%2B0100%20(Central%20European%20Standard%20Time)`. The time
  zone name in parentheses depends on the browser locale, the URL is unreadable when shared, and the
  milliseconds are gone after a reload or a shared link. The code knows: the comment at
  `query-form-signals.ts:920-921` skips re-parsing its own writes so it does not "drop the milliseconds of a
  committed Date". The legacy class wrote ISO (`query-form/query-form.ts:166`). The round-trip scenario
  (`scenarios/query-forms-url-sync.scenario.spec.ts:106-126`) only passes because it uses 0 ms, and it never
  asserts the URL.
- Fix: give `dateQueryField()` and `dateArrayQueryField()` a `valueToQueryParam` that writes `toISOString()`
  (`transformToDate` already parses ISO). Extend the scenario to assert `router.url` contains `2026-01-15T` and
  to round-trip a non-zero millisecond value. Mention the URL format in `query-forms.md:67`.
- Breaking: no (old `toString` URLs still parse through `transformToDate`). Decision: no.

## QB-11 `setupAuthTest` defaults `autoRetryOn401` to `false`, and production defaults it to `true`

- Status: fixed: default is `true`.
- Review: ok

- Where: `libs/query/testing/auth-test-utils.ts:38-39, 107`; production default
  `bearer-auth-query-builders.ts:756`; `apps/docs/query/testing.md:130`.
- Problem: a consumer testing "a secure request recovers from a 401" with the helper gets no refresh at all,
  unlike production. The table documents it, but the flipped default makes the helper test a configuration the
  app does not ship.
- Fix: default it to the production value (`true`). The lib's own specs that need it off pass
  `autoRetryOn401: false`.
- Breaking: yes (test helper default). Decision: no.

## QB-12 `latestExecutedQuery` / `latestNonInternalQuery` are public, undocumented, and overlap newer APIs

- Status: fixed (2026-10-06: documented in the JSDoc and the `auth.md` member table; not moved, a move is breaking)

- Where: `libs/query/src/lib/auth/bearer-auth-provider.ts:406-417, 1026-1027`; absent from the member table in
  `apps/docs/query/auth.md:70-84`. Used by `libs/query-devtools/src/lib/query-devtools-auth-tab.component.html`.
- Problem: two public signals with one-line JSDoc. Their semantics (cleared on logout, revocations excluded,
  "non-internal" decided by `triggeredBy`) are only in the source. The docs steer users to
  `queries.<key>.snapshot` and `executionState()` (`auth.md:260-282`), so a consumer meeting these in
  autocomplete cannot tell whether to use them.
- Fix: move both to a `subtle` namespace on the provider (the devtools are the only reader), or document them in
  the member table with a pointer to the preferred API.
- Breaking: yes if moved. Decision: yes (move vs document).

## QB-13 `persistence.fields` and `isResetBy` are plain `string[]`, and a typo in `persistence.fields` is silently ignored

- Status: fixed: `persistence.fields` typed over the form keys, dev warning for unknown keys (breaking for a bare `QueryFormPersistence` annotation); scenario in query-forms-persistence.scenario.spec.ts.
- Review: ok

- Where: `libs/query/src/lib/query-form-signals/query-form-signals.types.ts:47, 160` (`readonly string[]`),
  `query-form-signals.ts:549-553` (`keys.filter((key) => key in fieldDefs)`: no warning), contrast `:186-190`
  (`isResetBy` typo warns in dev mode).
- Problem: `observe({ persistence: { key, storage: 'session', fields: ['serach'] } })` compiles, persists
  nothing for that field, and also stops that field from blocking a restore, with no message. `isResetBy`
  typos at least warn.
- Fix: type `QueryFormSignalsObserveOptions` / `QueryFormPersistence` generically over the form's keys
  (`observe(options?: QueryFormSignalsObserveOptions<keyof TFields & string>)`), and add the same dev-mode warn
  as `isResetBy` for unknown keys. `isResetBy` cannot be typed at the field creator; a `defineQueryForm`-level
  mapped-type check over `TFields[K]['isResetBy']` could catch it, optional.
- Breaking: no. Decision: no.

## QB-14 A custom `bearerDecryptFn` returning `null` falls back to the default JWT decoder

- Status: fixed: ternary instead of `??`; scenario in auth-token-lifecycle.scenario.spec.ts.
- Review: ok

- Where: `libs/query/src/lib/auth/bearer-auth-provider.ts:817`
  (`config.bearerDecryptFn?.(token) ?? decryptBearer<TBearerData>(token)`).
- Problem: a decrypt function that returns `null`/`undefined` to say "no usable data" (an opaque token, a token
  for another audience) gets the default decoder's payload in `bearerData()` instead. The refresh query
  (`bearer-auth-query-builders.ts:567`) uses a ternary and does not fall back, so the two disagree on the same
  token.
- Fix: `config.bearerDecryptFn ? config.bearerDecryptFn(token) : decryptBearer(token)`.
- Breaking: no. Decision: no.

## QB-15 `withTokenExpirationWarning` runs two 1 s intervals per provider

- Status: fixed: one `toSignal`; `isExpiringSoon` is a computed.
- Review: ok

- Where: `libs/query/src/lib/auth/features/bearer-auth-token-expiration-warning.ts:62-88`.
- Problem: `expiresIn` and `isExpiringSoon` are two `toSignal`s over the same cold `expiresIn$`, so each one
  subscribes its own `timer(0, checkInterval)`. While a session exists, that is two intervals per tab. It also
  makes `isExpiringSoon` derivable but separately scheduled.
- Fix: keep one `toSignal(expiresIn$)` and make `isExpiringSoon` a `computed` over it.
- Breaking: no. Decision: no.

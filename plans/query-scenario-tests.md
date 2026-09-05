# Query scenario tests

Status: in progress (started 2026-09-03). Delete this file when the harness and the first
scenario suites are merged and the `query-scenario-tests` skill documents them.

## Why

The `libs/query` unit specs mock internals (`as unknown as AnyBearerAuthProvider`, hand-made
signals, `HttpTestingController.expectOne`). They pass while the real system races, leaks or gets
stuck. The scan in `plans/query-lib-scan.md` (2026-08-19) found 9 high bugs; none had a spec. Two
themes recur: test doubles that mirror the bug, and "running" flags with no `finally`.

A scenario test boots the **real** system through its **public API only** - the same imports a
consumer app uses - against a stateful fake backend and a deterministic clock. Internals may be
refactored freely; the scenario suite still tells the truth.

## Layout

```
libs/query/src/scenarios/
  harness/
    fake-api.ts          # stateful HttpBackend replacement
    fake-api.spec.ts     # the harness has its own small spec
    tokens.ts            # unsigned JWT minting for auth scenarios
    scenario.ts          # createScenario / useScenario, tick, flush, consumers
    invariants.ts        # the checks scenario.destroy() runs
    index.ts
  queries.scenario.spec.ts
  caching.scenario.spec.ts
  features.scenario.spec.ts        # polling, auto refresh, response update, handlers
  stacks.scenario.spec.ts          # stacks, paged stacks, batch, sequence
  errors.scenario.spec.ts          # error parsing, retry policy, html/symfony/ethlete parsers
  auth.scenario.spec.ts            # login, refresh, logout, races, secure queries
  gql.scenario.spec.ts
  persistence.scenario.spec.ts
  multi-tab.scenario.spec.ts
  ws.scenario.spec.ts
  query-forms.scenario.spec.ts
```

`src/**/*.spec.ts` is already in `tsconfig.spec.json` and the vitest include; `tsconfig.lib.json`
excludes it from the build. No config change is needed.

Scenario specs import from `@ethlete/query` (and `@ethlete/query/testing` for the multi-tab,
persistence and websocket fakes that already exist). They never import from `../lib/...`.

## Harness contract

### `createFakeApi(config)` - `harness/fake-api.ts`

An Angular `HttpBackend` (provided with `{ provide: HttpBackend, useValue: api.backend }`) that
behaves like a small server.

```ts
const api = createFakeApi({ baseUrl: 'https://api.test' });

api.on('GET', '/users/:id', ({ params, query, headers, body }) => ({ body: { id: params.id } }));
api.on('POST', '/users', () => ({ status: 201, body: { id: '9' } }));
api.on('GET', '/slow', () => ({ body: [], delay: 500 }));
api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));
api.on('GET', '/flaky', sequence([{ status: 503 }, { status: 503 }, { body: 'ok' }]));
api.once('GET', '/users/1', () => ({ status: 404 })); // consumed by the next matching request only
api.protect('/secure/**'); // 401 unless a valid, unexpired bearer token is sent
api.protect('/admin/**', (token) => token.claims.role === 'admin');

api.requests; // ordered log: { method, url, path, params, query, headers, body, at, status, aborted }
api.requestCount('GET', '/users/1');
api.pending(); // in-flight requests (delivered on the next tick)
api.reset(); // routes, log and one-shots
```

Rules:

- A handler may return a response object `{ status?, body?, headers?, delay? }` or throw an
  `HttpErrorResponse`. Status >= 400 becomes an `HttpErrorResponse`, like the real backend.
- Every response is delivered asynchronously through a `setTimeout(delay ?? 0)` on the **bare
  global** (never `window.setTimeout`, see `vitest-window-timers-not-faked` in memory). Under
  fake timers nothing lands until the test ticks. This makes request ordering explicit.
- Unsubscribing before delivery marks the log entry `aborted: true` and removes it from `pending()`.
- An unmatched request fails the test immediately with the method, url and the list of routes.
- Route patterns: `:param` segments, `*` one segment, `**` rest. Matching ignores `baseUrl`.
- `protect()` reads `Authorization: Bearer <jwt>`, decodes the payload with `tokens.ts`, and
  answers `401 { message: 'unauthorized' }` when the header is missing, the token is malformed,
  `exp` is in the past (fake `Date.now()`), or the optional predicate returns false.
- Optional: `api.on(...)` returning `{ progress: [25, 50, 100] }` emits upload/download progress
  events before the response. Only implement when a scenario needs it.

### `tokens.ts`

`mintToken({ expiresInMs, claims? })` builds an unsigned JWT (`header.payload.` with base64url,
empty signature) with `iat`/`exp` derived from `Date.now()`. `decodeToken(jwt)` returns the
claims or `null`. The auth provider only reads the payload, so no signature is required.

### `createScenario(config)` / `useScenario(config)` - `harness/scenario.ts`

```ts
const scenario = useScenario({
  clientOptions: { keepUnusedFor: 0 }, // merged into createQueryClient({ name, baseUrl, ... })
  clientFeatures: [withDefaultRetry()], // createQueryClient features
  providers: [], // extra TestBed providers
});

it('dedupes identical requests', () => {
  const s = scenario();
  s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params.id } }));

  const getUser = s.get<{ response: User; pathParams: { id: string } }>((p) => `/users/${p.id}`);

  const a = s.consumer(); // a fake component: its own injector + DestroyRef
  const b = s.consumer();
  const q1 = a.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
  const q2 = b.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

  s.tick(); // deliver
  expect(s.api.requestCount('GET', '/users/1')).toBe(1);
  expect(q1.response()).toEqual(q2.response());

  a.destroy();
  b.destroy();
});
```

- `useScenario` registers `beforeEach` (fresh TestBed, fake timers, new client + api) and
  `afterEach` (`scenario.destroy()`, which runs the invariants). It returns a getter.
- `createScenario` is the same without hook registration, for tests that need two clients
  (multi-tab) or a custom lifecycle. Those tests call `destroy()` themselves.
- Fake timers: `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })`.
  Do **not** fake `queueMicrotask` (the multi-tab fakes deliver on it).
- `s.tick(ms = 0)`: advance timers by `ms`, then `TestBed.tick()` (effects run). Because RxJS
  and the client schedule on microtasks between timers, `tick` must call
  `vi.advanceTimersByTime(ms)`, then `await`-free microtask draining via `vi.runAllTicks()` when
  available, then `TestBed.tick()`. Make `tick` synchronous if possible; if a scenario needs
  promise resolution (persistence), provide `await s.settle(ms)` which also awaits
  `Promise.resolve()` a few times.
- `s.flush(maxMs = 60_000)`: tick in steps until `api.pending() === 0` and the timer count is
  stable. Throws if it never settles.
- `s.consumer()`: creates a child `EnvironmentInjector` (`createEnvironmentInjector([], s.injector)`)
  and returns `{ injector, destroyRef, run(fn), destroy() }`. Queries created in `run` bind to
  that consumer. `destroy()` destroys the child injector and marks the consumer destroyed so the
  invariants can count it.
- `s.run(fn)`: `TestBed.runInInjectionContext(fn)` on the root injector.
- `s.errors`: every error the Angular `ErrorHandler` received, plus every `console.error` call.
  `s.expectError(matcher)` removes the first matching entry so the invariant passes.
- Auth helper `s.auth(config)`: builds a `createBearerAuthProvider` over the scenario client with
  login + refresh queries pointing at `api` routes (`POST /auth/login`, `POST /auth/refresh`)
  that issue tokens through `mintToken`. Accepts the same feature builders and refresh options a
  consumer would pass. Returns the injected provider. Adapt the shape of
  `libs/query/testing/auth-test-utils.ts`, but issue real (unsigned) tokens and go through `api`.

### `invariants.ts`

`scenario.destroy()` destroys every live consumer, destroys the TestBed injector, then asserts:

1. `api.pending() === 0` - a destroyed client leaves no request in flight (or aborted them).
2. `vi.getTimerCount() === 0` - no timer leaked (poll ticks, eviction timers, refresh timers).
3. `client.repository.subtle.cacheEntries().length === 0` - the repository released every entry.
4. `s.errors` is empty - no unexpected `ErrorHandler` or `console.error` call.

Failures name the invariant and dump the relevant state (pending requests, remaining cache keys,
error messages). A test can opt out of one invariant with a reason:
`s.allow('timers', 'withPolling keeps the interval until the consumer is destroyed - tracked in #123')`.
Every opt-out is a smell; the skill says so.

## Phase B - the scenario suites

One agent per file. Each agent writes 5-10 scenarios that read like a consumer story and
assert observable behavior: signal values, request log, timing. Every high finding in
`plans/query-lib-scan.md` that is still reproducible gets a scenario. When a scenario fails
against the current code:

- do **not** change `libs/query/src/lib`;
- keep the scenario, wrap it in `it.fails(...)` with a one-line reason that names the scan
  finding, and report it in the final summary.

The coordinator decides whether the bug is fixed in this change or filed.

## Running

```bash
npx vitest run --config vitest.projects.ts --project query libs/query/src/scenarios            # all scenarios
npx vitest run --config vitest.projects.ts --project query libs/query/src/scenarios/auth       # one file
```

Agents scope their runs to their own file. The coordinator runs the full `query` project once.

## Findings (from the suite agents, 2026-09-03)

- `features`: 7 pass, 1 `it.fails`. `withPolling` schedules on `window.setInterval`
  (`libs/query/src/lib/http/query-features.ts:230`); fake timers never fire it. Fix: bare `setInterval`.
- `features`: scan finding http #2 (poll tick closure leak) was fixed in `56e301f6e`; no regression
  scenario written yet - the `caching` suite's duplicate-unbind scenario should cover the neighbor.
- `caching`: 10 pass, no `it.fails`, no opt-outs. Scan http #2/#3 (eviction timer, onDestroy) confirmed
  fixed and now covered by regression scenarios 4 and 5. Note: a rebind inside `keepUnusedFor` shows
  the cached response synchronously and then revalidates in the background (one request) - that is the
  documented behavior, not "zero requests".
- `stacks`: 9 pass, no `it.fails`, no opt-outs. Scan theme 2 (batch/sequence stuck running flags)
  confirmed fixed in `56e301f6e`, now covered by regression scenarios 6 and 8. Harness gap: `s.tick`
  is synchronous, so promise-based APIs (`querySequence.run()`) need an async settle loop; the suite
  has a local `settleUntil()`. Consider promoting it into `harness/scenario.ts`.
- `errors`: 10 pass, no `it.fails`, no opt-outs. Harness gaps: `fake-api` cannot answer a status-0
  network error (error branch is `status >= 400`) - add a `networkError()` response helper;
  `registerQueryErrorParser`/`setDefaultQueryRetryFn` are process-wide singletons that never reset
  between tests, so suite order matters - consider a reset hook in `scenario.destroy()`; a timer
  created exactly at an `advanceTimersByTime` boundary needs one more 1 ms tick.
- `auth`: 8 pass, 1 `it.fails`. NEW BUG (not in the scan): after a 401 with `autoRetryOn401`, the
  refresh succeeds and `afterTokenRefresh$` emits, but the secure query never re-fires; it stays
  failed with the stale 401. Look at `tokenRefreshSubscription` in
  `libs/query/src/lib/http/secure-query-execute-factory.ts`. Scan auth #1 (logout during in-flight
  refresh) is fixed and now covered. `s.auth()` now also returns `ref` (the provider definition) for
  `createSecure*Query`. Harness change by the coordinator: `destroy()` now resets the TestBed before
  the invariants run, so root-provider timers and cache entries no longer count as leaks. TODO: remove
  the `ROOT_PROVIDER_TEARDOWN_GAP` opt-outs from `auth.scenario.spec.ts`; they are not needed anymore.
- `auth`: the `ROOT_PROVIDER_TEARDOWN_GAP` opt-outs are removed; 8 pass + 1 `it.fails` with no `allow`.
- `gql`: 11 pass, no `it.fails`. All four scan findings (secure verb, shared args mutation,
  `operationName` regex, divergent `transformResponse`) were fixed in `56e301f6e`; the suite now
  guards them. A 200 response without `data` throws on `response()` read, per the docs.
- `ws`: 8 pass, no `it.fails`. Both scan findings (destroy hook leaves the wrong room) were fixed in
  `56e301f6e` and are covered. The docs name no client-side reconnect backoff, so the reconnect
  scenario drives the test double directly. Local `createSocket(s)` helper builds a
  `createWebSocketTestDouble` + `createWebSocketClient` pair per test.
- `persistence`: 8 pass, 2 `it.fails`. (1) Scan finding "an existing cache entry ignores the second
  consumer's configuration": `query-repository.ts:732` ANDs `isPersistEnabled` across consumers, so a
  sibling that opted out turns persistence off for the one that opted in. (2) NEW BUG: the auth
  provider's login/refresh mutations set `subtle.useQueryRepositoryCache`, which makes them eligible
  for persistence; a plain `login()` lands in the store, against the docs ("Mutations are never
  persisted"). The authenticated-responses scenario filters `/auth/*` to stay on topic. Harness note:
  the persistence engine reads the adapter synchronously while the client is built, so the store is
  created in a `beforeEach` registered before `useScenario`, and referenced lazily
  (`adapter: () => store.adapter`).
- `features`: correction. `withPolling` does fire under the fake clock (`window === globalThis` in the
  vitest jsdom environment, so `window.setInterval` is faked too). The scenario is a plain `it` now; the
  suite has 8 pass, no `it.fails`. A destroyed query leaves the 100 ms circular-dependency guard timer
  from `query-execute-utils.ts` until it expires on its own; it is not a leak and no poll survives destroy.
- `multi-tab`: 9 pass, no `it.fails`, no opt-outs. Second tab = `createQueryClient()` installed with
  `ref.provide()` in a child injector of the scenario injector, `keepUnusedFor: 0`. Covers response
  sharing, shared freshness, `multiTabSync: false` opt-out, mutation refresh of the other tab only,
  `invalidateQueries` with and without `otherTabs`, a structured-clone failure on broadcast, one poller per
  key, and channel/lock teardown.
- `query-forms`: 12 pass, 2 `it.fails`. (1) NEW BUG: the documented filter-overlay flow
  `qf.setValue(draft.value())` loses a child field. `resolveResets` in `query-form-signals.ts` resets every
  `isResetBy` child of a changed parent, including a child the same commit set (`country: us, league: mls`
  commits as `league: null`). `skipResets: true` keeps it. Either the reset should skip a child that
  itself changed in the commit, or the docs must pass `skipResets`. The URL-navigation path is not
  affected. (2) Harness artifact: `@ethlete/core` `equal()` compares Dates by constructor identity, and
  under a faked `Date` an instance carries the native constructor while the global is the fake, so two
  different Dates compare equal and a `Date` field never commits. Hardening `equal()` with
  `Object.prototype.toString` would fix it. All earlier scan findings (`appendDefaultValueToUrl` on
  observe, Sort normalization, `?ids=5`, destroy-time param wipe, lazy function defaults) are fixed and
  covered. Harness change by the coordinator: `settle()` drains 20 microtask turns instead of 5; a
  `router.navigate` queued from a microtask needs more than 5.
- Not covered: the `createBranch` field-tree leak. The four invariants do not observe Angular effect or
  injector retention, so no honest failing assertion exists yet.

## Resolution (2026-09-04)

- `query-forms` (1): fixed. `resolveResets` never resets a key the same commit changed; the branch
  now runs the same reset graph. (2): fixed in `@ethlete/core` - `equal()` detects Dates by tag.
- `auth`: not a product bug. The refresh's `afterTokenRefresh$` emission is a microtask, and the
  synchronous `s.tick()`/`s.flush()` never drain microtasks - the scenario needed `await s.settle()`.
  The fake tokens also carried second-granularity `iat`/`exp` only, so login and refresh minted the
  same string under the frozen clock; `mintToken` now adds a `jti`. Both are harness fixes.
  Open: one refresh emits `afterTokenRefresh$` twice (the token-extraction effect in
  `bearer-auth-provider.ts` re-runs) - harmless for the `take(1)` retry, worth a look.
- `persistence` (1) and (2): fixed. `isPersistEnabled` is an OR over the bound consumers, recomputed
  on bind/unbind; `queueWrite` rejects non-cacheable methods.

## Scan wave 1 (2026-09-04)

Six agents hunted `libs/query` and `libs/components` against the docs, red test first. The `libs/query`
half landed as 8 commits on `next` (`a8090ca9e`..`9aec8b1e2`), 14 fixes with 14 changesets. New suites:
`http-lifecycle.scenario.spec.ts`, `auth-token-lifecycle`, `auth-secure-query`, `auth-multi-tab`,
`query-forms-url-sync`, `query-forms-branch`.

Fixed, each with a scenario or unit test that failed first:

- HTTP core: `reset()` left the query bound to its shared request; `max-age=0` was not stale in the
  same millisecond; `withLongPolling` retained the `withArgs`-started first round; the `ET800` guard
  measured its window with `performance.now()` against a `setTimeout` reset.
- Auth: a refresh whose 2xx body yields no tokens kept the session - the default extractor's throw
  reports as `code: 0`, which the retry list reads as a network failure. A custom `extractTokens`
  result now runs through the default checks too.
- Query form: URL coercion of `0`/`0.5`; the `skipResets` latch; `branch()` without debounce or reset
  graph (now with `liveValue`, which the filter overlay submits); two same-tick URL writes dropping
  each other; an emptied array counting as a filter.
- GraphQL: secure queries cached by transport rather than operation kind; production minification
  collapsing string literals and letting a `#` comment swallow the document.
- Persistence: startup pruning dropped a response written before the store index finished loading.

Open, left as `it.fails` with a reason in the spec:

- `http-lifecycle`: the `ET800` guard throws on more than five executions per 100 ms whatever the
  cause, so a slider bound to `withArgs` trips it. Raising the threshold or scoping the count to
  executions caused by the previous flush is a product call.
- `persistence`: a GraphQL query transported via POST is never persisted. The `request-success` event
  carries no `isRefreshable`, so the engine can only tell a read from a mutation by HTTP method. The
  fix is to add `isRefreshable` to that event (`query-repository.ts` ~L791,
  `currentEntry?.isRefreshable ?? isRefreshable`) and have `queueWrite` read it instead of
  `shouldCacheQuery(event.request.method)`.

Not pursued (candidates seen in code, no test): a delegated `refresh-requested` that reaches the
leader after it rotated the pair spends a second refresh token; `transformResponse` throwing;
`execute()` on a destroyed query; a second consumer's `retryFn` on a shared key. Persistent-auth
scenarios (cookie write/delete, inactivity logout across tabs, leadership hand-over) are still absent.

## Wave 3 (2026-09-04)

Opus agents authored, Fable reviewed. Full `query` project: 132 files, 1778 tests, no `it.fails`.

- Harness: `harness/fake-xhr.ts` routes the legacy client's `XMLHttpRequest` through the fake API;
  `createScenario` installs it per scenario and restores the original in `destroy()`.
- New suites: `legacy.scenario.spec.ts` (27: states incl. `Cancelled`, operators, caching, 15 s GC,
  window-focus refresh, smart polling, legacy auth providers), `multi-tab-config.scenario.spec.ts` (13:
  option variants, retained-entry update, quiet side effects, three-tab FIFO, hidden-tab hand-over,
  server no-op, degradation without the APIs).
- Extended: `caching` (server platform releases entries at once), `http-lifecycle` (`transformResponse`
  throw, `execute()` after destroy, first consumer's `retryFn` governs a shared key),
  `auth-multi-tab-leadership` (delegated refresh after rotation), `multi-tab` (consumers now run below
  the tab injector; the old shape resolved a bystander root client).
- Fixed, with changesets: `response()` reset to null on a `transformResponse` throw (`query-state.ts`,
  now a `linkedSignal` that keeps the previous value); a delegated `refresh-requested` after the leader
  rotated the pair spent a second refresh token (`refresh-requested` now carries the requester's
  encrypted token; the leader answers with its current pair).
- Docs: `legacy.md` migration row reads `poll({ interval, takeUntil })`; `auth.md` states one refresh
  per rotation across tabs.
- Findings not fixed: the legacy `QueryStore` never unsubscribes its `blur`/`focus` listeners and has no
  teardown for its 15 s GC (app-lifetime in production); a retained entry's evict timer outlives a
  destroyed client injector (bounded); the leader does not `announceStart()` when it declines a
  delegated request as `busy`, so the follower re-asks after 3 s for nothing. The scan triage with the
  open findings is in `plans/query-lib-scan.md`.

## Wave 4 (2026-09-05)

Opus agents authored one finding each, Fable reviewed and committed. The scan triage in
`plans/query-lib-scan.md` was the work list.

- Fixed, with changesets: `unobserve()` mid-navigation stripped the landing route's same-named params
  (`query-form-signals.ts`, the wipe now runs only when the pending navigation stays on the current
  route; destroy already passed `cleanup(false)` and was safe); the ws client sent `join-room` twice on
  the first connect and for a room joined during a drop (a `bufferedJoins` set tracks joins socket.io
  still holds; the unit spec and the test-double JSDoc mirrored the bug); the devtools override
  recorder map grew for the app lifetime (`releaseQueryDevtoolsOverridePersistence` runs from the
  registry's unregister closure); the leader declined a delegated refresh as `busy` in silence, so the
  follower took it over with the token the in-flight login replaced (`announceStart()` in the busy
  branch too); the legacy `QueryStore` never removed its `blur`/`focus` listeners or its 15 s GC
  (torn down on the owning `DestroyRef` when one exists).
- Pinned as documented, no fix: a numeric `refreshStrategy` is unclamped by design (three scenarios);
  the legacy `insertFrom` array case worked through the `select` overload, the redundant branch is
  collapsed (six unit tests).
- Already covered, no work: GraphQL over POST persistence (`persistence` suite), the `createBranch`
  release with a shorter-lived and with the default injector (`query-forms-branch` suite).
- New finding, not fixed: the legacy `QueryForm.unobserve()` during a navigation calls
  `router.navigate([], { queryParamsHandling: 'merge' })` against the old URL and cancels the user's
  navigation outright (`navigateByUrl` resolves `false`). Deprecated class; fix like the signals form.
- Harness notes: `mintToken` floors `exp` to whole seconds, so proactive refresh instants need a 1 s
  window (in the skill now); the harness router has no routes, suites that need a cross-route
  navigation call `router.resetConfig([{ path: 'other', children: [] }])` inline.

## Wave 5 (2026-09-05)

Two scheduled sessions. The first read every `apps/docs/query/*.md` page against the 33 scenario
suites (305 gaps, `.claude/handoffs/wave5-coverage-gaps.md`) and scanned the auth, http and devtools
trees for behavior the docs contradict (`.claude/handoffs/wave5-scan-*.md`). The second reviewed the
work its 19 agents left in the tree, split it per fix, and closed the rest. Opus agents authored one
item each; the coordinator reviewed, ran the scoped suites and committed. 32 commits.

Scan items 6-10 of `plans/query-lib-scan.md` are closed. The three legacy fixes, the signals form
in-flight navigation and the `ObservableSignal` mutation landed first; then, from the wave 5 scans:

- **auth**: a login that superseded the cookie restore stranded `sessionStatus()` on `'restoring'`,
  so every guard pended for the life of the tab; `withTracking` never read `trackInternalEvents`, so
  the provider's own executions raised nothing; `withTokenExpirationWarning` hardcoded the `exp`
  claim and now reads `expiresInPropertyName`; a leader that ran no secure queries burned its 401
  streak serving delegated refreshes and then throttled them all - the streak now counts one per
  rotation, in the tab whose own request loops.
- **http**: `state.error.set()` was wiped by any later `state.rawResponse.set()`, so a secure query
  that already held data reported no error at all and a snapshot of a failed query reported success
  (the two writes are ordered now); `withDefaultRetry` was a process-wide global and now resolves per
  client; a `transformResponse` throw ran `withSuccessHandling` with the previous response;
  `fetchPreviousPage()` returned the stack's last query instead of the page it fetched, and
  `blockExecutionDuringLoading` did not block the first backward fetch; a cached mutation - the auth
  tokens - was broadcast to every tab; an entry's merged policies (`isSecure`, `isRefreshable`,
  `isMultiTabSyncEnabled`, `keepUnusedFor`) stayed stuck after a consumer unbound; a synchronous
  throw from `execute()` inside a batch leaked `inFlight`; `buildQueryCacheKey` sorted header names
  before lowercasing them.
- **devtools**: a tombstone kept the destroyed component's injector through `meta.queryConfig`; only
  the first query that read a form was ever linked to it (the form's `value` noted the read on
  recomputation, not on read); the pills never came off a page that polls or holds a session, because
  `whenStable()` never resolves under zone.js - they settle half a second after the first render now;
  a second `provideQueryDevtools()` call warns instead of dropping its options in silence; a folded
  pill is no longer rebuilt on every token rotation; a failed devtools login no longer claims the next
  rotation's tokens, and the session vault is keyed per registration rather than by provider name;
  the host `ElementRef` is resolved only when the devtools read it.
- **Added**: `createHeadQuery` / `createOptionsQuery` and their secure twins - the repository already
  treated both as cacheable reads, but no creator existed.

Coverage: **the pass is complete.** All 16 docs pages under `apps/docs/query/` are covered against the
scenario layer - 305 gaps closed - and three suites are new: `queries-http-methods`,
`migrating-from-v2` and `query-forms-fields`. The `validateWithQuery` cache leak behind the five
`s.allow('cache')` opt-outs is fixed, so **no invariant opt-out remains anywhere in the layer**.

Two bugs the coverage pass itself found and fixed: a query stack without `append` built two query
objects per arg (the cache hid the second request, but every feature side effect ran twice and the
shadow queries lived for the stack's life), and `validateWithQuery` bound its internal query to
Angular's `FieldNodeStructure` injector, which signal forms never destroys for a root field.

Nine documented claims are parked as `it.fails`, each with a one-line reason naming its doc line.
They need a decision - fix the code or correct the sentence:

- `dependent-queries.md:119` - the `run()` promise of a destroyed sequence rejects with an RxJS
  `EmptyError` rather than never settling. The same caveat is in the `QuerySequence.run` and
  `executeUntilSettled` JSDoc.
- `ws.md:75` / `:145` - a malformed frame is `console.error`ed; only the `throw` is dev-mode gated.
- `caching.md:55` - an auto-execution never passes `allowCache`, so a consumer rebinding to a
  retained, still-fresh entry does send a request.
- `query-forms.md:118` - a cyclic `isResetBy` graph converges after two passes, so the ten-pass cap
  and its dev-mode warning are never reached.
- `auth.md:197` (also parked in `migrating-from-v2.scenario.spec.ts`) - a rejected session restore is
  never observable as `autoLogin`/`error` under the default policy: the logout happens in the same
  effect pass. `auth.md:281` documents the `logout` outcome, so the two lines are in tension.
- `migrating-from-v2.md:43` - Angular 22 provides `HttpClient` in root, so a client without
  `provideHttpClient()` does not throw. The page and its `withXhr()` advice predate that.
- `migrating-from-v2.md:201` - a re-execution whose refresh fails loses its last response.
- `migrating-from-v2.md:202` - `cleanQuery` destroys every superseded query, so it cancels an
  in-flight `POST` the page says it leaves alone.

New findings, not fixed: `GqlQueryArgs` constrains `rawResponse` to `{ data: TResponse }`, so
`gql.md:66` ("declare it only when your endpoint returns something else") cannot be satisfied without
a cast; the cache key is built from route, body and headers but not the method, so a `HEAD` and an
`OPTIONS` on one route share an entry (both in the current system and in the legacy client);
`[etInfinityQueryTrigger]` throws NG0200 unless it sits behind an `@if`; a legacy `QueryForm` that
does not `observe()` never updates `value`/`changes$`; `TrackingEventDataMap` resolves
`'tokenRefreshSuccess'` through its `` `${string}Success` `` branch, so the handler is mistyped;
`silenceMissingWithArgsFeatureError` together with `withArgs` throws, which no page mentions.

Harness gaps the pass reported, none fixed: `fake-api` logs no outgoing `HttpRequest` and emits
download progress only, all in the tick the response lands in (`http-lifecycle` carries a local
`HttpHandler` stand-in for both); `s.auth()` is hard-wired to the scenario's own client ref, so a
second authenticated tab is not expressible; `Scenario` cannot observe live query instances
(`batching` uses the devtools registry); the ws test double exposes no `withCredentials`;
`s.consumer()` takes no providers; there is no supported way to run a block in production mode; the
harness captures `console.error` but not `console.warn`.

## Wave 6 (2026-09-05)

The trees wave 5 never read: `legacy`, `gql`, `ws`, `pipes`, `query-form-signals`, `persistence` and
the signal-forms surface. Three scan agents produced `.claude/handoffs/wave6-scan-legacy-gql.md`,
`wave6-scan-ws-forms.md` and `wave6-scan-persistence-forms.md` - 4 High, 12 Medium, 14 Low. Every
High is fixed, each with a scenario that was red first.

- **A cancelled execution never settled.** `HttpRequest.abort()` cleared `loading` but wrote no error
  and emitted no terminal event, so `executeUntilSettled` stayed pending forever and a submitted form
  never left `submitting()` - disabled, no error, no retry, reload only. Two ordinary paths reached
  it: the devtools evict button, and `unbindAllSecure()`, which every logout runs. A cancelled
  execution now reports a terminal failure carrying a new `HttpCancelEvent`, code `0` and the message
  "The request was cancelled."; `validateWithQuery` aborts the round it abandons. This also settled
  the parked `dependent-queries.md:119` claim, which is now a passing test and a corrected sentence.
- **The signals query form re-parsed its own URL write.** The skip guard compared `<` where the newest
  write is `===`, so a `searchQueryField` holding `'2024'` committed the string and then the number -
  the declared type is `string | null`, so a `.trim()` on it throws. A `dateQueryField` lost up to
  999 ms, and one `setValue` fired three requests. Three more form defects landed with it:
  `skipFields` survives an `isResetBy` reset, the committed value moves without `observe()`, and
  `appendToUrl: false` leaves a foreign param alone.
- **A second `execute()` on an in-flight interop query** aborted the first request and sent a
  duplicate; `V2Query` makes it a no-op unless `cancelPrevious: true`. A double-clicked submit
  cancelled a request the server may already have accepted, then repeated it.
- **`[etInfinityQuery]` with an interop creator** threw ET950 on its first page, and its config had no
  `injector` field, so a consumer could not obey the documented rule. `InfinityQueryConfig` takes an
  optional `injector` now and the directive supplies its own by default.

Open: every Medium and Low in the three wave 6 files, plus the `## Unverified` section of each.

# query-a — DX scan 2026-10-02

Scope: `libs/query/src/lib/http` (client, creators, features, repository/cache, stacks, groups,
snapshots), `libs/query/src/lib/gql`, `libs/query/src/lib/devtools` (the hook surface), checked
against `apps/docs/query/{index,queries,http,features,caching,gql,stacks,groups,errors}.md`.
Not covered: auth, ws, query-form, testing utilities (query-b), legacy.

| ID    | Sev    | Kind | Decision | Title                                                                                                         |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------------------------- |
| QA-01 | High   | bug  | no       | `withResponseUpdate` writes the transformed response into `rawResponse`, so it breaks every GQL query — fixed |
| QA-02 | High   | bug  | no       | GQL `execute()` / `reset()` are not untracked, so calling them in an effect loops — fixed                     |
| QA-03 | Medium | bug  | yes      | Request options of the first creator to create a cache entry apply to every query sharing it                  |
| QA-04 | Medium | dx   | no       | Route error codes `ET001`/`ET002` collide with query core codes; four ranges are undocumented — fixed         |
| QA-05 | Medium | dx   | no       | A `baseUrl` ending in `/` passes `createQueryClient` and throws on every request — fixed                      |
| QA-06 | Medium | dx   | yes      | A bare `execute()` on a parked `withArgs` query sends null args or throws `ET003`                             |
| QA-07 | Medium | dx   | no       | Docs and JSDoc examples that do not compile (`await q.execute({ body })`, `withResponseUpdate`) — fixed       |
| QA-08 | Medium | dx   | no       | Creating a query outside an injection context fails with a raw `NG0203` that does not name `injector` — fixed |
| QA-09 | Medium | bug  | no       | Every query and every snapshot eagerly creates 10 `toObservable` effects — open                               |
| QA-10 | Low    | dx   | no       | Duplicate client `name`s are not detected, though the name keys sync, persistence and devtools — fixed        |
| QA-11 | Low    | dx   | no       | `invalidateQueries({ url: 'players' })` without a leading slash silently matches nothing — fixed              |
| QA-12 | Low    | dx   | no       | `silenceUncacheableAllowCacheError` is a public `QueryConfig` option that apps must not set — fixed           |
| QA-13 | Low    | dx   | yes      | About 165 devtools-contract exports share the main `@ethlete/query` barrel                                    |
| QA-14 | Low    | dx   | no       | Docs drift: `ReadonlyQuery` also omits `abort`; polling features are allowed on GQL queries — fixed           |

## QA-01 `withResponseUpdate` writes the transformed response into `rawResponse`, so it breaks every GQL query

- Where: `libs/query/src/lib/http/query-features.ts:801-825` (`context.state.rawResponse.set(response)`),
  `libs/query/src/lib/http/query-state.ts:193-212` (`transformed` runs `transformResponse` on `rawResponse`),
  `libs/query/src/lib/gql/gql-query-creator.ts:58` (every GQL creator defaults `transformResponse` to `unwrapGqlResponse`).
- Problem: the updater receives `currentResponse` (the transformed `ResponseType`) and returns a
  `ResponseType`, but the feature stores it in `state.rawResponse`. `transformResponse` then runs on it again:
  - On any GQL query: `unwrapGqlResponse(updatedData)` finds no `data` key and throws `ET600`. `error()` turns
    into the ET600 failure and `response()` keeps the old value. The update is never shown. This is the
    websocket + GQL pattern that `features.md` ("made for pushing websocket messages") and `ws.md` advertise.
  - On an HTTP creator with `transformResponse: (raw) => raw.data`, `response()` becomes `updated.data`, which
    is usually `undefined`.
  ```ts
  const match = getMatchGql(
    withArgs(() => ({ variables: { id } })),
    withResponseUpdate({ updater: ({ currentResponse }) => ({ ...currentResponse!, score: 3 }) }),
  ); // -> error() is ET600, response() is unchanged
  ```
  No spec or scenario combines `withResponseUpdate` with a `transformResponse`.
- Fix: write the updater's value as the _transformed_ response and bypass the transform. For example, add a
  `responseOverride` linked signal in `query-state.ts` that `response` prefers until the next settled raw
  response, and have `withResponseUpdate` set it. Do not type the updater over `RawResponseType`: the docs and
  `currentResponse` both promise the consumer shape. Add a scenario in `features.scenario.spec.ts` for an
  HTTP creator with `transformResponse` and for a GQL query.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## QA-02 GQL `execute()` / `reset()` are not untracked, so calling them in an effect loops

- Where: `libs/query/src/lib/gql/gql-query-execute.ts:38-91`. Compare `libs/query/src/lib/http/query-execute.ts:48-59`
  and `secure-query-execute-factory.ts:320-327`, which commit `88d8becb3` ("Run execute() and reset() untracked so
  an effect calling them does not loop") fixed. That commit did not touch the public GQL execute.
- Problem: `exec` reads `state.args()`, the repository and `previousKey`, and writes `state.request`, all inside
  the caller's reactive context. `effect(() => { this.term(); gqlSearch.execute(); })` therefore tracks the query's
  own state. The effect re-runs whenever the query changes, and once it repeats with identical args it hits
  `ET800`. `queries.md:127` says executing inside an effect is fine. The same code with an HTTP or secure GQL
  creator works. `reactive-contract.scenario.spec.ts` covers HTTP, secure, stacks and auth, but not GQL.
- Fix: wrap `exec` and `reset` in `untracked` like `query-execute.ts`. Add a GQL case to the
  `v3 execute() and reset() inside an effect` block of `reactive-contract.scenario.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## QA-03 Request options of the first creator to create a cache entry apply to every query sharing it

- Where: `libs/query/src/lib/http/query-repository.ts:530-603`. The cache key is route + method + body + headers,
  and on a hit (`:561-587`) the existing `request` is reused. `createHttpRequest` (`http-request.ts:412-423, 682`)
  captured the creator's `responseType`, `withCredentials`, `reportProgress`, `transferCache` and `reportErrors`,
  and `retryFn` (`query-repository.ts:601`), when the entry was created.
- Problem: `caching.md` says "Two creators can share one cache entry (same route and args)" and handles their
  `tags`, but every other creator option silently comes from whichever query mounted first. The docs' own
  `.clone()` example (`queries.md:129`, `query-creator.ts:245-255`) is the plain case:
  ```ts
  const getPostNoRetry = getPost.clone({ retryFn: () => ({ retry: false }) });
  // component A uses getPost, component B uses getPostNoRetry, same postId:
  // B's retry policy and reportErrors are whichever of A/B executed first.
  ```
  The same goes for a `responseType: 'blob'` download creator and a JSON creator on one URL, where one of them
  gets the other's body type, and for `reportErrors: false` on one of two creators.
- Fix (needs a choice): (a) hash the wire-shaping options (`responseType`, `withCredentials`) into the cache key,
  so those never share; and (b) for the policy options (`retryFn`, `reportErrors`, `reportProgress`), either key
  by them too or resolve them per consumer at settle time. At least document the rule in `caching.md`
  ("Deduplication") and on `clone()`.
- Breaking: no (a cache-key change only). Decision: yes. Should policy options split the entry or stay shared?

## QA-04 Route error codes `ET001`/`ET002` collide with query core codes; four ranges are undocumented

- Where: `libs/query/src/lib/http/internal/request-route.ts:8-28` (`INVALID_BASE_ROUTE: 1`, `INVALID_ROUTE: 2`,
  `PATH_PARAMS_MISSING_IN_ROUTE_FUNCTION: 3`) against `libs/query/src/lib/http/query-errors.ts:5-9`
  (`QUERY_CREATED_IN_REACTIVE_CONTEXT: 1`, `INVALIDATES_USED_ON_READ: 2`). The table is at `apps/docs/query/errors.md:278-293`.
- Problem: `ET001` means both "query created in a reactive context" (as `queries.md:127` documents it) and
  "baseRoute must not end with a slash", and `ET002` means both "`invalidates` on a read" (`caching.md`) and
  "route must start with a slash". The docs say "the codes exist so you can grep for them", but grepping
  `ET001` finds the wrong one. `RouteRuntimeErrorCode` is not in `QueryRuntimeErrorCode`, so a spec cannot
  assert on it by name the way `errors.md:293` promises. The table at `errors.md:282-291` also leaves out
  1–3 (routes), 250 (client feature used twice), 300–301 (`key`/`allowCache` on an uncacheable request) and
  700–701 (secure execute). The route messages also do not say how to fix the problem, and they call
  `baseUrl` "baseRoute".
- Fix: move the route codes into `QueryRuntimeErrorCode` under free numbers (e.g. `INVALID_BASE_URL: 10`,
  `INVALID_ROUTE: 11`, `PATH_PARAMS_MISSING_IN_ROUTE_FUNCTION: 12`). Rewrite the messages with the fix in them,
  e.g. `` `The client baseUrl "${base}" must not end with "/" - drop the trailing slash.` ``. Add the missing
  rows to `errors.md`.
- Breaking: yes (renumbered codes). Decision: no.
- Status: fixed
- Review: ok

## QA-05 A `baseUrl` ending in `/` passes `createQueryClient` and throws on every request

- Where: `libs/query/src/lib/http/internal/request-route.ts:203-205` (checked in `buildRoute`, i.e. per request).
  `libs/query/src/lib/http/query-client.ts:238-330` never validates `options.baseUrl`.
- Problem: `createQueryClient({ name: 'api', baseUrl: 'https://api.example.com/v1/' })` is accepted. The first
  query then throws `ET001: The baseRoute must not end with a slash` from inside the `withArgs` effect or the
  creator call, far from the misconfiguration, and it throws again on every execution. A trailing slash is the
  most common way to write a base URL.
- Fix: validate in `createQueryClient`'s factory (or strip the slash in dev mode with a warning), and keep the
  `buildRoute` check as a guard. Use the reworded message from QA-04.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## QA-06 A bare `execute()` on a parked `withArgs` query sends null args or throws `ET003`

- Where: `libs/query/src/lib/http/query-execute.ts:50-59` (`args = state.args()` with no null check),
  `libs/query/src/lib/http/query-execute-utils.ts:67-106`, and `request-route.ts:209-212`. The features guard
  this case themselves, e.g. `withAutoRefresh` at `query-features.ts:745-748` and `withPolling`.
- Problem: the docs teach parking (`withArgs(() => ready() ? args : null)`, `features.md` and
  `dependent-queries.md`), and they teach `.execute()` as the way to send a mutation's current args. Combined:
  - A function route, e.g. `withArgs(() => (this.id() ? { pathParams: { id: this.id() } } : null))` with a
    "Retry" button calling `execute()`: the click handler throws `ET003` synchronously.
  - A static route, e.g. `save()` with `withArgs(() => (form.valid() ? { body: form.value() } : null))`: it sends
    a `POST` with no body, and the server's 400/422 is all the developer sees.
- Fix (needs a choice): when `state.subtle.hasArgsSource()` is true and the resolved args are `null` with no
  explicit `args`, either make `execute()` a no-op with a dev-mode `console.warn` that names the route and says
  "the withArgs source returned null (parked)", or throw a new `ET1xx`. Document the result under `withArgs`.
- Breaking: only if it throws. Decision: yes. No-op + warn, or throw?
- Note: since the QA-04 fix, the path-params error this finding calls `ET003` is `ET012`; `ET003` now means a query created outside an injection context.
- Status: fixed (2026-10-06: no-op with a dev-mode warning on all four execute paths; documented under `withArgs`)

## QA-07 Docs and JSDoc examples that do not compile (`await q.execute({ body })`, `withResponseUpdate`)

- Where:
  - `apps/docs/query/caching.md:79`, `apps/docs/query/multi-tab.md:119` and the
    `libs/query/src/lib/http/query-client.ts:191` JSDoc all show `await createPlayer.execute({ body });`.
    `execute` returns `void` (`query-execute.ts:39`) and takes `{ args: { body } }`. As written, `invalidateQueries`
    would run before the mutation settles.
  - `libs/query/src/lib/http/query-features.ts:779-794`, the `withResponseUpdate` JSDoc, shows
    `withArgs(() => ({ matchId: 1 }))` (not `pathParams`) and `withResponseUpdate(({ currentResponse }) => …)`,
    but the API takes `{ updater }`.
- Problem: an app developer copying the invalidation example ends up with a race, and the IDE hover for
  `withResponseUpdate` shows a call that fails to type-check.
- Fix: use `await executeUntilSettled(createPlayer, { args: { body } });` in the three invalidation examples.
  Rewrite the JSDoc example as `withArgs(() => ({ pathParams: { matchId: 1 } }))` and
  `withResponseUpdate({ updater: ({ currentResponse }) => … })`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## QA-08 Creating a query outside an injection context fails with a raw `NG0203` that does not name `injector`

- Where: `libs/query/src/lib/http/query-dependencies.ts:52` (`options.queryConfig?.injector ?? inject(Injector)`).
  The same bare `inject` is in `query-stack.ts` (`createQueryStack`) and `query-group.ts:71`.
- Problem: calling a creator in `ngOnInit`, a click handler or a `setTimeout`, which are typical first attempts
  ("create the query when the dialog opens"), throws Angular's generic `NG0203: inject() must be called from an
injection context…`. The stack trace points into `@ethlete/query` internals. The error does not mention the
  `{ injector }` `QueryConfig` option (`queries.md:125`), which is the fix. Legacy interop already has a good
  message for the same case (`query-errors.ts:279-297`, `ET950`).
- Fix: in `setupQueryDependencies`, when no `queryConfig.injector` is given, check
  `assertInInjectionContext`-style (or catch `NG0203`) and throw a new `ET0xx`: "A query was created outside an
  injection context. Create it in a field initializer or constructor, or pass `{ injector }` as the first creator
  argument: `getPost({ injector: this.injector }, withArgs(...))`." Do the same in `createQueryStack`,
  `createPagedQueryStack` and `createQueryGroup`, adapting the hint.
- Breaking: no. Decision: no.
- Status: fixed
- Review: fixed the ET003 factory moved out of the public barrel into internal/inject-in-query-context.ts

## QA-09 Every query and every snapshot eagerly creates 10 `toObservable` effects

- Where: `libs/query/src/lib/http/observable-signal.ts:17` (`const default$ = toObservable(source, …)` runs at
  wrap time). Called 10× per query (`base-query-factory.ts:157-166`) and 10× per snapshot (`query-snapshot.ts:143-155`).
- Problem: `toObservable` creates an effect and a `ReplaySubject` immediately, whether or not anyone ever calls
  `.asObservable()`. A component with one query creates 10 effects that are scheduled and run on creation. A
  50-row `createQueryStack` creates 500. Every `createSnapshot()`, including the ones `executeUntilSettled`,
  `createQueryGroup.succeeded$` and batches make per execution, creates 10 more. Almost all apps read the signals
  and never call `asObservable()`.
- Fix: create `default$` lazily on the first `asObservable()` call, inside `untracked` (the override path already
  does this), and memoize it. The existing `observable-signal.spec.ts` cases still apply. Add one asserting that no
  effect is created until `asObservable()` is called.
- Breaking: no. Decision: no.
- Status: open: lazy `toObservable` changes the first emission from a synchronous replay to "after the next effect flush" for anyone subscribing after creation (e.g. in `ngOnInit`); a `startWith(current)` variant reorders values when the signal changed after the last effect run. Needs a design of its own (a shared watcher instead of one effect per signal), not a contained change.

## QA-10 Duplicate client `name`s are not detected, though the name keys sync, persistence and devtools

- Where: `libs/query/src/lib/http/query-client.ts:238-330` (no check). The name is used as an identity in
  `query-client-features.ts:127` (`et-query-sync-${clientName}`), `:190` (`et-query-persistence-${clientName}`),
  and by the devtools faults, mocks and schema (`query-devtools-faults.ts:199`, `query-devtools-schema.ts:120-136`,
  `http-request.ts:444,480`).
- Problem: `queries.md:62` says "Unique name", but nothing enforces it. Two clients named `api` (e.g. a copy-pasted
  client for a second backend) share one BroadcastChannel and one IndexedDB store, and a devtools fault or mock
  armed for one also hits the other. Nothing reports any of this.
- Fix: keep a module-level `Set` of names created in the browser, and `console.warn` in dev mode when a second
  client factory with the same name runs in the same app.
- Breaking: no. Decision: no.
- Status: fixed (dev-mode warn per environment injector, so the multi-tab test pattern of one client per child injector does not warn)
- Review: ok

## QA-11 `invalidateQueries({ url: 'players' })` without a leading slash silently matches nothing

- Where: `libs/query/src/lib/http/query-invalidation.ts:66-72` (`url.startsWith('/') ? baseUrl + url : url`).
  The `url` option is typed `string` (`:32`), while routes are `` `/${string}` `` (`query-creator.ts:13`).
- Problem: `'players'` is treated as an absolute URL, matches no request and refreshes nothing, with no warning.
  The same goes for `invalidates: [{ url: 'players' }]` on a mutation creator.
- Fix: type `url` as `` `/${string}` | `${string}://${string}` ``, or in dev mode warn when the value is neither
  root-relative nor absolute.
- Breaking: only with the type change (minor). Decision: no.
- Status: fixed (type `QueryInvalidationUrl`, breaking for a plain `string` variable)
- Review: ok

## QA-12 `silenceUncacheableAllowCacheError` is a public `QueryConfig` option that apps must not set

- Where: `libs/query/src/lib/http/query-creator.ts:307-315`.
- Problem: the JSDoc says "Application code should not set this", but the option sits on the public `QueryConfig`
  next to `onlyManualExecution` and shows up in completion for every creator call. It exists only for the legacy
  interop.
- Fix: mark it `@internal` (like `scopeDestroyRef` right below it), or pass it through the interop's internals
  instead of `QueryConfig`.
- Breaking: no (legacy interop is internal). Decision: no.
- Status: fixed
- Review: ok

## QA-13 About 165 devtools-contract exports share the main `@ethlete/query` barrel

- Where: `libs/query/src/lib/devtools/index.ts` (19 modules re-exported from `libs/query/src/index.ts:2`). Of
  about 224 exports there, about 165 are not `@internal`, e.g. `setQueryDevtoolsFault`, `setQueryDevtoolsApiEnv`,
  `suppressNextQueryStackDevtools`, `noteQueryFormRead`, `QueryDevtoolsEntryMeta`.
- Problem: they are the wire between `@ethlete/query` and `@ethlete/query-devtools`, not app API (the hook's own
  JSDoc says "not a general-purpose query API"). They show up in completion next to `createGetQuery` and
  `withArgs`, and nothing in their names or docs marks them as tooling-only. They cannot be `@internal`:
  `stripInternal` is on (`tsconfig.lib.prod.json`) and `query-devtools` imports them.
- Fix: move the contract to a secondary entry point (e.g. `@ethlete/query/devtools-contract`) that only
  `@ethlete/query-devtools` imports. Keep `provideQueryDevtools`-facing types in the main barrel.
- Breaking: yes, for direct importers (in practice only `query-devtools`). Decision: yes (a new entry point).

## QA-14 Docs drift: `ReadonlyQuery` also omits `abort`; polling features are allowed on GQL queries

- Where:
  - `apps/docs/query/queries.md:203` says `ReadonlyQuery` is "a `Query` without `execute`, `reset`, `asReadonly`
    and `subtle`". The code also omits `abort` (`libs/query/src/lib/http/query.ts:154-157`).
  - `apps/docs/query/features.md` says `withPolling`, `withLongPolling` and `withAutoRefresh` are "Only for
    `GET`/`HEAD`/`OPTIONS` queries - anything else throws". They also accept GQL queries over either transport
    (`flags.shouldAutoExecuteMethod`, `base-query-factory.ts:54-56`), and the error messages say so
    (`query-errors.ts:109,116,131`).
- Fix: add `abort` to the `ReadonlyQuery` row, and change the three sentences to "Only for reads - `GET`/`HEAD`/
  `OPTIONS` and GraphQL queries".
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

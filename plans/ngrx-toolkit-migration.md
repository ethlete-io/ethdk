# Migrating from `@tomtomb/ngrx-toolkit`

Goal: move fifagg-frontend and vbl-frontend off `@tomtomb/ngrx-toolkit` 3.4 onto `@ethlete/query` v3 with the
same shape as the v2 path: a generator rewrites the store side, an interop layer keeps every consumer compiling
and behaving the same, and screens then move to signals one at a time.

## Exposure

| App    | Features | Action groups | Consumer files (`MappedEntityState`) | `\| suspense` | Also on query v2         |
| ------ | -------- | ------------- | ------------------------------------ | ------------- | ------------------------ |
| fifagg | 52       | 265           | 117                                  | 79            | 5.43, 101/243 routes dup |
| vbl    | 10       | 27            | 38                                   | 43            | 5.41.5, large route dup  |

- Toolkit state lives in `libs/store/src/lib/stores/<domain>/<feature>/` (fifagg) and `libs/store/<name>` (vbl).
  Every feature has the same 7 files: `actions`, `models`, `service`, `effects`, `reducer`, `selectors`, `facade`,
  plus `store-x.module.ts`.
- fifagg attaches the bearer token to toolkit calls in `libs/store/src/lib/interceptors/jwt.interceptor.ts`, read
  from `ggApiClient.authProvider$` (v2). It skips contentful URLs, `/public` and `/status`.
- The toolkit path runs after the v2 path (`migrate-to-query-v3`), or in the same upgrade. The interop needs 6.x.
- 6.x pins `@angular/core` 22.1.6 (`libs/query/package.json`). fifagg is on Angular 19.2.4, so its Angular upgrade
  comes first.
- The fifagg `jwt.interceptor.ts` must go in the same run: it adds the bearer header to every `HttpClient` call, so v3
  secure queries would get it twice and third-party calls (Bynder, Shopify) would get it too. It also reads
  `ggApiClient.authProvider$`/`tokens$`, which v3 does not have. The generator deletes it and reports its skip list.
- Per-call headers (`actionOptions.headers`, for example `_ssrHeader` in `team.service.ts`) map to per-request headers.

## Concept map

| Toolkit                                                          | v3 / interop                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ServiceBase` method + `createHttpActionGroup` + effect          | one creator on the app's client (`xGet`, `xPost`, …)                  |
| args `queryParams` (path) / `params` (query string) / `body`     | `pathParams` / `queryParams` / `body` - the generator swaps the names |
| `defineArgTypes<{ args, response }>`                             | the creator's `TArgs`                                                 |
| reducer, selectors, `EffectBase`, `store-x.module.ts`            | deleted                                                               |
| `FacadeBase.call(group, args)` → `MappedEntityState`             | interop `toolkitCall(creator, args)` → interop handle, same shape     |
| `response$`, `cachedResponse$`, `error$`, `isLoading$`, …        | handle members over the v3 query                                      |
| `refresh()`, `remove()`, `startPolling()`, `stopPolling()`       | handle methods: `execute()`, `reset()`, a polling subscription        |
| `select(group, createActionId(...)).refresh()` (other component) | handle registry keyed by creator + args hash                          |
| `\| suspense`, `\| suspenseMulti`, `NgRxToolkitModule`           | interop pipes and module with the same names                          |
| `joinLoading`, `joinErrors`                                      | interop functions with the same signatures                            |
| `onActionMergeMap` / `onActionSwitchMap`                         | v3 execution; the switch case needs a check (D3)                      |

Not used in either app, so out of scope: `sideUpdates`, `on()`/`once()`, `isPolling$`, `args$`,
`onActionExhaustMap`/`onActionConcatMap`, `StoreDebugComponent`, the Firebase error branch.

Left alone (plain NgRx): fifagg `stores/files` (upload with progress) and `stores/router`, vbl `store/router` and
`store/root`, `RouterFacade` (140 refs in fifagg). If the app has no toolkit feature left, it keeps `@ngrx/*` only
for these.

Manual (report tasks): vbl `layout` and `tournament` facades (toolkit-shaped, no HTTP state), the fifagg
`resetFeatureStore` call in `stores/bridge/proxy/proxy.facade.ts`.

## Open decisions

- **D1 Where the interop lives.** Proposal: a secondary entry point `@ethlete/query/ngrx-toolkit`, with no `@ngrx/*`
  dependency. Apps that never used the toolkit never see it.
- **D2 Handle lifetime.** The toolkit keeps every entry forever in a root store, and facades are `providedIn: 'root'`,
  so calls come from event handlers without an injection context. Proposal: the handle runs its query in the
  environment injector and keeps one handle per creator + args hash, like the toolkit's `select` memo.
- **D3 Refetch semantics.** In the toolkit, `response$` goes to `null` on every new call and `cachedResponse$` keeps
  the last value; `onActionSwitchMap` (38 uses, 5 files) aborts the previous call. The handle must copy both.
- **D4 Error shape.** `error$` gives `{ status, message, data }`, and 24 fifagg files import the toolkit `Error`
  type. Proposal: the handle maps `QueryErrorResponse` to that shape and the interop exports the type.
- **D5 Secure or public creator.** The fifagg interceptor decides by URL. Proposal: a generator option with a route
  prefix list (`--publicRoutes=/public,/status`); a secure creator elsewhere.
- **D6 Duplicate routes.** Proposal: if a creator for the same method and route exists, the facade uses it and the
  generator writes no new one. Different response types for the same route go to the report.
- **D7 `skipCache` and the GET cache.** vbl sets `cacheAdapter: () => 0`. Map `extras.skipCache` to
  `allowCache: false`; check what fifagg's client caches.
- **D8 `isUnique` and `resetFeatureStore`.** Neither app uses `isUnique`. `resetFeatureStore` has one call site; a
  report task, not an API.

## Slices

- [ ] S1 Interop handle, pipes, `joinLoading`/`joinErrors` in the new entry point. Scenarios: every handle member
      the apps use, refetch (D3), polling with a kill switch, cross-component refresh by args.
- [ ] S2 `toolkitCall` and the handle registry (D2). Scenario: the fifagg `createActionId` + `refresh()` pattern.
- [ ] S3 Generator `migrate-from-ngrx-toolkit`: creators, facade rewrite, deletion of store files and module
      wiring, the args rename, `query-toolkit-migration-tasks.md`. Specs on copies of real fifagg and vbl features.
- [ ] S4 Run it on vbl (smaller), then fifagg, in a scratch copy. Typecheck, build, and open the main screens.
- [ ] S5 Guide `apps/docs/query/migrating-from-ngrx-toolkit.md`, changeset.

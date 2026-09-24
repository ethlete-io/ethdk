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

- [x] S1+S2 Interop `@ethlete/query/ngrx-toolkit` - b8e33174a; export-coverage entry - 5e7756a26.
  - `toolkitCall(creator, args, { injector })`, `toolkitSelect`, `MappedEntityState`, `ActionCallArgs`,
    `ToolkitError`, `CallState`, `SuspensePipe`/`SuspenseMultiPipe`/`NgRxToolkitModule`, `joinLoading`/`joinErrors`.
  - 12 scenarios in `libs/query/src/scenarios/ngrx-toolkit.scenario.spec.ts`. The handle maps from
    `executionState()`, not `response()`, so the new keep-last-response default does not change `response$`.
  - Differences from the toolkit: a second call with the same args joins the in-flight request; `switchMap` does
    not cancel calls with other args; `remove()` during a request drops the late result; no `isPolling$`,
    `type$`, `entityId$`.
- [x] S3a Generator store side - 3a350896f. S3b consumer side - 253936acd; generic fixtures - 9f935392e.
  - Options: `--client`, `--clientImport` (required), `--publicRoutes`, `--serviceApiBase`, plus the
    `migrate-to-query-v3` scoping. Tasks go to `query-toolkit-migration-tasks.md`, ids `NTK-*`.
  - The interceptor is detected and reported (`NTK-AUTH-INTERCEPTOR`), not deleted.
  - Dry runs on scratch copies (after `prep-for-query-v3` + `migrate-to-query-v3`):
    vbl 8/8 features, 39 consumer files moved, 10 files left (the 2 non-HTTP facades);
    fifagg 44/49 features (the rest have tasks), 127 consumer files moved, 76 files left, all with tasks.
- [ ] S4 Real run on vbl, then fifagg, in scratch copies. Typecheck, build, and open the main screens.
- [ ] S5 Guide `apps/docs/query/migrating-from-ngrx-toolkit.md` + sidebar link.

## Continue on 2026-09-26

1. **Blocker: history rewrite before any push of `next`.** 3a350896f (and 253936acd) hold client source in
   `libs/query/generators/migrate-from-ngrx-toolkit/__fixtures__`; 9f935392e made it generic, but the old blobs
   stay in history, and `origin` is public. The user approved a rewrite of the unpushed range from 3a350896f.
   The permission classifier blocked it ("Git Destructive"), so the user must allow it or run it.
   - Script: `plans/ngrx-toolkit-rewrite.sh` (dry run by default, `--apply` moves `next` with `git update-ref`, which checks
     the old tip). Plumbing only, in a temp index: every commit that has the generator dir gets the final
     generic tree of that dir; messages, authors and dates stay. It aborts if the final tree differs.
     The first dry run failed at `git rm --cached` (it checks the working tree); the script now uses
     `update-index --force-remove`, and that version has not run yet.
   - Before `--apply`: ask ethlete-sdk-29 (and any other committing session) for a commit freeze.
   - After: `/tmp/next-rewrite-map.txt` holds old → new shas. Fix the shas cited in
     `plans/query-consumer-coverage.md` ("Continue on 2026-09-26" section) and in this file, then tell the sessions.
   - Nobody pushes `next` until this is done. ethlete-sdk-29 and ethlete-sdk-57 know.
2. **Decide:** extra keys in `toolkitSelect` / `toolkitCall` args (one real site passes `skipCache: true`, which is
   now an excess-property type error). Either the interop accepts and drops them from the hash on both sides, or
   the site gets a task. `extras.skipCache` → `allowCache: false` (D7) is still open.
3. **S4 inputs:** `tsc` of the scratch vbl copy against `dist/libs/query` is untried. D6 duplicate matching compares
   type text, so the same shape under another name counts as a mismatch (vbl reuse 9 → 5); look for false
   mismatches. Action ids passed between components (3 fifagg sites) need a hand rewrite. vbl needs Angular 22
   and the v2 run; fifagg needs Angular 19 → 22 first.
4. Rules for every subagent: fixtures generic (no client names, dirs `app-a`/`app-b`), context under 150k with a
   handoff before, commit only with `git commit -- <paths>`.

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
- **D7 `skipCache` and the GET cache.** Closed: every `toolkitCall` sends the request, so the generator drops
  `skipCache`.
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
- [x] S3a Generator store side - e9f3b4abb. S3b consumer side - 1d5eba6ef; generic fixtures - 7c035a588.
  - Options: `--client`, `--clientImport` (required), `--publicRoutes`, `--serviceApiBase`, plus the
    `migrate-to-query-v3` scoping. Tasks go to `query-toolkit-migration-tasks.md`, ids `NTK-*`.
  - The interceptor is detected and reported (`NTK-AUTH-INTERCEPTOR`), not deleted.
  - Dry runs on scratch copies (after `prep-for-query-v3` + `migrate-to-query-v3`):
    vbl 8/8 features, 39 consumer files moved, 10 files left (the 2 non-HTTP facades);
    fifagg 44/49 features (the rest have tasks), 127 consumer files moved, 76 files left, all with tasks.
- [ ] S4 Real run on vbl, then fifagg, in scratch copies. Typecheck, build, and open the main screens.
  - vbl run 2026-09-25 (scratch copy, SDK `next` dist). Blocked at the build; the app was not served.
    - Angular 20 → 22 through `nx migrate` 22.7.12 then 23.1.0 (no `angular.json`, so not `ng update`): no new
      `tsc` errors; the build had 5 Angular 22 host/template errors in app code (fixed by hand). The old
      `@ethlete/cdk` 4.x does not bundle on Angular 22, so the 6.x SDK has to come in with the update.
    - `prep-for-query-v3` + `migrate-to-query-v3`: 55 files, no generator errors. 90 new `tsc` errors from two
      causes outside the query generators: the core 5 / cdk 5 API removals (about 34, with cascades), and prebuilt
      internal packages compiled against query 5.x that import `QueryClient`, `QueryCreator`, `Query`, `AnyQuery`
      from `@ethlete/query` (about 56). prep cannot rewrite `node_modules`, and 6.x has no `QueryClient` value, so
      those packages also fail to bundle. They need a release built with prep applied.
    - `migrate-from-ngrx-toolkit`: 8/8 features, 22 creators, 5 reused, 39 consumer files, 48 files deleted, 7
      tasks. 16 new errors, all from one generator gap: a non-HTTP facade imports `FacadeBase` plus
      `MappedEntityState`, and `consumers.ts:426` skips the whole file, so its handle types still come from the
      toolkit and no longer fit the migrated creators.
    - D6: 2 of 5 mismatches are false. One differs only in `number` vs `number | null` on optional members, one
      in a named alias whose sort union is a superset. Both are safe to reuse (the toolkit args are assignable).
      The other 3 are real (missing sort params, one response is an array on one side and a single object on the
      other).
    - Proposed: move the interop names in store-side files instead of skipping them (`consumers.ts:426`); compare
      D6 args after resolving aliases and normalising `| null` on optional members, or by assignability
      (`creators.ts` `decideReuse`); report installed packages whose `.d.ts` import the renamed v2 names
      (prep or `migrate-to-query-v3`). Open: S4 must also run `@ethlete/core:migrate-to-v5` and
      `@ethlete/cdk:migrate-to-v5` to reach a build. Whether `migrate-from-cdk` belongs in the run is a decision.
  - S4 run 2, 2026-09-25 (SDK `a90b33106`, dist copied to `/tmp/s4-dist`; scratch commits `ccbffac`..`af54e69` on
    top of step 1c, logs `/tmp/s4-vbl-logs/run2-*`). Steps: core `migrate-to-v5`, cdk `migrate-to-v5` (no
    `migrate-from-cdk`, user decision), `prep-for-query-v3`, `migrate-to-query-v3`, `migrate-from-ngrx-toolkit`.
    `migrate-to-query-v3` has to run before the toolkit generator, which needs the v3 client helpers.
    - Generators: no errors. The toolkit generator: 8/8 features, 20 creators written, 7 reused, 40 consumer files,
      48 files deleted, 6 tasks (2 `NTK-FACADE-WITHOUT-HTTP`, 3 `NTK-DUPLICATE-ROUTE-MISMATCH`, 1
      `NTK-UNSUPPORTED-IMPORT` for the `FacadeBase` import that is left in a non-HTTP facade).
    - Cause C is gone: the non-HTTP facade now takes `MappedEntityState`/`ToolkitError` from the interop and keeps
      `FacadeBase` on the toolkit. Zero errors in the store libs.
    - D6 is fixed: the 2 false mismatches are now reused (`getContent`, `getMatchResults`), and the 3 left are the
      real ones.
    - Cause B: prep now names the 4 prebuilt internal packages and the v2 names each imports. It is still the hard
      blocker. One package's FESM imports the `QueryClient` value, so the bundle cannot link. In `tsc` it shows up as
      20 `TS7006` implicit-any errors (creators typed with v2 `QueryCreator`) and 5 `_updateBaseRoute` errors on a
      package's client.
    - `tsc` (57 projects): 129 unique errors. 93 were already there before the SDK update (story files: `Story`,
      `HttpClientModule`, missing mdx/modules). Of the 36 new ones, 25 are cause B. The other 11 do not come from
      the query generators:
      - Defect: after core `migrate-to-v5` renames `ProvideThemeDirective` → `ProvideColorDirective`, cdk
        `migrate-to-v5` does not move the import, because `THEMING_EXPORTS` in
        `libs/cdk/generators/migrate-to-v5/color-themes.ts` only lists the old name. Result: 9 files
        `import { ProvideColorDirective } from '@ethlete/cdk'` (TS2459). Repro: that import alone, run cdk
        `migrate-to-v5`, and it stays unchanged.
      - Gap: core 5 removed `Memo` and `StringTemplate` (experimental props module, 4c49a55d3). Core `migrate-to-v5`
        neither rewrites nor reports them, and no changeset names them. 1 site each.
      - Manual: `@ethlete/types` 2.x makes `MatchListView.startTime` `string | null` (1 site).
      - Manual: cdk `migrate-to-v5` drops `@ethlete/theming` from `package.json`, so `yarn install` is needed. It
        was skipped here because the SDK comes from the dist copy.
    - Build: the libs stop at `queries` (`StringTemplate`) and `uikit-matches` (`Memo`). The apps fail on the same
      errors plus the cause B errors (producer 37 error lines, public and widgets 2 each). Bundling is not reached,
      and the app was not served.
- [ ] S5 Guide `apps/docs/query/migrating-from-ngrx-toolkit.md` + sidebar link.

## Continue on 2026-09-26

1. **Done:** the unpushed history from the S3a commit was rewritten on 2026-09-25 (plumbing, `plans/ngrx-toolkit-rewrite.sh`), so no commit holds client code. Cited shas in the plans were updated. `next` may be pushed again.
2. **Done (user decision 2026-09-26):** the generator drops `skipCache` from `toolkitSelect` args, and the interop hashes
   only the keys that reach the request, so a facade that passes wider args still shares the handle. D7 is moot: every
   `toolkitCall` sends the request.
3. **S4 inputs:** `tsc` of the scratch vbl copy against `dist/libs/query` is untried. D6 duplicate matching compares
   type text, so the same shape under another name counts as a mismatch (vbl reuse 9 → 5); look for false
   mismatches. Action ids passed between components (3 fifagg sites) need a hand rewrite. vbl needs Angular 22
   and the v2 run; fifagg needs Angular 19 → 22 first.
4. Rules for every subagent: fixtures generic (no client names, dirs `app-a`/`app-b`), context under 150k with a
   handoff before, commit only with `git commit -- <paths>`.

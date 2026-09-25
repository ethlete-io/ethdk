# Migrating from `@tomtomb/ngrx-toolkit`

A walkthrough of moving a workspace off `@tomtomb/ngrx-toolkit` onto the current query system. It follows the same shape as the [v2 migration](/query/migrating-from-v2): a generator rewrites the store side, an interop entry point (`@ethlete/query/ngrx-toolkit`) keeps every consumer compiling and behaving the same, and screens move to signals one at a time afterwards.

The order is: **upgrade core and cdk → prepare and migrate the v2 client → run this generator → work the task file → migrate screens**.

## What the generator does

Every toolkit feature is a folder of `actions`, `models`, `service`, `effects`, `reducer`, `selectors` and `facade` files plus a `StoreModule.forFeature` / `provideState` registration. For each feature it can read, the generator:

| Toolkit                                                      | After the run                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `ServiceBase` method + `createHttpActionGroup` + effect      | one creator on your v3 client (`apiGet`, `apiPostSecure`, …) in `<feature>.queries.ts` |
| args `queryParams` (path) / `params` (query string) / `body` | the creator's `pathParams` / `queryParams` / `body`                                    |
| reducer, selectors, effects, service, actions, registration  | deleted                                                                                |
| `FacadeBase.call(group, args)` returning `MappedEntityState` | `toolkitCall(creator, args, { injector })` returning a handle of the same shape        |
| `select(group, createActionId(...)).refresh()`               | `toolkitSelect(creator, args, { injector }).refresh()`                                 |
| `\| suspense`, `\| suspenseMulti`, `NgRxToolkitModule`       | the interop pipes and module, same names                                               |
| `joinLoading`, `joinErrors`, the toolkit `Error` type        | the interop functions, and `ToolkitError`                                              |

Consumer files that import `MappedEntityState`, `ActionCallArgs`, the pipes or the join helpers get their import moved from `@tomtomb/ngrx-toolkit` to `@ethlete/query/ngrx-toolkit`. The facade keeps its class, its name and its methods, so components that inject it do not change.

`skipCache` in `actionOptions.extras` is dropped: every `toolkitCall` sends the request.

Plain NgRx state that is not a toolkit feature (a router store, an upload store with progress) is left alone. If nothing else needs it, remove `@ngrx/*` and `@tomtomb/ngrx-toolkit` from `package.json` once the task file is empty.

## 1. Upgrade core and cdk first

The interop needs `@ethlete/query` 6.x, which needs the current Angular major. An app still on `@ethlete/core` / `@ethlete/cdk` 4.x cannot build against it, so run their v5 migrations in the same upgrade:

```bash
yarn nx g @ethlete/core:migrate-to-v5
yarn nx g @ethlete/cdk:migrate-to-v5
```

See [core](/core/#also-in-the-package) and [cdk](/cdk/#migrating-from-v4). Skip this step if the app is already on v5.

## 2. Prepare and migrate the v2 client

The generator writes creators on a v3 client, so the client and its generated helpers must exist:

```bash
yarn nx g @ethlete/query:prep-for-query-v3
yarn nx g @ethlete/query:migrate-to-query-v3
```

`prep-for-query-v3` warns about installed packages whose `.d.ts` files import a renamed v2 name (`QueryClient`, `QueryCreator`, ...) from `@ethlete/query`. No codemod can rewrite `node_modules`: run the prep in that package's own repository and release a rebuild before you continue. The [v2 migration guide](/query/migrating-from-v2) covers the rest of this step, including the HTTP interceptor audit.

## 3. Run the generator

```bash
yarn nx g @ethlete/query:migrate-from-ngrx-toolkit \
  --client=apiClient \
  --clientImport=@app/queries \
  --publicRoutes=/public,/status
```

| Option             | Required | What it does                                                                                                                                          |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--client`         | yes      | The v3 client the creators are built on (or its `…Config`). Its helpers (`apiGet`, `apiPostSecure`, …) must exist, or the run stops.                  |
| `--clientImport`   | yes      | Where the helpers are imported from: a module specifier (`@app/queries`) or a workspace file (`libs/queries/src/lib/api.client.ts`).                  |
| `--publicRoutes`   | no       | Comma-separated route prefixes that get the public helper. Every other route gets the secure one. Without it every creator uses the public helper.    |
| `--serviceApiBase` | no       | The `ServiceBase` API base the client points at, as written in the services (`environment.apiBaseURL`). Required when the services use more than one. |
| `--projects`       | no       | Nx projects to migrate. Defaults to the whole workspace.                                                                                              |
| `--include`        | no       | Path prefixes to migrate (`libs/store`). Unioned with `--projects`.                                                                                   |

The run prints how many features it converted, how many creators it wrote and reused, and how many consumer files it moved, then writes **`query-toolkit-migration-tasks.md`**. Read that file before the diff. Task ids are stable, so a re-run produces a list you can diff against the last one.

Most tasks that say "the feature was left on the toolkit" are resolved by fixing the cause and running the generator again. A re-run only touches the features still on the toolkit.

### Creators that already exist are reused

Apps that were also on the v2 client often have a creator for the same route already. If one exists with the same method, route, path params and response type, and the toolkit args are assignable to its args, the feature re-exports that creator instead of writing a second one. Assignable means TypeScript's check, after resolving aliases and intersections, with `T | null` on an optional member counted as `T`. So a named alias of the same shape, or a sort union that is a superset of the toolkit's, still reuses.

If the types really differ (a missing query param, an array response on one side and an object on the other), the generator writes a second creator and reports `NTK-DUPLICATE-ROUTE-MISMATCH`.

## 4. Check the result

- `tsc` over every affected project, then the build. `vitest` does not typecheck.
- Open the main screens. Loading, errors, and a `refresh()` from another component are what the interop has to get right.
- Search for `@tomtomb/ngrx-toolkit` imports. Each one left should have a task in the file.
- Delete the bearer token interceptor if the app has one (`NTK-AUTH-INTERCEPTOR` below). Leaving it sends the token twice on secure queries and to third-party hosts.

## The tasks and how to resolve them

### Features left on the toolkit

The feature is untouched. Fix the cause, then re-run the generator.

| Task                        | Cause and fix                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NTK-MIXED-ACTIONS`         | The actions file has plain NgRx actions besides the action groups. Move them, and the facade members that dispatch them, out of the feature.                                                   |
| `NTK-CUSTOM-EFFECT`         | An effect does more than `onAction*`. Move it out, or rewrite it on the v3 creator.                                                                                                            |
| `NTK-CUSTOM-REDUCER`        | The reducer holds state besides the toolkit slice. Move that state to its own store or a signal.                                                                                               |
| `NTK-ACTION-WITHOUT-EFFECT` | No effect sends the group to the service, so the request is unknown. Wire it up or delete the group.                                                                                           |
| `NTK-SERVICE-UNSUPPORTED`   | The service method is not a plain `return this.get(...)`. Rewrite it to `return this.get\|post\|put\|patch\|delete({ apiRoute, httpOpts: args, responseType })`, or write the creator by hand. |
| `NTK-SERVICE-API-BASE`      | The service talks to another API base than `--serviceApiBase`. Write the creator by hand on the client for that API.                                                                           |
| `NTK-ARGS-UNRESOLVED`       | The args type is not an interface or type literal with `queryParams` / `params` / `body`. Declare it that way in the models file.                                                              |
| `NTK-FACADE-STORE-MEMBER`   | A facade member or its constructor uses the NgRx store (a `resetFeatureStore` dispatch, for example). Rewrite or remove it. A reset usually becomes `remove()` on the handles.                 |

### Converted, but check by hand

| Task                           | What to do                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NTK-SERVICE-HEADERS`          | The service added request headers the creator does not send. Pass them per call in `actionOptions.headers`, or add them to the client's `headers`.                 |
| `NTK-SERVICE-CACHE-EXPIRY`     | The service cached the response for `cacheExpiresIn` seconds. The creator requests again on every call. Decide whether the screen needs a cache.                   |
| `NTK-ARGS-INHERITED`           | The args type extends another type, and only its own members were mapped. If the base adds `queryParams`, `params` or `body`, add them to the creator's type.      |
| `NTK-DUPLICATE-ROUTE-MISMATCH` | A second creator was written for a route that already had one. Align the types, keep one, and re-export it from the feature's queries file.                        |
| `NTK-STORE-FILE-KEPT`          | Code outside the feature still imports its reducer, effects, selectors, service or actions. Rewrite that code, then delete the store files and their registration. |

### Consumers

| Task                           | What to do                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NTK-UNSUPPORTED-IMPORT`       | The file still imports names the interop does not export. Rewrite the code that uses them and drop the import. A file that imports interop names together with store-side names (`FacadeBase` next to `MappedEntityState`) gets the interop names moved and keeps the rest with this task. |
| `NTK-UNCONVERTED-ACTION-GROUP` | A `MappedEntityState` / `ActionCallArgs` type names an action group whose feature is still on the toolkit, so the file was left alone. Resolve that feature's task, then re-run.                                                                                                           |
| `NTK-SELECT-BY-ACTION-ID`      | A handle is looked up by an action id that the generator could not trace back to its args. The interop has no action ids: pass the args to where the handle is needed and call `toolkitSelect(creator, args, { injector })`.                                                               |
| `NTK-AUTH-INTERCEPTOR`         | An interceptor attaches the bearer token to every `HttpClient` call. Secure creators already send it. Delete the interceptor and its registration. Routes it skipped must use public creators: add their prefixes to `--publicRoutes` and re-run.                                          |

### Leftovers

| Task                      | What to do                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NTK-FACADE-WITHOUT-HTTP` | A facade extends `FacadeBase` but has no action groups. Drop `FacadeBase` and its store wiring once nothing reads its state. |
| `NTK-COMMENTED-FEATURE`   | The feature only exists as comments. Delete the folder or restore it.                                                        |

## How the interop behaves

A handle is one v3 query per creator and args. It lives as long as the injector passed in, which for a `providedIn: 'root'` facade is the application. The generator adds `private injector = inject(Injector)` to each facade, because facade methods are called from event handlers with no injection context.

```ts
@Injectable({ providedIn: 'root' })
export class TeamFacade {
  private injector = inject(Injector);

  getTeam(args: ActionCallArgs<typeof getTeam>) {
    return toolkitCall(getTeam, args, { injector: this.injector });
  }
}
```

- **Args identify a handle by the request only.** The key is built from `queryParams`, `params` and `body`, in any key order. Anything else in the args, `actionOptions` included, does not count. So a facade that passes wider args still gets the handle another component created, and `toolkitSelect(...).refresh()` re-runs it.
- **`response$` and `cachedResponse$` keep their toolkit meaning.** `response$` goes to `null` when a new call starts, and `cachedResponse$` keeps the last response.
- **Errors keep the toolkit shape.** `error$` emits `{ status, message, data }` as `ToolkitError`.
- **A second call with the same args joins the one in flight** instead of sending another request.
- **Calls with other args are not cancelled.** A toolkit `onActionSwitchMap` aborted the previous call of the group; each args set is its own query now. Check screens that relied on that.
- **`remove()` during a request drops the late result.**
- **Not in the interop:** `isPolling$`, `type$`, `entityId$`, action ids, `sideUpdates`, `on()` / `once()`. They show up as `NTK-UNSUPPORTED-IMPORT` where used.

## 5. Migrate screens

The handle is a bridge. A screen is done when it reads a v3 query as signals and no longer injects the facade. See [queries and creators](/query/queries). The creators the generator wrote are ordinary v3 creators, so the screen can use them directly. When the last consumer of a facade is gone, delete it and its `models` file.

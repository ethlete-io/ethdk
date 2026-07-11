# Legacy client (V2)

The class-based `V2QueryClient` is the predecessor of the [current query system](/query/queries).

::: warning Maintenance mode
The legacy client only receives bug fixes. Don't use it for new code — this page exists for teams maintaining existing apps and as a [migration map](#migrating-to-the-current-system).
:::

Unlike the current system, the legacy client is instantiated directly (no DI provider) and its state is RxJS-first:

```ts
import { V2QueryClient, def } from '@ethlete/query';

export const client = new V2QueryClient({ baseRoute: 'https://api.example.com/v1' });

export const getPost = client.get({
  route: (p) => `/posts/${p.postId}`,
  types: {
    args: def<{ pathParams: { postId: string } }>(),
    response: def<Post>(),
  },
});
```

```ts
// consume via RxJS…
const post$ = getPost
  .prepare({ pathParams: { postId: '1' } })
  .execute()
  .state$.pipe(filterSuccess());

// …or via the signal helpers
postQuery = toQuerySignal(getPost.prepare({ pathParams: { postId: '1' } }).execute());
post = queryStateResponseSignal(this.postQuery);
```

## How it works

- **Query creators** come from the client's method helpers: `get`, `post`, `put`, `patch`, `delete`, `gqlQuery`, `gqlMutate`.
- `.prepare(args)` builds a `V2Query` (returning a cached instance for cacheable methods); `.execute()` runs it. Creators also offer `createSignal()` / `createSubject()` containers with automatic lifecycle handling.
- A query moves through the states `Prepared → Loading → Success | Failure | Cancelled`, published on `state$`. Helper operators (`filterSuccess()`, `filterFailure()`, `takeUntilResponse()`, `switchQueryState()`, …) and the `queryState*Signal` helpers unwrap it.
- **Caching**: `GET`, `OPTIONS`, `HEAD` and GraphQL queries are cached with a TTL from response cache headers. Expired unused queries are garbage-collected every 15 seconds.
- **Auto-refresh**: queries in use re-execute on window focus (`autoRefreshQueriesOnWindowFocus`, default `true`), and _smart polling_ (`enableSmartPolling`, default `true`) pauses `poll()` intervals while the window is blurred.
- **Auth** uses its own providers passed to `client.setAuthProvider(...)`: `V2BearerAuthProvider` (JWT + refresh), `BasicAuthProvider`, `CustomHeaderAuthProvider`. Queries opt in with `secure: true`; a 401 triggers refresh-and-retry.

## Supporting features

| Feature         | What it is                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*etQuery`      | Structural directive that executes a query and exposes `$implicit` (data), `loading`, `refreshing`, `progress` and `error` in the template.                      |
| `InfinityQuery` | Infinite lists: `createInfinityQueryConfig()` + `[etInfinityQuery]` / `[etInfinityQueryTrigger]` directives.                                                     |
| `EntityStore`   | Normalized entity cache wired into queries via the `entity` config (`store`, `id`, `get`, `set`).                                                                |
| `QueryForm`     | Router-synced filter/search forms — see the [overview](/query/#also-in-the-package); works with both systems but grew up here.                                   |
| Devtools        | `<et-query-devtools>` component showing live queries and auth state (`provideQueryClientForDevtools`).                                                           |
| Interop         | `createLegacyQueryCreator({ creator })` wraps a **current-system** creator in the legacy `.prepare()/.state$` surface — useful while migrating screen by screen. |

## Migrating to the current system

| Legacy                                     | Current                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `new V2QueryClient({ baseRoute })`         | [`createQueryClient({ name, baseUrl })`](/query/queries#the-query-client)                              |
| `client.get({ route, types })`             | [`createGetQuery(client)<TArgs>(route)`](/query/http)                                                  |
| `.prepare(args).execute()`                 | [`withArgs(() => args)`](/query/features#withargs) + [auto-execution](/query/queries#auto-execution)   |
| `query.state$` + `filterSuccess()`         | [`query.response()`](/query/queries#the-query-object) (signals; `.asObservable()` when RxJS is needed) |
| `createSignal()` / `toQuerySignal()`       | The query object itself — it's already signals.                                                        |
| `query.poll({ interval })`                 | [`withPolling({ interval })`](/query/features#withpolling)                                             |
| `autoRefreshOn.windowFocus`                | No equivalent — use [`withAutoRefresh`](/query/features#withautorefresh) with your own focus signal.   |
| `InfinityQuery` / `[etInfinityQuery]`      | [`createPagedQueryStack`](/query/stacks#paged-queries)                                                 |
| `V2BearerAuthProvider` + `setAuthProvider` | [`createBearerAuthProvider`](/query/auth) + secure creator templates                                   |
| `secure: true`                             | [`createSecureGetQuery(client, authProviderRef)`](/query/http#secure-queries)                          |
| `client.gqlQuery/gqlMutate`                | [`createGqlQueryVia…` / `createGqlMutationVia…`](/query/gql)                                           |
| `EntityStore`                              | No direct equivalent — [caching](/query/caching) dedupes by request; derive shared state with signals. |

The `createLegacyQueryCreator` interop lets both worlds coexist: define new endpoints with the current system and consume them from legacy-style components until those are migrated.

### Automated migration generators

Two Nx generators automate large parts of this migration — run them in order:

```bash
yarn nx g @ethlete/query:prep-for-query-v3
yarn nx g @ethlete/query:migrate-to-query-v3
```

1. **`prep-for-query-v3`** prepares the workspace: it renames every legacy symbol that collides with the current system to its `V2`/`v2` name (`QueryClient` → `V2QueryClient`, `BearerAuthProvider` → `V2BearerAuthProvider`, `buildQueryCacheKey` → `v2BuildQueryCacheKey`, …) in all files importing `@ethlete/query`. Run it (and commit) before upgrading the package.
2. **`migrate-to-query-v3`** performs the migration itself: it converts `V2QueryClient` instances to `createQueryClient`, generates current-system creators for your legacy ones, rewrites `.prepare()` call sites, wires the [`createLegacyQueryCreator`](#migrating-to-the-current-system) interop where a full conversion isn't possible, removes legacy devtools usage — and writes a migration report listing everything it changed and what still needs manual attention.

Both accept `--skipFormat` to skip re-formatting the touched files. The generators are codemods over your source: review the resulting diff (and the report) rather than trusting it blindly.

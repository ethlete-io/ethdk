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

# Queries & creators

The fundamentals shared by every query flavor — [HTTP](/query/http) and [GraphQL](/query/gql) queries are built from the same client, creators and query objects. The system is signals-first: a query is a plain object whose state (`response`, `loading`, `error`, …) is exposed as Angular signals.

The typical setup — one client per API, one creator per endpoint, queries created inside components:

```ts
import { createGetQuery, createQueryClient, withArgs } from '@ethlete/query';

// api.ts — one client per API
export const client = createQueryClient({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

export const getQuery = createGetQuery(client);

// posts.queries.ts — one creator per endpoint
export type GetPostQueryArgs = {
  response: Post;
  pathParams: { postId: string };
};

export const getPost = getQuery<GetPostQueryArgs>((p) => `/posts/${p.postId}`);
```

```ts
// post.component.ts — a live query per component instance
@Component({/* … */})
export class PostComponent {
  postId = input.required<string>();

  postQuery = getPost(withArgs(() => ({ pathParams: { postId: this.postId() } })));

  post = computed(() => this.postQuery.response());
}
```

Whenever `postId` changes, the query re-executes automatically; identical requests from other components are [deduplicated](/query/caching) and share the same response.

## Live demo

A real query against a mocked backend — execute it, make it fail, and watch the signals. `execute (allowCache)` skips the request entirely while the cached response is still fresh:

<StoryEmbed id="query-demos-lifecycle--default" height="420px" />

## The query client

`createQueryClient(options)` returns a root-provider tuple ([`[provide, inject, token]` from `@ethlete/core`](/core/utilities#dependency-injection)). You normally never touch the tuple yourself — creators take the whole client reference, and because the token is provided in root there is nothing to register in your app config.

| Option          | Default                   | Description                                                                                                                     |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | — (required)              | Unique name, used in the injection token (`QueryClient_<name>`).                                                                |
| `baseUrl`       | — (required)              | Base URL prepended to every route, e.g. `https://api.example.com/v1`.                                                           |
| `queryString`   | —                         | Config for how query params are serialized.                                                                                     |
| `cacheAdapter`  | `extractExpiresInSeconds` | Maps response headers to a freshness TTL — see [Caching](/query/caching).                                                       |
| `retryFn`       | `shouldRetryRequest`      | Decides whether a failed request is retried — see [Errors & retries](/query/errors).                                            |
| `keepUnusedFor` | `300000` (5 min)          | How long an entry survives after its last consumer was destroyed — see [Caching](/query/caching#keeping-unused-entries-around). |

## Query creators

A query creator is a function describing one endpoint. You get one by calling a method template (like `createGetQuery(client)` — see [HTTP](/query/http) for all of them) with a route and a `TArgs` type describing the request/response. Calling the creator inside an injection context produces a live query:

```ts
// features only
const query = getPost(withArgs(() => ({ pathParams: { postId: '1' } })));

// or with a config object first
const query = getPost(
  { onlyManualExecution: true },
  withArgs(() => ({ pathParams: { postId: '1' } })),
);
```

| `QueryConfig` option                 | Default | Description                                                                                    |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------- |
| `key`                                | —       | Custom cache key. Only allowed on cacheable queries (throws otherwise).                        |
| `onlyManualExecution`                | `false` | Skip auto-execution — the query only runs when you call `.execute()`.                          |
| `silenceMissingWithArgsFeatureError` | `false` | Allow a function route without a `withArgs` feature (you must then pass args to `.execute()`). |
| `injector`                           | —       | Create the query in a specific injector instead of the current injection context.              |

Creators expose `.clone(additionalOptions)` to derive a variant with merged options (e.g. a custom `retryFn`).

## Auto-execution

`GET`, `HEAD` and `OPTIONS` queries execute automatically — immediately when the route is static and argless, or whenever [`withArgs`](/query/features#withargs) produces new args. Mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) never auto-execute; call `.execute({ args })` yourself. Opt a query out entirely with `onlyManualExecution`.

## The query object

Every state property is a signal — and every one of them is an `ObservableSignal`, so `query.response.asObservable()` hands you an RxJS stream when you need one.

| Signal                 | Type                              | Description                                                                                |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `response()`           | `TResponse \| null`               | Latest (transformed) response. Kept while re-executing; cleared when a re-execution fails. |
| `loading()`            | `HttpRequestLoadingState \| null` | Loading state incl. `progress` (`percentage`, `speed`, `remainingTime`).                   |
| `error()`              | `QueryErrorResponse \| null`      | Normalized error — see [Errors & retries](/query/errors).                                  |
| `executionState()`     | discriminated union               | `{ type: 'loading' \| 'success' \| 'failure', … } \| null` — handy for `@switch` blocks.   |
| `args()`               | `RequestArgs \| null`             | Args of the latest execution.                                                              |
| `latestHttpEvent()`    | `HttpEvent \| null`               | Last raw Angular HTTP event.                                                               |
| `lastTimeExecutedAt()` | `number \| null`                  | Timestamp of the latest execution.                                                         |
| `triggeredBy()`        | `string \| null`                  | Who triggered the execution (`null` for user-triggered).                                   |
| `id()`                 | `QueryKey \| null`                | Current repository cache key.                                                              |

Methods:

- `execute({ args?, options? })` — `options.allowCache` reuses a fresh cached response, `options.triggeredBy` tags the run.
- `reset()` — back to the never-executed state.
- `createSnapshot()` — a frozen copy of the current state with an `isAlive` signal. Useful for "the request I started", untouched by later executions. The standalone `executeUntilSettled(query, executeArgs?)` combines both: it executes and resolves with the settled snapshot — handy in `async` flows like a signal-forms [`submit()` action](/query/errors#mapping-violations-onto-signal-forms). For a chain of dependent mutations built on top of it, see [Dependent queries](/query/dependent-queries).
- `asReadonly()` — the query without its mutating methods.

Some objects also carry a `subtle` namespace — everything under it is an unsupported escape hatch: if you touch it and it breaks, that's on you.

Queries live in a child injector parented to the component (or `queryConfig.injector`) that created them — when that scope is destroyed, the query is torn down and its cache reference released.

# Queries & creators

The fundamentals shared by every query flavor - [HTTP](/query/http) and [GraphQL](/query/gql) queries are built from the same client, creators and query objects. The system is signals-first: a query is a plain object whose state (`response`, `loading`, `error`, …) is exposed as Angular signals.

The typical setup - one client per API, one creator per endpoint, queries created inside components:

```ts
import { createGetQuery, createQueryClient, withArgs } from '@ethlete/query';

// api.ts - one client per API
export const client = createQueryClient({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

export const getQuery = createGetQuery(client);

// posts.queries.ts - one creator per endpoint
export type GetPostQueryArgs = {
  response: Post;
  pathParams: { postId: string };
};

export const getPost = getQuery<GetPostQueryArgs>((p) => `/posts/${p.postId}`);
```

```ts
// post.component.ts - a live query per component instance
@Component({/* … */})
export class PostComponent {
  postId = input.required<string>();

  postQuery = getPost(withArgs(() => ({ pathParams: { postId: this.postId() } })));

  post = computed(() => this.postQuery.response());
}
```

Whenever `postId` changes, the query re-executes automatically; identical requests from other components are [deduplicated](/query/caching) and share the same response.

## Live demo

A real query against a mocked backend - execute it, make it fail, and watch the signals. `execute (allowCache)` skips the request entirely while the cached response is still fresh:

<StoryEmbed id="query-demos-lifecycle--default" height="420px" />

## The query client

`createQueryClient(options)` returns a root-provider definition ([`{ provide, inject, token }` from `@ethlete/core`](/core/utilities#dependency-injection)). Creators take the whole definition; the token is provided in root, so there is nothing to register in your app config. Name the halves you need with the extractors:

```ts
import { toInjectFn } from '@ethlete/core';
import { createQueryClient } from '@ethlete/query';

const API = createQueryClient({ name: 'api', baseUrl: 'https://api.example.com/v1' });

export const injectApi = toInjectFn(API);
```

| Option          | Default                     | Description                                                                                                                                                                                                  |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`          | - (required)                | Unique name, used in the injection token (`QueryClient_<name>`).                                                                                                                                             |
| `baseUrl`       | - (required)                | Base URL prepended to every route, e.g. `https://api.example.com/v1`.                                                                                                                                        |
| `queryString`   | -                           | Config for how query params are serialized.                                                                                                                                                                  |
| `headers`       | -                           | A header record or `HttpHeaders` (or a function returning either) sent with every request - see [Client-wide headers](#client-wide-headers).                                                                 |
| `cacheAdapter`  | `extractExpiresInSeconds`   | Maps response headers to a freshness TTL - see [Caching](/query/caching).                                                                                                                                    |
| `retryFn`       | none (`withDefaultRetry()`) | Decides whether a failed request is retried - see [Errors & retries](/query/errors).                                                                                                                         |
| `keepUnusedFor` | `300000` (5 min)            | How long an entry survives after its last consumer was destroyed - see [Caching](/query/caching#keeping-unused-entries-around).                                                                              |
| `features`      | `[]`                        | Opt-in subsystems (each a `QueryClientFeature`): [multi-tab sync](/query/multi-tab), [persistence](/query/persistence), [error parsing & retries](/query/errors#opt-in-to-the-shapes-your-api-answers-with). |

### Client-wide headers

An API token, a tenant id, a preview credential - anything every request of a client carries belongs in `headers` rather than on each creator. Per-query `args.headers` are merged on top and win per header name.

Headers are a plain record (`Record<string, string | string[]>`) or Angular `HttpHeaders`, so a client file needs no `@angular/*` import to set one:

```ts
const API = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com',
  headers: { 'X-Api-Token': environment.apiToken },
});
```

Pass a function to make them dynamic: it runs on every execution, so reading a signal or a variable inside is enough for later requests to pick the new value up.

```ts
let previewToken: string | null = null;

const API = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com',
  headers: () => (previewToken ? { 'X-Preview-Token': previewToken } : {}),
});
```

Client headers are deliberately **not** part of the [cache key](/query/caching) - they are identical for every query of the client, so including them would only ever churn the whole cache at once. The flip side is that already-resolved queries keep their response when the headers change; call [`refreshQueriesInUse()`](/query/caching#refreshing-everything-in-use) to re-run them:

```ts
previewToken = token;
injectApi().refreshQueriesInUse();
```

## Query creators

A query creator is a function describing one endpoint. You get one by calling a method template (like `createGetQuery(client)` - see [HTTP](/query/http) for all of them) with a route and a `TArgs` type describing the request/response. Calling the creator inside an injection context produces a live query:

```ts
// features only
const query = getPost(withArgs(() => ({ pathParams: { postId: '1' } })));

// or with a config object first
const query = getPost(
  { onlyManualExecution: true },
  withArgs(() => ({ pathParams: { postId: '1' } })),
);
```

| `QueryConfig` option                 | Default   | Description                                                                                                                                                            |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                                | -         | Custom cache key. Only allowed on cacheable queries (throws otherwise).                                                                                                |
| `onlyManualExecution`                | `false`   | Skip auto-execution - the query only runs when you call `.execute()`.                                                                                                  |
| `silenceMissingWithArgsFeatureError` | `false`   | Allow a function route without a `withArgs` feature (you must then pass args to `.execute()`); throws if you combine it with `withArgs`.                               |
| `keepPreviousResponse`               | see below | Keep `response()` on the previous args' response while the request for new args loads. `true` for `GET`, `HEAD`, `OPTIONS` and GraphQL queries, `false` for mutations. |
| `injector`                           | -         | Create the query in a specific injector instead of the current injection context.                                                                                      |

Never call a creator inside a `computed`, an `effect` or a template: every re-run would build another query, so it throws `ET001`. Create the query once and drive it through `withArgs` or `.execute({ args })`. Reading, executing, `createSnapshot()` and `.asObservable({ injector })` are fine there.

Creators expose `.clone(additionalOptions)` to derive a variant with merged options (e.g. a custom `retryFn`).

## Auto-execution

`GET`, `HEAD` and `OPTIONS` queries execute automatically - immediately when the route is static and argless, or whenever [`withArgs`](/query/features#withargs) produces new args. Mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) never auto-execute; call `.execute({ args })` yourself. Opt a query out entirely with `onlyManualExecution`.

## The query object

Every state property is a signal - and every one of them is an `ObservableSignal`, so `query.response.asObservable()` hands you an RxJS stream when you need one.

| Signal                 | Type                              | Description                                                                                        |
| ---------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `response()`           | `TResponse \| null`               | Latest (transformed) response. Kept while re-executing or loading new args, and if that run fails. |
| `loading()`            | `HttpRequestLoadingState \| null` | Loading state incl. `progress` (`percentage`, `speed`, `remainingTime`).                           |
| `error()`              | `QueryErrorResponse \| null`      | Normalized error - see [Errors & retries](/query/errors).                                          |
| `executionState()`     | discriminated union               | `{ type: 'loading' \| 'success' \| 'failure', … } \| null` - handy for `@switch` blocks.           |
| `args()`               | `RequestArgs \| null`             | Args of the latest execution.                                                                      |
| `latestHttpEvent()`    | `HttpEvent \| null`               | Last raw Angular HTTP event.                                                                       |
| `lastTimeExecutedAt()` | `number \| null`                  | Timestamp of the latest execution.                                                                 |
| `triggeredBy()`        | `string \| null`                  | Who triggered the execution (`null` for user-triggered).                                           |
| `id()`                 | `QueryKey \| null`                | Current repository cache key.                                                                      |

Methods:

- `execute({ args?, options? })` - `options.allowCache` reuses a fresh cached response, `options.triggeredBy` tags the run, and `options.keepUnusedFor` overrides the creator's and the client's [retention](/query/caching#keeping-unused-entries-around) for this execution. An entry shared by several queries keeps the shortest retention of the queries currently bound to it, so a shorter one only applies until that query releases the entry.
- `reset()` - back to the never-executed state.
- `createSnapshot()` - a frozen copy of the current state with an `isAlive` signal. Useful for "the request I started", untouched by later executions. The standalone `executeUntilSettled$(query, executeArgs?)` combines both: a cold Observable that executes on subscribe, emits the settled snapshot and completes; unsubscribing before it settles aborts the request. `executeUntilSettled(query, executeArgs?)` is its Promise form for APIs that need an `async` function, like a signal-forms [`submit()` action](/query/errors#mapping-violations-onto-signal-forms). For a chain of dependent mutations built on top of it, see [Dependent queries](/query/dependent-queries).
- `asReadonly()` - the query without its mutating methods.

Some objects also carry a `subtle` namespace - everything under it is an unsupported escape hatch: if you touch it and it breaks, that's on you.

Both the `loading` and `failure` variants of `executionState()` report `hasCachedResponse: true` and
carry `cachedResponse` when a previous response is still available. This lets a screen keep rendering
known data while showing that its refresh is in progress or failed.

That includes new args. When `withArgs` produces new args, `response()` keeps the previous args' response
until the new request answers, and `executionState()` is
`{ type: 'loading', hasCachedResponse: true, cachedResponse }` in between. A failure on the new args is a
`failure` with that `cachedResponse`; a successful answer - an empty `204` included - replaces it. The
superseded request is still aborted, so the previous response never replaces a newer one.

```ts
const search = searchPosts(withArgs(() => ({ queryParams: { term: term() } })));
```

```html
@let state = search.executionState(); @if (state?.type === 'loading' && state.hasCachedResponse) {
<!-- the previous term's results, shown dimmed while the new term loads -->
}
```

Pass `keepPreviousResponse: false` in the `QueryConfig` when showing the previous args' data would be
wrong, for example a detail page whose id changed. Mutations never carry a response over: a second
`execute()` with a new body starts from `null`, so `executeUntilSettled` never reports an earlier
submission's response.

Two things still clear the response: `reset()`, and parking - a `withArgs` source that returns `null`
resets the query, so `response()` and `executionState()` are both `null` until args arrive again. A
logout resets every secure query the same way.

Queries live in a child injector parented to the component (or `queryConfig.injector`) that created them - when that scope is destroyed, the query is torn down and its cache reference released. Calling `execute()` on a query after that is a no-op: nothing is requested, and in dev mode a `console.warn` names the route so the stale reference can be found.

## Types

Nothing here is needed to use a query - the generics flow from the creator. They exist for the
signatures you write yourself: a component input that takes a query, a helper generic over an
endpoint, a [custom feature](/query/features#authoring-custom-features).

| Type                                                                               | What it is                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QueryArgs`                                                                        | The request/response contract a creator is generic over - the `TArgs` of [Typing requests](/query/http#typing-requests). Everything below is parameterized by one.                                                                                                                                                                                                                                                |
| `Query<TArgs>`                                                                     | A live query, the object a creator returns. `AnyNewQuery` is `Query<any>`, for code that does not care which endpoint.                                                                                                                                                                                                                                                                                            |
| `ReadonlyQuery<TArgs>`                                                             | What `asReadonly()` returns - a `Query` without `execute`, `reset`, `asReadonly` and `subtle`. The input type for a component that renders a query but must not drive it.                                                                                                                                                                                                                                         |
| `QueryCreator<TArgs>`                                                              | A creator. `AnyQueryCreator` erases the args, `QueryArgsOf<T>` recovers them from a creator _or_ a query, and `RunQueryCreator<TCreator>` is the query type a given creator produces.                                                                                                                                                                                                                             |
| `RequestArgs<TArgs>`                                                               | `TArgs` without the type-only `response` / `rawResponse` fields - what `execute({ args })` and `withArgs` take.                                                                                                                                                                                                                                                                                                   |
| `ResponseType`, `RawResponseType`, `PathParamsType`, `QueryParamsType`, `BodyType` | One field of a `QueryArgs` each, for deriving a type from the endpoint instead of restating it.                                                                                                                                                                                                                                                                                                                   |
| `QueryClient`, `QueryClientRef`                                                    | The client object and the provider definition `createQueryClient` returns - `AnyCreateQueryClientResult` is an alias of the latter, and what the secure creator templates take. `AnyQueryClient` is the injected client, and `CreateQueryClientConfigOptions` the [options bag](#the-query-client).                                                                                                               |
| `QueryConfig`, `BaseQueryCreatorOptions`                                           | The [per-query config](#query-creators) and the [creator options](/query/http#creator-options).                                                                                                                                                                                                                                                                                                                   |
| `QueryExecutionState<TArgs>`                                                       | The `executionState()` union: `QueryExecutionStateSuccess`, `QueryExecutionStateLoading` and `QueryExecutionStateFailure`. The latter two are themselves unions of a `…WithCachedResponse` and a `…WithNoResponse` half - `QueryExecutionStateLoadingWithCachedResponse`, `QueryExecutionStateLoadingWithNoResponse`, `QueryExecutionStateFailureWithCachedResponse`, `QueryExecutionStateFailureWithNoResponse`. |
| `QuerySnapshot<TArgs>`                                                             | What `createSnapshot()`, `executeUntilSettled$()` and `executeUntilSettled()` return; `AnyQuerySnapshot` erases the args.                                                                                                                                                                                                                                                                                                                   |
| `QueryKey`, `QueryMethod`, `RouteString`, `RouteType<TArgs>`                       | The cache key, the HTTP method union, and a route as a creator takes it - a `` `/${string}` `` literal, or a function of the path params.                                                                                                                                                                                                                                                                         |
| `QueryExecute<TArgs>`                                                              | The `execute` method's type. Its whole argument is a `QueryExecuteArgs<TArgs>` (`{ args?, options? }`), whose `options` is a `RunQueryExecuteOptions` - `allowCache`, `triggeredBy` and a per-execution `keepUnusedFor`.                                                                                                                                                                                          |
| `ObservableSignal<T>`                                                              | A signal that also has `.asObservable()` - the type of every signal on a query.                                                                                                                                                                                                                                                                                                                                   |

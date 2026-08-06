---
name: query
description: The signals-first @ethlete/query data-fetching system - the query client, typed query creators, reactive args, and reading results as signals or observables. Read BEFORE writing or reviewing code that fetches data, wires search/autocomplete to an API, adds auth/polling/pagination, or bridges a query into UI or RxJS.
kind: skill
scope: consumer
requires: ['@ethlete/query']
vars: [docsBaseUrl]
---

# @ethlete/query

Signals-first, typesafe data fetching for Angular: request dedup, caching, polling,
paged queries, bearer auth, GraphQL, and a socket.io realtime client.

**The written docs are the source of truth - read the relevant page before
non-trivial query work.** This guide is the index plus the load-bearing facts, so you
don't re-derive them from source.

| Page                                                                   | Covers                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| {%docsBaseUrl%}/query/                                                 | Overview + the two-generations note                                                 |
| {%docsBaseUrl%}/query/queries                                          | **Start here** - client, creators, the query object's signals, auto-execution       |
| {%docsBaseUrl%}/query/features                                         | `withArgs`, `withPolling`, `withAutoRefresh`, side-effect handlers                  |
| {%docsBaseUrl%}/query/http                                             | REST creators, typing requests, response transforms, upload progress                |
| {%docsBaseUrl%}/query/auth                                             | Bearer auth: login/refresh, auto token refresh, multi-tab sync                      |
| {%docsBaseUrl%}/query/caching · `/stacks` · `/errors` · `/gql` · `/ws` | Caching/dedup, pagination, error/retry, GraphQL, WebSockets                         |
| {%docsBaseUrl%}/query/multi-tab                                        | Opt-in cross-tab sync: shared responses, per-key polling election, mutation fan-out |
| {%docsBaseUrl%}/query/query-forms                                      | Router-synced filter/search forms                                                   |
| {%docsBaseUrl%}/query/legacy                                           | The maintenance-mode `V2QueryClient`                                                |

## Two generations - use the current one

- **Current (use this):** signals-first, provider-based. `createQueryClient`,
  `createGetQuery`/`createPostQuery`/…, `withArgs`. Everything imports from the
  single entry `@ethlete/query`.
- **Legacy (maintenance mode):** class-based `V2QueryClient`, `.prepare().execute()`,
  `queryComputed`. Don't write new code against it.

## Core usage

One client per API, one creator per endpoint, one live query per component instance:

```ts
import { createQueryClient, createGetQuery, withArgs } from '@ethlete/query';

export const apiClient = createQueryClient({ name: 'api', baseUrl: API_URL });
export const getPost = createGetQuery(apiClient)<GetPostArgs>((p) => `/posts/${p.pathParams.postId}`);

// in a component (injection context):
postId = input.required<string>();
postQuery = getPost(withArgs(() => ({ pathParams: { postId: this.postId() } })));
post = computed(() => this.postQuery.response());
```

- `GET`/`HEAD`/`OPTIONS` **auto-execute** - immediately when static/argless, or
  whenever `withArgs` produces new args. Mutations (`POST`/`PUT`/`PATCH`/`DELETE`)
  never auto-execute; call `.execute({ args })`. A function route (`pathParams`)
  requires `withArgs` (dev-mode error otherwise).
- Queries live in a child injector tied to the creating component; destroyed with it.

## The query object

Every state member is an **`ObservableSignal`** - a `Signal` that also has
`.asObservable()`. So each is both a signal (call it) and a stream:

- `response()` → `TResponse | null` (kept while re-executing; cleared on a failed re-exec).
- `loading()`, `error()` (normalized `QueryErrorResponse`), `args()`,
  `executionState()` (`{ type: 'loading' | 'success' | 'failure', … } | null`, great for `@switch`).
- Methods: `execute({ args?, options? })`, `reset()`, `createSnapshot()`, `asReadonly()`.

`query.response.asObservable()` binds to the query's own injector, so callers get
an `Observable<T | null>` **without** needing their own injection context (unlike
raw `toObservable`). It emits `null` first - `pipe(filter(r => r !== null))`.

## Reactive args & features

- **`withArgs(() => ({ pathParams, queryParams, body }))`** - runs like a `computed`;
  re-runs when a signal it reads changes and re-executes the query. This is how you
  drive **search-as-you-type**: back it with a search signal
  (`withArgs(() => ({ queryParams: { search: this.search() } }))`). Return
  `CLEAR_QUERY_ARGS` to reset args to `null` (pauses polling/auto-refresh).
- **Prefer `withArgs` over passing `args` to `execute()`.** Args declared on the query
  stay reactive: a `GET` re-executes itself when they change, and `withPolling` /
  `withAutoRefresh` restart off the same signal - none of which happens for args handed
  to `execute()`. A function route additionally throws without it. With `withArgs` in
  place a mutation is just `.execute()`, which reuses the current `args()`. Reserve
  `execute({ args })` for a one-off payload no signal holds (a form submit).
- `withPolling({ interval })`, `withAutoRefresh({ onSignalChanges: [...] })`.
- Side-effects: `withSuccessHandling`, `withErrorHandling`, `withLogging`.

There is no built-in debounce operator - dedup/caching handles repeated identical
requests; debounce at the input if you need it.

## Bridging a query into RxJS / other APIs

To hand a query's results to something that wants an `Observable<T[]>` (e.g. a
`(query) => Observable<...>` source): drive the query by a search signal and return
its response stream.

```ts
private search = signal('');
private q = getItems(withArgs(() => ({ queryParams: { q: this.search() } })));

fetch(query: string) {
  this.search.set(query);
  return this.q.response.asObservable().pipe(
    filter((r): r is ItemsRes => r !== null),
    map((r) => r.items),
  );
}
```

## Gotchas

- Signals-first: read `query.response()` in templates/computeds; it's **nullable**
  (`?? []` / `filter(Boolean)` as needed).
- Don't reach for the legacy client for new code.
- `.execute()` defaults `args` to the current `args()` when omitted.
- Anything under a query's `subtle` namespace is an unsupported escape hatch - never
  treat it as public API.

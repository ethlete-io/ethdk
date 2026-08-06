---
name: query
description: The signals-first @ethlete/query data-fetching system - the query client, typed query creators, reactive args, and reading results as signals or observables. Read BEFORE writing or reviewing code that fetches data, wires search/autocomplete to an API, adds auth/polling/pagination, or bridges a query into UI or RxJS. The full guide is the source of truth in apps/docs/query/*.md.
---

# @ethlete/query

Signals-first, typesafe data fetching for Angular: request dedup, caching, polling,
paged queries, bearer auth, GraphQL, and a socket.io realtime client.

**The written docs in `apps/docs/query/*.md` are the source of truth - read the
relevant page before non-trivial query work.** This skill is the index + the
load-bearing facts so you don't re-derive them from source.

| Page | Covers |
| --- | --- |
| `apps/docs/query/index.md` | Overview + the two-generations note |
| `apps/docs/query/queries.md` | **Start here** - client, creators, the query object's signals, auto-execution |
| `apps/docs/query/features.md` | `withArgs`, `withPolling`, `withAutoRefresh`, side-effect handlers |
| `apps/docs/query/http.md` | REST creators, typing requests, response transforms, upload progress |
| `apps/docs/query/auth.md` | Bearer auth: login/refresh, auto token refresh, multi-tab sync |
| `apps/docs/query/caching.md` · `stacks.md` · `errors.md` · `gql.md` · `ws.md` | Caching/dedup, pagination, error/retry, GraphQL, WebSockets |
| `apps/docs/query/multi-tab.md` | Opt-in cross-tab sync: shared responses, per-key polling election, mutation fan-out |
| `apps/docs/query/legacy.md` | The maintenance-mode `V2QueryClient` |

## Two generations - use the current one

- **Current (use this):** signals-first, provider-based. `createQueryClient`,
  `createGetQuery`/`createPostQuery`/…, `withArgs`. Everything imports from the
  single entry `@ethlete/query`.
- **Legacy (`libs/query/src/lib/legacy/`, maintenance mode):** class-based
  `V2QueryClient`, `.prepare().execute()`, `queryComputed`. Don't write new code
  against it. `QueryForm` (router-synced filter/search forms) is currently used
  mostly with the legacy client.

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
- `subtle` namespace = unsupported escape hatch.

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

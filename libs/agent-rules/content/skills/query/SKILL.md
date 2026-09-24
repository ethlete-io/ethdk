---
name: query
description: The signals-first @ethlete/query data-fetching system - the query client, typed query creators, reactive args, and reading results as signals or observables. Read BEFORE writing or reviewing code that fetches data, builds a list with filters/search/sort/paging bound to URL query params (defineQueryForm), wires search/autocomplete to an API, adds auth, route guards or polling, or bridges a query into UI or RxJS.
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

| Page                                                                   | Covers                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| {%docsBaseUrl%}/query/                                                 | Overview + the two-generations note                                                   |
| {%docsBaseUrl%}/query/queries                                          | **Start here** - client, creators, the query object's signals, auto-execution         |
| {%docsBaseUrl%}/query/features                                         | `withArgs`, `withPolling`, `withLongPolling`, `withAutoRefresh`, side-effect handlers |
| {%docsBaseUrl%}/query/http                                             | REST creators, typing requests, response transforms, upload progress                  |
| {%docsBaseUrl%}/query/auth                                             | Bearer auth: login/refresh, auto token refresh, multi-tab sync                        |
| {%docsBaseUrl%}/query/caching · `/stacks` · `/errors` · `/gql` · `/ws` | Caching/dedup, pagination, error/retry, GraphQL, WebSockets                           |
| {%docsBaseUrl%}/query/multi-tab                                        | Opt-in cross-tab sync: shared responses, per-key polling election, mutation fan-out   |
| {%docsBaseUrl%}/query/query-forms                                      | **Any filtered, searched, sorted or paged list** - `defineQueryForm`, URL sync        |
| {%docsBaseUrl%}/query/legacy                                           | The maintenance-mode `V2QueryClient`                                                  |

## Two generations - use the current one

- **Current (use this):** signals-first, provider-based. `createQueryClient`,
  `createGetQuery`/`createPostQuery`/…, `withArgs`. Everything imports from the
  single entry `@ethlete/query`.
- **Legacy (maintenance mode):** class-based `V2QueryClient`, `.prepare().execute()`,
  `queryComputed`. Don't write new code against it.

## Core usage

One client per API, one bound creator per method, one query per endpoint, one live query
per component instance:

```ts
import { createQueryClient, createGetQuery, withArgs } from '@ethlete/query';

// api.ts
export const apiClient = createQueryClient({ name: 'api', baseUrl: API_URL });
export const getQuery = createGetQuery(apiClient);

// posts.queries.ts
export type GetPostQueryArgs = {
  response: Post;
  pathParams: { postId: string };
};

export const getPost = getQuery<GetPostQueryArgs>((p) => `/posts/${p.postId}`);

// in a component (injection context):
postId = input.required<string>();
postQuery = getPost(withArgs(() => ({ pathParams: { postId: this.postId() } })));
post = computed(() => this.postQuery.response());
```

- `GET`/`HEAD`/`OPTIONS` **auto-execute** - immediately when static/argless, or
  whenever `withArgs` produces new args. Mutations (`POST`/`PUT`/`PATCH`/`DELETE`)
  never auto-execute; call `.execute({ args })`. A function route (`pathParams`)
  requires `withArgs` (dev-mode error otherwise).
- A route function receives the path params themselves: `(p) => \`/posts/${p.postId}\``.
- With bearer auth, bind the secure creators the same way:
  `const secureGetQuery = createSecureGetQuery(apiClient, authProviderRef)`.
- Queries live in a child injector tied to the creating component; destroyed with it.

## Lists with filters, search, sort or paging: `defineQueryForm`

Never wire list controls to the URL by hand (`injectQueryParams` + `router.navigate` +
drafts + effects). `defineQueryForm` does URL sync, debounce, defaults and page resets:

```ts
qf = defineQueryForm({
  fields: {
    search: searchQueryField(),
    sort: sortQueryField(),
    page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'sort'] }),
  },
}).observe();

users = getUsers(
  withArgs(() => {
    const { search, sort, page } = this.qf.value();

    return { queryParams: { query: search, sortBy: sort?.active, sortOrder: sort?.direction, page } };
  }),
);
```

Bind controls with `[formField]="qf.fields.search"`. `qf.value()` is the committed,
debounced value. See {%docsBaseUrl%}/query/query-forms for the other field creators,
filter overlays and `activeFilterCount`.

## The query object

Every state member is an **`ObservableSignal`** - a `Signal` that also has
`.asObservable()`. So each is both a signal (call it) and a stream:

- `response()` → `TResponse | null` (kept while re-executing; cleared on a failed re-exec).
  To keep showing the last good data after a failure, read `cachedResponse` from the
  `loading` or `failure` variant of `executionState()` - do not copy responses into a signal.
- `loading()`, `error()` (normalized `QueryErrorResponse`), `args()`,
  `executionState()` (`{ type: 'loading' | 'success' | 'failure', … } | null`, great for `@switch`).
- Methods: `execute({ args?, options? })`, `reset()`, `createSnapshot()`, `asReadonly()`.

`query.response.asObservable()` binds to the query's own injector, so callers get
an `Observable<T | null>` **without** needing their own injection context (unlike
raw `toObservable`). It emits `null` first - `pipe(filter(r => r !== null))`.

## Reactive args & features

- **`withArgs(() => ({ pathParams, queryParams, body }))`** - runs like a `computed`;
  re-runs when a signal it reads changes and re-executes the query. For
  **search-as-you-type**, read a `defineQueryForm` value (debounced) or another
  debounced signal - a raw input signal sends one request per keystroke. Return `null`
  to park the query - args reset to `null`, pausing polling/auto-refresh.
- **Prefer `withArgs` over passing `args` to `execute()`.** Args declared on the query
  stay reactive: a `GET` re-executes itself when they change, and `withPolling` /
  `withAutoRefresh` restart off the same signal - none of which happens for args handed
  to `execute()`. A function route additionally throws without it. With `withArgs` in
  place a mutation is just `.execute()`, which reuses the current `args()`. Reserve
  `execute({ args })` for a one-off payload no signal holds (a form submit).
- `withPolling({ interval })`, `withAutoRefresh({ onSignalChanges: [...] })`.
- **`withLongPolling({ nextArgs })`** for a completion-driven chain instead of an interval: each
  round starts once the previous settled, with args (a cursor) derived from its response. `nextArgs`
  returning `null` ends the chain. Not `withPolling` with a small interval - and the two throw when
  combined.
- Side-effects: `withSuccessHandling`, `withErrorHandling`, `withLogging`.

Debounce lives in the form layer: `searchQueryField()` debounces 300ms, and every query
field takes a `debounce` option. Outside a query form, debounce the signal before
`withArgs` reads it.

After a mutation, refresh the affected reads with `injectApi().invalidateQueries({ url })`
(see {%docsBaseUrl%}/query/caching) instead of calling `execute()` on each one.

For route guards, use `createAuthGuard(authProviderRef, config)`. Its `canMatchWith(predicate)`
checks a role or permission after the session has settled (see {%docsBaseUrl%}/query/auth).

## Bridging a query into RxJS / other APIs

For a callback that must start one request and return one correlated result, use a
manual query with `executeUntilSettled()`. Its frozen snapshot cannot be replaced by a
later execution, and the observable completes after that one result.

```ts
class ItemSource {
  private itemsQuery = getItems({ onlyManualExecution: true });

  fetch(query: string) {
    return defer(() => executeUntilSettled(this.itemsQuery, { args: { queryParams: { q: query } } })).pipe(
      map((snapshot) => {
        const response = snapshot.response();

        if (response === null) throw snapshot.error();

        return response.items;
      }),
    );
  }
}
```

Do not set a search signal and immediately return the shared `response` stream: the
previous response is retained during re-execution and can be the first non-null emission.
Unsubscribing from the wrapper stops result delivery but does not by itself abort the
promise-backed execution; use the query's reactive `withArgs` lifecycle when cancellation
is a requirement rather than a callback contract.

## Gotchas

- Signals-first: read `query.response()` in templates/computeds; it's **nullable**
  (`?? []` / `filter(Boolean)` as needed).
- Don't reach for the legacy client for new code.
- `.execute()` defaults `args` to the current `args()` when omitted.
- Anything under a query's `subtle` namespace is an unsupported escape hatch - never
  treat it as public API.

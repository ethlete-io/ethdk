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
non-trivial query work.** This guide maps every need to its API and page, plus the
load-bearing facts, so you don't re-derive them from source or hand-build what ships.

| Page                                              | Covers                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| {%docsBaseUrl%}/query/                            | Overview, the two generations, what else the package ships                    |
| {%docsBaseUrl%}/query/queries                     | **Start here** - client, creators, the query object's signals, auto-execution |
| {%docsBaseUrl%}/query/features                    | `withArgs`, polling, auto-refresh, side-effect handlers, custom features      |
| {%docsBaseUrl%}/query/http                        | REST creators, typing requests, response transforms, upload progress          |
| {%docsBaseUrl%}/query/auth                        | Bearer auth provider, guards, token refresh, auth features                    |
| {%docsBaseUrl%}/query/caching                     | Cache keys, dedup, `keepUnusedFor`, freshness, refresh and invalidation       |
| {%docsBaseUrl%}/query/multi-tab                   | Cross-tab response sharing, one poller per key, mutation fan-out              |
| {%docsBaseUrl%}/query/persistence                 | Successful reads kept in IndexedDB for reloads and offline cold starts        |
| {%docsBaseUrl%}/query/stacks                      | Many queries of one creator, infinite lists, paged data                       |
| {%docsBaseUrl%}/query/dependent-queries           | GET → GET dependencies and ordered mutation chains                            |
| {%docsBaseUrl%}/query/batching                    | Bulk writes with bounded concurrency, per-item results, retry                 |
| {%docsBaseUrl%}/query/errors                      | Error object, opt-in parsers, form submission, violations, retries            |
| {%docsBaseUrl%}/query/testing                     | Specs: answering requests, `@ethlete/query/testing` helpers and fakes         |
| {%docsBaseUrl%}/query/query-forms                 | **Any filtered, searched, sorted or paged list** - `defineQueryForm`          |
| {%docsBaseUrl%}/query/gql                         | GraphQL creators over GET/POST                                                |
| {%docsBaseUrl%}/query/ws                          | socket.io rooms and live-updating responses                                   |
| {%docsBaseUrl%}/query/legacy                      | The maintenance-mode `V2QueryClient` and its replacements                     |
| {%docsBaseUrl%}/query/migrating-from-v2           | Codemods and the screen-by-screen move off the legacy client                  |
| {%docsBaseUrl%}/query/migrating-from-ngrx-toolkit | The generator and interop that move a store off `@tomtomb/ngrx-toolkit`       |
| {%docsBaseUrl%}/query-devtools/                   | The devtools panel and `provideQueryDevtools()`                               |

## You need → use → read

Before writing a helper, find your need here. Pages are under `{%docsBaseUrl%}/query/`.

| You need                                                       | Use                                                                                                                                                                                                                                    | Read                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| One client per API                                             | `createQueryClient`, `injectApi()`                                                                                                                                                                                                     | `queries`           |
| REST reads (auto-executing)                                    | `createGetQuery`, `createHeadQuery`, `createOptionsQuery`                                                                                                                                                                              | `http`              |
| REST writes (manual)                                           | `createPostQuery`, `createPutQuery`, `createPatchQuery`, `createDeleteQuery`                                                                                                                                                           | `http`              |
| The same behind a bearer token                                 | `createSecureGetQuery`, `createSecureHeadQuery`, `createSecureOptionsQuery`, `createSecurePostQuery`, `createSecurePutQuery`, `createSecurePatchQuery`, `createSecureDeleteQuery`                                                      | `http`, `auth`      |
| Upload/download progress bar                                   | creator option `reportProgress: true`, then `loading().progress`                                                                                                                                                                       | `http`              |
| Args that follow signals (route params, inputs, filters)       | `withArgs`                                                                                                                                                                                                                             | `features`          |
| A filtered / searched / sorted / paged list synced to the URL  | `defineQueryForm`, `queryField`, `searchQueryField`, `sortQueryField`                                                                                                                                                                  | `query-forms`       |
| Refetch on an interval                                         | `withPolling`                                                                                                                                                                                                                          | `features`          |
| Next request once the previous settled, with a cursor from it  | `withLongPolling`                                                                                                                                                                                                                      | `features`          |
| Refetch when some other signal changes                         | `withAutoRefresh`                                                                                                                                                                                                                      | `features`          |
| Toast / log / react on success or failure                      | `withSuccessHandling`, `withErrorHandling`, `withLogging`                                                                                                                                                                              | `features`          |
| Patch a loaded response in place (e.g. from a socket message)  | `withResponseUpdate`                                                                                                                                                                                                                   | `features`, `ws`    |
| Page falls out of range after a filter shrinks the results     | `withPageResetOnError`, `isPageOutOfRangeError`                                                                                                                                                                                        | `features`          |
| Package your own reusable query behavior                       | `createQueryFeature`                                                                                                                                                                                                                   | `features`          |
| Refresh reads after a mutation (here and in other tabs)        | `injectApi().invalidateQueries({ url })`                                                                                                                                                                                               | `caching`           |
| Refetch everything after a client-wide header changed          | `injectApi().refreshQueriesInUse()`                                                                                                                                                                                                    | `caching`           |
| Show the previous data instantly on back navigation            | `keepUnusedFor` + `executionState().cachedResponse`                                                                                                                                                                                    | `caching`           |
| Last known data after a reload or offline                      | `withQueryPersistence`, `createIndexedDbQueryPersistenceAdapter`, `createNoopQueryPersistenceAdapter`                                                                                                                                  | `persistence`       |
| Tabs share responses, poll once, see each other's mutations    | `withMultiTabSync`                                                                                                                                                                                                                     | `multi-tab`         |
| Parallel detail requests for a list of ids                     | `createQueryStack`, `transformArrayResponse`                                                                                                                                                                                           | `stacks`            |
| Load more / infinite scroll / classic paging                   | `createPagedQueryStack`, `ethletePaginationAdapter` (and other adapters)                                                                                                                                                               | `stacks`            |
| A GET whose args come from another GET's response              | `withArgs` reading the first query's `response()`                                                                                                                                                                                      | `dependent-queries` |
| Run mutations in order, each using the previous result         | `querySequence`                                                                                                                                                                                                                        | `dependent-queries` |
| Many edits with progress, time remaining and retry of failures | `createQueryBatch`                                                                                                                                                                                                                     | `batching`          |
| Submit a signal form through a mutation, violations on fields  | `createQuerySubmission`                                                                                                                                                                                                                | `errors`            |
| Own submit handler, or server-side validation while typing     | `executeUntilSettled`, `executeUntilSettled$`, `mapViolationsToFormErrors`, `validateWithQuery`                                                                                                                                        | `errors`            |
| Understand the error shapes your API returns                   | `withEthleteApiErrors` (all), `withSymfonyErrors`, `withHtmlErrorParsing`                                                                                                                                                              | `errors`            |
| Error text for display, or an error built by hand (tests)      | `queryErrorMessage`, `queryErrorMessages`, `createQueryErrorResponse`, `<et-query-error>`                                                                                                                                              | `errors`            |
| Retry failed requests                                          | `withDefaultRetry`, `createDefaultRetryFn`                                                                                                                                                                                             | `errors`            |
| Login / refresh / logout with bearer tokens                    | `createBearerAuthProvider`, `withAuthenticationQuery`, `withRefreshQuery`                                                                                                                                                              | `auth`              |
| Protect routes, check roles or permissions                     | `createAuthGuard`, `canMatchWith`                                                                                                                                                                                                      | `auth`              |
| "Remember me" auto-login                                       | `withPersistentAuth`                                                                                                                                                                                                                   | `auth`              |
| Log out idle users                                             | `withInactivityLogout`                                                                                                                                                                                                                 | `auth`              |
| Warn before the session expires                                | `withTokenExpirationWarning`                                                                                                                                                                                                           | `auth`              |
| Revoke the token on logout                                     | `withTokenRevocation`                                                                                                                                                                                                                  | `auth`              |
| Share login/logout across tabs                                 | `withBearerAuthMultiTabSync`                                                                                                                                                                                                           | `auth`              |
| Auth telemetry events                                          | `withTracking`                                                                                                                                                                                                                         | `auth`              |
| Tokens from SSO or a native shell                              | `provider.setTokens(access, refresh)`                                                                                                                                                                                                  | `auth`              |
| Which of several queries is busy (v2 query collections)        | each query's `executionState()` in a `computed`; auth: `provider.executionState()`                                                                                                                                                     | `migrating-from-v2` |
| GraphQL                                                        | `createGqlQueryViaGet`, `createGqlQueryViaPost`, `createGqlMutationViaGet`, `createGqlMutationViaPost`, `createSecureGqlQueryViaGet`, `createSecureGqlQueryViaPost`, `createSecureGqlMutationViaGet`, `createSecureGqlMutationViaPost` | `gql`               |
| Realtime rooms over socket.io                                  | `createWebSocketClient`                                                                                                                                                                                                                | `ws`                |
| Inspect queries, stacks, auth and cache at runtime             | `provideQueryDevtools()` + `@ethlete/query-devtools`                                                                                                                                                                                   | `/query-devtools/`  |

## Two generations - use the current one

Write new code against the signals-first system (`createQueryClient`, `createGetQuery`, …,
`withArgs`), all from the single entry `@ethlete/query`. The class-based `V2QueryClient`
(`.prepare().execute()`, `queryComputed`) is in maintenance mode.

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
  never auto-execute; declare their args with `withArgs` too and call `.execute()`. A function route (`pathParams`)
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

Every state member is an **`ObservableSignal`** - call it, or `.asObservable()` it without an
injection context of your own (it emits `null` first).

- `response()` → `TResponse | null` (kept while re-executing; cleared on a failed re-exec).
  To keep showing the last good data after a failure, read `cachedResponse` from the
  `loading` or `failure` variant of `executionState()` - do not copy responses into a signal.
- `loading()`, `error()` (normalized `QueryErrorResponse`), `args()`,
  `executionState()` (`{ type: 'loading' | 'success' | 'failure', … } | null`, great for `@switch`).
- Methods: `execute({ args?, options? })`, `reset()`, `createSnapshot()`, `asReadonly()`.

## Reactive args

- **`withArgs(() => ({ pathParams, queryParams, body }))`** runs like a `computed` and
  re-executes on change. Return `null` to park the query (pauses polling/auto-refresh).
- **Prefer `withArgs` over `execute({ args })`.** Declared args keep a `GET` re-executing and
  polling/auto-refresh restarting off the same signal; a function route throws without it. A
  mutation with `withArgs` is just `.execute()`. Reserve `execute({ args })` for a one-off
  payload no signal holds.
- Search-as-you-type: read a debounced value (`searchQueryField()` debounces 300ms; every
  query field takes `debounce`) - a raw input signal sends one request per keystroke.
- `withLongPolling` and `withPolling` throw when combined.

## Bridging into RxJS or callbacks

For a callback that must return one correlated result, run a manual query
(`{ onlyManualExecution: true }`) through `executeUntilSettled$(query, { args })` - cold, its
snapshot is frozen to that execution, and unsubscribing aborts the request. Keep the Promise
`executeUntilSettled` for an `async` signal-forms `submit()`. Never set a signal and return the shared `response`
stream: the retained previous response can be the first non-null emission. See
{%docsBaseUrl%}/query/queries#the-query-object.

## Gotchas

- `query.response()` is **nullable** (`?? []` / `filter(Boolean)` as needed).
- `.execute()` defaults `args` to the current `args()` when omitted.
- Anything under a query's `subtle` namespace is an unsupported escape hatch - never
  treat it as public API.
- Use `withArgs` for mutations too. Never reach for `execute({ args })` plus
  `silenceMissingWithArgsFeatureError` unless the args really exist only at call time - the
  flag is an escape hatch, not the mutation pattern.

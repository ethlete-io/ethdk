# Caching & deduplication

All [queries](/query/queries) of a client share one **query repository** - an in-memory cache that deduplicates identical requests and tracks response freshness. It is reachable as `client.repository`, typed `QueryRepository`, though nothing in normal use needs it: the client's own `invalidateQueries()` / `refreshQueriesInUse()` are the supported surface. Successful reads can also be kept on disk so a reload does not start from nothing - see [persisted responses](/query/persistence).

## What is cached

`GET`, `OPTIONS` and `HEAD` requests, plus [GraphQL queries](/query/gql) regardless of transport. Cache keys hash the resolved route, the request method, the request body and the per-execution headers (except `Authorization`), so requests for different languages or tenants do not share a response, and neither do a `HEAD` and an `OPTIONS` on one route. The key ignores the order of `queryParams` keys, nested objects included, so `{ a, b }` and `{ b, a }` share an entry; the URL keeps the order you wrote. Mutating methods are never cached - passing `key` or `allowCache` to an uncacheable query throws.

## Deduplication

Two queries with the same key share one in-flight request and one response - ten components rendering the same `getUser` query cause exactly one HTTP request. Entries are reference-counted: when the last consumer is destroyed, the entry is released - either kept for a while (see below) or aborted and evicted straight away.

Deduplication can reach across tabs too: with the [multi-tab sync](/query/multi-tab) client feature a response fetched in one tab updates the same cache key in the others, and a polled key is polled by one tab on behalf of all of them.

## Keeping unused entries around

An entry that lost its last consumer is **kept for `keepUnusedFor` milliseconds (5 minutes by default)** instead of being thrown away. If a query mounts again within that window - a list page reached via browser back navigation, a component that remounts - it binds to the existing entry and **renders the previous response immediately** while revalidating in the background, rather than starting from an empty loading state:

```ts
export const client = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com/v1',
  keepUnusedFor: 60_000, // or 0 to release entries immediately
});

// per query, overriding the client
export const getHugeReport = createGetQuery(client)<ReportQueryArgs>('/report', { keepUnusedFor: 0 });
```

The default is exported as `DEFAULT_KEEP_UNUSED_FOR` and the per-client cap as `MAX_UNUSED_ENTRIES`.

Unlike the freshness TTL below, this is independent of `cache-control` - so it also applies to private/authenticated responses, where the header-derived TTL does nothing.

The returning query is in a loading state that carries the old data, so render it via `executionState`:

```ts
const state = query.executionState();

if (state?.type === 'loading' && state.hasCachedResponse) {
  // previous rows are in state.cachedResponse - show them, optionally with a refreshing hint
}
```

Details worth knowing:

- Only entries that actually **hold a response** are kept. A request unbound while still in flight, or one that only ever errored, is aborted immediately as before.
- At most **50 unused entries per client** are kept; beyond that the least recently orphaned are dropped. This matters for queries whose args change often (a search field produces a new cache key per keystroke).
- Retention is **browser only** - on the server entries are always released immediately, so an SSR request never pins response bodies.
- Logging out clears retained authenticated entries along with the live ones.
- This is a **memory** window, unrelated to how long a response may live on disk ([`maxAge`](/query/persistence#three-windows-three-different-jobs)). An entry released here can still be hydrated from the store the next time the query mounts cold.
- This pairs with [`setupScrollRestoration`](/core/scroll-restoration#restoring-the-offset-on-back-forward): a list that renders its rows on the first frame back reaches its full height immediately, so the saved scroll offset is restored without waiting out a refetch.

## Freshness

The client's `cacheAdapter` - a `CacheAdapterFn`, `(headers: HttpHeaders) => number | null` - derives a TTL from response headers. The default (`extractExpiresInSeconds`) reads `cache-control` (`no-cache`, `no-store`, `max-age`, `s-maxage`), `age` and `expires`; a `max-age` without an `age` header is halved as a safety margin, while `max-age=0` expires immediately.

The window is opt-in per execution. `execute({ options: { allowCache: true } })` reuses a fresh entry's response without hitting the server and re-fetches a stale one - as does the same option on a [stack](/query/stacks) or a [batch](/query/batching), which forwards it to each query it runs. Nothing else consults the window: an auto-execution never passes `allowCache`, so a query always sends a request when it mounts, including one binding again to a [retained entry](#keeping-unused-entries-around) that is still fresh - it renders that entry's response while the request is in flight. There is no interval-based revalidation - combine with [`withPolling`](/query/features#withpolling) when you need periodic refreshes.

## Refreshing everything in use

When something _outside_ the request changes but the cache key doesn't - typically a [client-wide header](/query/queries#client-wide-headers) like a preview token or a tenant id - nothing invalidates on its own, and already-resolved queries keep data fetched under the old value. `refreshQueriesInUse()` re-runs them:

```ts
previewToken.set(token);
injectApi().refreshQueriesInUse();
```

It bypasses the freshness window and restarts requests that are still in flight, so the new value applies everywhere. Only **reads** that still have consumers are refreshed - `GET` / `HEAD` / `OPTIONS`, plus a [GraphQL query over POST](/query/gql): re-firing a mutation nobody asked for would be a far worse surprise than a stale read, and entries sitting out their `keepUnusedFor` window revalidate on their own when a consumer binds again.

Being in the cache is not what makes an entry a read. A `POST` that opted in via `subtle.useQueryRepositoryCache` - which is how the [auth queries](/query/auth) get a stable cache key - is cached but never re-fired, so a refresh cannot replay a login or a token refresh.

This is what v2's `setDefaultHeaders({ refreshQueriesInUse: true })` did implicitly.

## Invalidating after a change

When the _data_ went stale rather than the request - you mutated something, or a push message said someone else did - `invalidateQueries()` re-runs the affected queries here **and in the user's other tabs**:

```ts
await createPlayer.execute({ body });

injectApi().invalidateQueries({ url: '/players' });
```

It refreshes the same set as `refreshQueriesInUse()` - reads with at least one consumer, cache bypassed, in-flight requests restarted - narrowed by what you pass:

| Option      | Default | Description                                                                                                             |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `url`       | -       | Invalidate one part of the API. Relative values resolve against `baseUrl`, like a route.                                |
| `tag`       | -       | Invalidate the reads that declared this [tag](#tags). Given with `url`, a read has to match both.                       |
| `filter`    | -       | Narrow further on the built `{ method, url }` of each query. Runs after `url`. **This tab only** - see below.           |
| `otherTabs` | `true`  | Whether the user's other tabs invalidate too. Needs the [multi-tab sync](/query/multi-tab) feature; ignored without it. |

`url` matching is boundary aware rather than a plain prefix test, so `/players` covers `/players`, `/players/1` and `/players?page=2` - but not `/players-archive`. Passing nothing invalidates everything in use.

The options bag is a `QueryInvalidationOptions`, and `filter` a `QueryInvalidationFilterFn` - it is handed a `QueryInvalidationCandidate` (`{ method, url }`, the URL fully built) and returns whether that query should be re-run.

Entries sitting out their `keepUnusedFor` window are not refetched: refreshing what nobody is looking at is how an invalidation turns into a request storm. The invalidation marks them stale instead, so the next consumer that binds, or an `execute({ options: { allowCache: true } })`, refetches rather than serving the old response.

A `filter` is a function, so it cannot cross a `BroadcastChannel`: the other tabs narrow by `url` and `tag` alone and invalidate a superset. Pair it with `otherTabs: false` when the two must agree.

### Invalidating from the mutation

Instead of calling `invalidateQueries()` after every `execute()`, declare what a mutation invalidates on its creator. After each successful response the creator runs `invalidateQueries()` once per target:

```ts
export const getOpportunity = createGetQuery(client)<GetOpportunityArgs>((p) => `/opportunities/${p.uuid}`, {
  tags: ({ args }) => [`opportunity:${args.pathParams.uuid}`],
});

export const patchOpportunityPerson = createPatchQuery(client)<PatchPersonArgs>(
  (p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`,
  { invalidates: ({ args }) => [{ tag: `opportunity:${args.pathParams.uuid}` }, { url: '/people' }] },
);
```

`invalidates` takes a static array or a function of `{ args, response }` - the args the mutation was sent with and its response (`null` for a `204`). A target is `{ url }` or `{ tag }`, typed `QueryInvalidationTarget`. It works on the `POST`, `PUT`, `PATCH` and `DELETE` creators, their secure variants and the [GraphQL mutation creators](/query/gql), where `args.variables` holds the variables.

- **Only a success invalidates.** A failed or aborted mutation invalidates nothing.
- **Same rules as the call.** Each target is an `invalidateQueries()` call: reads in use only, in-flight requests restarted, and the user's other tabs too.
- **Reads throw.** `invalidates` on a `GET`, `HEAD`, `OPTIONS` or GraphQL query creator throws `ET2`: a read that invalidates would do so on every load, itself included. Give the read `tags` and invalidate those from the mutation.

### Tags

A URL is not always enough: `PATCH /opportunities/9/people/1` also changes `/opportunities/9`, which is not below it. A read declares tags on its creator - a static array or a function of `{ args }` - and `invalidateQueries({ tag })` re-runs the reads in use that declared it:

```ts
injectApi().invalidateQueries({ tag: 'opportunity:9' });
```

Tags derive from the args, not from the response. Args are known before the request leaves, so a read is tagged while its first request is still in flight, and an invalidation restarts that request instead of letting it land data from before the write. A tag read off the response would miss exactly that read. For a list whose items change, tag the list itself (`opportunities`), or invalidate it by `url`.

Two creators can share one cache entry (same route and args); the entry carries the tags of all of them. Tags are plain strings, so a tag invalidation reaches the other tabs like a `url` one. A tab still running an older deploy ignores the tag and invalidates by `url` alone - more than asked, never less.

Which queries an invalidation actually hit is the one thing the queries themselves cannot report - from inside any of them it is just a refetch. The [query devtools](/query-devtools/#why-did-this-refetch) log each invalidation as one Events row listing every cache entry it re-executed, and name it back on each query's Overview under **Refetched by**.

### Optimistic updates

`withOptimisticUpdate` shows a mutation's expected result before the server answers. Before the request leaves it rewrites the cached response of every read its `target` matches - a `{ url }` or `{ tag }`, or an array of them - so every query bound to those entries shows the guess at once:

```ts
patchOpportunityPerson(
  withArgs(() => ({ pathParams: { uuid, peopleUuid }, body })),
  withOptimisticUpdate({
    read: getOpportunity,
    target: ({ args }) => ({ tag: `opportunity:${args.pathParams.uuid}` }),
    update: ({ current, args }) => ({ ...current, people: toggle(current.people, args.pathParams.peopleUuid) }),
  }),
);
```

- **`update` returns the next response or `null`.** `null` leaves that entry alone, and an entry without a response is skipped. `current` is the cached response before the read's `transformResponse`. Keep `update` pure: it runs again whenever the entry has to be recomputed.
- **`read` types `current`.** It only gives `current` the read creator's response type; the entries are still found by `target`, so a target must not match another read's entries. Without `read`, `current` is `unknown`.
- **Failure rolls back.** A failed, aborted or destroyed mutation restores what the entry held before. A refetch or another tab that wrote the entry in the meantime wins: the rollback leaves it alone. Other optimistic updates of the entry that are still pending are re-applied on top of the original.
- **Success runs `update` once more**, with the mutation's `response` (`null` for a `204`; `undefined` before the request). Return `null` there to keep the guess. The creator's [`invalidates`](#invalidating-from-the-mutation) refetch then replaces the guess with the server's answer.
- **It stays in this tab.** The guess is never broadcast or persisted; the other tabs get the server's answer through the invalidation.
- **Mutations only.** On a read it throws `ET107`.

## See it live

In the demo, the mocked backend sends `cache-control: max-age=20` (a 10s freshness window after halving). `requestNumber` only increments when the server is actually hit - `execute (allowCache)` within the window serves the cache:

<StoryEmbed id="query-demos-lifecycle--default" height="420px" />

# Caching & deduplication

All [queries](/query/queries) of a client share one **query repository** - an in-memory cache that deduplicates identical requests and tracks response freshness. Successful reads can also be kept on disk so a reload does not start from nothing - see [persisted responses](/query/persistence).

## What is cached

`GET`, `OPTIONS` and `HEAD` requests, plus [GraphQL queries](/query/gql) regardless of transport. Cache keys hash the resolved route, request body and per-execution headers (except `Authorization`), so requests for different languages or tenants do not share a response. Mutating methods are never cached - passing `key` or `allowCache` to an uncacheable query throws in dev mode.

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

The client's `cacheAdapter` derives a TTL from response headers. The default (`extractExpiresInSeconds`) reads `cache-control` (`no-cache`, `no-store`, `max-age`, `s-maxage`), `age` and `expires`; a `max-age` without an `age` header is halved as a safety margin, while `max-age=0` expires immediately.

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
| `filter`    | -       | Narrow further on the built `{ method, url }` of each query. Runs after `url`. **This tab only** - see below.           |
| `otherTabs` | `true`  | Whether the user's other tabs invalidate too. Needs the [multi-tab sync](/query/multi-tab) feature; ignored without it. |

`url` matching is boundary aware rather than a plain prefix test, so `/players` covers `/players`, `/players/1` and `/players?page=2` - but not `/players-archive`. Passing nothing invalidates everything in use.

Entries sitting out their `keepUnusedFor` window are deliberately left alone. They revalidate on their own when a consumer binds again, and refreshing what nobody is looking at is how an invalidation turns into a request storm.

A `filter` is a function, so it cannot cross a `BroadcastChannel`: the other tabs narrow by `url` alone and invalidate a superset. Pair it with `otherTabs: false` when the two must agree.

Which queries an invalidation actually hit is the one thing the queries themselves cannot report - from inside any of them it is just a refetch. The [query devtools](/query-devtools/#why-did-this-refetch) log each invalidation as one Events row listing every cache entry it re-executed, and name it back on each query's Overview under **Refetched by**.

## See it live

In the demo, the mocked backend sends `cache-control: max-age=20` (a 10s freshness window after halving). `requestNumber` only increments when the server is actually hit - `execute (allowCache)` within the window serves the cache:

<StoryEmbed id="query-demos-lifecycle--default" height="420px" />

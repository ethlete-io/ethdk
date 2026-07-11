# Caching & deduplication

All [queries](/query/queries) of a client share one **query repository** — an in-memory cache that deduplicates identical requests and tracks response freshness.

## What is cached

`GET`, `OPTIONS` and `HEAD` requests, plus [GraphQL queries](/query/gql) regardless of transport. Cache keys are a hash of route + args, so identical requests map to the same entry. Mutating methods are never cached — passing `key` or `allowCache` to an uncacheable query throws in dev mode.

## Deduplication

Two queries with the same key share one in-flight request and one response — ten components rendering the same `getUser` query cause exactly one HTTP request. Entries are reference-counted: when the last consumer is destroyed, the request is aborted and evicted.

## Freshness

The client's `cacheAdapter` derives a TTL from response headers. The default (`extractExpiresInSeconds`) reads `cache-control` (`no-cache`, `max-age`, `s-maxage`), `age` and `expires`; a `max-age` without an `age` header is halved as a safety margin.

While an entry is fresh, `execute({ options: { allowCache: true } })` and auto-executions reuse the cached response without hitting the server; a stale entry re-fetches. There is no interval-based revalidation — combine with [`withPolling`](/query/features#withpolling) when you need periodic refreshes.

## See it live

In the demo, the mocked backend sends `cache-control: max-age=20` (a 10s freshness window after halving). `requestNumber` only increments when the server is actually hit — `execute (allowCache)` within the window serves the cache:

<StoryEmbed id="query-demos-lifecycle--default" height="420px" />

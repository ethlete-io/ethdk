# @ethlete/query

Declarative, typesafe data fetching for Angular — a signals-first query system with request deduplication, caching, polling, paged queries, bearer-token auth and GraphQL support, plus a socket.io-based realtime client.

::: info Two generations
The package contains two query systems. The **current system** (everything below except the last section) is signals-first and provider-based. Its predecessor, the class-based `V2QueryClient`, is in **maintenance mode** — see [Legacy client](/query/legacy). New code should always use the current system.
:::

Everything is imported from the single package entry:

```ts
import { createQueryClient, createGetQuery, withArgs } from '@ethlete/query';
```

## Core

- [Queries & creators](/query/queries) — the query client, creating typed queries, the query object's signals and auto-execution. **Start here.**
- [Query features](/query/features) — `withArgs`, `withPolling`, `withAutoRefresh`, side-effect handlers and live response updates.
- [Caching & deduplication](/query/caching) — the query repository, cache keys, freshness and request sharing.
- [Query stacks & pagination](/query/stacks) — running many queries as one, infinite lists and paged data.
- [Errors & retries](/query/errors) — the normalized error object, the retry policy and runtime error codes.

## HTTP & auth

- [HTTP queries](/query/http) — REST-style creators (`createGetQuery`, `createPostQuery`, …), typing requests, response transforms and upload progress.
- [Auth](/query/auth) — the bearer auth provider: login/refresh queries, automatic token refresh, multi-tab sync, secure queries.

## GraphQL & realtime

- [GraphQL](/query/gql) — the `gql` tag and the GET/POST GraphQL creators built on the same core.
- [WebSockets](/query/ws) — the room-based socket.io client and live-updating query responses.

## Legacy

- [Legacy client](/query/legacy) — the maintenance-mode `V2QueryClient` and how its concepts map to the current system.

## Also in the package

- **`QueryForm`** — router-synced filter/search forms (`QueryField`, `SearchQueryField`, `SortQueryField`, …) that debounce, serialize to URL query params and feed query args. Primarily used together with the [legacy client](/query/legacy) today.
- **HTTP error pipes** — `ParseHttpErrorCodeToTitle{En,De}Pipe` and `ParseHttpErrorCodeToMessage{En,De}Pipe` translate HTTP status codes into a human-readable title and message (English/German).

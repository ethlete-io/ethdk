# @ethlete/query

Declarative, typesafe data fetching for Angular - a signals-first query system with request deduplication, caching, polling, paged queries, bearer-token auth and GraphQL support, plus a socket.io-based realtime client.

::: info Two generations
The package contains two query systems. The **current system** (everything below except the last section) is signals-first and provider-based. Its predecessor, the class-based `V2QueryClient`, is in **maintenance mode** - see [Legacy client](/query/legacy). New code should always use the current system.
:::

Everything is imported from the single package entry:

```ts
import { createQueryClient, createGetQuery, withArgs } from '@ethlete/query';
```

## Core

- [Queries & creators](/query/queries) - the query client, creating typed queries, the query object's signals and auto-execution. **Start here.**
- [Query features](/query/features) - `withArgs`, `withPolling`, `withAutoRefresh`, side-effect handlers and live response updates.
- [Caching & deduplication](/query/caching) - the query repository, cache keys, freshness and request sharing.
- [Multi-tab sync](/query/multi-tab) - the `withMultiTabSync()` client feature: sharing responses between the user's tabs, polling a key in one tab only and fanning mutations out.
- [Persisted responses](/query/persistence) - the `withQueryPersistence()` client feature: keeping successful reads on disk so a reload, or a cold start with no network, renders the last known data.
- [Query stacks & pagination](/query/stacks) - running many queries as one, infinite lists and paged data.
- [Errors & retries](/query/errors) - the normalized error object, the opt-in parsers (`withEthleteApiErrors()` and friends), the retry policy and runtime error codes.

## HTTP & auth

- [HTTP queries](/query/http) - REST-style creators (`createGetQuery`, `createPostQuery`, …), typing requests, response transforms and upload progress.
- [Auth](/query/auth) - the bearer auth provider: login/refresh queries, automatic token refresh, multi-tab sync, secure queries.

## GraphQL & realtime

- [GraphQL](/query/gql) - the `gql` tag and the GET/POST GraphQL creators built on the same core.
- [WebSockets](/query/ws) - the room-based socket.io client and live-updating query responses.

## Tooling

- [Query devtools](/query-devtools/) - `provideQueryDevtools()` plus the panel from [`@ethlete/query-devtools`](/query-devtools/) inspect live queries, stacks, sequences, auth, cache and events.

## Legacy

- [Legacy client](/query/legacy) - the maintenance-mode `V2QueryClient`, with the current-system replacement for every one of its concepts (creators, state operators, `*etQuery`, `InfinityQuery`, `EntityStore`, auth, devtools).
- [Migrating from the legacy client](/query/migrating-from-v2) - the walkthrough: codemods, booting the app again, then screen by screen.

## Also in the package

- **[Query forms](/query/query-forms)** - router-synced filter/search/sort forms that debounce, serialize to URL query params and feed query args. Use the signals-first `defineQueryForm` for new code; the original reactive-forms `QueryForm` remains available.
- **HTTP error pipes** - `ParseHttpErrorCodeToTitle{En,De}Pipe` and `ParseHttpErrorCodeToMessage{En,De}Pipe` translate HTTP status codes into a human-readable title and message (English/German). To render a failed query, reach for [`<et-query-error>`](/components/query-error) first - it already composes a title, the message or violation list and a retry from these tables.

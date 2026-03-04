# Query

`@ethlete/query` is a declarative, typesafe HTTP query layer for Angular. It wraps Angular's `HttpClient` with a structured, feature-driven API for executing requests, managing loading/error state, caching, polling, pagination, authentication and GraphQL.

## Installation

```sh
yarn add @ethlete/query @ethlete/core
```

## Core concepts

| Concept | Description |
|---|---|
| **Query Creator** | Defines a reusable HTTP endpoint — its method, route, args type and response type. |
| **Query Client** | The runtime container that holds the `HttpClient`, `QueryRepository` and config. |
| **Query** | An active instance of a query creator bound to a component injector. Holds reactive state (loading, response, error). |
| **Query Features** | Composable behaviors attached to a query — `withArgs()`, `withPolling()`, `withAutoRefresh()`, etc. |
| **Auth Provider** | Bearer token lifecycle manager — login, refresh, multi-tab sync, leader election. |
| **Query Stack** | Executes a fixed set of queries in parallel and exposes merged state. |
| **Paged Query Stack** | Like Query Stack but for paginated data — manages page navigation and accumulation. |

## Quick example

```ts
import { createQuery, createQueryClient, withArgs } from '@ethlete/query';

const getUser = createQuery({
  method: 'GET',
  route: (args: { id: number }) => `/users/${args.id}`,
  responseType: {} as User,
});

// Inside a component
const query = getUser({ injector }, withArgs({ id: 1 }));

// Reactive state
query.response(); // Signal<User | null>
query.loading();  // Signal<QueryLoading | null>
query.error();    // Signal<HttpErrorResponse | null>
```

## Next steps

- [Query Creator](./query-creator) — defining endpoints
- [Query Client](./query-client) — setup and configuration
- [Query Features](./query-features) — composable behaviors
- [Auth Provider](./auth) — bearer token management
- [Query Stack](./query-stack) — parallel queries
- [Paged Query Stack](./paged-query-stack) — pagination
- [GQL](./gql) — GraphQL support
- [Error Reference](./errors) — runtime error codes

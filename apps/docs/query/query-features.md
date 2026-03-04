# Query Features

Query features are composable behaviors passed when instantiating a query. They follow the `with*` naming convention.

## `withArgs`

Provides the arguments for the query. Required when the route is a function.

```ts
const query = getUserById({ injector }, withArgs({ id: 42 }));
```

`withArgs` accepts either a static value or a reactive getter:

```ts
// Reactive — re-executes the query when the signal changes
const query = getUserById(
  { injector },
  withArgs(() => ({ id: userId() })),
);
```

## `withPolling`

Polls the endpoint at a given interval. Only supported on `GET`, `HEAD`, `OPTIONS` and GQL queries.

```ts
const query = getStatus({ injector }, withPolling({ interval: 5000 }));
```

## `withAutoRefresh`

Re-executes the query when a specified signal or observable emits.

```ts
const query = getNotifications({ injector }, withAutoRefresh({ triggers: [refreshSignal] }));
```

By default `withAutoRefresh` is incompatible with `onlyManualExecution`. Set `ignoreOnlyManualExecution: true` to override.

## `withResponseUpdate`

Allows manually updating the cached response without re-fetching.

```ts
const query = getUser({ injector }, withResponseUpdate());
// Later:
query.updateResponse((current) => ({ ...current, name: 'Updated' }));
```

## `withSilencedMissingArgsError`

Suppresses the runtime error thrown when the route is a function but no `withArgs` feature is present. Useful when args are conditionally provided.

```ts
const query = getUserById({ injector }, withSilencedMissingArgsError());
```

## Feature rules

- Each feature can only be used **once per query** — using the same feature twice throws `ET0`.
- `withPolling` and `withAutoRefresh` are only valid on read-only HTTP methods (`ET101`, `ET102`).
- `withAutoRefresh` cannot be combined with `onlyManualExecution` unless explicitly opted in (`ET103`).
- `withResponseUpdate` cannot be used inside a query stack (`ET501`).

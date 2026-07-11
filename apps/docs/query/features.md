# Query features

Features configure a [query's](/query/queries) behavior and are passed to the creator call. Each feature type can be used **once per query** (using one twice throws in dev mode).

```ts
const matchQuery = getMatch(
  withArgs(() => ({ pathParams: { matchId: this.matchId() } })),
  withPolling({ interval: 10_000 }),
  withErrorHandling({ handler: (e) => console.error(e) }),
);
```

## withArgs

Reactively supplies request args. The function runs in a reactive context — like a `computed`, it re-runs when a signal it reads changes, and new args re-execute [auto-executable](/query/queries#auto-execution) queries:

```ts
withArgs(() => ({ queryParams: { page: this.page(), search: this.search() } }));
```

Two special return values:

- `CLEAR_QUERY_ARGS` — resets the args to `null`. Polling and auto-refresh pause while args are `null`.
- `null` — keeps the previous args unchanged.

A function route (one using `pathParams`) requires a `withArgs` feature — creating the query without one throws in dev mode (opt out via the `silenceMissingWithArgsFeatureError` [query config](/query/queries#query-creators) if you always pass args to `execute`).

## withPolling

Re-executes the query on an interval. The interval restarts when args change, and stops when the query's scope is destroyed.

| Option             | Default      | Description                           |
| ------------------ | ------------ | ------------------------------------- |
| `interval`         | — (required) | Polling interval in milliseconds.     |
| `executeInitially` | `false`      | Also execute immediately on creation. |

Only for `GET`/`HEAD`/`OPTIONS` queries — anything else throws.

## withAutoRefresh

Re-executes the query whenever one of the given signals changes:

```ts
withAutoRefresh({ onSignalChanges: [this.locale, this.currency] });
```

Throws when combined with `onlyManualExecution` unless you pass `ignoreOnlyManualExecution: true`, and (like polling) is limited to `GET`/`HEAD`/`OPTIONS`.

## Side-effect handlers

| Feature                        | Called with                                            |
| ------------------------------ | ------------------------------------------------------ |
| `withSuccessHandling(options)` | `handler(response)` on every response.                 |
| `withErrorHandling(options)`   | `handler(error: QueryErrorResponse)` on every failure. |
| `withLogging(options)`         | `logFn(event)` for every raw HTTP event.               |

These listen to the query's discrete event stream, so they never miss a terminal transition — use them for toasts, tracking and debugging rather than deriving state (that's what the [signals](/query/queries#the-query-object) are for).

## withResponseUpdate

Reactively patches the current response without re-fetching — made for pushing websocket messages into an already-loaded query. Return `null` to skip an update; the next real server response overwrites patches.

```ts
const matchQuery = getMatch(
  withArgs(() => ({ pathParams: { matchId: this.matchId() } })),
  withResponseUpdate({
    updater: ({ currentResponse }) => {
      const message = this.matchRoom()?.latestMessage();
      if (!message || !currentResponse) return null;

      return { ...currentResponse, ...message.data };
    },
  }),
);
```

See [WebSockets](/query/ws) for the room client this pairs with, and a live demo of this feature below:

<StoryEmbed id="query-demos-live-response-update--default" height="440px" />

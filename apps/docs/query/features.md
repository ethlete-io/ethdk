# Query features

Features configure a [query's](/query/queries) behavior and are passed to the creator call. Each feature type can be used **once per query** (using one twice throws in dev mode).

```ts
import { withArgs, withErrorHandling, withPolling } from '@ethlete/query';

const matchQuery = getMatch(
  withArgs(() => ({ pathParams: { matchId: this.matchId() } })),
  withPolling({ interval: 10_000 }),
  withErrorHandling({ handler: (e) => console.error(e) }),
);
```

## withArgs

Reactively supplies request args. The function runs in a reactive context - like a `computed`, it re-runs when a signal it reads changes, and new args re-execute [auto-executable](/query/queries#auto-execution) queries:

```ts
withArgs(() => ({ queryParams: { page: this.page(), search: this.search() } }));
```

Return `null` to **park** the query: its args reset to `null`, and polling and auto-refresh pause until args are set again. That is how a query waits for something it depends on - see [dependent queries](/query/dependent-queries).

A function route (one using `pathParams`) requires a `withArgs` feature - creating the query without one throws in dev mode (opt out via the `silenceMissingWithArgsFeatureError` [query config](/query/queries#query-creators) if you always pass args to `execute`). Setting that config together with a `withArgs` feature throws too, since the two contradict each other.

## withPolling

Re-executes the query on an interval. The interval restarts when args change, and stops when the query's scope is destroyed.

| Option             | Default      | Description                           |
| ------------------ | ------------ | ------------------------------------- |
| `interval`         | - (required) | Polling interval in milliseconds.     |
| `executeInitially` | `false`      | Also execute immediately on creation. |

Only for `GET`/`HEAD`/`OPTIONS` queries - anything else throws.

With the [multi-tab sync](/query/multi-tab#polling-dedup) client feature, the same query polled in several tabs is polled by one of them; the rest keep their interval but skip each tick and receive the data instead. Pass `withMultiTabSync({ dedupePolling: false })` if you want every tab to poll for itself, and leave the feature out entirely to keep every tab on its own.

## withLongPolling

Long polling: a chain of requests where each round starts once the previous one settled, with args derived from what it returned. There is no interval - the server sets the cadence by holding each request open until it has something to report.

```ts
import { withArgs, withLongPolling } from '@ethlete/query';

const eventsQuery = getEvents(
  withArgs(() => ({ queryParams: { cursor: null } })),
  withLongPolling({
    nextArgs: (response) => (response ? { queryParams: { cursor: response.cursor } } : null),
  }),
);
```

| Option            | Default      | Description                                                            |
| ----------------- | ------------ | ---------------------------------------------------------------------- |
| `nextArgs`        | - (required) | `(response, args) => args \| null`. `null` ends the chain.             |
| `delay`           | `250`        | Pause between one round settling and the next starting.                |
| `errorDelay`      | `1000`       | Wait before repeating a failed round. Doubles per consecutive failure. |
| `maxErrorDelay`   | `30000`      | Ceiling for the doubling `errorDelay`.                                 |
| `stopAfterErrors` | `10`         | Consecutive failures that end the chain.                               |

`response` is `null` when the server answered without a body - a `204` on timeout, which is the usual way to say "nothing yet". Returning the args unchanged is what re-asks the same question; returning `null` ends the chain, and only a new `withArgs` value or a manual `execute()` starts it again.

`nextArgs` is handed the args the settled round was actually sent with, not the query's `args()` signal - so a cursor chain reads its own last position even though the `withArgs` source never changes.

A **failed** round is repeated after a growing delay rather than ending the chain, so a transient 502 or a dropped connection does not silently deaden a live feed. That backoff sits on top of the request's own [retry policy](/query/errors#retries): a round counts as failed once its retries are exhausted. After `stopAfterErrors` consecutive failures the chain stops and the query keeps its error.

A new value from the `withArgs` source cancels the pending round - the source's own re-execution starts the new chain from it. `reset()` cancels it too.

Two things this feature deliberately does not do:

- **Rounds are not cached.** Each one is requested with `keepUnusedFor: 0`, because a cursor is asked for once and never again; retaining them would leave one dead entry per round behind for the whole retention window.
- **Rounds are not deduped across tabs.** [Multi-tab sync](/query/multi-tab#polling-dedup) elects a poller per cache key, and a chain's key moves with every round, so every tab drives its own chain.

Only for `GET`/`HEAD`/`OPTIONS` queries - anything else throws, as does combining it with `withPolling`, since both would drive the same query's re-execution.

`delay` exists because a server that already has data answers a long poll immediately: on a busy feed, rounds would otherwise follow each other with no pause at all. Raise it to put a floor under how often a chatty endpoint is asked.

## withAutoRefresh

Re-executes the query whenever one of the given signals changes:

```ts
import { withAutoRefresh } from '@ethlete/query';

withAutoRefresh({ onSignalChanges: [this.locale, this.currency] });
```

Throws when combined with `onlyManualExecution` unless you pass `ignoreOnlyManualExecution: true`, and (like polling) is limited to `GET`/`HEAD`/`OPTIONS`.

## Side-effect handlers

| Feature                        | Called with                                            |
| ------------------------------ | ------------------------------------------------------ |
| `withSuccessHandling(options)` | `handler(response)` on every response.                 |
| `withErrorHandling(options)`   | `handler(error: QueryErrorResponse)` on every failure. |
| `withLogging(options)`         | `logFn(event)` for every raw HTTP event.               |

These listen to the query's discrete event stream, so they never miss a terminal transition - use them for toasts, tracking and debugging rather than deriving state (that's what the [signals](/query/queries#the-query-object) are for).

## withResponseUpdate

Reactively patches the current response without re-fetching - made for pushing websocket messages into an already-loaded query. Return `null` to skip an update; the next real server response overwrites patches.

```ts
import { withResponseUpdate } from '@ethlete/query';

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

## withPageResetOnError

Resets the page when the current page becomes out of range - e.g. after a filter shrinks the result set below the current page. It reacts to the query's error events and resets the **page source** (a signal or a [query form](/query/query-forms) field), so the normal reactive re-execution then runs with the corrected page. Fixing the source (rather than patching args) is what makes the change stick, since query args are reactively sourced.

```ts
import { withArgs, withPageResetOnError } from '@ethlete/query';

// signal-driven page
const users = getUsers(
  withArgs(() => ({ queryParams: { page: this.page() } })),
  withPageResetOnError({ page: this.page }),
);

// query-form-driven page
const users = getUsers(
  withArgs(() => ({ queryParams: this.qf.value() })),
  withPageResetOnError({ reset: () => this.qf.resetFieldToDefault('page') }),
);
```

| Option    | Default                 | Description                                                                                                        |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `page`    | -                       | A `WritableSignal<number>` to reset (use this **or** `reset`).                                                     |
| `resetTo` | `1`                     | Value to reset `page` to.                                                                                          |
| `reset`   | -                       | Callback to reset any page source (use this **or** `page`).                                                        |
| `when`    | `isPageOutOfRangeError` | Which errors trigger the reset. The default matches HTTP `416` and a dev-mode `500` Pagerfanta out-of-range error. |

The `isPageOutOfRangeError` predicate is exported too, so you can reuse it inside a plain `withErrorHandling` handler when you need custom behavior.

## Authoring custom features

`createQueryFeature()` is the extension point behind all the built-in `with*` features - use it to package your own reusable query behavior:

```ts
import { createQueryFeature, nestedEffect, QueryArgs } from '@ethlete/query';

const withLogging = <TArgs extends QueryArgs>(options: { prefix: string }) =>
  createQueryFeature<TArgs>({
    type: 'withLogging',
    devtools: () => [{ label: 'prefix', value: options.prefix }],
    fn: ({ state, execute, deps, flags }) => {
      nestedEffect(() => console.log(options.prefix, state.args()));
    },
  });
```

`type` is any string that names the feature; the built-in ones use the `QueryFeatureType` constants. Two features of the same `type` on one query throw. The feature `fn` runs once during query creation and receives the query's internals: its `state` (args, response, error, loading signals), the internal `execute` function, DI `deps` and the resolved feature `flags`. Use `nestedEffect()` (also exported) instead of `effect()` when reacting to signals inside a feature - it creates the effect outside the current reactive context so the feature setup itself never becomes a dependency.

The optional `devtools` describer is what the [devtools panel](/query-devtools/#features-show-what-they-were-configured-with) lists under the feature's name. It is only called while an entry is being built, so a feature keeps costing nothing without `provideQueryDevtools()`.

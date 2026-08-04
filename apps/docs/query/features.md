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

Two special return values:

- `CLEAR_QUERY_ARGS` - resets the args to `null`. Polling and auto-refresh pause while args are `null`.
- `null` - keeps the previous args unchanged.

A function route (one using `pathParams`) requires a `withArgs` feature - creating the query without one throws in dev mode (opt out via the `silenceMissingWithArgsFeatureError` [query config](/query/queries#query-creators) if you always pass args to `execute`).

## withPolling

Re-executes the query on an interval. The interval restarts when args change, and stops when the query's scope is destroyed.

| Option             | Default      | Description                           |
| ------------------ | ------------ | ------------------------------------- |
| `interval`         | - (required) | Polling interval in milliseconds.     |
| `executeInitially` | `false`      | Also execute immediately on creation. |

Only for `GET`/`HEAD`/`OPTIONS` queries - anything else throws.

With the [multi-tab sync](/query/multi-tab#polling-dedup) client feature, the same query polled in several tabs is polled by one of them; the rest keep their interval but skip each tick and receive the data instead. Pass `withMultiTabSync({ dedupePolling: false })` if you want every tab to poll for itself, and leave the feature out entirely to keep every tab on its own.

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

The feature `fn` runs once during query creation and receives the query's internals: its `state` (args, response, error, loading signals), the internal `execute` function, DI `deps` and the resolved feature `flags`. Use `nestedEffect()` (also exported) instead of `effect()` when reacting to signals inside a feature - it creates the effect outside the current reactive context so the feature setup itself never becomes a dependency.

The optional `devtools` describer is what the [devtools panel](/components/query-devtools#features-show-what-they-were-configured-with) lists under the feature's name. It is only called while an entry is being built, so a feature keeps costing nothing without `provideQueryDevtools()`.

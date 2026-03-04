# Query Stack

A query stack executes a fixed, known set of queries in parallel and exposes merged reactive state.

## Usage

```ts
import { createQueryStack } from '@ethlete/query';

const stack = createQueryStack({
  injector,
  queries: [getUser({ injector }, withArgs({ id: 1 })), getSettings({ injector })],
});

stack.loading(); // Signal<QueryLoading | null> — loading if any query is loading
stack.error(); // Signal<HttpErrorResponse | null> — first error, if any
stack.responses; // Tuple of per-query response signals
```

## Limitations

- `withArgs()` cannot be used inside a query stack (error `ET500`). Pass args when constructing the query before passing to the stack.
- `withResponseUpdate()` cannot be used inside a query stack (error `ET501`).

## Error: total/expected count mismatch (ET502)

If a query inside the stack depends on the response of a previous query to compute pagination values, the stack may encounter a mismatch between total and expected query counts. Set `blockExecutionDuringLoading: true` to prevent this.

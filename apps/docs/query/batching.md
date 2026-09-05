# Batching & bulk edits

A bulk edit sends the same mutation many times - archive 300 posts, reassign 40 tickets, delete every selected row. Firing them all at once hammers the API, and a plain `Promise.all`-style fan-out loses the one thing the UI needs most: which items actually failed.

`createQueryBatch` runs one query creator over a list of items with a bounded number of requests in flight, and keeps a per-item outcome so a partial failure stays recoverable.

## Why not a query stack

[Query stacks](/query/stacks#query-stacks) also fan one creator out over many arg sets, but they are built for reads:

|                  | `createQueryStack`                            | `createQueryBatch`                                                            |
| ---------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Triggered by     | signal changes (reactive)                     | a call to `run()` (imperative)                                                |
| Typical method   | `GET`                                         | `POST` / `PUT` / `PATCH` / `DELETE`                                           |
| Requests         | all at once                                   | at most `concurrency` at a time                                               |
| Queries          | kept alive, readable per query                | created per item, destroyed as soon as that item settles                      |
| Failure handling | `anyError()` / `retryFailed()` across queries | a per-item result, plus `retryFailed()` that resends only what didn't succeed |

Reach for a stack when the data is a read that should track signals. Reach for a batch when a button kicks off N writes.

## Basic use

```ts
import { createQueryBatch } from '@ethlete/query';

@Component({/* … */})
export class PostListComponent {
  protected selection = signal<Post[]>([]);

  protected archive = createQueryBatch({
    queryCreator: patchPost,
    args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
    concurrency: 6,
  });

  archiveSelected() {
    this.archive
      .run(this.selection())
      .pipe(
        tap((result) =>
          result.ok ? this.toast.success('Archived') : this.toast.error(`${result.failed.length} failed`),
        ),
      )
      .subscribe();
  }
}
```

`run()` is a **cold Observable**: nothing is sent until you subscribe, and it emits the result once and completes when the batch settles.

::: tip Call it from an injection context
`createQueryBatch` captures the host's `Injector` to build each item's query, and the host's destruction stops an in-flight run.
:::

## The result

`run()` emits a discriminated view of the whole batch, in input order:

```ts
const result = /* emitted by run() */;

result.ok; // every item succeeded or was skipped, nothing left unattempted
result.cancelled; // the run stopped early
result.results; // every item's outcome, in input order
result.succeeded; // { status: 'success', index, item, args, response }[]
result.failed; // { status: 'error', index, item, args, error }[]
result.skipped; // items whose args function returned null
result.notAttempted; // items still queued when the run stopped
```

Every entry carries the original `item` and its `index`, so a failure maps straight back onto the row that caused it - no bookkeeping on your side.

## Reactive progress

The same information is exposed as signals while the batch runs, so a template can drive a progress UI without subscribing to anything:

```html
<button
  [loading]="archive.running()"
  [progress]="archive.progress()"
  (click)="archiveSelected()"
  et-button
  type="button"
>
  Archive {{ selection().length }} posts
</button>

@if (archive.running()) {
<p>{{ archive.completed() }} / {{ archive.total() }} - {{ archive.failed() }} failed</p>
<button (click)="archive.cancel()">Cancel</button>
}
```

| Signal                                 | What it holds                                                           |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `status()`                             | `idle` → `running` → `success` / `partial` / `error` / `cancelled`      |
| `running()`                            | `true` while a run is in flight                                         |
| `total()`, `completed()`, `inFlight()` | counts for the current run                                              |
| `progress()`                           | `0`-`100`, ready to bind to `[progress]` or `<et-progress-bar [value]>` |
| `succeeded()`, `failed()`, `skipped()` | per-status counts                                                       |
| `itemsPerSecond()`                     | measured throughput, or `null` before it can be measured                |
| `remainingTime()`                      | rough ms until the run settles, or `null`                               |
| `results()`                            | the settled outcomes so far, growing as the run progresses              |
| `errors()`, `failedItems()`            | the failures, for an error list                                         |

### Time remaining

A batch of 800 items is exactly where "37%" stops being enough. `remainingTime()` estimates the milliseconds still to go the same way [upload progress](/query/http#request-options) does for a transfer: `itemsPerSecond()` measures the throughput of the current run, and the outstanding items are extrapolated from it.

```html
@if (archive.running()) {
<p>
  {{ archive.completed() }} / {{ archive.total() }} @if (archive.remainingTime(); as remaining) { · {{ remaining / 1000
  | number: '1.0-0' }}s left } @else { · estimating… }
</p>
}
```

Both are `null` until there is something to measure - the first `concurrency` items have to settle and the run has to be at least 2s old - so a template needs the indeterminate branch above. They are re-estimated on every settled item, which means:

- **Uneven items make it jump.** The estimate is an average over the run so far, not a prediction per item. A batch whose items differ wildly in cost will move around; a label reading "about a minute left" survives that better than a ticking countdown.
- **It does not tick on its own.** Nothing recomputes between two settled items, so a batch with slow items updates its estimate slowly. Format it in coarse units rather than seconds if that reads badly.
- **Skipped items count as settled**, so a run that skips a lot of items looks faster than the network actually is.
- `itemsPerSecond()` keeps its final value once the run settles - useful for a "500 items in 40s" summary - while `remainingTime()` drops back to `null` because nothing is outstanding.

For a side effect per item - crossing a row off the moment its update lands - use `onItemSettled` instead of watching `results()`:

```ts
protected archive = createQueryBatch({
  queryCreator: patchPost,
  args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
  onItemSettled: (result) => result.status === 'success' && this.removeRow(result.item),
});
```

## Retrying

A partial failure is the normal case for a bulk edit, and re-running the whole list would resend the mutations that already worked. `retryFailed()` resends **only** the items that did not succeed - the failed ones plus anything a `cancel()` left unattempted - and merges the outcomes back into the same result set:

```html
@if (archive.failed()) {
<button (click)="retry()">Retry {{ archive.failed() }} failed</button>
}
```

```ts
retry() {
  this.archive.retryFailed().subscribe();
}
```

## Skipping, stopping and cancelling

- **Skip an item** by returning `null` from `args`. It is recorded as `skipped`, not as a failure, and `ok` stays `true`.
- **`stopOnError: true`** stops the batch at the first failure. Everything still queued becomes `notAttempted`; requests already in flight are left to settle.
- **`cancel()`** does the same on demand. It deliberately does **not** abort in-flight requests: a mutation the server may already have applied has to be recorded, so those items settle into the results as normal. (Unsubscribing from the run _does_ abort them - prefer `cancel()`.)

## Notes

- **Concurrency defaults to 4.** Raise it for a fast, forgiving API; lower it to 1 for an endpoint that serializes anyway or rate-limits aggressively. Per-request HTTP retries are unchanged - they still come from the creator's or client's [retry policy](/query/errors#retries).
- **Queries are disposable.** Each item's query is created right before it runs and destroyed as soon as it settles, so a 5000-item batch holds `concurrency` queries at a time, not 5000.
- **`withArgs` is rejected.** Args come from the batch's `args` option; passing the feature throws `ET911`.
- **One run at a time.** Subscribing to a second `run()` (or `retryFailed()`) while one is in flight errors with `ET910`.
- **Order is input order**, even though execution interleaves. `results()` and every list on the result are sorted by the item's original index.

## Types

`createQueryBatch` takes a `CreateQueryBatchOptions<TCreator, TItem>` and returns a
`QueryBatch<TItem, TArgs>`; `AnyQueryBatch` erases both. `status()` is a `QueryBatchStatus`
(`'idle' | 'running' | 'success' | 'partial' | 'error' | 'cancelled'`), `run()` resolves with a
`QueryBatchResult<TItem, TArgs>`, and each entry in it is a `QueryBatchItemResult<TItem, TArgs>` -
the union of `QueryBatchItemSuccess`, `QueryBatchItemError`, `QueryBatchItemSkipped` and
`QueryBatchItemCancelled`, discriminated on `status`. `AnyQueryBatchItemResult` is that union with
the generics erased, for a helper that formats a row.

## Inspecting a run in the devtools

With [`provideQueryDevtools()`](/query-devtools/) installed, every `createQueryBatch` registers itself and the panel gets a **Batches** tab: the run's status and progress bar, the measured throughput and time remaining, the concurrency it was configured with, and one row per item with its resolved route, the args it was sent and the response or error it came back with. Failures are listed first, so a cap never drops the items you opened the tab for.

Two details follow from queries being disposable:

- **An item's query only exists while that item is in flight.** The panel keeps a short tail of the most recent ones so a settled item's row still opens the full query detail - request, cURL, run history - but beyond that tail the row falls back to the args and outcome the batch itself recorded. Those are kept for every item.
- **The Queries list folds a run into one row**, expandable to its items. A batch's items differ in every path param, so nothing else would group them, and a run at `concurrency: 20` would otherwise be twenty rows churning through the same slot. Their tombstones are capped per batch, so a bulk run can never evict the destroyed queries the rest of the panel is read for.

## Sequences report progress too

A [query sequence](/query/dependent-queries#imperative-waterfalls-dependent-mutations) - a waterfall of _dependent_ mutations - exposes `completed()` and the same `0`-`100` `progress()` signal, so a multi-step checkout can drive the identical progress UI:

```html
<button [loading]="checkout.running()" [progress]="checkout.progress()" et-button type="button">Place order</button>
```

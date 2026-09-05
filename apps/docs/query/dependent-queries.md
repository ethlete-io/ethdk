# Dependent queries

Sometimes one query can't run until another has produced its data - a query whose path depends on a previously fetched id, or a chain of mutations where each call feeds the next. There are two distinct shapes, and they use different tools.

## Reactive dependencies (GET → GET)

When an [auto-executing](/query/queries#auto-execution) query depends on another query's response, you don't need anything new - read the dependency inside [`withArgs`](/query/features#withargs) and park until it's ready. Returning `null` keeps the dependent query idle while the dependency is still loading; once the response arrives, `withArgs` re-runs and the query executes:

```ts
import { withArgs } from '@ethlete/query';

userQuery = getUser(withArgs(() => ({ pathParams: { id: this.userId() } })));

permsQuery = getPermissions(
  withArgs(() => {
    const user = this.userQuery.response();
    return user ? { pathParams: { userId: user.id } } : null;
  }),
);
```

Each query keeps its own signals, dedup and caching. This is the right tool whenever the chain is reactive and read-only.

## Imperative waterfalls (dependent mutations)

Mutations (`POST`/`PUT`/`PATCH`/`DELETE`) never auto-execute, so a dependent chain of them is inherently imperative - triggered by a button or a form submit, with each step feeding the next and a failure aborting the rest. `querySequence` orchestrates exactly that on top of [`executeUntilSettled`](/query/queries#the-query-object).

```ts
import { querySequence } from '@ethlete/query';

@Component({/* … */})
export class CheckoutComponent {
  private order = signal<OrderDraft>(/* … */);

  // mutation query instances, created the normal way - args come from the sequence
  private createOrder = createOrderQuery();
  private createPayment = createPaymentQuery();
  private confirmOrder = confirmOrderQuery();

  // built once; each args function runs on every .run()
  readonly checkout = querySequence(this.createOrder, () => ({ args: { body: this.order() } }))
    .then(this.createPayment, (order) => ({ args: { body: { orderId: order.id } } }))
    .then(this.confirmOrder, (payment, [order]) => ({
      args: { pathParams: { paymentId: payment.id }, body: { orderRef: order.id } },
    }));

  async submit() {
    const result = await this.checkout.run();

    if (!result.ok) {
      // result.failedAt, result.error (QueryErrorResponse), result.snapshots (up to the failure)
      return;
    }

    // fully-typed tuple: [Order, Payment, Confirmation]
    const [order, payment, confirmation] = result.responses;
  }
}
```

### Building the chain

`querySequence(query, seedArgs)` starts the waterfall with its first step; `.then(query, mapArgs)` appends each dependent step. Both arg producers are **functions evaluated at `run()` time** - so the sequence can safely live as a component field while still reading current signal values on each run.

`mapArgs` receives the previous step's response (unwrapped) and the fully-typed tuple of all responses so far, so a later step can still reach an earlier step's data:

```ts
.then(this.confirmOrder, (payment, [order, _payment]) => ({ args: { /* uses order + payment */ } }))
```

A step that settles with no body - a `204 No Content` `PUT`/`DELETE` - passes `null` to the next `mapArgs`. Declare that step's `response` as nullable (`response: Receipt | null`) and the parameter type follows, so the null-check is the compiler's job:

```ts
.then(this.createOrder, (cleared) => ({ args: { body: { cartRef: cleared?.id ?? null } } }))
```

Steps take **query instances**, not creators - consistent with `executeUntilSettled`, and with how you already create a mutation query to call `.execute()` on it.

### The result

`run()` resolves with a discriminated union - never throws on a failed request:

```ts
type QuerySequenceResult<T extends unknown[]> =
  | { ok: true; responses: T; snapshots: QuerySnapshot[] }
  | { ok: false; failedAt: number; error: QueryErrorResponse; snapshots: QuerySnapshot[] };
```

The chain object itself is a `QuerySequence<TResponses>`, `status()` a `QuerySequenceStatus`, and the seed/step args a `QuerySequenceStepArgs<TArgs>` - the same `{ args }` shape `query.execute()` takes.

On success `responses` is the typed tuple of every step's response. On failure the waterfall stops at the first error - later steps never run - and you get the failing step's index and normalized error. `snapshots` always holds the settled, frozen [snapshots](/query/queries#the-query-object) of every step that ran, so a later re-run can't mutate the results you read.

### Reactive progress

The sequence also exposes signals mirroring [`createQueryStack`](/query/stacks), so a template can drive a stepper or spinner without manual bookkeeping:

| Signal / member | Type                                                  | Description                                         |
| --------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `status`        | `Signal<'idle' \| 'running' \| 'success' \| 'error'>` | Lifecycle phase.                                    |
| `running`       | `Signal<boolean>`                                     | `true` while a run is in flight.                    |
| `currentStep`   | `Signal<number>`                                      | 1-based index of the in-flight step; `0` when idle. |
| `total`         | `number`                                              | Step count of the fully-built chain.                |
| `error`         | `Signal<QueryErrorResponse \| null>`                  | The failing step's error.                           |
| `failedAt`      | `Signal<number \| null>`                              | Zero-based index of the failing step.               |
| `snapshots`     | `Signal<QuerySnapshot[]>`                             | Settled snapshots so far.                           |
| `responses`     | `Signal<Partial<T>>`                                  | Responses so far.                                   |

```html
@if (checkout.running()) {
<et-progress>Step {{ checkout.currentStep() }} / {{ checkout.total }}</et-progress>
} @if (checkout.error(); as err) {
<et-error [error]="err" />
}
```

`completed()` counts the settled steps and `progress()` turns that into a `0`-`100` percentage, so the same run can drive a bar or a determinate button spinner without any arithmetic in the template:

```html
<button [loading]="checkout.running()" [progress]="checkout.progress()" et-button type="button">Place order</button>
```

Every `.then()` returns a new object, but all of them read the same run - so a reference you kept to an earlier link reports the same `total`, `completed()` and `progress()` as the fully-chained one.

### Notes

- **Re-runnable.** Calling `run()` again resets the progress signals and replays the chain (e.g. behind a retry button). Calling it while a run is already in flight throws.
- **Abort only.** The first error stops the waterfall - dependent steps can't run without their upstream data anyway. There is no continue-on-error mode. For _independent_ calls that should tolerate a partial failure, use a [query batch](/query/batching) instead.
- **No rollback.** A mid-chain failure leaves earlier steps' server effects in place; `failedAt` and `snapshots` tell you exactly how far it got, and any compensation is up to you.
- **Cancellation** (inherited from `executeUntilSettled`): if the host scope is destroyed mid-flight - or the step's cache entry is evicted - the in-flight query is torn down and the run stops there like any other failure, resolving with `{ ok: false, failedAt, error }` whose error says the request was cancelled.

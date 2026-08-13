/* eslint-disable @typescript-eslint/no-explicit-any */

import { computed, DestroyRef, inject, Signal, signal, WritableSignal } from '@angular/core';
import { isQueryDevtoolsEnabled, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
import { AnyNewQuery, AnyQuerySnapshot, Query, QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryErrorResponse } from './query-error-response';
import { querySequenceAlreadyRunning } from './query-errors';
import { executeUntilSettled } from './query-snapshot-utils';

/** The last element of a tuple type - the response of the step a `.then()` callback follows. */
type LastOf<T extends unknown[]> = T extends [...unknown[], infer L] ? L : never;

/** The current lifecycle phase of a query sequence. */
export type QuerySequenceStatus = 'idle' | 'running' | 'success' | 'error';

/** The args a sequence step supplies to its query - the same `{ args }` shape `query.execute()` takes. */
export type QuerySequenceStepArgs<TArgs extends QueryArgs> = {
  args: RequestArgs<TArgs>;
};

/**
 * The outcome of a settled {@link QuerySequence.run}.
 *
 * A discriminated union: on success `responses` is the fully-typed tuple of every step's response;
 * on failure `failedAt` is the zero-based index of the step that errored and `error` is its
 * normalized {@link QueryErrorResponse}. `snapshots` always holds the settled snapshots of every
 * step that ran - up to and including the failing one.
 */
export type QuerySequenceResult<TResponses extends unknown[]> =
  | { ok: true; responses: TResponses; snapshots: AnyQuerySnapshot[] }
  | { ok: false; failedAt: number; error: QueryErrorResponse; snapshots: AnyQuerySnapshot[] };

/**
 * An imperative waterfall of dependent queries - usually mutations (`POST`/`PUT`/`PATCH`/`DELETE`)
 * where each call needs the previous call's response.
 *
 * Build the chain once (e.g. as a component field) with {@link querySequence} and `.then()`, then
 * trigger it with {@link run}. Each step runs via `executeUntilSettled`, threading the previous
 * step's response into the next; the first error aborts the rest. The progress signals mirror
 * `createQueryStack`, so a template can drive a stepper without manual bookkeeping.
 */
export type QuerySequence<TResponses extends unknown[]> = {
  /**
   * Appends a dependent step. `mapArgs` runs at {@link run} time and receives the previous step's
   * (unwrapped, non-null on success) response plus the typed tuple of all responses so far, so a
   * later step can still reach an earlier one's data.
   */
  then: <TArgs extends QueryArgs>(
    query: Query<TArgs>,
    mapArgs: (previousResponse: LastOf<TResponses>, responses: TResponses) => QuerySequenceStepArgs<TArgs>,
  ) => QuerySequence<[...TResponses, ResponseType<TArgs>]>;

  /** The current lifecycle phase - `idle` before the first run, then `running` → `success` | `error`. */
  status: Signal<QuerySequenceStatus>;

  /** `true` while a run is in flight. */
  running: Signal<boolean>;

  /** The 1-based index of the in-flight step, or `0` when idle. */
  currentStep: Signal<number>;

  /** How many steps have settled - the successful ones plus the failing one. */
  completed: Signal<number>;

  /**
   * How far the waterfall has got, as a percentage (`0`-`100`) so it can be bound straight to
   * `<et-progress-bar [value]>` or a button's `[progress]`. A run that fails stops where it stopped.
   */
  progress: Signal<number>;

  /** The static number of steps in the sequence. */
  total: number;

  /** The query objects backing each step, in order. Useful for devtools / advanced introspection. */
  queries: AnyNewQuery[];

  /** The error of the step that failed, or `null` while running / on success. */
  error: Signal<QueryErrorResponse | null>;

  /** The zero-based index of the step that failed, or `null` while running / on success. */
  failedAt: Signal<number | null>;

  /** The settled snapshots of every step that has run, grows as the waterfall progresses. */
  snapshots: Signal<AnyQuerySnapshot[]>;

  /**
   * The resolved input args each step was run with, grows as the waterfall progresses. The value at
   * index `i` is what {@link QuerySequence.then}'s `mapArgs` produced for step `i` at run time.
   */
  stepArgs: Signal<unknown[]>;

  /** The responses of every step that has succeeded, grows as the waterfall progresses. */
  responses: Signal<Partial<TResponses>>;

  /**
   * Runs every step in order, resolving once the waterfall settles.
   *
   * Resets the progress signals, then awaits each step in turn - stopping at the first error and
   * resolving with `{ ok: false, failedAt, error }`, or `{ ok: true, responses }` when all steps
   * succeed. Re-runnable (e.g. behind a retry button); throws {@link querySequenceAlreadyRunning}
   * if a run is already in flight.
   *
   * Cancellation caveat (inherited from `executeUntilSettled`): if the host scope is destroyed
   * mid-flight the in-flight query is torn down and this promise never settles.
   */
  run: () => Promise<QuerySequenceResult<TResponses>>;
};

type InternalStep = {
  query: AnyNewQuery;
  produceArgs: (previousResponse: unknown, responses: unknown[]) => QuerySequenceStepArgs<QueryArgs>;
};

type SequenceState = {
  status: WritableSignal<QuerySequenceStatus>;
  running: WritableSignal<boolean>;
  currentStep: WritableSignal<number>;
  error: WritableSignal<QueryErrorResponse | null>;
  failedAt: WritableSignal<number | null>;
  snapshots: WritableSignal<AnyQuerySnapshot[]>;
  stepArgs: WritableSignal<unknown[]>;
  responses: WritableSignal<unknown[]>;
};

const createSequenceState = (): SequenceState => ({
  status: signal<QuerySequenceStatus>('idle'),
  running: signal(false),
  currentStep: signal(0),
  error: signal<QueryErrorResponse | null>(null),
  failedAt: signal<number | null>(null),
  snapshots: signal<AnyQuerySnapshot[]>([]),
  stepArgs: signal<unknown[]>([]),
  responses: signal<unknown[]>([]),
});

/**
 * A stable holder the devtools registry keeps as a sequence entry's handle. Because `.then()`
 * returns a fresh {@link QuerySequence} object per link (all sharing one {@link SequenceState}),
 * `current` is updated to the latest link so the UI always reads the fully-built sequence.
 * @internal
 */
export type QuerySequenceDevtoolsHandle = { current: QuerySequence<any> };

const buildSequence = <TResponses extends unknown[]>(
  steps: InternalStep[],
  state: SequenceState,
  devtoolsHandle?: QuerySequenceDevtoolsHandle,
): QuerySequence<TResponses> => {
  const run = async (): Promise<QuerySequenceResult<TResponses>> => {
    if (state.running()) throw querySequenceAlreadyRunning();

    state.status.set('running');
    state.running.set(true);
    state.currentStep.set(0);
    state.error.set(null);
    state.failedAt.set(null);
    state.snapshots.set([]);
    state.stepArgs.set([]);
    state.responses.set([]);

    const snapshots: AnyQuerySnapshot[] = [];
    const stepArgs: unknown[] = [];
    const responses: unknown[] = [];
    let previousResponse: unknown = undefined;

    for (const [i, step] of steps.entries()) {
      state.currentStep.set(i + 1);

      const { args } = step.produceArgs(previousResponse, responses);
      stepArgs.push(args);
      state.stepArgs.set([...stepArgs]);
      const snapshot = await executeUntilSettled(step.query, { args });

      snapshots.push(snapshot);
      state.snapshots.set([...snapshots]);

      const error = snapshot.error();

      if (error) {
        state.status.set('error');
        state.error.set(error);
        state.failedAt.set(i);
        state.running.set(false);

        return { ok: false, failedAt: i, error, snapshots };
      }

      const response = snapshot.response();
      responses.push(response);
      state.responses.set([...responses]);
      previousResponse = response;
    }

    state.status.set('success');
    state.running.set(false);

    return { ok: true, responses: responses as TResponses, snapshots };
  };

  const completed = computed(() => state.snapshots().length);

  const sequence: QuerySequence<TResponses> = {
    then: (query, mapArgs) =>
      buildSequence(
        [
          ...steps,
          { query, produceArgs: (previousResponse, responses) => mapArgs(previousResponse as any, responses as any) },
        ],
        state,
        devtoolsHandle,
      ) as any,
    status: state.status.asReadonly(),
    running: state.running.asReadonly(),
    currentStep: state.currentStep.asReadonly(),
    completed,
    progress: computed(() => (steps.length === 0 ? 0 : (completed() / steps.length) * 100)),
    total: steps.length,
    queries: steps.map((s) => s.query),
    error: state.error.asReadonly(),
    failedAt: state.failedAt.asReadonly(),
    snapshots: state.snapshots.asReadonly(),
    stepArgs: state.stepArgs.asReadonly(),
    responses: state.responses.asReadonly() as Signal<Partial<TResponses>>,
    run,
  };

  if (devtoolsHandle) devtoolsHandle.current = sequence;

  return sequence;
};

/**
 * Starts an imperative waterfall of dependent queries. Chain the remaining steps with `.then()`
 * and trigger it with `.run()` - see {@link QuerySequence}.
 *
 * The seed step's `args` are produced lazily (at `run()` time), so the sequence can safely live as
 * a component field while still reading current signal values on each run.
 *
 * @example
 * ```ts
 * readonly checkout = querySequence(this.createOrder, () => ({ args: { body: this.order() } }))
 *   .then(this.createPayment, (order) => ({ args: { body: { orderId: order.id } } }))
 *   .then(this.confirmOrder, (payment, [order]) => ({
 *     args: { pathParams: { paymentId: payment.id }, body: { orderRef: order.id } },
 *   }));
 *
 * async submit() {
 *   const result = await this.checkout.run();
 *   if (!result.ok) return this.handle(result.error);
 *   const [order, payment, confirmation] = result.responses;
 * }
 * ```
 */
export const querySequence = <TArgs extends QueryArgs>(
  query: Query<TArgs>,
  seedArgs: () => QuerySequenceStepArgs<TArgs>,
): QuerySequence<[ResponseType<TArgs>]> => {
  const devtoolsHandle: QuerySequenceDevtoolsHandle | undefined = isQueryDevtoolsEnabled()
    ? { current: null as unknown as QuerySequence<any> }
    : undefined;

  const seed = buildSequence<[ResponseType<TArgs>]>(
    [{ query, produceArgs: () => seedArgs() }],
    createSequenceState(),
    devtoolsHandle,
  );

  if (devtoolsHandle) {
    const unregister = registerQueryDevtoolsEntry({
      kind: 'query-sequence',
      handle: devtoolsHandle,
      meta: {},
    });

    // Sequences have no destroy hook; tie cleanup to the creating scope when there is one.
    try {
      inject(DestroyRef).onDestroy(unregister);
    } catch {
      // Created outside an injection context - the entry lives for the app's lifetime.
    }
  }

  return seed;
};

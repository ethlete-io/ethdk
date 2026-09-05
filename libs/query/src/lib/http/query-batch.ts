/* eslint-disable @typescript-eslint/no-explicit-any */

import { computed, DestroyRef, inject, Injector, runInInjectionContext, Signal, signal } from '@angular/core';
import {
  defer,
  EMPTY,
  filter,
  finalize,
  from,
  map,
  mergeMap,
  Observable,
  Subject,
  take,
  takeUntil,
  tap,
  toArray,
} from 'rxjs';
import {
  isQueryDevtoolsEnabled,
  registerQueryDevtoolsEntry,
  runInQueryDevtoolsBatch,
} from '../devtools/query-devtools-hook';
import { SPEED_BUFFER_TIME_IN_MS } from './http-request';
import { Query, QueryArgs, RequestArgs, ResponseType } from './query';
import { AnyCreateQueryClientResult } from './query-client';
import { AnyQueryCreator, QueryArgsOf, QueryMethod } from './query-creator';
import { createQueryErrorResponse, QueryErrorResponse } from './query-error-response';
import { queryBatchAlreadyRunning, queryBatchWithArgsUsed } from './query-errors';
import { QueryFeature, QueryFeatureType } from './query-features';

/** The current lifecycle phase of a query batch. */
export type QueryBatchStatus = 'idle' | 'running' | 'success' | 'partial' | 'error' | 'cancelled';

export type QueryBatchItemSuccess<TItem, TArgs extends QueryArgs> = {
  status: 'success';
  index: number;
  item: TItem;
  args: RequestArgs<TArgs>;
  response: ResponseType<TArgs>;
};

export type QueryBatchItemError<TItem, TArgs extends QueryArgs> = {
  status: 'error';
  index: number;
  item: TItem;
  args: RequestArgs<TArgs>;
  error: QueryErrorResponse;
};

/** An item whose `args` function returned `null` - it was never sent. */
export type QueryBatchItemSkipped<TItem> = {
  status: 'skipped';
  index: number;
  item: TItem;
};

/** An item that was still queued when the run was cancelled or stopped by `stopOnError`. */
export type QueryBatchItemCancelled<TItem> = {
  status: 'cancelled';
  index: number;
  item: TItem;
};

export type QueryBatchItemResult<TItem, TArgs extends QueryArgs> =
  | QueryBatchItemSuccess<TItem, TArgs>
  | QueryBatchItemError<TItem, TArgs>
  | QueryBatchItemSkipped<TItem>
  | QueryBatchItemCancelled<TItem>;

/** The outcome of a settled {@link QueryBatch.run} or {@link QueryBatch.retryFailed}. */
export type QueryBatchResult<TItem, TArgs extends QueryArgs> = {
  /** `true` when every item either succeeded or was skipped, and nothing was left unattempted. */
  ok: boolean;

  /** `true` if the run stopped early - through `cancel()` or `stopOnError`. */
  cancelled: boolean;

  /** Every item's outcome, in input order. */
  results: QueryBatchItemResult<TItem, TArgs>[];

  succeeded: QueryBatchItemSuccess<TItem, TArgs>[];
  failed: QueryBatchItemError<TItem, TArgs>[];
  skipped: QueryBatchItemSkipped<TItem>[];
  notAttempted: QueryBatchItemCancelled<TItem>[];
};

/**
 * Runs one mutation over many items with a bounded number of requests in flight, keeping a per-item
 * outcome so a partial failure stays recoverable.
 *
 * Built by {@link createQueryBatch}. Unlike a query stack the queries are not kept around: each item
 * gets a query, runs it, and the query is destroyed once it settles - so a batch of 5000 items holds
 * `concurrency` queries at a time, not 5000.
 */
export type QueryBatch<TItem, TArgs extends QueryArgs> = {
  /** The current lifecycle phase - `idle` before the first run, then `running` → the settled phase. */
  status: Signal<QueryBatchStatus>;

  /** `true` while a run is in flight. */
  running: Signal<boolean>;

  /** How many items the current (or last) run covers. */
  total: Signal<number>;

  /** How many items have settled in any way - success, error, skipped or cancelled. */
  completed: Signal<number>;

  /** How many requests are in flight right now, at most `concurrency`. */
  inFlight: Signal<number>;

  succeeded: Signal<number>;
  failed: Signal<number>;
  skipped: Signal<number>;

  /**
   * How far the run has got, as a percentage (`0`-`100`) so it can be bound straight to
   * `<et-progress-bar [value]>` or a button's `[progress]`. `0` before the first run.
   */
  progress: Signal<number>;

  /**
   * Items settling per second, averaged over the current (or last) run - the batch counterpart of a
   * transfer's `speed`. `null` until enough items have settled to measure.
   */
  itemsPerSecond: Signal<number | null>;

  /**
   * Roughly how much longer the run needs, in milliseconds: the items still outstanding at the
   * measured {@link QueryBatch.itemsPerSecond}. `null` while there is no throughput to extrapolate
   * from and once nothing is left, so a template can fall back to an indeterminate label.
   *
   * It re-estimates on every settled item, and a batch whose items differ wildly in cost will move
   * around a lot - treat it as an estimate, not a countdown.
   */
  remainingTime: Signal<number | null>;

  /** Every settled item's outcome so far, in input order. Grows as the run progresses. */
  results: Signal<QueryBatchItemResult<TItem, TArgs>[]>;

  /** The errors of every failed item so far. */
  errors: Signal<QueryErrorResponse[]>;

  /** The items that failed, for a "3 of 500 could not be updated" list. */
  failedItems: Signal<TItem[]>;

  /**
   * Runs the mutation once per item. Cold: nothing is sent until it is subscribed to, and it emits
   * the result once and completes when the batch settles.
   *
   * Subscribing resets the previous run's results. Errors with {@link queryBatchAlreadyRunning} if a
   * run is still in flight. A failing item does not abort the rest unless `stopOnError` is set.
   */
  run: (items: readonly TItem[]) => Observable<QueryBatchResult<TItem, TArgs>>;

  /**
   * Re-runs only the items that did not succeed - the failed ones plus anything left unattempted by
   * a `cancel()` or `stopOnError`. Successful items are never sent twice, which is what makes this
   * safe to put behind a retry button in a bulk edit. Cold, like {@link QueryBatch.run}.
   */
  retryFailed: () => Observable<QueryBatchResult<TItem, TArgs>>;

  /**
   * Stops scheduling further items. Requests already in flight are **not** aborted - a mutation the
   * server may have already applied must still be recorded - so they settle into the results as
   * normal and the run emits once they do.
   *
   * Unsubscribing from the run does abort everything in flight, which for a mutation is rarely what
   * you want. Prefer this.
   */
  cancel: () => void;

  /** Clears the results and returns to `idle`. Ignored while a run is in flight. */
  reset: () => void;
};

export type AnyQueryBatch = QueryBatch<any, any>;

export type AnyQueryBatchItemResult = QueryBatchItemResult<any, any>;

/**
 * The stable holder the devtools registry keeps as a batch entry's handle, and which every one of the
 * batch's item queries is attributed to. Read `current` to reach the batch itself.
 *
 * Indirect because it has to exist before the {@link QueryBatch} it points at does: the code that
 * creates an item query closes over the owner while the batch object is still being built.
 */
export type QueryBatchDevtoolsHandle = { current: AnyQueryBatch };

export type CreateQueryBatchOptions<TCreator extends AnyQueryCreator, TItem> = {
  /** The query creator to run per item - usually a `POST`/`PUT`/`PATCH`/`DELETE`. */
  queryCreator: TCreator;

  /**
   * Builds one item's request args. Return `null` to skip the item without sending anything - it is
   * recorded as `skipped` rather than as a failure.
   */
  args: (item: TItem, index: number) => RequestArgs<QueryArgsOf<TCreator>> | null;

  /**
   * How many requests may be in flight at once.
   *
   * @default 4
   */
  concurrency?: number;

  /**
   * If `true`, the first failure stops the batch: everything still queued is recorded as `cancelled`
   * and the requests already in flight are left to settle.
   *
   * @default false
   */
  stopOnError?: boolean;

  /**
   * Features applied to every query in the batch.
   *
   * @throws If the `withArgs` feature is used - args come from the `args` option.
   */
  features?: QueryFeature<any>[];

  /** Passed to each `execute()`. Only meaningful when batching cacheable (`GET`-like) requests. */
  allowCache?: boolean;

  /**
   * Called as each item settles, before the run emits. Use it to stream progress into the UI -
   * removing a row the moment its update lands, say.
   */
  onItemSettled?: (result: QueryBatchItemResult<TItem, QueryArgsOf<TCreator>>) => void;
};

type BatchEntry<TItem> = { item: TItem; index: number };

/**
 * Runs the same mutation over a list of items - the bulk edit / bulk delete shape - with a bounded
 * number of requests in flight and a per-item outcome.
 *
 * Where a query stack fans a reactive read out over many arg sets and keeps every query alive, a
 * batch is imperative and disposable: it is triggered by a button, it tolerates a partial failure,
 * and it destroys each query as soon as that item settles.
 *
 * Call it from an injection context; the host's destruction stops an in-flight run.
 *
 * @example
 * ```ts
 * protected archivePosts = createQueryBatch({
 *   queryCreator: patchPost,
 *   args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
 *   concurrency: 6,
 * });
 *
 * archiveSelected() {
 *   this.archivePosts
 *     .run(this.selection())
 *     .pipe(tap((result) => result.ok || this.toast.error(`${result.failed.length} failed`)))
 *     .subscribe();
 * }
 * ```
 *
 * ```html
 * <button et-button [loading]="archivePosts.running()" [progress]="archivePosts.progress()">Archive</button>
 * @if (archivePosts.failed()) {
 *   <button (click)="retry()">Retry {{ archivePosts.failed() }} failed</button>
 * }
 * ```
 */
export const createQueryBatch = <TCreator extends AnyQueryCreator, TItem>(
  options: CreateQueryBatchOptions<TCreator, TItem>,
): QueryBatch<TItem, QueryArgsOf<TCreator>> => {
  type TArgs = QueryArgsOf<TCreator>;
  type ItemResult = QueryBatchItemResult<TItem, TArgs>;

  const { queryCreator, args: mapArgs, stopOnError, allowCache, onItemSettled, features = [] } = options;
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));

  if (features.some((f) => f.type === QueryFeatureType.WITH_ARGS)) {
    throw queryBatchWithArgsUsed();
  }

  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);

  const devtoolsHandle: QueryBatchDevtoolsHandle | undefined = isQueryDevtoolsEnabled()
    ? { current: null as unknown as AnyQueryBatch }
    : undefined;

  const status = signal<QueryBatchStatus>('idle');
  const running = signal(false);
  const total = signal(0);
  const inFlight = signal(0);
  const results = signal<ItemResult[]>([]);
  const runStartedAt = signal<number | null>(null);
  const lastSettleAt = signal<number | null>(null);
  const completedBeforeRun = signal(0);

  let settled: (ItemResult | undefined)[] = [];
  let cancelRequested = false;
  let hostDestroyed = false;

  const hostDestroyed$ = new Subject<void>();

  destroyRef.onDestroy(() => {
    hostDestroyed = true;
    cancelRequested = true;
    hostDestroyed$.next();
    hostDestroyed$.complete();
  });

  const publish = () => results.set(settled.filter((r): r is ItemResult => !!r));

  const record = (result: ItemResult) => {
    settled[result.index] = result;
    lastSettleAt.set(Date.now());
    publish();
    onItemSettled?.(result as QueryBatchItemResult<TItem, QueryArgsOf<TCreator>>);
  };

  const countOf = (of: ItemResult['status']) => computed(() => results().filter((r) => r.status === of).length);

  const completed = computed(() => results().length);
  const failedResults = computed(() =>
    results().filter((r): r is QueryBatchItemError<TItem, TArgs> => r.status === 'error'),
  );

  // Measured from the run's start rather than between the last two settles: items land in waves of
  // `concurrency`, so an instantaneous rate swings between zero and a burst.
  const itemsPerSecond = computed(() => {
    const startedAt = runStartedAt();
    const measuredAt = lastSettleAt();

    if (startedAt === null || measuredAt === null) return null;

    const elapsedMs = measuredAt - startedAt;
    const settledInRun = completed() - completedBeforeRun();

    // One settled item says nothing about a run of `concurrency` parallel ones, and a run shorter
    // than the buffer extrapolates a whole batch out of its own warm-up.
    if (elapsedMs < SPEED_BUFFER_TIME_IN_MS || settledInRun < Math.min(concurrency, total())) return null;

    return (settledInRun / elapsedMs) * 1000;
  });

  const remainingTime = computed(() => {
    const rate = itemsPerSecond();
    const outstanding = total() - completed();

    if (rate === null || rate <= 0 || outstanding <= 0) return null;

    return Math.round((outstanding / rate) * 1000);
  });

  const runEntry = (entry: BatchEntry<TItem>): Observable<unknown> =>
    defer(() => {
      if (cancelRequested) {
        record({ status: 'cancelled', index: entry.index, item: entry.item });

        return EMPTY;
      }

      const args = mapArgs(entry.item, entry.index);

      if (args === null) {
        record({ status: 'skipped', index: entry.index, item: entry.item });

        return EMPTY;
      }

      // The args reach the query through `execute()`, never `withArgs()`, so a function route has to
      // be told the missing feature is intentional or creating the query throws ET100.
      const create = () => queryCreator({ silenceMissingWithArgsFeatureError: true }, ...features);

      let query: Query<TArgs> | undefined;

      try {
        query = runInInjectionContext(injector, () =>
          devtoolsHandle ? runInQueryDevtoolsBatch({ batch: devtoolsHandle, index: entry.index }, create) : create(),
        ) as Query<TArgs>;

        // Count the item only once `execute()` has returned: it can throw (a route function of the
        // consumer, ET800), and the `finalize` that decrements again belongs to the observable below.
        query.execute({ args, options: { allowCache } });
        inFlight.update((count) => count + 1);
      } catch (error) {
        query?.subtle.destroy();
        record({
          status: 'error',
          index: entry.index,
          item: entry.item,
          args,
          error: createQueryErrorResponse(error),
        });

        if (stopOnError) cancelRequested = true;

        return EMPTY;
      }

      const snapshot = query.createSnapshot();

      return snapshot.isAlive.asObservable().pipe(
        filter((isAlive) => !isAlive),
        take(1),
        // A destroyed host tears the query down without ever settling it, so the run would hang.
        takeUntil(hostDestroyed$),
        tap(() => {
          const error = snapshot.error();

          if (error) {
            record({ status: 'error', index: entry.index, item: entry.item, args, error });

            if (stopOnError) cancelRequested = true;

            return;
          }

          record({
            status: 'success',
            index: entry.index,
            item: entry.item,
            args,
            response: snapshot.response() as ResponseType<TArgs>,
          });
        }),
        finalize(() => {
          inFlight.update((count) => count - 1);

          // The host's destruction already tore the query's injector down; destroying it again throws.
          if (!hostDestroyed) query.subtle.destroy();
        }),
      );
    });

  const settleRun = (entries: BatchEntry<TItem>[]): QueryBatchResult<TItem, TArgs> => {
    const stoppedEarly = cancelRequested;

    for (const entry of entries) {
      settled[entry.index] ??= { status: 'cancelled', index: entry.index, item: entry.item };
    }

    publish();
    running.set(false);

    const all = results();
    const succeeded = all.filter((r): r is QueryBatchItemSuccess<TItem, TArgs> => r.status === 'success');
    const failed = all.filter((r): r is QueryBatchItemError<TItem, TArgs> => r.status === 'error');
    const skipped = all.filter((r): r is QueryBatchItemSkipped<TItem> => r.status === 'skipped');
    const notAttempted = all.filter((r): r is QueryBatchItemCancelled<TItem> => r.status === 'cancelled');

    if (failed.length === 0) status.set(notAttempted.length === 0 ? 'success' : 'cancelled');
    else status.set(succeeded.length === 0 ? 'error' : 'partial');

    return {
      ok: failed.length === 0 && notAttempted.length === 0,
      cancelled: stoppedEarly,
      results: all,
      succeeded,
      failed,
      skipped,
      notAttempted,
    };
  };

  const runEntries = (collect: () => BatchEntry<TItem>[]): Observable<QueryBatchResult<TItem, TArgs>> =>
    defer(() => {
      if (running()) throw queryBatchAlreadyRunning();

      const entries = collect();

      cancelRequested = false;
      running.set(true);
      status.set('running');
      publish();

      // After `publish()`: a retry clears its entries first, so this reads the count the retried
      // items are measured against, not the one from before they were dropped.
      completedBeforeRun.set(completed());
      runStartedAt.set(Date.now());
      lastSettleAt.set(null);

      return from(entries).pipe(
        mergeMap((entry) => runEntry(entry), concurrency),
        toArray(),
        map(() => settleRun(entries)),
        finalize(() => {
          if (status() === 'running') status.set('idle');
          running.set(false);
        }),
      );
    });

  const run = (items: readonly TItem[]) =>
    runEntries(() => {
      settled = new Array(items.length);
      total.set(items.length);

      return items.map((item, index) => ({ item, index }));
    });

  const retryFailed = () =>
    runEntries(() => {
      const entries = results()
        .filter((r) => r.status === 'error' || r.status === 'cancelled')
        .map((r) => ({ item: r.item, index: r.index }));

      for (const entry of entries) {
        settled[entry.index] = undefined;
      }

      return entries;
    });

  const batch: QueryBatch<TItem, TArgs> = {
    status: status.asReadonly(),
    running: running.asReadonly(),
    total: total.asReadonly(),
    completed,
    inFlight: inFlight.asReadonly(),
    succeeded: countOf('success'),
    failed: countOf('error'),
    skipped: countOf('skipped'),
    progress: computed(() => {
      const count = total();

      return count === 0 ? 0 : (completed() / count) * 100;
    }),
    itemsPerSecond,
    remainingTime,
    results: results.asReadonly(),
    errors: computed(() => failedResults().map((r) => r.error)),
    failedItems: computed(() => failedResults().map((r) => r.item)),
    run,
    retryFailed,
    cancel: () => {
      cancelRequested = true;
    },
    reset: () => {
      if (running()) return;

      settled = [];
      total.set(0);
      results.set([]);
      status.set('idle');
      runStartedAt.set(null);
      lastSettleAt.set(null);
      completedBeforeRun.set(0);
    },
  };

  if (devtoolsHandle) {
    devtoolsHandle.current = batch;

    const internals = queryCreator.subtle.creatorInternals as {
      route?: unknown;
      method?: QueryMethod;
      client?: AnyCreateQueryClientResult;
    };

    const unregister = registerQueryDevtoolsEntry({
      kind: 'query-batch',
      handle: devtoolsHandle,
      route: internals.route,
      clientRef: internals.client,
      meta: { method: internals.method, concurrency, stopOnError: !!stopOnError },
    });

    destroyRef.onDestroy(unregister);
  }

  return batch;
};

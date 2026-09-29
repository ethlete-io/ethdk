import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentApiAnswer,
  AgentApiApprovalStatus,
  AgentApiQueued,
  AgentApproval,
  AgentApprovalRequest,
  approvableByAll,
  approvalStatusOf,
  dayBoundaryOf,
  enqueueApproval,
  localDayKey,
  markApproval,
  openApprovalFor,
  settleApprovalQueue,
  withStaleStandInCreatesExpired,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  filter,
  interval,
  map,
  of,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectWindowLock } from '../window-lock';

const SETTLE_EVERY_MS = 60_000;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The writes agents asked for, waiting for the user's press.
 *
 * It is read from the encrypted store on every unlock and dropped from memory on every lock, so a
 * locked window holds none of it. An approved item is handed to `approved$`; whoever carries it out
 * reports back through `finish`.
 */
const APPROVAL_QUEUE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const windowLock = injectWindowLock();
  const queue = signal<AgentApproval[]>([]);
  const loaded = signal(false);
  const failure = signal<string | null>(null);
  const saves$ = new Subject<void>();
  const approved$ = new Subject<AgentApproval>();

  const today = () => localDayKey(new Date(), dayBoundaryOf(settings.settings()));

  // A change before the read landed would save over the stored queue with a partial one.
  const change = (next: AgentApproval[]) => {
    if (!loaded()) return;

    queue.set(next);
    saves$.next();
  };

  const settle = () => {
    const current = queue();
    const settled = withStaleStandInCreatesExpired(settleApprovalQueue(current, today()), settings.settings().standIns);

    if (settled.length !== current.length || settled.some((item, index) => item !== current[index])) change(settled);
  };

  toObservable(windowLock.isLocked)
    .pipe(
      switchMap((locked) => {
        queue.set([]);
        loaded.set(false);
        failure.set(null);

        if (locked) return EMPTY;

        return ports.approvals.read$().pipe(
          catchError((error: unknown) => {
            failure.set(messageOf(error));

            return EMPTY;
          }),
        );
      }),
      tap((read) => {
        queue.set(read);
        loaded.set(true);
        settle();
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  // `concatMap` over the latest snapshot: two presses in a row must reach the store in order.
  saves$
    .pipe(
      concatMap(() =>
        ports.approvals.save$(queue()).pipe(
          catchError((error: unknown) => {
            failure.set(messageOf(error));

            return EMPTY;
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  interval(SETTLE_EVERY_MS)
    .pipe(
      filter(() => loaded()),
      tap(settle),
      takeUntilDestroyed(),
    )
    .subscribe();

  toObservable(computed(() => settings.settings().standIns))
    .pipe(
      filter(() => loaded()),
      tap(settle),
      takeUntilDestroyed(),
    )
    .subscribe();

  const whenLoaded$ = toObservable(computed(() => ({ isLoaded: loaded(), failed: failure() }))).pipe(
    switchMap(({ isLoaded, failed }) => {
      if (failed) return throwError(() => new Error(`Timetrack could not read its approval queue: ${failed}`));

      return isLoaded ? of(true) : EMPTY;
    }),
    take(1),
  );

  const find = (id: string) => queue().find((item) => item.id === id);

  const approveOne = (item: AgentApproval) => {
    change(markApproval(queue(), { id: item.id, state: 'running' }));
    approved$.next(item);
  };

  return {
    items: queue.asReadonly(),
    /** Whether `items` holds the stored queue yet. Before that it is empty whatever the store holds. */
    isLoaded: loaded.asReadonly(),
    waiting: computed(() => queue().filter((item) => item.state === 'queued' || item.state === 'running')),
    approvableByAll: computed(() => approvableByAll(queue(), settings.settings().actionClasses)),
    failure: failure.asReadonly(),
    approved$: approved$.asObservable(),

    /** A `target` an item from the same client still waits for answers that item and queues nothing. */
    enqueue$: (options: {
      request: AgentApprovalRequest;
      client?: string;
      target?: string;
    }): Observable<AgentApiQueued> =>
      whenLoaded$.pipe(
        map(() => {
          settle();

          const { target } = options;
          const open = target ? openApprovalFor(queue(), { client: options.client, target }) : undefined;

          if (open) return { status: 'queued', approvalId: open.id };

          const id = crypto.randomUUID();

          change(enqueueApproval(queue(), { id, ...options, at: new Date(), day: today() }));

          return { status: 'queued', approvalId: id };
        }),
      ),

    status$: (id: string): Observable<AgentApiApprovalStatus> =>
      whenLoaded$.pipe(
        map(() => {
          settle();

          const item = find(id);

          if (!item) throw new Error(`Timetrack holds no approval ${id}.`);

          return approvalStatusOf(item);
        }),
      ),

    approve: (id: string) => {
      settle();

      const item = find(id);

      if (item?.state === 'queued') approveOne(item);
    },

    approveAll: () => {
      settle();
      approvableByAll(queue(), settings.settings().actionClasses).forEach(approveOne);
    },

    reject: (id: string) => {
      settle();

      if (find(id)?.state === 'queued')
        change(markApproval(queue(), { id, state: 'rejected', decidedAtMs: Date.now() }));
    },

    finish: (id: string, answer: AgentApiAnswer) =>
      change(
        markApproval(queue(), {
          id,
          state: 'approved',
          decidedAtMs: Date.now(),
          ...(answer.ok ? { result: answer.value } : { error: answer.message }),
        }),
      ),
  };
});

export const injectApprovalQueue = /* @__PURE__ */ toInjectFn(APPROVAL_QUEUE_DEF);

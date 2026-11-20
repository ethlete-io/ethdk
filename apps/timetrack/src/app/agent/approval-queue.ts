import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentApiAnswer,
  AgentApiApprovalStatus,
  AgentApiQueued,
  AgentApiWaitingApproval,
  AgentApproval,
  AgentApprovalRequest,
  AutoModeAnswer,
  approvableByAll,
  approvalStatusOf,
  dayBoundaryOf,
  enqueueApproval,
  localDayKey,
  markApproval,
  findApproval,
  foldedApprovalOf,
  rejectApproval,
  settleApprovalQueue,
  SharedApprovalQueue,
  waitingApprovalsOf,
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
import { PairedMachine, injectHostPorts } from '../../host';
import { approvedCreatesToRun, mergedApprovalQueue } from '../peers/shared-approvals';
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
  const queued$ = new Subject<AgentApproval>();

  const today = () => localDayKey(new Date(), dayBoundaryOf(settings.settings()));
  const sharingAnswers = signal<readonly AutoModeAnswer[] | undefined>(undefined);
  const pairedMachines = signal<readonly PairedMachine[] | undefined>(undefined);
  const machineId = toSignal(ports.peers.machineId$().pipe(catchError(() => EMPTY)), { initialValue: null });

  // A change before the read landed would save over the stored queue with a partial one.
  const change = (next: AgentApproval[]) => {
    if (!loaded()) return;

    queue.set(next);
    saves$.next();
  };

  const revise = (next: (current: readonly AgentApproval[]) => AgentApproval[]) => {
    const current = queue();
    const revised = next(current);

    if (revised.length !== current.length || revised.some((item, index) => item !== current[index])) change(revised);
  };

  const settle = () =>
    revise((current) =>
      withStaleStandInCreatesExpired(settleApprovalQueue(current, today()), {
        standIns: settings.settings().standIns,
        answers: sharingAnswers(),
      }),
    );

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

  const find = (id: string) => findApproval(queue(), id);

  const approveOne = (item: AgentApproval) => {
    change(markApproval(queue(), { id: item.id, state: 'running', decidedAtMs: Date.now() }));
    approved$.next(item);
  };

  const approvedHere = signal<ReadonlySet<string>>(new Set());

  const runsHere = (item: AgentApproval) => !item.ownerMachineId || item.ownerMachineId === machineId();

  const runReadyCreates = () =>
    approvedCreatesToRun({
      machineId: machineId(),
      queue: queue(),
      machines: pairedMachines(),
      nowMs: Date.now(),
    }).forEach(approveOne);

  const waitsForPeers = (item: AgentApproval) =>
    item.request.op === 'jira.create' &&
    item.state === 'approved' &&
    item.result === undefined &&
    item.error === undefined &&
    runsHere(item);

  const approveHere = (item: AgentApproval) => {
    if (runsHere(item) && item.request.op === 'jira.create') {
      change(markApproval(queue(), { id: item.id, state: 'approved', decidedAtMs: Date.now() }));
      runReadyCreates();
    } else if (runsHere(item)) approveOne(item);
    else {
      approvedHere.update((ids) => new Set(ids).add(item.id));
      change(markApproval(queue(), { id: item.id, state: 'approved', decidedAtMs: Date.now() }));
    }
  };

  return {
    items: queue.asReadonly(),
    /** Whether `items` holds the stored queue yet. Before that it is empty whatever the store holds. */
    isLoaded: loaded.asReadonly(),
    waiting: computed(() =>
      queue().filter((item) => item.state === 'queued' || item.state === 'running' || waitsForPeers(item)),
    ),
    approvedElsewhere: computed(() =>
      queue().filter(
        (item) =>
          item.state === 'approved' &&
          !!item.ownerMachineId &&
          item.ownerMachineId !== machineId() &&
          !approvedHere().has(item.id) &&
          item.result === undefined &&
          item.error === undefined,
      ),
    ),
    approvableByAll: computed(() => approvableByAll(queue(), settings.settings().actionClasses)),
    failure: failure.asReadonly(),
    approved$: approved$.asObservable(),
    /** Each item as it is newly queued. An ask its open item already answers queues nothing. */
    queued$: queued$.asObservable(),

    /** Replaces the stored queue with what `next` makes of it. Nothing changes before the queue is read. */
    revise,

    /** Today's auto mode answers, so settling keeps a create that another subject's draft still shares. */
    shareAnswers: (answers: readonly AutoModeAnswer[]) => sharingAnswers.set(answers),

    /** The paired machines, `undefined` until they were first listed. */
    pairedMachines: pairedMachines.asReadonly(),

    /**
     * Takes the paired machines, merges the queues they sent into this one and runs what another machine
     * approved for this one. An item another machine owns is never run here.
     */
    syncPeers: (state: { machines: readonly PairedMachine[]; peers: readonly SharedApprovalQueue[] }) => {
      pairedMachines.set(state.machines);

      const id = machineId();

      if (!loaded()) return;

      if (id && state.peers.length) {
        const merged = mergedApprovalQueue({ machineId: id, own: queue(), peers: state.peers });

        revise(() => merged.queue);
        merged.toRun.filter((item) => item.request.op !== 'jira.create').forEach(approveOne);
      }

      runReadyCreates();
    },

    /** Answers with the item `foldedApprovalOf` names, waiting again if it expired, and queues a new one otherwise. */
    enqueue$: (options: {
      request: AgentApprovalRequest;
      client?: string;
      target?: string;
    }): Observable<AgentApiQueued> =>
      whenLoaded$.pipe(
        map(() => {
          settle();

          const day = today();
          const folded = foldedApprovalOf(queue(), { ...options, day });

          if (folded && !folded.reopen) return { status: 'queued', approvalId: folded.item.id };

          const id = folded?.item.id ?? crypto.randomUUID();

          change(enqueueApproval(queue(), { id, ...options, at: new Date(), day }));

          const queuedItem = find(id);

          if (queuedItem) queued$.next(queuedItem);

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

      if (item?.state === 'queued') approveHere(item);
    },

    approveAll: () => {
      settle();
      approvableByAll(queue(), settings.settings().actionClasses).forEach(approveHere);
    },

    reject: (id: string) => {
      settle();

      const rejected = rejectApproval(queue(), { id: find(id)?.id ?? id, decidedAtMs: Date.now() });

      if (rejected.ok) change(rejected.queue);
    },

    waitingList$: (): Observable<AgentApiWaitingApproval[]> =>
      whenLoaded$.pipe(
        map(() => {
          settle();

          return waitingApprovalsOf(queue());
        }),
      ),

    reject$: (id: string): Observable<AgentApiApprovalStatus> =>
      whenLoaded$.pipe(
        map(() => {
          settle();

          const rejected = rejectApproval(queue(), { id: find(id)?.id ?? id, decidedAtMs: Date.now() });

          if (!rejected.ok) throw new Error(rejected.message);

          change(rejected.queue);

          return { status: 'rejected', approvalId: id };
        }),
      ),

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

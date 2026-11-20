import {
  AgentApproval,
  SharedApprovalQueue,
  encodeSharedApprovals,
  mergeSharedApprovals,
  sameDraftSummary,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';
import { PairedMachine } from '../../host';

const SEND_DEBOUNCE_MS = 2_000;

const sameDecision = (left: AgentApproval, right: AgentApproval) =>
  left.state === right.state &&
  left.error === right.error &&
  JSON.stringify(left.result) === JSON.stringify(right.result) &&
  left.ownerMachineId === right.ownerMachineId &&
  String(left.foldedIds) === String(right.foldedIds);

/**
 * This machine's queue with the queues of its paired machines merged in, and the items another machine
 * approved that this one owns and so has to run. An item whose decision did not change stays the object
 * this machine holds.
 */
export const mergedApprovalQueue = (options: {
  machineId: string;
  own: readonly AgentApproval[];
  peers: readonly SharedApprovalQueue[];
}): { queue: AgentApproval[]; toRun: AgentApproval[] } => {
  const held = new Map(options.own.map((item) => [item.id, item]));
  const queue = mergeSharedApprovals(options).map(({ final: _final, ...item }): AgentApproval => {
    const own = held.get(item.id);

    return own && sameDecision(own, item) ? own : item;
  });
  const toRun = queue.filter(
    (item) =>
      item.ownerMachineId === options.machineId &&
      item.state === 'approved' &&
      item.result === undefined &&
      item.error === undefined &&
      held.get(item.id)?.state === 'queued',
  );

  return { queue, toRun };
};

/** Sends the queue once a change settles; an unchanged queue is not sent again. */
export const sendSharedApprovals$ = (options: {
  queue$: Observable<readonly AgentApproval[]>;
  send$: (queue: readonly AgentApproval[]) => Observable<void>;
  debounceMs?: number;
}): Observable<void> =>
  options.queue$.pipe(
    debounceTime(options.debounceMs ?? SEND_DEBOUNCE_MS),
    map((queue) => ({ queue, wire: encodeSharedApprovals(queue) })),
    distinctUntilChanged((left, right) => left.wire === right.wire),
    concatMap(({ queue }) =>
      options.send$(queue).pipe(
        take(1),
        catchError(() => EMPTY),
      ),
    ),
  );

/** The paired machines and the queues they last sent, handed to `sync` on each tick. */
export const receiveSharedApprovals$ = (options: {
  tick$: Observable<unknown>;
  machines$: () => Observable<readonly PairedMachine[]>;
  received$: () => Observable<readonly SharedApprovalQueue[]>;
  sync: (state: { machines: readonly PairedMachine[]; peers: readonly SharedApprovalQueue[] }) => void;
}): Observable<void> =>
  options.tick$.pipe(
    // Machines before queues: a pull between the two reads would date the queues later than they are.
    exhaustMap(() =>
      options.machines$().pipe(
        take(1),
        catchError(() => of([])),
        switchMap((machines) =>
          options.received$().pipe(
            take(1),
            catchError(() => of([])),
            map((peers) => ({ machines, peers })),
          ),
        ),
      ),
    ),
    map(options.sync),
  );

/** The summary match an approved create runs with: the near match the queue folds by once it is shared. */
export const queuedCreateSummaryMatch = (machines: readonly PairedMachine[] | undefined) =>
  machines?.length ? sameDraftSummary : undefined;

import { AgentApproval, findApproval, sameDraftSummary } from '@ethlete/timetrack';
import { PairedMachine } from '../../host';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvedCreatesToRun,
  mergedApprovalQueue,
  queuedCreateSummaryMatch,
  sendSharedApprovals$,
} from './shared-approvals';

const create = (id: string, over: Partial<AgentApproval> = {}): AgentApproval => ({
  id,
  request: { op: 'jira.create', projectKey: 'ABC', summary: `Issue ${id}`, description: '' },
  opClass: 'external',
  askedAtMs: 1_000,
  day: '2026-11-20',
  state: 'queued',
  ...over,
});

describe('mergedApprovalQueue', () => {
  it('keeps the approval of a near-same create that folds into a waiting one and runs it once on its owner', () => {
    const waiting = create('b1', { ownerMachineId: 'B', askedAtMs: 1_000 });
    const approved = create('a1', {
      ownerMachineId: 'A',
      askedAtMs: 2_000,
      state: 'approved',
      decidedAtMs: 7,
      decidedBy: 'A',
    });
    const sameSummary = { op: 'jira.create' as const, projectKey: 'ABC', summary: 'Same', description: '' };
    waiting.request = sameSummary;
    approved.request = sameSummary;
    const { queue, toRun } = mergedApprovalQueue({
      machineId: 'B',
      own: [waiting],
      peers: [{ machineId: 'A', queue: [approved] }],
    });

    expect(queue).toEqual([expect.objectContaining({ id: 'b1', state: 'approved', decidedBy: 'A' })]);
    expect(toRun.map((item) => item.id)).toEqual(['b1']);
  });

  it('runs an item this machine owns once the paired machine approved it', () => {
    const own = [create('c1', { ownerMachineId: 'A' })];
    const { queue, toRun } = mergedApprovalQueue({
      machineId: 'A',
      own,
      peers: [{ machineId: 'B', queue: [create('c1', { ownerMachineId: 'A', state: 'approved', decidedAtMs: 5 })] }],
    });

    expect(queue[0]?.state).toBe('approved');
    expect(toRun.map((item) => item.id)).toEqual(['c1']);
  });

  it('runs nothing the paired machine owns, and takes its created item as done', () => {
    const own = [create('c1', { ownerMachineId: 'B' })];
    const created = create('c1', { ownerMachineId: 'B', state: 'approved', decidedAtMs: 5, result: { key: 'ABC-1' } });
    const { queue, toRun } = mergedApprovalQueue({
      machineId: 'A',
      own,
      peers: [{ machineId: 'B', queue: [created] }],
    });

    expect(queue[0]).toEqual(expect.objectContaining({ state: 'approved', result: { key: 'ABC-1' } }));
    expect(toRun).toEqual([]);
  });

  it('keeps the id of its own item resolvable once it folds into the equivalent item of the paired machine', () => {
    const { queue } = mergedApprovalQueue({
      machineId: 'B',
      own: [
        create('b1', {
          askedAtMs: 2_000,
          request: { op: 'jira.create', projectKey: 'ABC', summary: 'Same', description: '' },
        }),
      ],
      peers: [
        {
          machineId: 'A',
          queue: [
            create('a1', { request: { op: 'jira.create', projectKey: 'ABC', summary: 'Same', description: '' } }),
          ],
        },
      ],
    });

    expect(queue.map((item) => item.id)).toEqual(['a1']);
    expect(findApproval(queue, 'b1')?.id).toBe('a1');
  });

  it('keeps the held object when the decision did not change', () => {
    const own = [create('c1', { ownerMachineId: 'A', state: 'rejected', decidedAtMs: 5 })];
    const { queue } = mergedApprovalQueue({
      machineId: 'A',
      own,
      peers: [{ machineId: 'B', queue: [create('c1', { ownerMachineId: 'A', state: 'rejected', decidedAtMs: 4 })] }],
    });

    expect(queue[0]).toBe(own[0]);
  });
});

describe('sendSharedApprovals$', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the queue once a change settles, and an unchanged queue only once', () => {
    const queue$ = new Subject<readonly AgentApproval[]>();
    const sent: (readonly AgentApproval[])[] = [];
    const subscription = sendSharedApprovals$({
      queue$,
      send$: (queue) => {
        sent.push(queue);

        return of(undefined);
      },
      debounceMs: 100,
    }).subscribe();

    queue$.next([create('c1')]);
    vi.advanceTimersByTime(100);
    queue$.next([create('c1')]);
    vi.advanceTimersByTime(100);
    queue$.next([create('c1', { state: 'rejected' })]);
    vi.advanceTimersByTime(100);

    expect(sent.map((queue) => queue[0]?.state)).toEqual(['queued', 'rejected']);
    subscription.unsubscribe();
  });
});

const machine: PairedMachine = {
  machineId: 'B',
  label: 'MacBook',
  certFingerprint: 'fp',
  lastAddr: null,
  lastSeenMs: 1_000,
  clockOffsetMs: 0,
  pairedAtMs: 0,
  lastPullMs: 1_000,
};

describe('queuedCreateSummaryMatch', () => {
  it('keeps the exact summary check while no machine shares the queue', () => {
    expect(queuedCreateSummaryMatch(undefined)).toBeUndefined();
    expect(queuedCreateSummaryMatch([])).toBeUndefined();
  });

  it('matches the near summary the queue folds by once a paired machine shares it', () => {
    expect(queuedCreateSummaryMatch([machine])).toBe(sameDraftSummary);
  });
});

describe('approvedCreatesToRun', () => {
  const AT = 1_000_000;
  const peer = (machineId: string, pulledAtMs: number): PairedMachine => ({
    ...machine,
    machineId,
    lastSeenMs: pulledAtMs,
    lastPullMs: pulledAtMs,
  });
  const approvedCreate = (id: string, summary: string, askedAtMs: number) =>
    create(id, {
      request: { op: 'jira.create', projectKey: 'ABC', summary, description: '' },
      askedAtMs,
      state: 'approved',
      decidedAtMs: AT,
    });

  it('files one Jira issue when two unsynced machines approve the same create in the same second', () => {
    const jira: string[] = [];
    const runOn = (machineId: string, queue: readonly AgentApproval[], machines: PairedMachine[], nowMs: number) => {
      const ready = approvedCreatesToRun({ machineId, queue, machines, nowMs });

      return queue.map((item) => {
        if (!ready.includes(item) || item.request.op !== 'jira.create') return item;

        jira.push(item.request.summary);

        return { ...item, result: { key: `ABC-${jira.length}` } };
      });
    };

    const onA = runOn(
      'A',
      [approvedCreate('a1', 'Visuelle Baselines in die CI integrieren', AT - 60_000)],
      [peer('B', AT - 10_000)],
      AT,
    );
    const onB = runOn(
      'B',
      [approvedCreate('b1', 'Visuelle Baselines in CI integrieren', AT - 50_000)],
      [peer('A', AT - 10_000)],
      AT,
    );
    const pulledAtMs = AT + 60_000;
    const mergedOnA = mergedApprovalQueue({ machineId: 'A', own: onA, peers: [{ machineId: 'B', queue: onB }] });
    const mergedOnB = mergedApprovalQueue({ machineId: 'B', own: onB, peers: [{ machineId: 'A', queue: onA }] });

    const laterOnA = runOn('A', mergedOnA.queue, [peer('B', pulledAtMs)], pulledAtMs);
    const laterOnB = runOn('B', mergedOnB.queue, [peer('A', pulledAtMs)], pulledAtMs);

    expect(jira).toEqual(['Visuelle Baselines in die CI integrieren']);
    expect(findApproval(laterOnA, 'b1')?.result).toEqual({ key: 'ABC-1' });
    expect(findApproval(laterOnB, 'b1')?.result).toBeUndefined();
  });

  it('runs an approved create at once while no paired machine is reachable', () => {
    const queue = [approvedCreate('a1', 'Pdf export', AT - 60_000)];

    expect(approvedCreatesToRun({ machineId: 'A', queue, machines: [], nowMs: AT })).toEqual(queue);
    expect(approvedCreatesToRun({ machineId: 'A', queue, machines: [peer('B', AT - 3_600_000)], nowMs: AT })).toEqual(
      queue,
    );
  });

  it('runs nothing before the paired machines were listed, and nothing another machine owns', () => {
    const queue = [approvedCreate('a1', 'Pdf export', AT - 60_000)];

    expect(approvedCreatesToRun({ machineId: 'A', queue, machines: undefined, nowMs: AT })).toEqual([]);
    expect(
      approvedCreatesToRun({
        machineId: 'A',
        queue: [{ ...queue[0]!, ownerMachineId: 'B' }],
        machines: [],
        nowMs: AT,
      }),
    ).toEqual([]);
  });

  it('waits longer for a paired machine whose clock is behind', () => {
    const queue = [approvedCreate('a1', 'Pdf export', AT - 60_000)];
    const pulled = { ...peer('B', AT + 30_000), clockOffsetMs: -40_000 };

    expect(approvedCreatesToRun({ machineId: 'A', queue, machines: [pulled], nowMs: AT + 30_000 })).toEqual([]);
  });
});

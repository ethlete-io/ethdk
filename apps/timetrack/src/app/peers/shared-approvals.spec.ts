import { AgentApproval } from '@ethlete/timetrack';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergedApprovalQueue, sendSharedApprovals$ } from './shared-approvals';

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

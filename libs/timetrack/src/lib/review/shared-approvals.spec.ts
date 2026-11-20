import { describe, expect, it } from 'vitest';
import { AgentApproval, findApproval, parseApprovalQueue } from '../agent-api/approval-queue';
import { AutoModeApplyRequest } from '../agent-api/approval-queue';
import {
  encodeSharedApprovals,
  isFinalApproval,
  mayRunSharedApproval,
  mergeSharedApprovals,
  parseSharedApprovals,
  peerApprovalQueue,
} from './shared-approvals';

const DAY = '2026-11-19';

const createItem = (
  id: string,
  askedAtMs: number,
  over: Partial<AgentApproval> = {},
  summary = 'Visuelle Baselines integrieren',
): AgentApproval =>
  ({
    id,
    request: { op: 'jira.create', projectKey: 'FIFAGG', summary, issueType: 'Task' },
    opClass: 'external',
    client: 'auto-mode',
    askedAtMs,
    day: DAY,
    state: 'queued',
    ...over,
  }) as unknown as AgentApproval;

const applyItem = (id: string, askedAtMs: number): AgentApproval => ({
  id,
  request: {
    op: 'autoMode.apply',
    day: DAY,
    subject: { kind: 'context', contextId: 'repo:/home/dev/app~one' },
    label: 'app',
    issueKey: 'FIFAGG-1',
  } satisfies AutoModeApplyRequest,
  opClass: 'external',
  askedAtMs,
  day: DAY,
  state: 'queued',
});

const merge = (machineId: string, own: AgentApproval[], ...peers: [string, AgentApproval[]][]) =>
  mergeSharedApprovals({ machineId, own, peers: peers.map(([id, queue]) => ({ machineId: id, queue })) });

describe('mergeSharedApprovals', () => {
  it('shows an item queued on A in the merge of B, owned by A', () => {
    const [item] = merge('B', [], ['A', [createItem('c1', 1)]]);

    expect(item?.id).toBe('c1');
    expect(item?.ownerMachineId).toBe('A');
    expect(mayRunSharedApproval(item!, 'B')).toBe(false);
    expect(mayRunSharedApproval(item!, 'A')).toBe(true);
  });

  it('carries a decision made on B into the merge of A', () => {
    const rejected = createItem('c1', 1, { state: 'rejected', decidedAtMs: 5 });
    const [item] = merge('A', [createItem('c1', 1)], ['B', [rejected]]);

    expect(item?.state).toBe('rejected');
    expect(item?.ownerMachineId).toBe('A');
  });

  it('lets the later decision win when both decide, expiry included', () => {
    const approved = createItem('c1', 1, { state: 'approved', decidedAtMs: 5 });
    const expired = createItem('c1', 1, { state: 'expired', decidedAtMs: 9 });

    expect(merge('A', [approved], ['B', [expired]])[0]?.state).toBe('expired');
    expect(merge('A', [expired], ['B', [approved]])[0]?.state).toBe('expired');
  });

  it('keeps a created item final against a later peer decision', () => {
    const created = createItem('c1', 1, { state: 'approved', decidedAtMs: 5, result: { key: 'FIFAGG-9' } });
    const rejected = createItem('c1', 1, { state: 'rejected', decidedAtMs: 20 });
    const [item] = merge('B', [rejected], ['A', [created]]);

    expect(isFinalApproval(created)).toBe(true);
    expect(item?.state).toBe('approved');
    expect(item?.final).toBe(true);
  });

  it('keeps a running item final', () => {
    const running = createItem('c1', 1, { state: 'running', decidedAtMs: 5 });
    const expired = createItem('c1', 1, { state: 'expired', decidedAtMs: 20 });

    expect(merge('B', [expired], ['A', [running]])[0]?.state).toBe('running');
  });

  it('folds the same create queued on two machines into the first one, with its owner', () => {
    const merged = merge('B', [createItem('b1', 2)], ['A', [createItem('a1', 1)]]);

    expect(merged.map(({ id, ownerMachineId }) => [id, ownerMachineId])).toEqual([['a1', 'A']]);
  });

  it('keeps the id of an item folded away resolvable, across later merges', () => {
    const merged = merge('B', [createItem('b1', 2)], ['A', [createItem('a1', 1)]]);
    const again = merge('A', [createItem('a1', 1)], ['B', merged]);

    expect(findApproval(merged, 'b1')?.id).toBe('a1');
    expect(findApproval(again, 'b1')?.id).toBe('a1');
    expect(findApproval(parseApprovalQueue(JSON.parse(JSON.stringify(again))), 'b1')?.id).toBe('a1');
  });

  it('folds the same auto mode apply across three machines', () => {
    const merged = merge('C', [applyItem('c', 3)], ['A', [applyItem('a', 1)]], ['B', [applyItem('b', 2)]]);

    expect(merged.map(({ id, ownerMachineId }) => [id, ownerMachineId])).toEqual([['a', 'A']]);
  });

  it('keeps a created item over an earlier queued copy of the same work', () => {
    const created = createItem('b1', 2, { state: 'approved', decidedAtMs: 6, result: {} });
    const merged = merge('A', [createItem('a1', 1)], ['B', [created]]);

    expect(merged.map(({ id, ownerMachineId }) => [id, ownerMachineId])).toEqual([['b1', 'B']]);
  });

  it('keeps different work apart', () => {
    const merged = merge('B', [createItem('b1', 2, {}, 'Login Fehler beheben')], ['A', [createItem('a1', 1)]]);

    expect(merged.map(({ id }) => id)).toEqual(['a1', 'b1']);
  });

  it('keeps the owner stable once a peer merged the item back', () => {
    const [onB] = merge('B', [], ['A', [createItem('c1', 1)]]);
    const [onA] = merge('A', [createItem('c1', 1)], ['B', [onB!]]);

    expect(onA?.ownerMachineId).toBe('A');
  });
});

describe('the shared approval wire form', () => {
  it('round-trips a queue, keeping a running item running and its owner', () => {
    const queue = [
      createItem('c1', 1, { state: 'running', decidedAtMs: 5, ownerMachineId: 'B' }),
      createItem('c2', 2, { state: 'approved', decidedAtMs: 6, result: { issue: { key: 'FIFAGG-9' } } }),
    ];

    expect(parseSharedApprovals(encodeSharedApprovals(queue))).toEqual([
      expect.objectContaining({ id: 'c1', state: 'running', ownerMachineId: 'B', decidedAtMs: 5 }),
      expect.objectContaining({ id: 'c2', state: 'approved', result: { issue: { key: 'FIFAGG-9' } } }),
    ]);
  });

  it('reads nothing from rows that are not a shared queue', () => {
    expect(parseSharedApprovals('not json')).toBeNull();
    expect(parseSharedApprovals('{"sharedSettings":1,"entries":[]}')).toBeNull();
  });

  it('moves a peer decision into this clock by the offset', () => {
    const { queue } = peerApprovalQueue({
      machineId: 'B',
      queue: [createItem('c1', 1, { state: 'rejected', decidedAtMs: 10_000 })],
      clockOffsetMs: 2_000,
    });

    expect(queue[0]?.decidedAtMs).toBe(8_000);
  });
});

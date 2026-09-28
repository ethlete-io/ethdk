import { describe, expect, it } from 'vitest';
import {
  AGENT_APPROVAL_INTERRUPTED,
  AgentApproval,
  AutoModeApplyRequest,
  agentApiCallerOf,
  agentApiClientOf,
  approvableByAll,
  approvalClassOf,
  describeApproval,
  approvalStatusOf,
  enqueueApproval,
  markApproval,
  openApprovalFor,
  parseApprovalQueue,
  routesThroughApproval,
  settleApprovalQueue,
} from './approval-queue';
import { AgentApiRequest } from './model';
import { parseAgentRequest } from './parse';

const CREATE: AgentApiRequest = { op: 'jira.create', summary: 'Pdf export', description: '', projectKey: 'ABC' };
const SYNC: AgentApiRequest = { op: 'tempo.sync', day: '2026-09-28', planHash: 'abc' };
const AT = new Date(2026, 8, 28, 10);

const queueOf = (...requests: AgentApiRequest[]) =>
  requests.reduce<AgentApproval[]>(
    (queue, request, index) => enqueueApproval(queue, { id: `a${index}`, request, at: AT, day: '2026-09-28' }),
    [],
  );

describe('routesThroughApproval', () => {
  it('answers a read directly', () => {
    expect(routesThroughApproval({ op: 'day.rows', day: '2026-09-28' })).toBe(false);
    expect(routesThroughApproval({ op: 'approval.status', id: 'a0' })).toBe(false);
  });

  it('queues every write', () => {
    expect(routesThroughApproval(CREATE)).toBe(true);
    expect(routesThroughApproval(SYNC)).toBe(true);
    expect(routesThroughApproval({ op: 'tempo.delete', day: '2026-09-28', worklogId: '1' })).toBe(true);
    expect(routesThroughApproval({ op: 'standIn.remove', id: 's1' })).toBe(true);
    expect(routesThroughApproval({ op: 'agentSessions.resync', paths: ['/repo'] })).toBe(true);
  });

  it('answers the plan-only forms directly, since they write nothing', () => {
    expect(routesThroughApproval({ op: 'tempo.sync', day: '2026-09-28' })).toBe(false);

    const split = { op: 'standIn.split' as const, id: 's1', branch: 'b', commits: [], projectRoots: [], paths: [] };

    expect(routesThroughApproval({ ...split, apply: false })).toBe(false);
    expect(routesThroughApproval({ ...split, apply: true })).toBe(true);
  });
});

describe('settleApprovalQueue', () => {
  it('expires an item still waiting once the day it was asked on is over', () => {
    const queue = queueOf(CREATE);

    expect(settleApprovalQueue(queue, '2026-09-28')[0]?.state).toBe('queued');
    expect(settleApprovalQueue(queue, '2026-09-29')[0]?.state).toBe('expired');
  });

  it('keeps a decided item for a week, then drops it', () => {
    const queue = markApproval(queueOf(CREATE), { id: 'a0', state: 'rejected' });

    expect(settleApprovalQueue(queue, '2026-10-05')).toHaveLength(1);
    expect(settleApprovalQueue(queue, '2026-10-06')).toHaveLength(0);
  });
});

describe('approvableByAll', () => {
  it('skips every human-only item', () => {
    const queue = queueOf(CREATE, SYNC, { op: 'standIn.rename', id: 's1', name: 'x' });

    expect(approvableByAll(queue).map((item) => item.request.op)).toEqual(['jira.create', 'standIn.rename']);
  });

  it('skips an item the user made human-only, and an auto mode create by its own class', () => {
    const queue = [
      ...queueOf(CREATE, { op: 'standIn.rename', id: 's1', name: 'x' }),
      ...enqueueApproval([], { id: 'a9', request: CREATE, client: 'auto mode', at: AT, day: '2026-09-28' }),
    ];

    expect(approvableByAll(queue, { 'standIn.rename': 'human-only' }).map((item) => item.id)).toEqual(['a0', 'a9']);
    expect(approvableByAll(queue, { 'jira.create': 'human-only' }).map((item) => item.id)).toEqual(['a1', 'a9']);
    expect(approvableByAll(queue, { 'autoMode.create': 'human-only' }).map((item) => item.id)).toEqual(['a0', 'a1']);
  });

  it('skips an item that is no longer waiting', () => {
    const queue = markApproval(queueOf(CREATE), { id: 'a0', state: 'running' });

    expect(approvableByAll(queue)).toEqual([]);
  });
});

describe('approvalStatusOf', () => {
  it('reads a running item as still queued', () => {
    const [item] = markApproval(queueOf(CREATE), { id: 'a0', state: 'running' });

    expect(item && approvalStatusOf(item)).toEqual({ status: 'queued', approvalId: 'a0' });
  });

  it('answers the result of an approved item', () => {
    const [item] = markApproval(queueOf(CREATE), { id: 'a0', state: 'approved', result: { issue: { key: 'ABC-1' } } });

    expect(item && approvalStatusOf(item)).toEqual({
      status: 'approved',
      approvalId: 'a0',
      result: { issue: { key: 'ABC-1' } },
    });
  });
});

describe('enqueueApproval', () => {
  const ask = (queue: readonly AgentApproval[], id: string) =>
    enqueueApproval(queue, { id, request: CREATE, client: 'auto mode', target: 'band-1', at: AT, day: '2026-09-28' });

  it('queues nothing a second time for a target a waiting item already holds', () => {
    const once = ask([], 'a0');
    const twice = ask(once, 'a1');

    expect(twice.map((item) => item.id)).toEqual(['a0']);
    expect(openApprovalFor(twice, { client: 'auto mode', target: 'band-1' })?.id).toBe('a0');
  });

  it('queues again once the item for the target is decided', () => {
    const rejected = markApproval(ask([], 'a0'), { id: 'a0', state: 'rejected' });

    expect(ask(rejected, 'a1').map((item) => item.id)).toEqual(['a0', 'a1']);
  });
});

describe('parseApprovalQueue', () => {
  it('reads back what it stored', () => {
    const queue = markApproval(queueOf(CREATE, SYNC), { id: 'a1', state: 'rejected', decidedAtMs: 5 });

    expect(parseApprovalQueue(JSON.parse(JSON.stringify(queue)))).toEqual(queue);
  });

  it('reads back the target an item was queued for', () => {
    const queue = enqueueApproval([], { id: 'a0', request: CREATE, target: 'band-1', at: AT, day: '2026-09-28' });

    expect(parseApprovalQueue(JSON.parse(JSON.stringify(queue)))[0]?.target).toBe('band-1');
  });

  it('takes the class from the table, not from the store', () => {
    const [stored] = queueOf(SYNC);

    expect(parseApprovalQueue([{ ...stored, opClass: 'local' }])[0]?.opClass).toBe('human-only');
  });

  it('drops an entry whose request no longer parses', () => {
    const [stored] = queueOf(CREATE);

    expect(parseApprovalQueue([{ ...stored, request: { op: 'jira.create' } }])).toEqual([]);
  });

  it('reads an item that was running when the app stopped as approved with an error', () => {
    const queue = markApproval(queueOf(CREATE), { id: 'a0', state: 'running' });

    expect(parseApprovalQueue(queue)[0]).toMatchObject({ state: 'approved', error: AGENT_APPROVAL_INTERRUPTED });
  });
});

describe('agentApiClientOf', () => {
  it('reads the name a caller gave itself, without control characters', () => {
    expect(agentApiClientOf({ op: 'status', client: ' Claude Code\u001b[2J ' })).toBe('Claude Code[2J');
  });

  it('reads nothing where the caller gave no name', () => {
    expect(agentApiClientOf({ op: 'status' })).toBeUndefined();
    expect(agentApiClientOf({ op: 'status', client: 3 })).toBeUndefined();
  });
});

const APPLY: AutoModeApplyRequest = {
  op: 'autoMode.apply',
  day: '2026-09-28',
  subject: { kind: 'stand-in', standInId: 's1' },
  label: 'Pdf export',
  issueKey: 'ABC-7',
};

describe('an auto mode apply in the queue', () => {
  it('waits as external, follows autoMode.apply, and reads back what it stored', () => {
    const queue = enqueueApproval([], { id: 'a0', request: APPLY, client: 'auto mode', at: AT, day: '2026-09-28' });
    const [item] = queue;

    expect(item?.opClass).toBe('external');
    expect(item && approvalClassOf(item, { 'autoMode.apply': 'human-only' })).toBe('human-only');
    expect(parseApprovalQueue(JSON.parse(JSON.stringify(queue)))).toEqual(queue);
    expect(describeApproval(APPLY)).toBe('Resolves stand-in Pdf export with ABC-7');
  });

  it('drops a stored apply that names no subject', () => {
    const [stored] = enqueueApproval([], { id: 'a0', request: APPLY, at: AT, day: '2026-09-28' });

    expect(parseApprovalQueue([{ ...stored, request: { ...APPLY, subject: { kind: 'stand-in' } } }])).toEqual([]);
  });

  it('is never read from a CLI request', () => {
    expect(parseAgentRequest(APPLY).ok).toBe(false);
  });
});

describe('agentApiCallerOf', () => {
  it('refuses a CLI the name auto mode queues under', () => {
    expect(agentApiCallerOf({ op: 'status', client: 'Auto Mode' })).toBeUndefined();
    expect(agentApiCallerOf({ op: 'status', client: 'Claude Code' })).toBe('Claude Code');
  });
});

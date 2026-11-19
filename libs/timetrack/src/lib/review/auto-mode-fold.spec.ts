import { describe, expect, it } from 'vitest';
import { AUTO_MODE_CLIENT } from '../agent-api/action-classes';
import {
  AgentApproval,
  AgentApprovalState,
  enqueueApproval,
  markApproval,
  openApprovalFor,
  waitingApprovalsOf,
} from '../agent-api/approval-queue';
import {
  autoModeApplies,
  autoModeApplyRequest,
  autoModeApplyTarget,
  autoModeApprovalTarget,
  autoModeContextLabel,
  autoModeCreateRequest,
  autoModeQueuedAnswer,
  autoModeSharedCreate,
} from './auto-mode';
import { AutoModeAnswer, AutoModeSubject } from './model';

const TODAY = '2026-11-19';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);
const EXTERNAL = { 'autoMode.apply': 'external' } as const;

const sessionOf = (session: string): AutoModeSubject => ({
  kind: 'context',
  contextId: `repo:/home/dev/fifagg-frontend~${session}`,
});

const matchFor = (subject: AutoModeSubject, issueKey = 'FIFAGG-12769'): AutoModeAnswer => ({
  subject,
  askedAtMs: 0,
  request: { notes: [], parents: [], issues: [] },
  outcome: { kind: 'match', issueKey },
});

const draftFor = (subject: AutoModeSubject): AutoModeAnswer => ({
  subject,
  askedAtMs: 0,
  request: { notes: [], parents: [], issues: [] },
  outcome: { kind: 'draft', summary: 'Integrate the visual baselines', description: '', projectKey: 'FIFAGG' },
});

const queueApply = (queue: readonly AgentApproval[], answer: AutoModeAnswer, options: { id: string; time: string }) => {
  const request = autoModeApplyRequest({
    day: TODAY,
    answer,
    label: answer.subject.kind === 'context' ? autoModeContextLabel(answer.subject.contextId) : '',
    classes: EXTERNAL,
  });

  if (!request) throw new Error('nothing to queue');

  const target = autoModeApplyTarget(TODAY, answer.subject);

  if (openApprovalFor(queue, { client: AUTO_MODE_CLIENT, target })) return [...queue];

  return enqueueApproval(queue, {
    id: options.id,
    request,
    client: AUTO_MODE_CLIENT,
    target,
    at: at(options.time),
    day: TODAY,
  });
};

const queueCreate = (queue: readonly AgentApproval[], answer: AutoModeAnswer, options: { id: string }) => {
  const shared = autoModeSharedCreate({ day: TODAY, answer, approvals: queue });

  if (shared) return { queue: [...queue], answer: autoModeQueuedAnswer(answer, shared) };

  const request = autoModeCreateRequest(answer);

  if (!request) throw new Error('nothing to queue');

  const next = enqueueApproval(queue, {
    id: options.id,
    request,
    client: AUTO_MODE_CLIENT,
    target: autoModeApprovalTarget(TODAY, answer.subject),
    at: at('12:58'),
    day: TODAY,
  });

  return {
    queue: next,
    answer: autoModeQueuedAnswer(
      answer,
      next.find((item) => item.id === options.id)!,
    ),
  };
};

const decided = (queue: AgentApproval[], id: string, state: AgentApprovalState) =>
  markApproval(queue, { id, state, decidedAtMs: at('12:59').getTime() });

describe('the same auto mode apply asked twice on one day', () => {
  it('keeps one item when the same band asks again minutes later', () => {
    const first = queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' });
    const second = queueApply(first, matchFor(sessionOf('a')), { id: 'apply-2', time: '13:00' });

    expect(waitingApprovalsOf(second).map((item) => item.approvalId)).toEqual(['apply-1']);
  });

  it('folds the apply of a second session in the same checkout into the item that waits', () => {
    const first = queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' });
    const second = queueApply(first, matchFor(sessionOf('b')), { id: 'apply-2', time: '13:00' });

    expect(waitingApprovalsOf(second).map((item) => item.approvalId)).toEqual(['apply-1']);
  });

  it('writes the folded match of both sessions once the one item is approved, and neither once it is rejected', () => {
    const queue = queueApply(
      queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' }),
      matchFor(sessionOf('b')),
      { id: 'apply-2', time: '13:00' },
    );
    const applies = (approvals: AgentApproval[], subject: AutoModeSubject) =>
      autoModeApplies({ day: TODAY, answer: matchFor(subject), classes: EXTERNAL, approvals });

    expect(applies(decided(queue, 'apply-1', 'approved'), sessionOf('b'))).toBe(true);
    expect(applies(decided(queue, 'apply-1', 'rejected'), sessionOf('a'))).toBe(false);
    expect(applies(decided(queue, 'apply-1', 'rejected'), sessionOf('b'))).toBe(false);
  });

  it('queues nothing again for an apply approved or rejected earlier that day', () => {
    const first = queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' });

    for (const state of ['approved', 'rejected'] as const) {
      const again = queueApply(decided(first, 'apply-1', state), matchFor(sessionOf('b')), {
        id: 'apply-2',
        time: '13:00',
      });

      expect(again.map((item) => [item.id, item.state])).toEqual([['apply-1', state]]);
    }
  });

  it('waits again on the expired item rather than queuing a second one', () => {
    const first = queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' });
    const again = queueApply(decided(first, 'apply-1', 'expired'), matchFor(sessionOf('a')), {
      id: 'apply-2',
      time: '13:00',
    });

    expect(again.map((item) => [item.id, item.state])).toEqual([['apply-1', 'queued']]);
  });

  it('queues apart another issue, another checkout or another day', () => {
    const first = queueApply([], matchFor(sessionOf('a')), { id: 'apply-1', time: '12:58' });
    const otherIssue = queueApply(first, matchFor(sessionOf('b'), 'FIFAGG-1'), { id: 'apply-2', time: '13:00' });
    const otherCheckout = queueApply(
      first,
      matchFor({ kind: 'context', contextId: 'repo:/home/dev/fifagg-backend~b' }),
      { id: 'apply-3', time: '13:00' },
    );
    const yesterday = first.map((item) => ({ ...item, day: '2026-11-18' }));
    const nextDay = queueApply(yesterday, matchFor(sessionOf('b')), { id: 'apply-4', time: '13:00' });

    expect(otherIssue).toHaveLength(2);
    expect(otherCheckout).toHaveLength(2);
    expect(nextDay).toHaveLength(2);
  });
});

describe('the same auto mode create drafted twice on one day', () => {
  it('folds the draft of a second subject into the create that waits', () => {
    const first = queueCreate([], draftFor(sessionOf('a')), { id: 'create-1' });
    const second = queueCreate(first.queue, draftFor({ kind: 'stand-in', standInId: 's-1' }), { id: 'create-2' });

    expect(second.queue.map((item) => item.id)).toEqual(['create-1']);
    expect(second.answer.outcome).toMatchObject({ approvalId: 'create-1' });
  });

  it('asks nothing again for a create rejected earlier that day', () => {
    const first = queueCreate([], draftFor(sessionOf('a')), { id: 'create-1' });
    const second = queueCreate(decided(first.queue, 'create-1', 'rejected'), draftFor(sessionOf('b')), {
      id: 'create-2',
    });

    expect(second.queue.map((item) => [item.id, item.state])).toEqual([['create-1', 'rejected']]);
  });
});

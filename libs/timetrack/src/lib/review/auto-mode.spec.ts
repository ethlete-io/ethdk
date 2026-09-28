import { describe, expect, it } from 'vitest';
import { UnnamedContext } from '../model/attribution';
import { ActivityBlock, contextKey } from '../model/block';
import { openStandIn } from '../model/stand-in';
import { DayRows } from '../rows/build-rows';
import { WorkGroup } from '../rows/merge';
import { unnamedRowId } from '../rows/propose';
import { reopenStandIn, resolveStandIn } from '../settings/stand-in';
import { DEFAULT_TIMETRACK_SETTINGS } from '../settings/model';
import { TicketWritingRequest } from '../ticket/write';
import { AUTO_MODE_CLIENT, ActionClasses } from '../agent-api/action-classes';
import { AgentApproval, enqueueApproval, markApproval } from '../agent-api/approval-queue';
import {
  approvalRowIdsOf,
  autoModeApplies,
  autoModeApplyRequest,
  autoModeApplyTarget,
  autoModeApprovalTarget,
  autoModeContextLabel,
  autoModeReadout,
  autoModeAsks,
  autoModeCreateRequest,
  autoModeCreatedKeys,
  autoModeQueuedAnswer,
  withAutoModeAnswer,
  withAutoModeCreated,
  withAutoModeRowNames,
} from './auto-mode';
import { setRowIssue } from './edits';
import { AutoModeAnswer, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
import { reviewDay } from './review-day';

const TODAY = '2026-08-11';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);

const BLOCK: ActivityBlock = {
  from: at('08:00'),
  to: at('09:00'),
  context: { repoPath: '/work/shop', branch: 'feature/export' },
  evidence: [],
};

const GROUP: WorkGroup = {
  from: at('08:00'),
  to: at('09:00'),
  observedMs: 3_600_000,
  confidence: 'weak',
  evidence: [],
  blocks: [BLOCK],
};

const CONTEXT: UnnamedContext = {
  id: contextKey(BLOCK.context),
  context: BLOCK.context,
  observedMs: 3_600_000,
  from: at('08:00'),
  to: at('09:00'),
  suggestion: { repoPath: '/work/shop', branch: 'feature/export' },
};

const DAY: DayRows = {
  proposals: [],
  unattributed: [GROUP],
  unnamed: [
    {
      id: unnamedRowId(GROUP),
      from: at('08:00'),
      to: at('09:00'),
      durationMs: 3_600_000,
      observedMs: 3_600_000,
      laneKey: 'repo:/work/shop',
      description: 'export',
      confidence: 'weak',
      evidence: [],
      state: 'suggested',
    },
  ],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
};

const REQUEST: TicketWritingRequest = { notes: [], parents: [], issues: [] };

const matched = (issueKey: string): AutoModeAnswer => ({
  subject: { kind: 'context', contextId: CONTEXT.id },
  askedAtMs: 0,
  request: REQUEST,
  outcome: { kind: 'match', issueKey },
});

const drafted: AutoModeAnswer = {
  subject: { kind: 'context', contextId: CONTEXT.id },
  askedAtMs: 0,
  request: REQUEST,
  outcome: {
    kind: 'draft',
    summary: 'Export the month',
    description: 'One file.',
    projectKey: 'ABC',
    parentKey: 'ABC-9',
  },
};

const rowsOf = (edits: DayReviewEdits) => reviewDay({ rows: DAY, edits }).rows;

const autoPass = (edits: DayReviewEdits) =>
  withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: DAY.unattributed });

const asks = (options: {
  day?: string;
  answers?: AutoModeAnswer[];
  standIns?: ReturnType<typeof openStandIn>[];
  rows?: Pick<ReviewedRow, 'standInId' | 'issueKey' | 'sources'>[];
}) =>
  autoModeAsks({
    enabled: true,
    day: options.day ?? TODAY,
    today: TODAY,
    contexts: [CONTEXT],
    standIns: options.standIns ?? [],
    rows: options.rows ?? [],
    answers: options.answers ?? [],
  });

describe('autoModeAsks', () => {
  it('asks about each unnamed context and each open stand-in of today', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });

    expect(asks({ standIns: [standIn] })).toEqual([
      { kind: 'context', contextId: CONTEXT.id },
      { kind: 'stand-in', standInId: standIn.id },
    ]);
  });

  it('asks nothing about a past day', () => {
    expect(asks({ day: '2026-08-10' })).toEqual([]);
  });

  it('asks nothing while auto mode is off', () => {
    expect(
      autoModeAsks({
        enabled: false,
        day: TODAY,
        today: TODAY,
        contexts: [CONTEXT],
        standIns: [],
        rows: [],
        answers: [],
      }),
    ).toEqual([]);
  });

  it('asks a band once: an answer stored against the day is never asked again', () => {
    expect(asks({ answers: [matched('ABC-1')] })).toEqual([]);
  });

  it('leaves a stand-in the user reopened alone', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const settings = { ...DEFAULT_TIMETRACK_SETTINGS, standIns: [standIn] };
    const resolved = resolveStandIn({ settings, id: standIn.id, issueKey: 'ABC-1' });
    const reopened = reopenStandIn({ settings: resolved, id: standIn.id });

    expect(asks({ standIns: reopened.standIns })).toEqual([{ kind: 'context', contextId: CONTEXT.id }]);
  });

  it('leaves a stand-in alone once the user keyed its row by hand today', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const rows = [{ standInId: standIn.id, issueKey: 'ABC-6', sources: { issue: 'human' as const } }];

    expect(asks({ standIns: [standIn], rows })).toEqual([{ kind: 'context', contextId: CONTEXT.id }]);
  });

  it('still asks about a stand-in whose row holds an observed or auto issue', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const rows = [
      { standInId: standIn.id, issueKey: 'ABC-6' },
      { standInId: standIn.id, issueKey: 'ABC-7', sources: { issue: 'auto' as const } },
    ];

    expect(asks({ standIns: [standIn], rows })).toEqual([
      { kind: 'context', contextId: CONTEXT.id },
      { kind: 'stand-in', standInId: standIn.id },
    ]);
  });

  it('skips a stand-in the day does not hold', () => {
    const standIn = openStandIn({ name: 'Journey', day: '2026-08-10', now: at('07:00') });

    expect(asks({ standIns: [standIn] })).toEqual([{ kind: 'context', contextId: CONTEXT.id }]);
  });
});

describe('withAutoModeRowNames', () => {
  it('names the band with the match as a local write whose source is auto', () => {
    const edits = autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')));
    const [row] = rowsOf(edits);

    expect(row?.issueKey).toBe('ABC-1');
    expect(row?.sources?.issue).toBe('auto');
  });

  it('leaves a field the user set unchanged', () => {
    const [unnamed] = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    if (!unnamed) throw new Error('no row');

    const byHand = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: unnamed, issueKey: 'ABC-7' });
    const edits = autoPass(withAutoModeAnswer(byHand, matched('ABC-1')));

    expect(edits.overrides).toEqual(byHand.overrides);
    expect(rowsOf(edits)[0]?.issueKey).toBe('ABC-7');
  });

  it('leaves a band the user cleared unnamed', () => {
    const [unnamed] = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    if (!unnamed) throw new Error('no row');

    const cleared = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: unnamed, issueKey: '' });
    const edits = autoPass(withAutoModeAnswer(cleared, matched('ABC-1')));

    expect(edits.overrides).toEqual(cleared.overrides);
  });

  it('writes nothing for a draft until its create is approved', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, drafted);

    expect(autoPass(edits)).toBe(edits);
  });

  it('names the band with the key the approved create filed', () => {
    const queued = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, {
      ...drafted,
      outcome: { ...drafted.outcome, approvalId: 'a-1' } as AutoModeAnswer['outcome'],
    });
    const edits = autoPass(withAutoModeCreated(queued, { approvalId: 'a-1', issueKey: 'ABC-12' }));

    expect(rowsOf(edits)[0]?.issueKey).toBe('ABC-12');
  });
});

describe('autoModeCreateRequest', () => {
  it('queues exactly one external create for a band with no match', () => {
    const request = autoModeCreateRequest(drafted);

    expect(request).toEqual({
      op: 'jira.create',
      summary: 'Export the month',
      description: 'One file.',
      projectKey: 'ABC',
      parentKey: 'ABC-9',
    });
    expect(AUTO_MODE_CLIENT).toBe('auto mode');
  });

  it('queues nothing a second time, and nothing for a match', () => {
    const queued = { ...drafted, outcome: { ...drafted.outcome, approvalId: 'a-1' } } as AutoModeAnswer;

    expect(autoModeCreateRequest(queued)).toBeNull();
    expect(autoModeCreateRequest(matched('ABC-1'))).toBeNull();
  });
});

describe('autoModeQueuedAnswer', () => {
  it('takes over the create an earlier ask queued for the same band, with the wording it holds', () => {
    const earlier = {
      id: 'a-1',
      request: {
        op: 'jira.create' as const,
        summary: 'Month export',
        description: 'Earlier.',
        projectKey: 'ABC',
      },
    };

    expect(autoModeQueuedAnswer(drafted, earlier).outcome).toEqual({
      kind: 'draft',
      summary: 'Month export',
      description: 'Earlier.',
      projectKey: 'ABC',
      approvalId: 'a-1',
    });
  });

  it('keys the queue item by day and subject', () => {
    expect(autoModeApprovalTarget(TODAY, drafted.subject)).not.toBe(
      autoModeApprovalTarget('2026-08-12', drafted.subject),
    );
    expect(autoModeApprovalTarget(TODAY, drafted.subject)).not.toBe(
      autoModeApprovalTarget(TODAY, { kind: 'stand-in', standInId: CONTEXT.id }),
    );
  });
});

describe('autoModeCreatedKeys', () => {
  const queued = { ...drafted, outcome: { ...drafted.outcome, approvalId: 'a-1' } } as AutoModeAnswer;

  it('reads the key of an approved create', () => {
    expect(
      autoModeCreatedKeys({
        answers: [queued],
        approvals: [{ id: 'a-1', state: 'approved', result: { issue: { key: 'ABC-12', id: '1' } } }],
      }),
    ).toEqual([{ answer: queued, approvalId: 'a-1', issueKey: 'ABC-12' }]);
  });

  it('reads nothing while it waits, and nothing for a rejected or failed one', () => {
    expect(
      autoModeCreatedKeys({
        answers: [queued],
        approvals: [
          { id: 'a-1', state: 'queued' },
          { id: 'a-2', state: 'rejected' },
        ],
      }),
    ).toEqual([]);
    expect(autoModeCreatedKeys({ answers: [queued], approvals: [{ id: 'a-1', state: 'approved' }] })).toEqual([]);
  });
});

const queuedApply = (answer: AutoModeAnswer, label = 'shop · feature/export'): AgentApproval[] => {
  const request = autoModeApplyRequest({
    day: TODAY,
    answer,
    label,
    classes: { 'autoMode.apply': 'external' },
  });

  if (!request) throw new Error('nothing to queue');

  return enqueueApproval([], {
    id: 'apply-1',
    request,
    client: AUTO_MODE_CLIENT,
    target: autoModeApplyTarget(TODAY, answer.subject),
    at: at('10:00'),
    day: TODAY,
  });
};

describe('autoModeApplyRequest', () => {
  it('queues a match only where the user made applying stricter than local', () => {
    const answer = matched('ABC-1');

    expect(autoModeApplyRequest({ day: TODAY, answer, label: 'shop', classes: {} })).toBeNull();
    expect(
      autoModeApplyRequest({ day: TODAY, answer, label: 'shop', classes: { 'autoMode.apply': 'human-only' } }),
    ).toBeNull();
    expect(
      autoModeApplyRequest({ day: TODAY, answer, label: 'shop', classes: { 'autoMode.apply': 'external' } }),
    ).toEqual({ op: 'autoMode.apply', day: TODAY, subject: answer.subject, label: 'shop', issueKey: 'ABC-1' });
    expect(
      autoModeApplyRequest({ day: TODAY, answer: drafted, label: 'shop', classes: { 'autoMode.apply': 'external' } }),
    ).toBeNull();
  });
});

describe('autoModeApplies', () => {
  const applies = (options: { answer?: AutoModeAnswer; classes?: ActionClasses; approvals?: AgentApproval[] }) =>
    autoModeApplies({
      day: TODAY,
      answer: options.answer ?? matched('ABC-1'),
      classes: options.classes ?? {},
      approvals: options.approvals ?? [],
    });

  it('writes a match at local, and never at human-only', () => {
    expect(applies({})).toBe(true);
    expect(applies({ classes: { 'autoMode.apply': 'human-only' } })).toBe(false);
  });

  it('writes a match at external only once its queued apply is approved', () => {
    const classes: ActionClasses = { 'autoMode.apply': 'external' };
    const queue = queuedApply(matched('ABC-1'));

    expect(applies({ classes, approvals: queue })).toBe(false);
    expect(applies({ classes, approvals: markApproval(queue, { id: 'apply-1', state: 'approved' }) })).toBe(true);
  });

  it('keeps a rejected apply rejected, whatever the class is now', () => {
    const rejected = markApproval(queuedApply(matched('ABC-1')), { id: 'apply-1', state: 'rejected' });

    expect(applies({ approvals: rejected })).toBe(false);
  });

  it('writes the key an approved create filed, and nothing for a draft still waiting', () => {
    const filed = { ...drafted, outcome: { ...drafted.outcome, createdKey: 'ABC-12' } } as AutoModeAnswer;

    expect(applies({ answer: drafted })).toBe(false);
    expect(applies({ answer: filed, classes: { 'autoMode.apply': 'human-only' } })).toBe(true);
  });

  it('gates the row pass', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1'));

    expect(
      withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: DAY.unattributed, applies: () => false }),
    ).toBe(edits);
  });
});

describe('autoModeContextLabel', () => {
  it('names a checkout by its folder and branch, and an application by its id', () => {
    expect(autoModeContextLabel(CONTEXT.id)).toBe('shop · feature/export');
    expect(autoModeContextLabel('repo:/work/shop@main#apps/web')).toBe('shop · main · apps/web');
    expect(autoModeContextLabel('repo:/work/shop~session-1')).toBe('shop');
    expect(autoModeContextLabel('app:figma')).toBe('figma');
  });
});

describe('autoModeReadout', () => {
  const readout = (options: {
    edits: DayReviewEdits;
    approvals?: AgentApproval[];
    classes?: ActionClasses;
    standIns?: ReturnType<typeof openStandIn>[];
  }) =>
    autoModeReadout({
      day: TODAY,
      edits: options.edits,
      approvals: options.approvals ?? [],
      classes: options.classes ?? {},
      standIns: options.standIns ?? [],
    });

  it('counts the rows a match named as auto', () => {
    const edits = autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')));

    expect(readout({ edits })).toEqual([
      expect.objectContaining({ status: 'applied', issueKey: 'ABC-1', namedRows: 1, label: 'shop · feature/export' }),
    ]);
  });

  it('reads a match nothing named as unused, or held where applying is set to never', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1'));

    expect(readout({ edits })[0]?.status).toBe('unused');
    expect(readout({ edits, classes: { 'autoMode.apply': 'human-only' } })[0]?.status).toBe('held');
  });

  it('reads the queued apply of a match from the queue', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1'));
    const queue = queuedApply(matched('ABC-1'));

    expect(readout({ edits, approvals: queue })[0]?.status).toBe('waiting');
    expect(readout({ edits, approvals: markApproval(queue, { id: 'apply-1', state: 'rejected' }) })[0]?.status).toBe(
      'rejected',
    );
  });

  it('reads a stand-in auto mode resolved, and one the user resolved themselves', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const settings = { ...DEFAULT_TIMETRACK_SETTINGS, standIns: [standIn] };
    const answer: AutoModeAnswer = { ...matched('ABC-1'), subject: { kind: 'stand-in', standInId: standIn.id } };
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, answer);
    const byAuto = resolveStandIn({ settings, id: standIn.id, issueKey: 'ABC-1', source: 'auto' }).standIns;
    const byHand = resolveStandIn({ settings, id: standIn.id, issueKey: 'ABC-2' }).standIns;

    expect(readout({ edits, standIns: byAuto })[0]).toMatchObject({ status: 'applied', label: 'Journey' });
    expect(readout({ edits, standIns: byHand })[0]?.status).toBe('overruled');
  });

  it('follows a queued create from waiting to filed', () => {
    const answer = { ...drafted, outcome: { ...drafted.outcome, approvalId: 'a-1' } } as AutoModeAnswer;
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, answer);
    const create = autoModeCreateRequest(drafted);

    if (!create) throw new Error('no create');

    const queue = enqueueApproval([], {
      id: 'a-1',
      request: create,
      client: AUTO_MODE_CLIENT,
      at: at('10:00'),
      day: TODAY,
    });
    const approved = markApproval(queue, { id: 'a-1', state: 'approved', result: { issue: { key: 'ABC-12' } } });

    expect(readout({ edits, approvals: queue })[0]).toMatchObject({ status: 'waiting', summary: 'Export the month' });
    expect(readout({ edits, approvals: approved })[0]).toMatchObject({ status: 'filed', issueKey: 'ABC-12' });
  });

  it('says why a draft was never queued', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, drafted);

    expect(readout({ edits })[0]?.status).toBe('not-queued');
    expect(readout({ edits, classes: { 'autoMode.create': 'human-only' } })[0]?.status).toBe('held');
  });

  it('reads a failed run as failed', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, { ...drafted, outcome: { kind: 'failed' } });

    expect(readout({ edits })[0]?.status).toBe('failed');
  });
});

describe('approvalRowIdsOf', () => {
  const rows = rowsOf(EMPTY_DAY_REVIEW_EDITS);
  const create = { op: 'jira.create' as const, summary: 'Export the month', description: '', projectKey: 'ABC' };
  const idsOf = (item: Parameters<typeof approvalRowIdsOf>[0]['item'], day = TODAY) =>
    approvalRowIdsOf({ item, day, rows, unattributed: DAY.unattributed });

  it('previews an auto mode create on the unnamed band of its context', () => {
    const target = autoModeApprovalTarget(TODAY, { kind: 'context', contextId: CONTEXT.id });

    expect(idsOf({ request: create, target })).toEqual([unnamedRowId(GROUP)]);
  });

  it('previews nothing for a create of another day or one with no target', () => {
    const target = autoModeApprovalTarget('2026-08-10', { kind: 'context', contextId: CONTEXT.id });

    expect(idsOf({ request: create, target })).toEqual([]);
    expect(idsOf({ request: create })).toEqual([]);
  });

  it('previews a worklog add on the row it falls on', () => {
    const request = {
      op: 'worklog.add' as const,
      issueKey: 'ABC-1',
      description: '',
      fromMs: at('08:15').getTime(),
      durationMs: 900_000,
    };

    expect(idsOf({ request })).toEqual([unnamedRowId(GROUP)]);
    expect(idsOf({ request: { ...request, fromMs: at('10:00').getTime() } })).toEqual([]);
  });

  it('previews nothing for a tempo sync', () => {
    expect(idsOf({ request: { op: 'tempo.sync', day: TODAY, planHash: 'x' } })).toEqual([]);
  });
});

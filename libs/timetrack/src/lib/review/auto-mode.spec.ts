import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { UnnamedContext } from '../model/attribution';
import { ActivityBlock, contextKey } from '../model/block';
import { StandIn, openStandIn } from '../model/stand-in';
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
  autoModeAskRefusal,
  autoModeContextLabel,
  autoModeReadout,
  autoModeAsks,
  autoModeSubjectRequest,
  autoModeCreateRequest,
  autoModeCreatedKeys,
  autoModeQueuedAnswer,
  autoModeReaskSubjectOf,
  withAutoModeAnswer,
  withAutoModeCreated,
  withAutoModeRowNames,
  withAutoModeSubjectItemsExpired,
  withNamedContextItemsExpired,
  withStaleStandInCreatesExpired,
} from './auto-mode';
import { autoDescriptionRowId, withAutoModeDescription } from './auto-description';
import { setRowDescription, setRowIssue } from './edits';
import { AutoModeAnswer, AutoModeSubject, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
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

describe('autoModeAsks after new evidence', () => {
  const CONFIG = resolveGitFlowConfig({});
  const SUBJECT = { kind: 'context' as const, contextId: CONTEXT.id };
  const commit = (subject: string) => ({ kind: 'commit' as const, at: at('08:30'), detail: subject, summary: subject });
  const groupOf = (subjects: string[], observedMs = 3_600_000): WorkGroup => ({
    ...GROUP,
    observedMs,
    blocks: [{ ...BLOCK, evidence: subjects.map(commit) }],
  });
  const answerFrom = (unattributed: WorkGroup[], outcome: AutoModeAnswer['outcome']): AutoModeAnswer => ({
    subject: SUBJECT,
    askedAtMs: 0,
    request: autoModeSubjectRequest({
      subject: SUBJECT,
      contexts: [CONTEXT],
      unattributed,
      standIns: [],
      config: CONFIG,
      maskedNames: [],
    })!,
    outcome,
  });
  const morning = [groupOf(['Add the export button'])];
  const afternoon = [groupOf(['Add the export button', 'Write the month as CSV'])];
  const draftOutcome = drafted.outcome;
  const asksWith = (options: {
    unattributed: WorkGroup[];
    answer: AutoModeAnswer;
    approvals?: AgentApproval[];
    rows?: Parameters<typeof autoModeAsks>[0]['rows'];
    contexts?: UnnamedContext[];
  }) =>
    autoModeAsks({
      enabled: true,
      day: TODAY,
      today: TODAY,
      contexts: options.contexts ?? [CONTEXT],
      standIns: [],
      rows: options.rows ?? [],
      answers: [options.answer],
      evidence: { unattributed: options.unattributed, config: CONFIG, maskedNames: [] },
      approvals: options.approvals ?? [],
    });

  it('asks a band again once a later commit changes what its answer was built from', () => {
    expect(asksWith({ unattributed: afternoon, answer: answerFrom(morning, draftOutcome) })).toEqual([SUBJECT]);
  });

  it('asks nothing on a second evaluation of unchanged evidence', () => {
    const answer = answerFrom(afternoon, draftOutcome);

    expect(asksWith({ unattributed: afternoon, answer })).toEqual([]);
    expect(asksWith({ unattributed: afternoon, answer })).toEqual([]);
  });

  it('asks nothing for a band that only grew longer', () => {
    const longer = [groupOf(['Add the export button'], 7_200_000)];
    const contexts = [{ ...CONTEXT, observedMs: 7_200_000 }];

    expect(asksWith({ unattributed: longer, contexts, answer: answerFrom(morning, draftOutcome) })).toEqual([]);
  });

  it('asks nothing again without the evidence or the queue to judge by', () => {
    expect(
      autoModeAsks({
        enabled: true,
        day: TODAY,
        today: TODAY,
        contexts: [CONTEXT],
        standIns: [],
        rows: [],
        answers: [answerFrom(morning, draftOutcome)],
        evidence: { unattributed: afternoon, config: CONFIG, maskedNames: [] },
      }),
    ).toEqual([]);
  });

  it('leaves an answer whose create the user approved or rejected', () => {
    const create = { op: 'jira.create' as const, summary: 'Export', description: '', projectKey: 'ABC' };
    const queue = enqueueApproval([], {
      id: 'a-1',
      request: create,
      client: AUTO_MODE_CLIENT,
      target: autoModeApprovalTarget(TODAY, SUBJECT),
      at: new Date(),
      day: TODAY,
    });
    const answer = answerFrom(morning, { ...draftOutcome, approvalId: 'a-1' } as AutoModeAnswer['outcome']);

    expect(asksWith({ unattributed: afternoon, answer, approvals: queue })).toEqual([SUBJECT]);

    for (const state of ['approved', 'running', 'rejected'] as const) {
      const approvals = markApproval(queue, { id: 'a-1', state });

      expect(asksWith({ unattributed: afternoon, answer, approvals })).toEqual([]);
    }

    expect(
      asksWith({
        unattributed: afternoon,
        answer: answerFrom(morning, { ...draftOutcome, createdKey: 'ABC-12' } as AutoModeAnswer['outcome']),
      }),
    ).toEqual([]);
  });

  it('leaves a match whose apply the user rejected', () => {
    const answer = answerFrom(morning, { kind: 'match', issueKey: 'ABC-1' });
    const queue = enqueueApproval([], {
      id: 'p-1',
      request: { op: 'autoMode.apply', day: TODAY, subject: SUBJECT, label: 'shop', issueKey: 'ABC-1' },
      client: AUTO_MODE_CLIENT,
      target: autoModeApplyTarget(TODAY, SUBJECT),
      at: new Date(),
      day: TODAY,
    });

    expect(asksWith({ unattributed: afternoon, answer, approvals: queue })).toEqual([SUBJECT]);
    expect(
      asksWith({ unattributed: afternoon, answer, approvals: markApproval(queue, { id: 'p-1', state: 'rejected' }) }),
    ).toEqual([]);
  });

  it('leaves a band the user named a row of by hand', () => {
    const rows = [{ id: unnamedRowId(afternoon[0]!), issueKey: 'ABC-7', sources: { issue: 'human' as const } }];

    expect(asksWith({ unattributed: afternoon, rows, answer: answerFrom(morning, draftOutcome) })).toEqual([]);
  });

  it('renames the band an earlier match named with the match the new ask found', () => {
    const first = autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')));
    const edits = autoPass(withAutoModeAnswer(first, matched('ABC-2')));

    expect(rowsOf(edits)[0]?.issueKey).toBe('ABC-2');
    expect(rowsOf(edits)[0]?.sources?.issue).toBe('auto');
  });
});

describe('expiring what an old auto mode answer left waiting', () => {
  const create = { op: 'jira.create' as const, summary: 'Export', description: '', projectKey: 'ABC' };
  const context = (contextId: string) => ({ kind: 'context' as const, contextId });
  const queue = [
    { id: 'a', subject: context('c1'), apply: false },
    { id: 'b', subject: context('c1'), apply: true },
    { id: 'c', subject: context('c2'), apply: false },
  ].reduce<AgentApproval[]>(
    (items, entry) =>
      enqueueApproval(items, {
        id: entry.id,
        request: entry.apply
          ? { op: 'autoMode.apply', day: TODAY, subject: entry.subject, label: 'shop', issueKey: 'ABC-1' }
          : create,
        client: AUTO_MODE_CLIENT,
        target: (entry.apply ? autoModeApplyTarget : autoModeApprovalTarget)(TODAY, entry.subject),
        at: new Date(),
        day: TODAY,
      }),
    [],
  );

  it('expires the create and apply a re-asked subject left waiting, and nothing else', () => {
    const states = withAutoModeSubjectItemsExpired(queue, { day: TODAY, subject: context('c1') }).map(
      (item) => item.state,
    );

    expect(states).toEqual(['expired', 'expired', 'queued']);
  });

  it('expires what waits for a context that is no longer open', () => {
    const states = withNamedContextItemsExpired(queue, { day: TODAY, openContextIds: new Set(['c2']) }).map(
      (item) => item.state,
    );

    expect(states).toEqual(['expired', 'expired', 'queued']);
  });

  it('leaves what waits for an open context, another day or another client alone', () => {
    const fromCli = queue.map((item) => ({ ...item, client: 'Claude Code' }));

    expect(
      withNamedContextItemsExpired(queue, { day: TODAY, openContextIds: new Set(['c1', 'c2']) }).map((i) => i.state),
    ).toEqual(['queued', 'queued', 'queued']);
    expect(
      withNamedContextItemsExpired(queue, { day: '2026-08-12', openContextIds: new Set() }).map((i) => i.state),
    ).toEqual(['queued', 'queued', 'queued']);
    expect(
      withNamedContextItemsExpired(fromCli, { day: TODAY, openContextIds: new Set() }).map((i) => i.state),
    ).toEqual(['queued', 'queued', 'queued']);
  });
});

describe('asking auto mode again for a row', () => {
  const CONFIG = resolveGitFlowConfig({});
  const SUBJECT = { kind: 'context' as const, contextId: CONTEXT.id };
  const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
  const offerFor = (row: ReviewedRow, options: { day?: string; ruled?: boolean } = {}) =>
    autoModeReaskSubjectOf({
      row,
      day: options.day ?? TODAY,
      contexts: [CONTEXT],
      ...(options.ruled ? { ruledContextIds: new Set([CONTEXT.id]) } : {}),
      unattributed: DAY.unattributed,
      standIns: [standIn],
    });
  const bandOf = (edits: DayReviewEdits) => rowsOf(edits)[0]!;
  const standInRow = (sources?: ReviewedRow['sources']): ReviewedRow => ({
    ...bandOf(EMPTY_DAY_REVIEW_EDITS),
    id: 'stand-in-row',
    standInId: standIn.id,
    ...(sources ? { issueKey: 'ABC-6', sources } : {}),
  });

  it('offers an unnamed band, and one auto mode named, for the context behind it', () => {
    expect(offerFor(bandOf(EMPTY_DAY_REVIEW_EDITS))).toEqual(SUBJECT);
    expect(offerFor(bandOf(autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')))))).toEqual(SUBJECT);
  });

  it('offers a band of a past day', () => {
    expect(offerFor(bandOf(EMPTY_DAY_REVIEW_EDITS), { day: '2026-08-10' })).toEqual(SUBJECT);
  });

  it('hides it on a band the user named by hand, and on one a rule answers', () => {
    const row = bandOf(EMPTY_DAY_REVIEW_EDITS);
    const named = bandOf(setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row, issueKey: 'ABC-7', source: 'human' }));

    expect(offerFor(named)).toBeNull();
    expect(offerFor({ ...row, issueKey: 'ABC-7' })).toBeNull();
    expect(offerFor(row, { ruled: true })).toBeNull();
    expect(offerFor({ ...row, unattended: true })).toBeNull();
  });

  it('offers an open stand-in, and hides it once the user keyed its row or it resolved', () => {
    expect(offerFor(standInRow())).toEqual({ kind: 'stand-in', standInId: standIn.id });
    expect(offerFor(standInRow({ issue: 'auto' }))).toEqual({ kind: 'stand-in', standInId: standIn.id });
    expect(offerFor(standInRow({ issue: 'human' }))).toBeNull();
    expect(
      autoModeReaskSubjectOf({
        row: standInRow(),
        day: TODAY,
        contexts: [CONTEXT],
        unattributed: DAY.unattributed,
        standIns: [{ ...standIn, state: 'resolved' }],
      }),
    ).toBeNull();
  });

  it('replaces the answer once, expires what the old one left waiting, and asks nothing after', () => {
    const request = autoModeSubjectRequest({
      subject: SUBJECT,
      contexts: [CONTEXT],
      unattributed: DAY.unattributed,
      standIns: [],
      config: CONFIG,
      maskedNames: [],
    })!;
    const held: AutoModeAnswer = {
      ...drafted,
      request,
      outcome: { ...drafted.outcome, approvalId: 'a-1' } as AutoModeAnswer['outcome'],
    };
    const queue = enqueueApproval([], {
      id: 'a-1',
      request: { op: 'jira.create', summary: 'Export the month', description: 'One file.', projectKey: 'ABC' },
      client: AUTO_MODE_CLIENT,
      target: autoModeApprovalTarget(TODAY, SUBJECT),
      at: new Date(),
      day: TODAY,
    });
    const asksAfter = (answer: AutoModeAnswer, approvals: AgentApproval[]) =>
      autoModeAsks({
        enabled: true,
        day: TODAY,
        today: TODAY,
        contexts: [CONTEXT],
        standIns: [],
        rows: rowsOf(EMPTY_DAY_REVIEW_EDITS),
        answers: [answer],
        evidence: { unattributed: DAY.unattributed, config: CONFIG, maskedNames: [] },
        approvals,
      });

    expect(asksAfter(held, queue)).toEqual([]);

    const expired = withAutoModeSubjectItemsExpired(queue, { day: TODAY, subject: SUBJECT });
    const edits = withAutoModeAnswer(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, held), {
      ...matched('ABC-2'),
      request,
    });

    expect(expired.map((item) => item.state)).toEqual(['expired']);
    expect(edits.auto).toHaveLength(1);
    expect(asksAfter(edits.auto![0]!, expired)).toEqual([]);
    expect(rowsOf(autoPass(edits))[0]?.issueKey).toBe('ABC-2');
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

  describe('a match replaced by a draft', () => {
    const redrafted = (edits: DayReviewEdits) => withAutoModeAnswer(edits, drafted);

    it('unnames the rows the match named, once', () => {
      const named = autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')));
      const edits = autoPass(redrafted(named));

      expect(rowsOf(edits)[0]?.issueKey).toBeFalsy();
      expect(autoPass(edits)).toBe(edits);
    });

    it('keeps the issue of a row the user named', () => {
      const [unnamed] = rowsOf(EMPTY_DAY_REVIEW_EDITS);

      if (!unnamed) throw new Error('no row');

      const byHand = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: unnamed, issueKey: 'ABC-1' });
      const edits = autoPass(redrafted(withAutoModeAnswer(byHand, matched('ABC-1'))));

      expect(rowsOf(edits)[0]?.issueKey).toBe('ABC-1');
    });

    it('names the rows with the key the approved create filed', () => {
      const named = autoPass(withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, matched('ABC-1')));
      const queued = autoPass(
        withAutoModeAnswer(named, {
          ...drafted,
          outcome: { ...drafted.outcome, approvalId: 'a-1' } as AutoModeAnswer['outcome'],
        }),
      );
      const edits = autoPass(withAutoModeCreated(queued, { approvalId: 'a-1', issueKey: 'ABC-12' }));

      expect(rowsOf(edits)[0]?.issueKey).toBe('ABC-12');
      expect(rowsOf(edits)[0]?.sources?.issue).toBe('auto');
    });
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

describe('a match Jira had done', () => {
  const done = (): AutoModeAnswer => {
    const answer = matched('FOO-1');

    return answer.outcome.kind === 'match' ? { ...answer, outcome: { ...answer.outcome, done: true } } : answer;
  };

  it('is never written, queued or named onto a band, and reads out as done', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, done());

    expect(autoModeApplies({ day: TODAY, answer: done(), classes: {}, approvals: [] })).toBe(false);
    expect(
      autoModeApplyRequest({ day: TODAY, answer: done(), label: 'shop', classes: { 'autoMode.apply': 'external' } }),
    ).toBeNull();
    expect(withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: DAY.unattributed })).toBe(edits);
    expect(autoModeReadout({ day: TODAY, edits, approvals: [], classes: {}, standIns: [] })).toEqual([
      expect.objectContaining({ status: 'done', issueKey: 'FOO-1', namedRows: 0 }),
    ]);
  });

  it('queues a stand-in’s match for approval at local and external, marked done, and never at human-only', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const answer: AutoModeAnswer = { ...done(), subject: { kind: 'stand-in', standInId: standIn.id } };
    const request = (classes: ActionClasses) => autoModeApplyRequest({ day: TODAY, answer, label: 'Journey', classes });

    expect(request({})).toEqual({
      op: 'autoMode.apply',
      day: TODAY,
      subject: answer.subject,
      label: 'Journey',
      issueKey: 'FOO-1',
      done: true,
    });
    expect(request({ 'autoMode.apply': 'external' })).toEqual(expect.objectContaining({ done: true }));
    expect(request({ 'autoMode.apply': 'human-only' })).toBeNull();
    expect(autoModeApplies({ day: TODAY, answer, classes: {}, approvals: [] })).toBe(false);

    const local = request({});

    if (!local) throw new Error('nothing to queue');

    const queue = enqueueApproval([], {
      id: 'apply-1',
      request: local,
      client: AUTO_MODE_CLIENT,
      target: autoModeApplyTarget(TODAY, answer.subject),
      at: at('10:00'),
      day: TODAY,
    });
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, answer);
    const statusOf = (approvals: AgentApproval[]) =>
      autoModeReadout({ day: TODAY, edits, approvals, classes: {}, standIns: [standIn] })[0]?.status;

    expect(statusOf([])).toBe('done');
    expect(statusOf(queue)).toBe('waiting');
    expect(statusOf(markApproval(queue, { id: 'apply-1', state: 'rejected' }))).toBe('rejected');
  });
});

describe('a match on a parent issue', () => {
  const parentMatch = (subject: AutoModeAnswer['subject']): AutoModeAnswer => ({
    ...matched('FOO-1'),
    subject,
    outcome: { kind: 'match', issueKey: 'FOO-1', parent: true },
  });

  it('queues for approval marked parent at local, never writes before it, and never at human-only', () => {
    const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
    const answer = parentMatch({ kind: 'stand-in', standInId: standIn.id });
    const request = (classes: ActionClasses) => autoModeApplyRequest({ day: TODAY, answer, label: 'Journey', classes });

    expect(request({})).toEqual(expect.objectContaining({ issueKey: 'FOO-1', parent: true }));
    expect(request({})).not.toHaveProperty('done');
    expect(request({ 'autoMode.apply': 'external' })).toEqual(expect.objectContaining({ parent: true }));
    expect(request({ 'autoMode.apply': 'human-only' })).toBeNull();
    expect(autoModeApplies({ day: TODAY, answer, classes: {}, approvals: [] })).toBe(false);

    const local = request({});

    if (!local) throw new Error('nothing to queue');

    const queue = enqueueApproval([], {
      id: 'apply-1',
      request: local,
      client: AUTO_MODE_CLIENT,
      target: autoModeApplyTarget(TODAY, answer.subject),
      at: at('10:00'),
      day: TODAY,
    });

    expect(autoModeApplies({ day: TODAY, answer, classes: {}, approvals: queue })).toBe(false);
    expect(
      autoModeApplies({
        day: TODAY,
        answer,
        classes: {},
        approvals: markApproval(queue, { id: 'apply-1', state: 'approved' }),
      }),
    ).toBe(true);
  });

  it('still writes a match that is not a parent at local', () => {
    const answer = matched('FOO-1');

    expect(autoModeApplies({ day: TODAY, answer, classes: {}, approvals: [] })).toBe(true);
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

  describe('a row auto mode described', () => {
    const [row] = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    if (!row) throw new Error('no row');

    const request = { repo: 'Repo-1', minutes: 60, issue: { key: 'ABC-1' }, notes: [] };
    const described = (description?: string) =>
      withAutoModeDescription({
        edits: EMPTY_DAY_REVIEW_EDITS,
        row,
        answer: {
          rowId: autoDescriptionRowId(row),
          askedAtMs: at('10:00').getTime(),
          request,
          ...(description ? { description } : {}),
        },
      });
    const readRows = (edits: DayReviewEdits) =>
      autoModeReadout({ day: TODAY, edits, approvals: [], classes: {}, standIns: [], rows: rowsOf(edits) });

    it('reads the line it wrote, under the lane label of the row rather than the masked one', () => {
      expect(readRows(described('Built the export'))).toEqual([
        expect.objectContaining({
          key: `description:${autoDescriptionRowId(row)}`,
          kind: 'description',
          status: 'written',
          description: 'Built the export',
          label: 'shop',
        }),
      ]);
    });

    it('reads a line the user wrote over as overruled', () => {
      const edits = described('Built the export');
      const [current] = rowsOf(edits);

      if (!current) throw new Error('no row');

      const overruled = setRowDescription({ edits, row: current, description: 'My own words' });

      expect(readRows(overruled)[0]?.status).toBe('overruled');
    });

    it('reads an answer with no line as failed', () => {
      expect(readRows(described())[0]?.status).toBe('failed');
    });

    it('orders descriptions and ticket asks by when they were asked', () => {
      const edits = withAutoModeAnswer(described('Built the export'), { ...drafted, askedAtMs: at('11:00').getTime() });

      expect(readRows(edits).map((entry) => entry.kind)).toEqual(['description', 'context']);
    });
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

  it('previews a worklog add on the sibling session row it covers most', () => {
    const [first] = rows;

    if (!first) throw new Error('no row');

    const early = { ...first, id: 'ABC-1@08:00', issueKey: 'ABC-1', from: at('08:00'), to: at('08:30') };
    const late = { ...early, id: 'ABC-1@08:00+b', from: at('08:15'), to: at('09:15') };
    const request = {
      op: 'worklog.add' as const,
      issueKey: 'ABC-1',
      description: '',
      fromMs: at('08:20').getTime(),
      durationMs: 2_700_000,
    };

    expect(
      approvalRowIdsOf({ item: { request }, day: TODAY, rows: [early, late], unattributed: DAY.unattributed }),
    ).toEqual([late.id]);
  });

  it('previews nothing for a tempo sync', () => {
    expect(idsOf({ request: { op: 'tempo.sync', day: TODAY, planHash: 'x' } })).toEqual([]);
  });
});

describe('withStaleStandInCreatesExpired', () => {
  const create = { op: 'jira.create' as const, summary: 'Engagement items', description: '', projectKey: 'ABC' };
  const queued = (options: { id: string; target: string; client?: string }) =>
    enqueueApproval([], {
      ...options,
      request: create,
      client: options.client ?? AUTO_MODE_CLIENT,
      at: new Date(),
      day: TODAY,
    })[0]!;
  const forStandIn = queued({ id: 'a', target: autoModeApprovalTarget(TODAY, { kind: 'stand-in', standInId: 's1' }) });

  it('expires the create waiting for a stand-in that resolved', () => {
    const [item] = withStaleStandInCreatesExpired([forStandIn], [{ id: 's1', state: 'resolved' }]);

    expect(item?.state).toBe('expired');
  });

  it('leaves one for an open stand-in, a context, or another client alone', () => {
    const forContext = queued({ id: 'b', target: autoModeApprovalTarget(TODAY, { kind: 'context', contextId: 'c' }) });
    const fromCli = queued({ id: 'c', target: forStandIn.target ?? '', client: 'Claude Code' });
    const states = withStaleStandInCreatesExpired([forStandIn, forContext, fromCli], [{ id: 's1', state: 'open' }]).map(
      (item) => item.state,
    );

    expect(states).toEqual(['queued', 'queued', 'queued']);
    expect(withStaleStandInCreatesExpired([fromCli], [])[0]?.state).toBe('queued');
  });
});

describe('autoModeAskRefusal', () => {
  const standIn = openStandIn({ name: 'Journey', day: TODAY, now: at('07:00') });
  const settings = { ...DEFAULT_TIMETRACK_SETTINGS, standIns: [standIn] };
  const refusalOf = (
    subject: AutoModeSubject,
    options: { day?: string; standIns?: StandIn[]; ruled?: boolean; edits?: DayReviewEdits } = {},
  ) =>
    autoModeAskRefusal({
      subject,
      day: options.day ?? TODAY,
      contexts: [CONTEXT],
      ...(options.ruled ? { ruledContextIds: new Set([CONTEXT.id]) } : {}),
      unattributed: DAY.unattributed,
      rows: rowsOf(options.edits ?? EMPTY_DAY_REVIEW_EDITS),
      standIns: options.standIns ?? [standIn],
    });
  const STAND_IN = { kind: 'stand-in' as const, standInId: standIn.id };
  const CONTEXT_SUBJECT = { kind: 'context' as const, contextId: CONTEXT.id };

  it('lets an agent ask about an open stand-in of the day and an unnamed context of it', () => {
    expect(refusalOf(STAND_IN)).toBeNull();
    expect(refusalOf(CONTEXT_SUBJECT)).toBeNull();
  });

  it('refuses a stand-in it does not hold, one off the day, a resolved one and one the user reopened', () => {
    const resolved = resolveStandIn({ settings, id: standIn.id, issueKey: 'ABC-1' });
    const reopened = reopenStandIn({ settings: resolved, id: standIn.id });

    expect(refusalOf({ kind: 'stand-in', standInId: 'nope' })).toBe('Timetrack holds no stand-in nope.');
    expect(refusalOf(STAND_IN, { day: '2026-08-10' })).toBe(`Stand-in ${standIn.id} holds no time on 2026-08-10.`);
    expect(refusalOf(STAND_IN, { standIns: resolved.standIns })).toBe(
      `Stand-in ${standIn.id} is resolved already, so auto mode has nothing to ask.`,
    );
    expect(refusalOf(STAND_IN, { standIns: reopened.standIns })).toBe(
      `The user reopened stand-in ${standIn.id}, so auto mode leaves it to them.`,
    );
  });

  it('refuses a context the day holds no unnamed work of, a ruled one and one the user named by hand', () => {
    const row = rowsOf(EMPTY_DAY_REVIEW_EDITS)[0]!;
    const named = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row, issueKey: 'ABC-7', source: 'human' });

    expect(refusalOf({ kind: 'context', contextId: 'repo:/elsewhere' })).toBe(
      `${TODAY} holds no unnamed work of context repo:/elsewhere.`,
    );
    expect(refusalOf(CONTEXT_SUBJECT, { ruled: true })).toBe(
      `A standing rule names context ${CONTEXT.id}, so auto mode is not asked.`,
    );
    expect(refusalOf(CONTEXT_SUBJECT, { edits: named })).toBe(
      `The user named context ${CONTEXT.id} by hand on ${TODAY}, so auto mode leaves it to them.`,
    );
  });
});

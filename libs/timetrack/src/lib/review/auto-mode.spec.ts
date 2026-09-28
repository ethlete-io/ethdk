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
import {
  AUTO_MODE_CLIENT,
  autoModeAsks,
  autoModeCreateRequest,
  autoModeCreatedKeys,
  withAutoModeAnswer,
  withAutoModeCreated,
  withAutoModeRowNames,
} from './auto-mode';
import { setRowIssue } from './edits';
import { AutoModeAnswer, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
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

const asks = (options: { day?: string; answers?: AutoModeAnswer[]; standIns?: ReturnType<typeof openStandIn>[] }) =>
  autoModeAsks({
    enabled: true,
    day: options.day ?? TODAY,
    today: TODAY,
    contexts: [CONTEXT],
    standIns: options.standIns ?? [],
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
      autoModeAsks({ enabled: false, day: TODAY, today: TODAY, contexts: [CONTEXT], standIns: [], answers: [] }),
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

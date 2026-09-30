import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ActionClasses } from '../agent-api/action-classes';
import { AgentApproval, parseApprovalQueue } from '../agent-api/approval-queue';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { DisputeAnswer, resolveDisputeWithAgent$ } from '../ticket/dispute';
import { ProcessResult, TimetrackProcessRunner } from '../transport/ports';
import {
  autoDisputeApplies,
  autoDisputeAsks,
  autoDisputeRequest,
  autoDisputeResolveRequest,
  autoModeResolveTarget,
  disputedTargetOf,
  withAutoModeDispute,
  withAutoModeDisputeResolutions,
} from './auto-dispute';
import { autoModeReadout } from './auto-mode';
import { setRowDescription, setRowIssue } from './edits';
import { AutoModeDispute, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const TODAY = '2026-08-11';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);

const BOOKED = 'ABC-12';
const OTHER = 'ABC-14';

/**
 * An agent session merged the base branch into the booked issue's branch through a worktree, while the
 * checkout itself sat on the other issue's branch.
 */
const disputed = (options: Partial<WorklogProposal> = {}): WorklogProposal => ({
  id: `${BOOKED}@09:15`,
  issueKey: BOOKED,
  disputedIssueKey: OTHER,
  from: at('09:15'),
  to: at('10:00'),
  durationMs: 45 * 60_000,
  observedMs: 45 * 60_000,
  laneKey: 'repo:/work/shop',
  description: 'Merge the base branch',
  confidence: 'certain',
  evidence: [
    { kind: 'branch', at: at('09:15'), detail: 'branch `feature/ABC-14-login` checked out in /work/shop' },
    { kind: 'branch', at: at('09:40'), detail: 'merged `origin/next` into `feature/ABC-12-export` without a checkout' },
    { kind: 'agent-session', at: at('09:20'), detail: 'a session', summary: 'Merge next into the export branch' },
  ],
  state: 'suggested',
  ...options,
});

const dayOf = (proposals: WorklogProposal[]): DayRows => ({
  proposals,
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const reviewOf = (edits: DayReviewEdits, proposal = disputed()) => reviewDay({ rows: dayOf([proposal]), edits });

const rowOf = (edits: DayReviewEdits = EMPTY_DAY_REVIEW_EDITS, proposal = disputed()) => {
  const [row] = reviewOf(edits, proposal).rows;

  if (!row) throw new Error('no row');

  return row;
};

const asks = (options: { edits?: DayReviewEdits; classes?: ActionClasses; day?: string; enabled?: boolean }) => {
  const edits = options.edits ?? EMPTY_DAY_REVIEW_EDITS;

  return autoDisputeAsks({
    enabled: options.enabled ?? true,
    day: options.day ?? TODAY,
    today: TODAY,
    classes: options.classes ?? {},
    rows: reviewOf(edits).rows,
    edits,
  }).map((row) => row.id);
};

const disputeOf = (answer?: DisputeAnswer, row = rowOf()): AutoModeDispute => {
  const other = disputedTargetOf(row);

  if (!other || !row.issueKey) throw new Error('no dispute');

  return {
    rowId: row.id,
    askedAtMs: at('10:30').getTime(),
    booked: row.issueKey,
    other,
    request: autoDisputeRequest({ row, other }),
    ...(answer ? { answer } : {}),
  };
};

const KEEP: DisputeAnswer = { choice: 'keep', reason: 'The session merged into the export branch.' };
const USE: DisputeAnswer = { choice: 'use', reason: 'The commits name the login work.' };
const UNSURE: DisputeAnswer = { choice: 'unsure', reason: 'Nothing says which.' };

const resolved = (options: { answer: DisputeAnswer; edits?: DayReviewEdits; applies?: boolean }) => {
  const start = options.edits ?? EMPTY_DAY_REVIEW_EDITS;
  const edits = withAutoModeDispute(start, disputeOf(options.answer, rowOf(start)));

  return withAutoModeDisputeResolutions({
    edits,
    rows: reviewOf(edits).rows,
    applies: () => options.applies ?? true,
  });
};

const approval = (state: AgentApproval['state'], dispute = disputeOf(KEEP)): AgentApproval => {
  const request = autoDisputeResolveRequest({ day: TODAY, dispute, label: 'shop', classes: EXTERNAL });

  if (!request) throw new Error('no request');

  return {
    id: 'approval-1',
    request,
    opClass: 'external',
    target: autoModeResolveTarget(TODAY, dispute.rowId),
    askedAtMs: 0,
    day: TODAY,
    state,
  };
};

const EXTERNAL: ActionClasses = { 'autoMode.apply': 'external' };
const NEVER: ActionClasses = { 'autoMode.apply': 'human-only' };

describe('autoDisputeAsks', () => {
  it('asks about a band two rungs named different work for', () => {
    expect(asks({})).toEqual([`${BOOKED}@09:15`]);
  });

  it('asks about nothing on another day, with auto mode off, or with applying set to never', () => {
    expect(asks({ day: '2026-08-10' })).toEqual([]);
    expect(asks({ enabled: false })).toEqual([]);
    expect(asks({ classes: NEVER })).toEqual([]);
  });

  it('still asks where applying waits for an approval', () => {
    expect(asks({ classes: EXTERNAL })).toEqual([`${BOOKED}@09:15`]);
  });

  it('leaves a band the user settled or edited alone', () => {
    const kept = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: rowOf(), issueKey: BOOKED });
    const described = setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row: rowOf(), description: 'Mine' });
    const hidden: DayReviewEdits = { ...EMPTY_DAY_REVIEW_EDITS, overrides: { [`${BOOKED}@09:15`]: { hidden: false } } };

    expect(asks({ edits: kept })).toEqual([]);
    expect(asks({ edits: described })).toEqual([]);
    expect(asks({ edits: hidden })).toEqual([]);
  });

  it('asks once per pair of answers', () => {
    const answered = withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, disputeOf(UNSURE));
    const otherPair = withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, { ...disputeOf(UNSURE), booked: 'ABC-99' });

    expect(asks({ edits: answered })).toEqual([]);
    expect(asks({ edits: otherPair })).toEqual([`${BOOKED}@09:15`]);
  });
});

describe('autoDisputeRequest', () => {
  it('sends both answers with their titles, the description, the branch evidence and the notes', () => {
    const row = rowOf();

    expect(
      autoDisputeRequest({
        row,
        other: { kind: 'issue', issueKey: OTHER },
        summaries: { [BOOKED]: 'Export the month', [OTHER]: 'Log in with a passkey' },
      }),
    ).toEqual({
      repo: 'shop',
      minutes: 45,
      description: 'Merge the base branch',
      booked: { key: BOOKED, summary: 'Export the month' },
      other: { key: OTHER, summary: 'Log in with a passkey' },
      branches: [
        'branch `feature/ABC-14-login` checked out in shop',
        'merged `origin/next` into `feature/ABC-12-export` without a checkout',
      ],
      notes: ['Merge next into the export branch'],
    });
  });

  it('names a stand-in rival by the name the user gave it', () => {
    const request = autoDisputeRequest({
      row: rowOf(),
      other: { kind: 'stand-in', standInId: 's-1' },
      standIns: [{ id: 's-1', name: 'Login rework', description: 'Passkeys' }],
    });

    expect(request.other).toEqual({ standIn: 'Login rework', description: 'Passkeys' });
  });
});

describe('withAutoModeDisputeResolutions', () => {
  it('keeps the booked key as auto mode’s answer, which settles the dispute', () => {
    const review = reviewOf(resolved({ answer: KEEP }));
    const [row] = review.rows;

    expect(row?.issueKey).toBe(BOOKED);
    expect(row?.sources?.issue).toBe('auto');
    expect(row?.disputedIssueKey).toBeUndefined();
    expect(review.check.warnings.map((warning) => warning.kind)).not.toContain('naming-disagreement');
  });

  it('takes the other issue on a use answer', () => {
    const [row] = reviewOf(resolved({ answer: USE })).rows;

    expect(row?.issueKey).toBe(OTHER);
    expect(row?.sources?.issue).toBe('auto');
  });

  it('names the row with the stand-in a use answer picked', () => {
    const proposal = disputed({ disputedIssueKey: undefined, disputedStandInId: 's-1' });
    const dispute = disputeOf(USE, rowOf(EMPTY_DAY_REVIEW_EDITS, proposal));
    const edits = withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, dispute);
    const next = withAutoModeDisputeResolutions({
      edits,
      rows: reviewOf(edits, proposal).rows,
      applies: () => true,
    });

    expect(next.overrides[dispute.rowId]).toMatchObject({ standInId: 's-1', sources: { issue: 'auto' } });
  });

  it('leaves the dispute where the answer is unsure or may not be written yet', () => {
    const unsure = resolved({ answer: UNSURE });
    const waiting = resolved({ answer: KEEP, applies: false });

    expect(unsure.overrides).toEqual({});
    expect(waiting.overrides).toEqual({});
    expect(rowOf(unsure).disputedIssueKey).toBe(OTHER);
  });

  it('never writes over a band the user edited', () => {
    const described = setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row: rowOf(), description: 'Mine' });
    const next = resolved({ answer: USE, edits: described });

    expect(next.overrides[`${BOOKED}@09:15`]).toEqual(described.overrides[`${BOOKED}@09:15`]);
  });
});

describe('autoDisputeApplies', () => {
  const applies = (options: { classes?: ActionClasses; approvals?: AgentApproval[]; answer?: DisputeAnswer }) =>
    autoDisputeApplies({
      day: TODAY,
      dispute: disputeOf(options.answer ?? KEEP),
      classes: options.classes ?? {},
      approvals: options.approvals ?? [],
    });

  it('writes at local and never at human-only or for an unsure answer', () => {
    expect(applies({})).toBe(true);
    expect(applies({ classes: NEVER })).toBe(false);
    expect(applies({ answer: UNSURE })).toBe(false);
  });

  it('writes at external only once its queued apply is approved', () => {
    expect(applies({ classes: EXTERNAL })).toBe(false);
    expect(applies({ classes: EXTERNAL, approvals: [approval('queued')] })).toBe(false);
    expect(applies({ classes: EXTERNAL, approvals: [approval('approved')] })).toBe(true);
    expect(applies({ approvals: [approval('rejected')] })).toBe(false);
  });
});

describe('a dispute where Jira had one side done', () => {
  const bookedDone = (answer: DisputeAnswer): AutoModeDispute => ({ ...disputeOf(answer), doneKeys: [BOOKED] });
  const pass = (dispute: AutoModeDispute) => {
    const edits = withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, dispute);

    return {
      edits,
      written: withAutoModeDisputeResolutions({
        edits,
        rows: reviewOf(edits).rows,
        applies: (held) => autoDisputeApplies({ day: TODAY, dispute: held, classes: {}, approvals: [] }),
      }),
    };
  };

  it('changes nothing where the model picked the done side, and reads out why', () => {
    const dispute = bookedDone(KEEP);
    const { edits, written } = pass(dispute);

    expect(written).toBe(edits);
    expect(autoDisputeResolveRequest({ day: TODAY, dispute, label: 'shop', classes: EXTERNAL })).toBeNull();
    expect(
      autoModeReadout({ day: TODAY, edits, approvals: [], classes: {}, standIns: [], rows: reviewOf(edits).rows }),
    ).toEqual([expect.objectContaining({ kind: 'dispute', status: 'done', issueKey: BOOKED })]);
  });

  it('lets the other side win where the model picked it', () => {
    expect(rowOf(pass(bookedDone(USE)).written)?.issueKey).toBe(OTHER);
  });
});

describe('autoDisputeResolveRequest', () => {
  it('queues a keep or use answer only where applying waits for an approval', () => {
    expect(autoDisputeResolveRequest({ day: TODAY, dispute: disputeOf(KEEP), label: 'shop', classes: {} })).toBeNull();
    expect(
      autoDisputeResolveRequest({ day: TODAY, dispute: disputeOf(UNSURE), label: 'shop', classes: EXTERNAL }),
    ).toBeNull();
    expect(
      autoDisputeResolveRequest({ day: TODAY, dispute: disputeOf(USE), label: 'shop', classes: EXTERNAL }),
    ).toMatchObject({ op: 'autoMode.resolve', choice: 'use', booked: BOOKED, other: { issueKey: OTHER } });
  });

  it('survives a round trip through the stored queue', () => {
    const item = approval('queued');

    expect(parseApprovalQueue(JSON.parse(JSON.stringify([item])))[0]?.request).toEqual(item.request);
  });
});

describe('autoModeReadout of a dispute', () => {
  const readout = (edits: DayReviewEdits, approvals: AgentApproval[] = [], classes: ActionClasses = {}) =>
    autoModeReadout({ day: TODAY, edits, approvals, classes, standIns: [], rows: reviewOf(edits).rows }).filter(
      (entry) => entry.kind === 'dispute',
    );

  it('reads out what it chose and why', () => {
    expect(readout(resolved({ answer: KEEP }))).toEqual([
      expect.objectContaining({ status: 'applied', issueKey: BOOKED, label: 'shop', reason: KEEP.reason }),
    ]);
    expect(readout(withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, disputeOf(UNSURE)))).toEqual([
      expect.objectContaining({ status: 'unsure', reason: UNSURE.reason }),
    ]);
    expect(
      readout(withAutoModeDispute(EMPTY_DAY_REVIEW_EDITS, disputeOf(KEEP)), [approval('queued')], EXTERNAL),
    ).toEqual([expect.objectContaining({ status: 'waiting' })]);
  });
});

describe('resolveDisputeWithAgent$', () => {
  const runner = (stdout: string): TimetrackProcessRunner => ({
    run$: () => of<ProcessResult>({ code: 0, stdout, stderr: '' }),
  });
  const ask = (wording: unknown) =>
    firstValueFrom(
      resolveDisputeWithAgent$({
        runner: runner(JSON.stringify({ is_error: false, structured_output: wording })),
        request: disputeOf().request,
      }),
    );

  it('reads a choice and its reason', async () => {
    expect(await ask({ choice: 'keep', reason: ' The merge  names it. ' })).toEqual({
      choice: 'keep',
      reason: 'The merge names it.',
    });
  });

  it('answers null for a choice it does not know', async () => {
    expect(await ask({ choice: 'both', reason: '' })).toBeNull();
  });
});

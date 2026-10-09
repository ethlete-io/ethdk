import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { WorklogProposal } from '../model/proposal';
import { TempoSyncPlan } from '../tempo/diff';
import { withBookedReview, writtenAfterSync } from './frozen-rows';
import { DayReview, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, WrittenWorklog } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const LANE = 'repo:/home/tom/dev/ethlete-sdk';
const at = (time: string) => new Date(`2026-10-06T${time}:00Z`);

const proposal = (options: { issueKey: string; from: string; to: string }): WorklogProposal => {
  const span = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: span,
    observedMs: span,
    laneKey: LANE,
    description: `work on ${options.issueKey}`,
    confidence: 'certain',
    evidence: [],
    state: 'suggested',
  };
};

const dayRows = (proposals: WorklogProposal[]): DayRows => ({
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

const written = (options: {
  proposalId: string;
  worklogId: string;
  from: string;
  minutes: number;
}): WrittenWorklog => ({
  proposalId: options.proposalId,
  worklogId: options.worklogId,
  issueKey: 'ET-772',
  from: at(options.from),
  durationMs: options.minutes * MINUTE,
  description: 'work on ET-772',
});

const MORNING = 'ET-772@2026-10-06T09:00:00.000Z';
const LATE = 'ET-772@2026-10-06T17:00:00.000Z';
const SCRAP = 'ET-772@2026-10-06T20:30:00.000Z';

const frozen = dayRows([
  proposal({ issueKey: 'ET-772', from: '09:00', to: '10:00' }),
  proposal({ issueKey: 'ET-772', from: '17:00', to: '17:30' }),
  proposal({ issueKey: 'ET-772', from: '20:30', to: '20:45' }),
]);

const shape = (review: DayReview) =>
  review.rows.map((row) => ({
    id: row.id,
    span: `${row.from.toISOString().slice(11, 16)}-${row.to.toISOString().slice(11, 16)}`,
    minutes: row.durationMs / MINUTE,
    description: row.description,
    worklogIds: row.worklogIds,
  }));

const book = (options: { edits?: DayReviewEdits; worklogs: WrittenWorklog[] }) =>
  withBookedReview({
    edits: { ...(options.edits ?? EMPTY_DAY_REVIEW_EDITS), frozenRows: frozen },
    written: options.worklogs,
    review: (edits) => reviewDay({ rows: frozen, edits }),
  });

describe('a booked day', () => {
  const worklogs = [
    written({ proposalId: MORNING, worklogId: 'w-1', from: '09:00', minutes: 60 }),
    written({ proposalId: LATE, worklogId: 'w-2', from: '17:00', minutes: 30 }),
  ];

  it('draws a row this app wrote as Tempo holds it, where a rule has since re-cut it', () => {
    const open = reviewDay({ rows: frozen, edits: { ...EMPTY_DAY_REVIEW_EDITS, frozenRows: frozen } });

    expect(shape(open).find((row) => row.id === LATE)?.minutes).toBe(45);

    const review = reviewDay({ rows: frozen, edits: book({ worklogs }) });

    expect(shape(review)).toEqual([
      { id: MORNING, span: '09:00-10:00', minutes: 60, description: 'work on ET-772', worklogIds: ['w-1'] },
      { id: LATE, span: '17:00-17:30', minutes: 30, description: 'work on ET-772', worklogIds: ['w-2'] },
    ]);
    expect(review.check.loggedMs).toBe(90 * MINUTE);
  });

  it('keeps the review it was booked with when the rules draw the day differently', () => {
    const edits = book({ worklogs });
    const booked = reviewDay({ rows: frozen, edits });
    const later = reviewDay({ rows: frozen, edits, round: { incrementMs: 30 * MINUTE } });

    expect(
      reviewDay({ rows: frozen, edits: { ...edits, booked: undefined }, round: { incrementMs: 30 * MINUTE } }),
    ).not.toEqual(booked);
    expect(later).toEqual(booked);
  });

  it('draws an edit made since the booking, and only the fields it changed', () => {
    const edits = book({ worklogs });
    const review = reviewDay({
      rows: frozen,
      edits: { ...edits, overrides: { [LATE]: { description: 'Reviewed the dispute answers' } } },
    });

    expect(shape(review).find((row) => row.id === LATE)).toEqual({
      id: LATE,
      span: '17:00-17:30',
      minutes: 30,
      description: 'Reviewed the dispute answers',
      worklogIds: ['w-2'],
    });
    expect(shape(review).find((row) => row.id === MORNING)?.worklogIds).toEqual(['w-1']);
  });

  it('takes the worklogs a later sync wrote when the day is booked again', () => {
    const first = book({ worklogs: worklogs.slice(0, 1) });
    const again = withBookedReview({
      edits: first,
      written: worklogs,
      review: (edits) => reviewDay({ rows: frozen, edits }),
    });

    expect(shape(reviewDay({ rows: frozen, edits: again })).find((row) => row.id === LATE)).toEqual({
      id: LATE,
      span: '17:00-17:30',
      minutes: 30,
      description: 'work on ET-772',
      worklogIds: ['w-2'],
    });
    expect(again.booked?.edits).toEqual(EMPTY_DAY_REVIEW_EDITS);
  });
});

describe('writtenAfterSync', () => {
  it('lays a sync’s own creates, updates and deletes over what Tempo answered', () => {
    const late = proposal({ issueKey: 'ET-772', from: '17:00', to: '17:30' });
    const scrap = proposal({ issueKey: 'ET-772', from: '20:30', to: '20:45' });
    const plan: TempoSyncPlan = {
      creates: [{ proposal: { ...scrap, state: 'accepted' }, issueId: '1', contentHash: 'a', reason: 'new' }],
      updates: [
        {
          proposal: { ...late, state: 'accepted' },
          issueId: '1',
          tempoWorklogId: 'w-2',
          contentHash: 'b',
          reason: 'content-changed',
        },
      ],
      deletes: [{ proposalId: MORNING, tempoWorklogId: 'w-1', reason: 'proposal-removed' }],
      unchanged: [],
      skipped: [],
      unresolved: [],
      staleLedgerProposalIds: [],
      foreign: [],
      foreignSubtractions: [],
    };

    const after = writtenAfterSync({
      written: [
        written({ proposalId: MORNING, worklogId: 'w-1', from: '09:00', minutes: 60 }),
        written({ proposalId: LATE, worklogId: 'w-2', from: '17:00', minutes: 45 }),
      ],
      plan,
      outcome: {
        rows: [
          { kind: 'create', proposalId: SCRAP, status: 'written', tempoWorklogId: 'w-3' },
          { kind: 'update', proposalId: LATE, status: 'written', tempoWorklogId: 'w-2' },
          { kind: 'delete', proposalId: MORNING, status: 'written', tempoWorklogId: 'w-1' },
        ],
        ledger: [],
        prunedProposalIds: [],
        retry: { ...plan, creates: [], updates: [], deletes: [] },
      },
    });

    expect(after.map((worklog) => [worklog.worklogId, worklog.durationMs / MINUTE])).toEqual([
      ['w-3', 15],
      ['w-2', 30],
    ]);
  });
});

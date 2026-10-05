import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { setRowDescription } from './edits';
import { isDayHeldByTempo, withFrozenRows } from './frozen-rows';
import { EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-10-01T${time}:00Z`);

const proposal = (options: { issueKey: string; from: string; to: string }): WorklogProposal => {
  const observedMs = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: observedMs,
    observedMs,
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

const booked = dayRows([proposal({ issueKey: 'ABC-1', from: '18:15', to: '19:45' })]);
const recut = dayRows([
  proposal({ issueKey: 'ABC-2', from: '18:15', to: '19:15' }),
  proposal({ issueKey: 'ABC-1', from: '19:15', to: '19:45' }),
]);

const describedOn = (rows: DayRows) => {
  const [row] = reviewDay({ rows }).rows;

  if (!row) throw new Error('the day holds no row');

  return setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, description: 'Bracket review' });
};

const spans = (rows: DayRows, edits = EMPTY_DAY_REVIEW_EDITS) =>
  reviewDay({ rows, edits }).rows.map((row) => ({
    issueKey: row.issueKey,
    from: row.from.toISOString().slice(11, 16),
    to: row.to.toISOString().slice(11, 16),
    description: row.description,
  }));

describe('a day Tempo holds', () => {
  it('keeps the rows and the edit it was booked with when the model re-cuts the day', () => {
    const frozen = withFrozenRows({ edits: describedOn(booked), rows: booked, held: true, finished: true });

    expect(frozen).not.toBeNull();
    expect(spans(recut, frozen ?? undefined)).toEqual([
      { issueKey: 'ABC-1', from: '18:15', to: '19:45', description: 'Bracket review' },
    ]);
  });

  it('freezes nothing on a day Tempo does not hold, one still running, or one already frozen', () => {
    const edits = describedOn(booked);

    expect(withFrozenRows({ edits, rows: booked, held: false, finished: true })).toBeNull();
    expect(withFrozenRows({ edits, rows: booked, held: true, finished: false })).toBeNull();
    expect(
      withFrozenRows({ edits: { ...edits, frozenRows: booked }, rows: recut, held: true, finished: true }),
    ).toBeNull();
  });

  it('re-cuts a day with no frozen rows', () => {
    expect(spans(recut).map((row) => row.from)).toEqual(['18:15', '19:15']);
  });

  it('counts a worklog this app wrote and one the coverage read as held', () => {
    expect(isDayHeldByTempo({ ledger: [], coverage: null })).toBe(false);
    expect(isDayHeldByTempo({ ledger: [], coverage: { issues: [] } })).toBe(false);
    expect(isDayHeldByTempo({ ledger: [], coverage: { issues: [{ issueKey: 'ABC-1', coveredMs: MINUTE }] } })).toBe(
      true,
    );
    expect(
      isDayHeldByTempo({
        ledger: [{ proposalId: 'p', day: '2026-10-01', tempoWorklogId: '1', contentHash: 'h', syncedAt: new Date() }],
        coverage: null,
      }),
    ).toBe(true);
  });
});

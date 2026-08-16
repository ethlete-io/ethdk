import { describe, expect, it } from 'vitest';
import { SyncedWorklog, WorklogProposalState } from '../model/proposal';
import { contentHashOf } from '../tempo/diff';
import { DayReview, ReviewedRow } from './model';
import { reviewWeek, shiftWeekKey, startOfWeekKey, weekDayKeys } from './week';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const row = (options: {
  day: string;
  issueKey: string;
  from: string;
  minutes: number;
  state: WorklogProposalState;
}): ReviewedRow => {
  const from = new Date(`${options.day}T${options.from}:00`);
  const durationMs = options.minutes * MINUTE;

  return {
    id: `${options.issueKey}@${from.toISOString()}`,
    issueKey: options.issueKey,
    from,
    to: new Date(from.getTime() + durationMs),
    durationMs,
    observedMs: durationMs,
    description: `work on ${options.issueKey}`,
    confidence: 'certain',
    evidence: [],
    state: options.state,
    edited: false,
  };
};

const review = (options: { rows: ReviewedRow[]; unattributedMs?: number }): DayReview => ({
  rows: options.rows,
  check: {
    proposedMs: options.rows
      .filter((entry) => entry.state === 'accepted' || entry.state === 'edited')
      .reduce((sum, entry) => sum + entry.durationMs, 0),
    unattributedMs: options.unattributedMs ?? 0,
    warnings: [],
  },
  unreconciledMs: 0,
});

const ledgerFor = (entry: ReviewedRow): SyncedWorklog => ({
  proposalId: entry.id,
  tempoWorklogId: '900',
  contentHash: contentHashOf({ proposal: entry }),
  syncedAt: new Date(`${entry.from.toISOString().slice(0, 10)}T18:00:00`),
});

const logged = (day: string, minutes: number) => {
  const entry = row({ day, issueKey: 'FIP-1', from: '09:00', minutes, state: 'accepted' });

  return { day, review: review({ rows: [entry] }), ledger: [ledgerFor(entry)] };
};

const unlogged = (day: string, minutes: number) => ({
  day,
  review: review({ rows: [row({ day, issueKey: 'FIP-1', from: '09:00', minutes, state: 'accepted' })] }),
  ledger: [],
});

const empty = (day: string) => ({ day, review: review({ rows: [] }), ledger: [] });

describe('startOfWeekKey', () => {
  it('leaves a Monday where it is', () => {
    expect(startOfWeekKey('2026-08-10')).toBe('2026-08-10');
  });

  it('walks a Wednesday back to its Monday', () => {
    expect(startOfWeekKey('2026-08-12')).toBe('2026-08-10');
  });

  it('keeps a Sunday in the week that ends on it, not the one that starts after it', () => {
    expect(startOfWeekKey('2026-08-16')).toBe('2026-08-10');
  });

  it('crosses a month end', () => {
    expect(startOfWeekKey('2026-09-02')).toBe('2026-08-31');
  });

  it('starts on a Sunday when asked to', () => {
    expect(startOfWeekKey('2026-08-12', 0)).toBe('2026-08-09');
  });
});

describe('weekDayKeys', () => {
  it('lists the seven days of the week a day falls in, in order', () => {
    expect(weekDayKeys('2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });
});

describe('shiftWeekKey', () => {
  it('moves by whole weeks over a month end', () => {
    expect(shiftWeekKey('2026-08-31', -1)).toBe('2026-08-24');
    expect(shiftWeekKey('2026-08-31', 1)).toBe('2026-09-07');
  });
});

describe('reviewWeek', () => {
  it('reports nothing owing for a week whose every day is in Tempo as written', () => {
    const week = reviewWeek({
      days: [logged('2026-08-10', 480), logged('2026-08-11', 480)],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.owingDays).toBe(0);
    expect(week.days.every((day) => day.gap === null)).toBe(true);
  });

  it('counts every day that still owes something', () => {
    const week = reviewWeek({
      days: [logged('2026-08-10', 480), unlogged('2026-08-11', 480), unlogged('2026-08-12', 240)],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.owingDays).toBe(2);
    expect(week.days.filter((day) => day.gap).map((day) => day.day)).toEqual(['2026-08-11', '2026-08-12']);
    expect(week.days[1]?.gap?.reasons).toEqual(['unsynced']);
  });

  it('orders the days oldest first however they arrive', () => {
    const week = reviewWeek({
      days: [logged('2026-08-12', 60), logged('2026-08-10', 60), logged('2026-08-11', 60)],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.days.map((day) => day.day)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12']);
  });

  it('targets only the days that saw work, so an empty weekend is not a shortfall', () => {
    const week = reviewWeek({
      days: [logged('2026-08-10', 480), logged('2026-08-11', 480), empty('2026-08-15'), empty('2026-08-16')],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.proposedMs).toBe(16 * HOUR);
    expect(week.targetMs).toBe(16 * HOUR);
    expect(week.deltaMs).toBe(0);
  });

  it('counts a day that observed time nothing could attribute as worked', () => {
    const week = reviewWeek({
      days: [{ day: '2026-08-10', review: review({ rows: [], unattributedMs: 3 * HOUR }), ledger: [] }],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.days[0]?.worked).toBe(true);
    expect(week.days[0]?.gap?.reasons).toEqual(['unattributed']);
    expect(week.targetMs).toBe(8 * HOUR);
  });

  it('counts a day whose rows all await a yes or a no as worked, though it proposes nothing yet', () => {
    const suggested = row({ day: '2026-08-10', issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'suggested' });
    const week = reviewWeek({
      days: [{ day: '2026-08-10', review: review({ rows: [suggested] }), ledger: [] }],
      dayTargetMs: 8 * HOUR,
    });

    expect(week.days[0]?.proposedMs).toBe(0);
    expect(week.days[0]?.worked).toBe(true);
    expect(week.days[0]?.gap?.reasons).toEqual(['undecided']);
  });

  it('reports a week with nothing in it as neither over nor short', () => {
    const week = reviewWeek({ days: [empty('2026-08-15'), empty('2026-08-16')], dayTargetMs: 8 * HOUR });

    expect(week.targetMs).toBe(0);
    expect(week.deltaMs).toBe(0);
    expect(week.owingDays).toBe(0);
  });
});

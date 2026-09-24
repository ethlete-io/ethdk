import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { matchCalls } from '../rows/calls';
import { propose } from '../rows/propose';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
import { reviewDay } from './review-day';
import { setRowDescription, setRowRange, splitRow } from './edits';

const at = (hour: number, minute = 0) => new Date(2026, 8, 24, hour, minute);

const call: CallWindow = {
  from: at(11),
  to: at(13),
  appId: 'Discord',
  title: 'Discord',
  attendedMs: 120 * 60_000,
  countsAsWork: true,
  isPresence: true,
};

const occurrence = (overrides: Partial<CalendarOccurrenceEvent>): CalendarOccurrenceEvent => ({
  at: at(11),
  until: at(11, 30),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: 'occ-pentest',
  title: 'Pentest Abstimmung',
  participants: ['dn@example.com'],
  accepted: true,
  ...overrides,
});

const PENTEST = 'Pentest Abstimmung (with dn@example.com)';

const dayOf = (occurrences: CalendarOccurrenceEvent[]): DayRows => {
  const calls = matchCalls({ calls: [call], blocks: [], claimed: [], occurrences });
  const proposed = propose({ groups: calls.map((match) => match.group) });

  return {
    proposals: proposed.proposals,
    unattributed: proposed.unattributed,
    unnamed: proposed.unnamed,
    unobserved: [],
    calls,
    timers: [],
    behind: [],
    filledMs: 0,
    private: [],
    privateMs: 0,
  };
};

const review = (rows: DayRows, edits: DayReviewEdits = EMPTY_DAY_REVIEW_EDITS) => reviewDay({ rows, edits }).rows;

const splitAt = (rows: DayRows, time: Date) => {
  const [row] = review(rows);

  return splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row: row as ReviewedRow, at: time });
};

const descriptions = (rows: readonly ReviewedRow[]) => rows.map((row) => row.description);

describe('reviewDay over a piece of a call', () => {
  it('drops the meeting from a piece split off after it ended', () => {
    const rows = dayOf([occurrence({})]);

    expect(descriptions(review(rows))).toEqual([PENTEST]);
    expect(descriptions(review(rows, splitAt(rows, at(12, 15))))).toEqual([PENTEST, 'Discord']);
  });

  it('keeps the meeting on both pieces of a split inside it', () => {
    const rows = dayOf([occurrence({})]);

    expect(descriptions(review(rows, splitAt(rows, at(11, 15))))).toEqual([PENTEST, PENTEST]);
  });

  it('names a piece after the later meeting that covers it', () => {
    const rows = dayOf([
      occurrence({}),
      occurrence({ occurrenceId: 'occ-daily', title: 'Daily', participants: [], at: at(12, 30), until: at(13) }),
    ]);
    const [, gap] = review(rows);
    const edits = setRowRange({ edits: EMPTY_DAY_REVIEW_EDITS, row: gap as ReviewedRow, from: at(12), to: at(12, 45) });

    expect(descriptions(review(rows))).toEqual([PENTEST, 'Discord', 'Daily']);
    expect(descriptions(review(rows, edits))).toEqual([PENTEST, 'Daily', 'Daily']);
  });

  it('drops the meeting from the stretch a shortened call row hands back', () => {
    const rows = dayOf([occurrence({})]);
    const [row] = review(rows);
    const edits = setRowRange({ edits: EMPTY_DAY_REVIEW_EDITS, row: row as ReviewedRow, from: at(11), to: at(12, 15) });

    expect(descriptions(review(rows, edits))).toEqual([PENTEST, 'Discord']);
  });

  it('keeps a description the reviewer typed on a piece no meeting covers', () => {
    const rows = dayOf([occurrence({})]);
    const split = splitAt(rows, at(12, 15));
    const [, later] = review(rows, split);
    const edits = setRowDescription({ edits: split, row: later as ReviewedRow, description: 'Reward planning' });

    expect(descriptions(review(rows, edits))).toEqual([PENTEST, 'Reward planning']);
  });
});

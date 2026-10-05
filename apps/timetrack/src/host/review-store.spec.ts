import { DayRows, EMPTY_DAY_REVIEW_EDITS } from '@ethlete/timetrack';
import { parseStoredEdits, toStoredEdits } from './review-store';

const frozenRows: DayRows = {
  proposals: [
    {
      id: 'ABC-1@2026-10-01T18:15:00.000Z',
      issueKey: 'ABC-1',
      from: new Date('2026-10-01T18:15:00.000Z'),
      to: new Date('2026-10-01T19:45:00.000Z'),
      durationMs: 90 * 60_000,
      observedMs: 90 * 60_000,
      description: 'work on ABC-1',
      confidence: 'certain',
      evidence: [{ kind: 'commit', at: new Date('2026-10-01T18:30:00.000Z'), detail: 'Fix the bracket' }],
      state: 'suggested',
    },
  ],
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
};

describe('review store', () => {
  it('reads back the frozen rows of a booked day with their dates', () => {
    const stored = JSON.parse(JSON.stringify(toStoredEdits({ ...EMPTY_DAY_REVIEW_EDITS, frozenRows })));

    expect(parseStoredEdits(stored).frozenRows).toEqual(frozenRows);
  });

  it('reads a day without frozen rows as one the engine still cuts', () => {
    const stored = JSON.parse(JSON.stringify(toStoredEdits(EMPTY_DAY_REVIEW_EDITS)));

    expect(parseStoredEdits(stored).frozenRows).toBeUndefined();
  });
});

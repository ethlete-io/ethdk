import { describe, expect, it } from 'vitest';
import { CALL_LANE_KEY } from '../rows/lane';
import { setRowIssue } from './edits';
import { laneIssueUses, laneIssueUsesFor } from './lane-issues';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';

const row = (options: { id: string; laneKey?: string }): ReviewedRow => ({
  id: options.id,
  from: new Date('2026-09-01T08:00:00Z'),
  to: new Date('2026-09-01T09:00:00Z'),
  durationMs: 3_600_000,
  observedMs: 3_600_000,
  laneKey: options.laneKey,
  description: '',
  confidence: 'certain',
  evidence: [],
  state: 'suggested',
  edited: false,
  hidden: false,
});

const named = (options: { id: string; laneKey?: string; issueKey: string }) =>
  setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: row(options), issueKey: options.issueKey });

const day = (key: string, edits: DayReviewEdits) => ({ day: key, edits });

describe('laneIssueUses', () => {
  it('reads back the lane a row was named in', () => {
    const edits = named({ id: 'unnamed:@x', laneKey: CALL_LANE_KEY, issueKey: 'ABC-1' });

    expect(laneIssueUses([day('2026-09-01', edits)])).toEqual([
      { laneKey: CALL_LANE_KEY, issueKey: 'ABC-1', count: 1, lastUsedDay: '2026-09-01' },
    ]);
  });

  it('keeps a naming out of every lane but its own', () => {
    const edits = named({ id: 'unnamed:@x', laneKey: 'repo:/dev/one', issueKey: 'ABC-1' });
    const uses = laneIssueUses([day('2026-09-01', edits)]);

    expect(laneIssueUsesFor({ uses, laneKey: 'repo:/dev/one' })).toHaveLength(1);
    expect(laneIssueUsesFor({ uses, laneKey: 'repo:/dev/two' })).toEqual([]);
  });

  it('counts every day a lane was named with the issue, and keeps the last', () => {
    const uses = laneIssueUses([
      day('2026-09-01', named({ id: 'a', laneKey: CALL_LANE_KEY, issueKey: 'ABC-1' })),
      day('2026-09-03', named({ id: 'b', laneKey: CALL_LANE_KEY, issueKey: 'ABC-1' })),
    ]);

    expect(uses).toEqual([{ laneKey: CALL_LANE_KEY, issueKey: 'ABC-1', count: 2, lastUsedDay: '2026-09-03' }]);
  });

  it('offers the most recently named issue first, whatever order the days are read in', () => {
    const uses = laneIssueUses([
      day('2026-09-05', named({ id: 'b', laneKey: CALL_LANE_KEY, issueKey: 'ABC-2' })),
      day('2026-09-01', named({ id: 'a', laneKey: CALL_LANE_KEY, issueKey: 'ABC-1' })),
      day('2026-09-02', named({ id: 'a', laneKey: CALL_LANE_KEY, issueKey: 'ABC-1' })),
    ]);

    expect(uses.map((use) => use.issueKey)).toEqual(['ABC-2', 'ABC-1']);
  });

  it('folds the lane meetings used to have into the call lane', () => {
    const uses = laneIssueUses([day('2026-09-01', named({ id: 'a', laneKey: 'lane:meeting', issueKey: 'ABC-1' }))]);

    expect(laneIssueUsesFor({ uses, laneKey: CALL_LANE_KEY }).map((use) => use.issueKey)).toEqual(['ABC-1']);
  });

  it('counts a row the reviewer built by hand, which carries its own lane', () => {
    const edits: DayReviewEdits = {
      ...EMPTY_DAY_REVIEW_EDITS,
      pinned: [
        {
          id: 'pinned',
          replaces: [],
          issueKey: 'ABC-7',
          laneKey: CALL_LANE_KEY,
          from: new Date('2026-09-01T08:00:00Z'),
          to: new Date('2026-09-01T09:00:00Z'),
          durationMs: 3_600_000,
          observedMs: 0,
          description: '',
          confidence: 'certain',
          evidence: [],
        },
      ],
    };

    expect(laneIssueUses([day('2026-09-01', edits)]).map((use) => use.issueKey)).toEqual(['ABC-7']);
  });

  it('counts neither a rejected row nor one taken off the timeline', () => {
    const rejected: DayReviewEdits = {
      ...EMPTY_DAY_REVIEW_EDITS,
      overrides: {
        a: { issueKey: 'ABC-1', laneKey: CALL_LANE_KEY, state: 'rejected' },
        b: { issueKey: 'ABC-2', laneKey: CALL_LANE_KEY, hidden: true },
      },
    };

    expect(laneIssueUses([day('2026-09-01', rejected)])).toEqual([]);
  });

  it('offers nothing for a row that has no lane', () => {
    const edits = named({ id: 'unnamed:@x', issueKey: 'ABC-1' });

    expect(laneIssueUses([day('2026-09-01', edits)])).toEqual([]);
    expect(laneIssueUsesFor({ uses: [], laneKey: '' })).toEqual([]);
  });

  it('holds the list to the limit it is asked for', () => {
    const uses = laneIssueUses(
      ['2026-09-01', '2026-09-02', '2026-09-03'].map((key, at) =>
        day(key, named({ id: `row-${at}`, laneKey: CALL_LANE_KEY, issueKey: `ABC-${at}` })),
      ),
    );

    expect(laneIssueUsesFor({ uses, laneKey: CALL_LANE_KEY, limit: 2 }).map((use) => use.issueKey)).toEqual([
      'ABC-2',
      'ABC-1',
    ]);
  });
});

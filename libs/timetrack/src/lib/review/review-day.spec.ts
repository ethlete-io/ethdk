import { describe, expect, it } from 'vitest';
import { DayCorrelation } from '../correlate/correlate-day';
import { WorkGroup } from '../correlate/merge';
import { Confidence, Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { mergeRows, resetRow, setRowDescription, setRowDuration, setRowState, splitRow } from './edits';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const evidence = (options: { time: string; detail: string }): Evidence => ({
  kind: 'commit',
  at: at(options.time),
  detail: options.detail,
});

const proposal = (options: {
  issueKey: string;
  from: string;
  to: string;
  minutes?: number;
  confidence?: Confidence;
  evidence?: Evidence[];
}): WorklogProposal => {
  const observedMs = (options.minutes ?? 60) * MINUTE;

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: observedMs,
    observedMs,
    description: `work on ${options.issueKey}`,
    confidence: options.confidence ?? 'certain',
    evidence: options.evidence ?? [],
    state: 'suggested',
  };
};

const correlation = (options: { proposals: WorklogProposal[]; unattributed?: WorkGroup[] }): DayCorrelation => ({
  blocks: [],
  proposals: options.proposals,
  unattributed: options.unattributed ?? [],
  meetings: [],
  check: { proposedMs: 0, unattributedMs: 0, warnings: [] },
});

const rowFor = (review: { rows: { issueKey: string }[] }, issueKey: string) => {
  const row = review.rows.find((candidate) => candidate.issueKey === issueKey);

  if (!row) throw new Error(`no row for ${issueKey}`);

  return row;
};

describe('reviewDay', () => {
  it('accepts a well-evidenced row on sight and leaves a weak one awaiting review', () => {
    const review = reviewDay({
      correlation: correlation({
        proposals: [
          proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' }),
          proposal({ issueKey: 'FIP-2', from: '09:00', to: '10:00', confidence: 'weak' }),
        ],
      }),
    });

    expect(review.rows.map((row) => row.state)).toEqual(['accepted', 'suggested']);
    expect(review.rows.every((row) => !row.edited)).toBe(true);
  });

  it('counts only what a sync would write towards the proposed total', () => {
    const review = reviewDay({
      correlation: correlation({
        proposals: [
          proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' }),
          proposal({ issueKey: 'FIP-2', from: '09:00', to: '10:00', confidence: 'weak' }),
        ],
      }),
    });

    expect(review.check.proposedMs).toBe(60 * MINUTE);
  });

  it('applies a field override and marks the row edited without losing what was proposed', () => {
    const base = correlation({ proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' })] });
    const edits = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: base }).rows[0]!,
      description: 'pairing on the importer',
    });

    const row = reviewDay({ correlation: base, edits }).rows[0]!;

    expect(row.description).toBe('pairing on the importer');
    expect(row.state).toBe('edited');
    expect(row.edited).toBe(true);
    expect(row.proposed?.description).toBe('work on FIP-1');
  });

  it('keeps a rejected row out of the total even after the reviewer retypes it', () => {
    const base = correlation({ proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' })] });
    const first = reviewDay({ correlation: base }).rows[0]!;
    const edits = setRowState({
      edits: setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row: first, description: 'not billable' }),
      row: first,
      state: 'rejected',
    });

    const review = reviewDay({ correlation: base, edits });

    expect(review.rows[0]!.state).toBe('rejected');
    expect(review.rows[0]!.edited).toBe(true);
    expect(review.check.proposedMs).toBe(0);
  });

  it('accepts a weak row the reviewer checked, so it starts syncing', () => {
    const base = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00', confidence: 'weak' })],
    });
    const edits = setRowState({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: base }).rows[0]!,
      state: 'accepted',
    });

    expect(reviewDay({ correlation: base, edits }).check.proposedMs).toBe(60 * MINUTE);
  });

  it('drops the proposal a split consumed instead of showing it beside the halves', () => {
    const base = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '10:00', minutes: 120 })],
    });
    const edits = splitRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: base }).rows[0]!,
      at: at('09:00'),
    });

    const review = reviewDay({ correlation: base, edits });

    expect(review.rows).toHaveLength(2);
    expect(review.rows.map((row) => row.durationMs / MINUTE)).toEqual([60, 60]);
    expect(review.check.proposedMs).toBe(120 * MINUTE);
    expect(review.unreconciledMs).toBe(0);
  });

  it('reports new evidence that landed under an edited row rather than folding it in', () => {
    const before = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '10:00', minutes: 120 })],
    });
    const edits = splitRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: before }).rows[0]!,
      at: at('09:00'),
    });

    const after = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '11:00', minutes: 180 })],
    });
    const review = reviewDay({ correlation: after, edits });

    expect(review.rows.map((row) => row.durationMs / MINUTE)).toEqual([60, 60]);
    expect(review.unreconciledMs).toBe(60 * MINUTE);
    expect(review.check.warnings.map((warning) => warning.kind)).toContain('edited-row-drift');
  });

  it('leaves drift below the tolerance unreported', () => {
    const before = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '10:00', minutes: 120 })],
    });
    const edits = splitRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: before }).rows[0]!,
      at: at('09:00'),
    });
    const after = correlation({
      proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '10:05', minutes: 125 })],
    });

    const review = reviewDay({ correlation: after, edits });

    expect(review.unreconciledMs).toBe(5 * MINUTE);
    expect(review.check.warnings.map((warning) => warning.kind)).not.toContain('edited-row-drift');
  });

  it('orders edited rows into the day by their clock time', () => {
    const base = correlation({
      proposals: [
        proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' }),
        proposal({ issueKey: 'FIP-2', from: '11:00', to: '12:00' }),
      ],
    });
    const edits = splitRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowFor(reviewDay({ correlation: base }), 'FIP-1'),
      at: at('08:30'),
    });

    expect(reviewDay({ correlation: base, edits }).rows.map((row) => row.from.getUTCHours())).toEqual([8, 8, 11]);
  });

  it('still reports the day against its target after edits', () => {
    const base = correlation({ proposals: [proposal({ issueKey: 'FIP-1', from: '08:00', to: '09:00' })] });
    const edits = setRowDuration({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ correlation: base }).rows[0]!,
      durationMs: 30 * MINUTE,
    });

    const review = reviewDay({ correlation: base, edits, check: { targetMs: 120 * MINUTE } });

    expect(review.check.deltaMs).toBe(-90 * MINUTE);
    expect(review.check.warnings.map((warning) => warning.kind)).toContain('under-target');
  });
});

describe('splitRow', () => {
  const base = correlation({
    proposals: [
      proposal({
        issueKey: 'FIP-1',
        from: '08:00',
        to: '10:00',
        minutes: 120,
        evidence: [
          evidence({ time: '08:10', detail: 'early commit' }),
          evidence({ time: '09:40', detail: 'late commit' }),
        ],
      }),
    ],
  });
  const row = reviewDay({ correlation: base }).rows[0]!;

  it('gives each half the evidence observed inside it', () => {
    const edits = splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('09:00') });
    const rows = reviewDay({ correlation: base, edits }).rows;

    expect(rows.map((entry) => entry.evidence.map((item) => item.detail))).toEqual([['early commit'], ['late commit']]);
  });

  it('preserves the pair total on an uneven cut and lands both sides on whole increments', () => {
    const edits = splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('08:20') });
    const rows = reviewDay({ correlation: base, edits }).rows;

    expect(rows.map((entry) => entry.durationMs / MINUTE)).toEqual([15, 105]);
    expect(rows.reduce((sum, entry) => sum + entry.durationMs, 0)).toBe(120 * MINUTE);
  });

  it('keeps a rejected row rejected on both sides of the cut', () => {
    const rejected = setRowState({ edits: EMPTY_DAY_REVIEW_EDITS, row, state: 'rejected' });
    const edits = splitRow({
      edits: rejected,
      row: reviewDay({ correlation: base, edits: rejected }).rows[0]!,
      at: at('09:00'),
    });

    const review = reviewDay({ correlation: base, edits });

    expect(review.rows.map((entry) => entry.state)).toEqual(['rejected', 'rejected']);
    expect(review.check.proposedMs).toBe(0);
  });

  it('refuses a cut outside the row', () => {
    expect(splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('11:00') })).toBe(EMPTY_DAY_REVIEW_EDITS);
    expect(splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('08:00') })).toBe(EMPTY_DAY_REVIEW_EDITS);
  });

  it('splits a row that was already split, and both parts still replace the original proposal', () => {
    const once = splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('09:00') });
    const twice = splitRow({
      edits: once,
      row: reviewDay({ correlation: base, edits: once }).rows[0]!,
      at: at('08:30'),
    });

    const review = reviewDay({ correlation: base, edits: twice });

    expect(review.rows).toHaveLength(3);
    expect(review.rows.map((entry) => entry.durationMs / MINUTE)).toEqual([30, 30, 60]);
    expect(twice.pinned.every((pinned) => pinned.replaces.includes('FIP-1@2026-08-11T08:00:00.000Z'))).toBe(true);
  });

  it('undoes the whole split when either half is reset', () => {
    const once = splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row, at: at('09:00') });
    const reset = resetRow({ edits: once, row: reviewDay({ correlation: base, edits: once }).rows[1]! });

    const review = reviewDay({ correlation: base, edits: reset });

    expect(review.rows).toHaveLength(1);
    expect(review.rows[0]!.edited).toBe(false);
    expect(review.rows[0]!.durationMs).toBe(120 * MINUTE);
    expect(review.unreconciledMs).toBe(0);
  });
});

describe('mergeRows', () => {
  const base = correlation({
    proposals: [
      proposal({
        issueKey: 'FIP-1',
        from: '08:00',
        to: '09:00',
        evidence: [evidence({ time: '08:30', detail: 'a commit' })],
      }),
      proposal({
        issueKey: 'FIP-2',
        from: '10:00',
        to: '11:00',
        confidence: 'weak',
        evidence: [evidence({ time: '10:30', detail: 'a window title' })],
      }),
    ],
  });

  const merge = (edits?: DayReviewEdits) => {
    const review = reviewDay({ correlation: base, edits });

    return mergeRows({ edits: edits ?? EMPTY_DAY_REVIEW_EDITS, rows: review.rows });
  };

  it("replaces both rows with one spanning them, on the first row's issue", () => {
    const review = reviewDay({ correlation: base, edits: merge() });

    expect(review.rows).toHaveLength(1);
    expect(review.rows[0]!.issueKey).toBe('FIP-1');
    expect(review.rows[0]!.description).toBe('work on FIP-1');
    expect(review.rows[0]!.from).toEqual(at('08:00'));
    expect(review.rows[0]!.to).toEqual(at('11:00'));
  });

  it('adds the durations up and keeps the whole evidence chain in order', () => {
    const row = reviewDay({ correlation: base, edits: merge() }).rows[0]!;

    expect(row.durationMs).toBe(120 * MINUTE);
    expect(row.observedMs).toBe(120 * MINUTE);
    expect(row.evidence.map((entry) => entry.detail)).toEqual(['a commit', 'a window title']);
  });

  it('takes the confidence of the tier holding most of the merged time', () => {
    expect(reviewDay({ correlation: base, edits: merge() }).rows[0]!.confidence).toBe('weak');
  });

  it('drops the overrides of the rows it consumed', () => {
    const withOverride = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowFor(reviewDay({ correlation: base }), 'FIP-2'),
      description: 'gone',
    });

    expect(merge(withOverride).overrides).toEqual({});
  });

  it('keeps time a merge absorbed, even when one side had been rejected', () => {
    const rejected = setRowState({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowFor(reviewDay({ correlation: base }), 'FIP-2'),
      state: 'rejected',
    });
    const review = reviewDay({ correlation: base, edits: merge(rejected) });

    expect(review.rows[0]!.state).toBe('edited');
    expect(review.check.proposedMs).toBe(120 * MINUTE);
  });

  it('stays rejected when every row it merged was rejected', () => {
    const first = reviewDay({ correlation: base });
    const rejected = setRowState({
      edits: setRowState({ edits: EMPTY_DAY_REVIEW_EDITS, row: first.rows[0]!, state: 'rejected' }),
      row: first.rows[1]!,
      state: 'rejected',
    });

    expect(reviewDay({ correlation: base, edits: merge(rejected) }).rows[0]!.state).toBe('rejected');
  });

  it('leaves a single row alone', () => {
    const single = reviewDay({ correlation: base }).rows.slice(0, 1);

    expect(mergeRows({ edits: EMPTY_DAY_REVIEW_EDITS, rows: single })).toBe(EMPTY_DAY_REVIEW_EDITS);
  });
});

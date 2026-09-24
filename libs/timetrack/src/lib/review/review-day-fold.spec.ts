import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { UnnamedProposal } from '../rows/propose';
import { Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { hideRow, setRowDescription, splitRow } from './edits';
import { DayReview, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const LANE = 'repo:/home/tom/dev/fifagg/fifagg-frontend';
const STAND_IN = 'stand-in:1:competition-navigation';
const at = (time: string) => new Date(`2026-09-23T${time}:00Z`);

const evidence = (time: string): Evidence => ({ kind: 'commit', at: at(time), detail: `commit at ${time}` });

const band = (options: {
  from: string;
  to: string;
  observed?: number;
  standInId?: string;
  laneKey?: string;
  excluded?: boolean;
}): UnnamedProposal => {
  const span = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `unnamed:${options.laneKey ?? LANE}@${at(options.from).toISOString()}`,
    standInId: options.standInId ?? STAND_IN,
    from: at(options.from),
    to: at(options.to),
    durationMs: span,
    observedMs: (options.observed ?? span / MINUTE) * MINUTE,
    stretches: [{ from: at(options.from), to: at(options.to) }],
    laneKey: options.laneKey ?? LANE,
    description: `work from ${options.from}`,
    confidence: 'certain',
    evidence: [evidence(options.from)],
    state: 'suggested',
    ...(options.excluded ? { excluded: true } : {}),
  };
};

const proposal = (options: { issueKey: string; from: string; to: string; laneKey?: string }): WorklogProposal => {
  const span = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: span,
    observedMs: span,
    laneKey: options.laneKey ?? LANE,
    description: `work on ${options.issueKey}`,
    confidence: 'certain',
    evidence: [],
    state: 'suggested',
  };
};

const dayRows = (options: { proposals?: WorklogProposal[]; unnamed?: UnnamedProposal[] }): DayRows => ({
  proposals: options.proposals ?? [],
  unattributed: [],
  unnamed: options.unnamed ?? [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const hhmm = (date: Date) => date.toISOString().slice(11, 16);
const spans = (review: DayReview) =>
  review.rows.map((row) => `${hhmm(row.from)}-${hhmm(row.to)} ${row.durationMs / MINUTE}m`);

const review = (rows: DayRows, edits?: DayReviewEdits) => reviewDay({ rows, edits });

describe('reviewDay folding single-increment rows', () => {
  const day = dayRows({
    unnamed: [
      band({ from: '12:15', to: '13:45' }),
      band({ from: '14:45', to: '15:00' }),
      band({ from: '15:45', to: '16:00' }),
    ],
  });

  it('folds each short row into the nearest row of the same name, keeping the total', () => {
    const result = review(day);

    expect(spans(result)).toEqual(['12:15-14:15 120m']);
    expect(result.rows[0]?.id).toBe(`unnamed:${LANE}@${at('12:15').toISOString()}`);
    expect(result.rows[0]?.observedMs).toBe(120 * MINUTE);
    expect(result.rows[0]?.description).toBe('work from 12:15');
    expect(result.rows[0]?.evidence.map((entry) => entry.detail)).toEqual([
      'commit at 12:15',
      'commit at 14:45',
      'commit at 15:45',
    ]);
  });

  it('grows the start of a neighbour that comes after the short row', () => {
    const result = review(
      dayRows({
        proposals: [
          proposal({ issueKey: 'ET-1', from: '09:00', to: '09:15' }),
          proposal({ issueKey: 'ET-1', from: '11:00', to: '12:00' }),
        ],
      }),
    );

    expect(spans(result)).toEqual(['10:45-12:00 75m']);
    expect(result.rows[0]?.id).toBe(`ET-1@${at('11:00').toISOString()}`);
  });

  it('keeps a short row that no row of its name shares a lane with', () => {
    const result = review(
      dayRows({
        unnamed: [
          band({ from: '12:15', to: '13:45' }),
          band({ from: '14:45', to: '15:00', standInId: 'stand-in:2:other' }),
          band({ from: '15:45', to: '16:00', laneKey: 'repo:/elsewhere' }),
        ],
      }),
    );

    expect(spans(result)).toEqual(['12:15-13:45 90m', '14:45-15:00 15m', '15:45-16:00 15m']);
  });

  it('keeps a short row when the growth would cover other work in the lane', () => {
    const result = review(
      dayRows({
        proposals: [proposal({ issueKey: 'ET-2', from: '13:45', to: '14:30' })],
        unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00' })],
      }),
    );

    expect(spans(result)).toEqual(['12:15-13:45 90m', '13:45-14:30 45m', '14:45-15:00 15m']);
  });

  it('folds two short rows into each other when no longer row of their name exists', () => {
    const result = review(
      dayRows({ unnamed: [band({ from: '17:15', to: '17:30' }), band({ from: '17:30', to: '17:45' })] }),
    );

    expect(spans(result)).toEqual(['17:15-17:45 30m']);
  });

  it('never folds a short row the reviewer edited', () => {
    const unfolded = dayRows({ unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00' })] });
    const edited = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: { ...unfolded.unnamed[1]!, edited: false, hidden: false },
      description: 'mine',
    });

    expect(spans(review(unfolded, edited))).toEqual(['12:15-13:45 90m', '14:45-15:00 15m']);
  });

  it('keeps folding into a neighbour the reviewer edited in place', () => {
    const [grown] = review(day).rows;
    const edits = setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row: grown!, description: 'mine' });
    const result = review(day, edits);

    expect(spans(result)).toEqual(['12:15-14:15 120m']);
    expect(result.rows[0]?.description).toBe('mine');
  });

  it('hides the folded time with the row it went into', () => {
    const [grown] = review(day).rows;
    const result = review(day, hideRow({ edits: EMPTY_DAY_REVIEW_EDITS, row: grown! }));

    expect(result.rows).toEqual([]);
    expect(result.hidden.map((row) => `${hhmm(row.from)}-${hhmm(row.to)}`)).toEqual(['12:15-14:15']);
  });

  it('does not bring the folded rows back once the grown row is split', () => {
    const [grown] = review(day).rows;
    const result = review(day, splitRow({ edits: EMPTY_DAY_REVIEW_EDITS, row: grown!, at: at('13:00') }));

    expect(spans(result)).toEqual(['12:15-13:00 45m', '13:00-14:15 75m']);
  });

  it('leaves excluded rows out of the fold', () => {
    const result = review(
      dayRows({
        unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00', excluded: true })],
      }),
    );

    expect(spans(result)).toEqual(['12:15-13:45 90m', '14:45-15:00 15m']);
  });
});

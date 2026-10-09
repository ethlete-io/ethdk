import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import { WorkGroup } from '../rows/merge';
import { UnnamedProposal, propose } from '../rows/propose';
import { Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { hideRow, resetRow, setRowDescription, setRowIssue, splitRow } from './edits';
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
  unattended?: boolean;
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
    ...(options.unattended ? { unattended: true } : {}),
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

  it('grows the far side of the neighbour when the near side would cover other work in the lane', () => {
    const result = review(
      dayRows({
        proposals: [proposal({ issueKey: 'ET-2', from: '13:45', to: '14:30' })],
        unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00' })],
      }),
    );

    expect(spans(result)).toEqual(['12:00-13:45 105m', '13:45-14:30 45m']);
    expect(result.rows[0]?.id).toBe(`unnamed:${LANE}@${at('12:15').toISOString()}`);
  });

  it('grows the far side when the near side would cover a background row in another lane', () => {
    const rows = (unnamed: UnnamedProposal[]) =>
      dayRows({
        proposals: [
          proposal({ issueKey: 'ET-772', from: '13:45', to: '14:30', laneKey: 'repo:/home/tom/dev/ethlete-sdk' }),
        ],
        unnamed,
      });
    const reviewed = (unnamed: UnnamedProposal[]) =>
      reviewDay({ rows: rows(unnamed), cut: { backgroundProjects: ['ET'] } });
    const long = band({ from: '12:15', to: '13:45' });
    const before = reviewed([long, band({ from: '11:45', to: '12:15' })]);
    const result = reviewed([long, band({ from: '14:45', to: '15:00' }), band({ from: '15:45', to: '16:00' })]);

    expect(spans(result)).toEqual(['11:45-13:45 120m', '13:45-14:30 45m']);
    expect(result.rows[0]?.id).toBe(`unnamed:${LANE}@${at('12:15').toISOString()}`);
    expect(result.check.proposedMs).toBe(before.check.proposedMs);
  });

  it('joins two short calls from the earlier start forward, over rows in other lanes', () => {
    const call = (from: string, to: string, observed: number) => ({
      ...proposal({ issueKey: 'ABC-1', from, to, laneKey: CALL_LANE_KEY }),
      observedMs: observed * MINUTE,
    });
    const result = reviewDay({
      rows: dayRows({
        proposals: [
          call('09:15', '09:30', 15),
          call('09:30', '09:45', 6),
          proposal({ issueKey: 'XYZ-1', from: '09:15', to: '09:45' }),
          proposal({ issueKey: 'ET-772', from: '09:00', to: '09:45', laneKey: 'repo:/home/tom/dev/ethlete-sdk' }),
        ],
      }),
      cut: { backgroundProjects: ['ET'] },
    });
    const calls = result.rows.filter((row) => row.issueKey === 'ABC-1');

    expect(calls.map((row) => `${hhmm(row.from)}-${hhmm(row.to)} ${row.durationMs / MINUTE}m`)).toEqual([
      '09:15-09:45 30m',
    ]);
    expect(calls[0]?.observedMs).toBe(21 * MINUTE);
  });

  it('keeps a short row when both sides of the neighbour would cover other work in the lane', () => {
    const result = review(
      dayRows({
        proposals: [
          proposal({ issueKey: 'ET-2', from: '13:45', to: '14:30' }),
          proposal({ issueKey: 'ET-3', from: '11:30', to: '12:15' }),
        ],
        unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00' })],
      }),
    );

    expect(spans(result)).toEqual(['11:30-12:15 45m', '12:15-13:45 90m', '13:45-14:30 45m', '14:45-15:00 15m']);
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

  it('still folds a short row whose only change is a description auto mode wrote', () => {
    const unfolded = dayRows({ unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00' })] });
    const described = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: { ...unfolded.unnamed[1]!, edited: false, hidden: false },
      description: 'auto line',
      source: 'auto',
    });

    expect(spans(review(unfolded, described))).toEqual(['12:15-14:00 105m']);
  });

  it('reads a row whose only change is an auto description as not edited', () => {
    const [grown] = review(day).rows;
    const edits = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: grown!,
      description: 'auto line',
      source: 'auto',
    });
    const [row] = review(day, edits).rows;

    expect(row?.description).toBe('auto line');
    expect(row?.edited).toBe(false);
    expect(row?.state).toBe('suggested');
    expect(row?.sources?.description).toBe('auto');
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

  const bookedMs = (result: DayReview) => result.rows.reduce((sum, row) => sum + row.durationMs, 0);

  it('folds an unattended short row into the row of its name it touches', () => {
    const rows = [band({ from: '15:45', to: '17:30' }), band({ from: '17:30', to: '17:45', unattended: true })];
    const result = review(dayRows({ unnamed: rows }));

    expect(spans(result)).toEqual(['15:45-17:45 120m']);
    expect(result.rows[0]?.unattended).toBeUndefined();
    expect(result.rows[0]?.folded).toEqual([rows[1]?.id]);
    expect(bookedMs(result)).toBe(120 * MINUTE);
  });

  it('joins unattended short rows of one name that touch', () => {
    const result = review(
      dayRows({
        unnamed: [
          band({ from: '17:15', to: '17:30', unattended: true }),
          band({ from: '17:30', to: '17:45', unattended: true }),
        ],
      }),
    );

    expect(spans(result)).toEqual(['17:15-17:45 30m']);
    expect(result.rows[0]?.unattended).toBe(true);
  });

  it('keeps an unattended short row that no row of its name touches', () => {
    const result = review(
      dayRows({
        unnamed: [band({ from: '12:15', to: '13:45' }), band({ from: '14:45', to: '15:00', unattended: true })],
      }),
    );

    expect(spans(result)).toEqual(['12:15-13:45 90m', '14:45-15:00 15m']);
  });

  it('never folds an attended short row into an unattended one', () => {
    const result = review(
      dayRows({
        unnamed: [band({ from: '12:15', to: '13:45', unattended: true }), band({ from: '13:45', to: '14:00' })],
      }),
    );

    expect(spans(result)).toEqual(['12:15-13:45 90m', '13:45-14:00 15m']);
  });
});

describe('reviewDay folding the attended rest of a row nobody attended', () => {
  const SECOND = 1_000;
  const atSecond = (time: string, second: number) => new Date(at(time).getTime() + second * SECOND);
  const work = (options: { from: Date; to: Date; attended?: boolean }): WorkGroup => ({
    issueKey: 'ABC-100',
    from: options.from,
    to: options.to,
    observedMs: options.to.getTime() - options.from.getTime(),
    confidence: 'certain',
    evidence: [],
    ...(options.attended === false ? { attended: false } : {}),
    blocks: [
      {
        from: options.from,
        to: options.to,
        context: { repoPath: '/work/app-a', branch: 'feat/ABC-100-thing' },
        evidence: [],
      },
    ],
  });
  const { proposals, unnamed } = propose({
    groups: [
      work({ from: atSecond('16:34', 28), to: atSecond('16:49', 56), attended: false }),
      work({ from: at('19:15'), to: at('19:45') }),
    ],
    breaks: [{ from: atSecond('16:31', 48), to: atSecond('16:51', 42) }],
  });

  it('keeps the rest where the break ended, rather than on a row of its name hours away', () => {
    const result = review(dayRows({ proposals, unnamed }));

    expect(spans(result)).toEqual(['16:30-16:45 15m', '16:45-17:00 15m', '19:15-19:45 30m']);
    expect(result.rows[0]?.unattended).toBe(true);
  });
});

describe('reviewDay folding crowded sessions of one ticket', () => {
  const session = (options: { from: string; to: string; observed: number }): WorklogProposal => ({
    ...proposal({ issueKey: 'ET-772', ...options }),
    id: `ET-772@${options.from}`,
    durationMs: options.observed * MINUTE,
    observedMs: options.observed * MINUTE,
  });
  const day = dayRows({
    proposals: [
      session({ from: '09:00', to: '11:00', observed: 60 }),
      session({ from: '09:15', to: '10:30', observed: 30 }),
      session({ from: '09:30', to: '10:15', observed: 15 }),
      session({ from: '09:45', to: '11:15', observed: 30 }),
    ],
  });
  const bookedMs = (result: DayReview) => result.rows.reduce((sum, row) => sum + row.durationMs, 0);

  it('draws at most three parallel sessions and books what the four observed', () => {
    const result = review(day);

    expect(spans(result)).toEqual(['09:00-11:00 75m', '09:15-10:30 30m', '09:45-11:15 30m']);
    expect(bookedMs(result)).toBe(135 * MINUTE);
  });

  it('never folds a session the reviewer edited', () => {
    const edits = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: { ...day.proposals[2]!, edited: false, hidden: false },
      description: 'mine',
    });
    const result = review(day, edits);

    expect(spans(result)).toEqual(['09:00-11:00 90m', '09:30-10:15 15m', '09:45-11:15 30m']);
    expect(bookedMs(result)).toBe(135 * MINUTE);
  });
});

describe('reviewDay, an edit on a call band that gains a name later', () => {
  const callBand = (options: { from: string; to: string; excluded?: boolean }): UnnamedProposal => {
    const row = band({ ...options, laneKey: CALL_LANE_KEY });

    return { ...row, id: `unnamed:@${at(options.from).toISOString()}`, standInId: undefined };
  };
  const morning = proposal({ issueKey: 'FIP-2866', from: '08:00', to: '08:45', laneKey: CALL_LANE_KEY });
  const before = callBand({ from: '12:00', to: '13:30', excluded: true });
  const after = callBand({ from: '13:45', to: '14:15', excluded: true });
  const meeting = callBand({ from: '13:30', to: '13:45' });
  const unnamedDay = dayRows({ proposals: [morning], unnamed: [before, meeting, after] });
  const namedDay = dayRows({
    proposals: [
      morning,
      {
        ...proposal({ issueKey: 'FIP-2866', from: '13:30', to: '13:45', laneKey: CALL_LANE_KEY }),
        unnamedId: meeting.id,
      },
    ],
    unnamed: [before, after],
  });
  const edits = setRowIssue({
    edits: EMPTY_DAY_REVIEW_EDITS,
    row: { ...meeting, edited: false, hidden: false },
    issueKey: 'FIFAGG-12652',
  });
  const drawn = (result: DayReview) =>
    result.rows.map((row) => `${hhmm(row.from)}-${hhmm(row.to)} ${row.issueKey ?? '-'}`);

  it('keeps the issue the reviewer gave the band over the name the day learned for it', () => {
    const result = review(namedDay, edits);

    expect(drawn(result)).toEqual([
      '08:00-08:45 FIP-2866',
      '12:00-13:30 -',
      '13:30-13:45 FIFAGG-12652',
      '13:45-14:15 -',
    ]);
    expect(result.rows.find((row) => row.issueKey === 'FIFAGG-12652')).toMatchObject({
      id: meeting.id,
      sources: { issue: 'human' },
    });
  });

  it('still reads the band as the reviewer named it while nothing else names it', () => {
    expect(drawn(review(unnamedDay, edits))).toEqual(drawn(review(namedDay, edits)));
  });

  it('gives the band its learned name back once the reviewer resets it', () => {
    const edited = review(namedDay, edits).rows.find((row) => row.issueKey === 'FIFAGG-12652');

    expect(edited).toBeDefined();
    expect(drawn(review(namedDay, resetRow({ edits, row: edited! })))).toEqual(drawn(review(namedDay)));
  });
});

describe('reviewDay, a band the reviewer named whose rule answers differently later', () => {
  const lane = 'repo:/work/app-a';
  const ruled = proposal({ issueKey: 'ABC-1', from: '12:15', to: '13:00', laneKey: lane });
  const edits = setRowIssue({
    edits: EMPTY_DAY_REVIEW_EDITS,
    row: { ...ruled, edited: false, hidden: false },
    issueKey: 'ABC-9',
  });
  const named = (result: DayReview) =>
    result.rows.map((row) => `${hhmm(row.from)} ${row.issueKey ?? '-'} ${row.state}`);

  it('keeps the issue the reviewer gave once a stand-in names the band instead', () => {
    const renamed = { ...band({ from: '12:15', to: '13:00', laneKey: lane }), disputedIssueKey: 'ABC-1' };
    const result = review(dayRows({ unnamed: [renamed] }), edits);

    expect(named(result)).toEqual(['12:15 ABC-9 edited']);
    expect(result.rows[0]).toMatchObject({ id: ruled.id, sources: { issue: 'human' } });
  });

  it('counts the band as named once nothing names it any more', () => {
    const unruled = band({ from: '12:15', to: '13:00', laneKey: lane, standInId: '' });
    const group: WorkGroup = {
      rowId: unruled.id,
      from: unruled.from,
      to: unruled.to,
      observedMs: unruled.observedMs,
      confidence: 'certain',
      evidence: [],
      blocks: [],
      laneKey: lane,
    };
    const result = review({ ...dayRows({ unnamed: [unruled] }), unattributed: [group] }, edits);

    expect(named(result)).toEqual(['12:15 ABC-9 edited']);
    expect(result.check.unattributedMs).toBe(0);
  });

  it('keeps the issue the reviewer gave once another issue names the band instead', () => {
    const renamed = proposal({ issueKey: 'ABC-2', from: '12:15', to: '13:00', laneKey: lane });

    expect(named(review(dayRows({ proposals: [renamed] }), edits))).toEqual(['12:15 ABC-9 edited']);
  });

  it('leaves a band of another lane or another start to its own answer', () => {
    const elsewhere = proposal({ issueKey: 'ABC-2', from: '12:15', to: '13:00', laneKey: 'repo:/work/app-b' });
    const later = proposal({ issueKey: 'ABC-2', from: '12:30', to: '13:00', laneKey: lane });

    expect(named(review(dayRows({ proposals: [elsewhere, later] }), edits))).toEqual([
      '12:15 ABC-2 accepted',
      '12:30 ABC-2 accepted',
    ]);
  });

  it('carries no edit the reviewer left without naming the band', () => {
    const described = setRowDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: { ...ruled, edited: false, hidden: false },
      description: 'mine',
    });
    const renamed = proposal({ issueKey: 'ABC-2', from: '12:15', to: '13:00', laneKey: lane });

    expect(review(dayRows({ proposals: [renamed] }), described).rows[0]).toMatchObject({
      issueKey: 'ABC-2',
      edited: false,
    });
  });
});

describe('reviewDay folding across a repository one agent session moved to', () => {
  const APP = 'repo:/home/dev/app-a';
  const SPECS = 'repo:/home/dev/app-a-specs';
  const rows = (handedOver?: DayRows['handedOver']): DayRows => ({
    ...dayRows({
      unnamed: [
        band({ from: '10:00', to: '11:00', laneKey: APP }),
        band({ from: '11:00', to: '11:15', laneKey: SPECS, standInId: 'stand-in:2:specs' }),
        band({ from: '11:15', to: '11:30', laneKey: APP }),
      ],
    }),
    ...(handedOver ? { handedOver } : {}),
  });

  it('never grows a row over the minutes its session handed to the other repository', () => {
    const result = review(rows({ [APP]: [{ from: at('11:02'), to: at('11:12') }] }));

    expect(spans(result)).toEqual(['09:45-11:00 75m', '11:00-11:15 15m']);
  });

  it('still grows over a row of another repository nothing handed over', () => {
    expect(spans(review(rows()))).toEqual(['10:00-11:15 75m', '11:00-11:15 15m']);
  });
});

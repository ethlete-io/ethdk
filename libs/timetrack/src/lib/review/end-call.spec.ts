import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { matchCalls } from '../rows/calls';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { endRowAt, isLiveCallRow } from './end-call';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const meeting = (to: string): WorklogProposal => ({
  id: `FIP-3095@${at('14:00').toISOString()}`,
  issueKey: 'FIP-3095',
  from: at('14:00'),
  to: at(to),
  durationMs: at(to).getTime() - at('14:00').getTime(),
  observedMs: at(to).getTime() - at('14:00').getTime(),
  laneKey: 'lane:call',
  description: 'Meeting #1 | Braune Digital - Discord',
  confidence: 'likely',
  evidence: [],
  state: 'suggested',
});

const callUntil = (to: string) =>
  matchCalls({
    calls: [
      {
        appId: 'com.hnc.Discord.helper.Renderer',
        from: at('14:00'),
        to: at(to),
        title: 'Meeting #1 | Braune Digital - Discord',
        attendedMs: 0,
        countsAsWork: true,
        isPresence: true,
      },
    ],
    blocks: [],
    claimed: [],
  });

const day = (to: string): DayRows => ({
  proposals: [meeting(to)],
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: callUntil(to),
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const spans = (edits: DayReviewEdits, through: string) =>
  reviewDay({ rows: day(through), edits }).rows.map((row) => ({
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    issueKey: row.issueKey,
  }));

const endedAt = (now: string) =>
  endRowAt({
    edits: EMPTY_DAY_REVIEW_EDITS,
    row: reviewDay({ rows: day(now) }).rows[0]!,
    at: at(now),
  });

describe('endRowAt, on a call row that still grows', () => {
  it('ends the row on the increment nearest now', () => {
    expect(spans(endedAt('16:07'), '16:07')[0]).toEqual({
      from: at('14:00').toISOString(),
      to: at('16:00').toISOString(),
      issueKey: 'FIP-3095',
    });
  });

  it('keeps the end while the call runs on, and draws the rest as a band with no name', () => {
    expect(spans(endedAt('16:07'), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('16:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('16:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });

  it('ends the row on the increment above now when that one is nearer, where the row is drawn to already', () => {
    expect(spans(endedAt('16:10'), '17:00').map((row) => row.to)).toEqual([
      at('16:15').toISOString(),
      at('17:00').toISOString(),
    ]);
  });

  it('leaves the edits alone for an end at or before the start', () => {
    const edits = endRowAt({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ rows: day('16:00') }).rows[0]!,
      at: at('14:05'),
    });

    expect(edits).toBe(EMPTY_DAY_REVIEW_EDITS);
  });
});

describe('isLiveCallRow', () => {
  const HELPER = 'com.hnc.Discord.helper.Renderer';
  const started: CollectedEvent[] = [{ at: at('14:00'), source: 'call', kind: 'call-start', appId: HELPER }];

  const live = (options: { edits: DayReviewEdits; through: string; events?: CollectedEvent[] }) =>
    reviewDay({ rows: day(options.through), edits: options.edits }).rows.map((row) =>
      isLiveCallRow({
        row,
        calls: day(options.through).calls,
        events: options.events ?? started,
        edits: options.edits,
      }),
    );

  it('holds for a call row the open call still grows', () => {
    expect(live({ edits: EMPTY_DAY_REVIEW_EDITS, through: '16:07' })).toEqual([true]);
  });

  it('no longer holds for the row once it was ended, and holds for the rest of the call', () => {
    expect(live({ edits: endedAt('16:07'), through: '17:00' })).toEqual([false, true]);
  });

  it('does not hold once a call-end closed the call', () => {
    const events: CollectedEvent[] = [...started, { at: at('16:00'), source: 'call', kind: 'call-end', appId: HELPER }];

    expect(live({ edits: EMPTY_DAY_REVIEW_EDITS, through: '16:00', events })).toEqual([false]);
  });
});

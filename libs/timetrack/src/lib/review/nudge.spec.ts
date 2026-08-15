import { describe, expect, it } from 'vitest';
import { SyncedWorklog, WorklogProposalState } from '../model/proposal';
import { contentHashOf } from '../tempo/diff';
import { DayReview, ReviewedRow } from './model';
import {
  DEFAULT_NUDGE_REPEAT_MS,
  DayNudgeRecord,
  dayNudge,
  dayReviewGap,
  hasNudgeRepeatElapsed,
  isNudgeDue,
} from './nudge';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-08-11T${time}:00`);

const row = (options: {
  issueKey: string;
  from: string;
  minutes: number;
  state: WorklogProposalState;
}): ReviewedRow => {
  const durationMs = options.minutes * MINUTE;

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: new Date(at(options.from).getTime() + durationMs),
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
    proposedMs: options.rows.reduce((sum, entry) => sum + entry.durationMs, 0),
    unattributedMs: options.unattributedMs ?? 0,
    warnings: [],
  },
  unreconciledMs: 0,
});

const ledgerFor = (entry: ReviewedRow): SyncedWorklog => ({
  proposalId: entry.id,
  tempoWorklogId: '900',
  contentHash: contentHashOf({ proposal: entry }),
  syncedAt: at('18:00'),
});

describe('dayReviewGap', () => {
  it('reports nothing for a day whose every row is in Tempo as written', () => {
    const logged = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'accepted' });

    expect(dayReviewGap({ review: review({ rows: [logged] }), ledger: [ledgerFor(logged)] })).toBeNull();
  });

  it('counts a row the ledger has never held as time Tempo is behind on', () => {
    const written = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'accepted' });
    const gap = dayReviewGap({ review: review({ rows: [written] }), ledger: [] });

    expect(gap?.reasons).toEqual(['unsynced']);
    expect(gap?.unsyncedMs).toBe(120 * MINUTE);
  });

  it('counts a row whose content moved since it was written', () => {
    const logged = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'accepted' });
    const entry = ledgerFor(logged);
    const gap = dayReviewGap({
      review: review({ rows: [{ ...logged, description: 'a description the reviewer retyped' }] }),
      ledger: [entry],
    });

    expect(gap?.reasons).toEqual(['unsynced']);
  });

  it('reads a rejected row Tempo still holds as work owed, without claiming its time', () => {
    const dropped = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'rejected' });
    const gap = dayReviewGap({ review: review({ rows: [dropped] }), ledger: [ledgerFor(dropped)] });

    expect(gap?.reasons).toEqual(['unsynced']);
    expect(gap?.unsyncedMs).toBe(0);
  });

  it('leaves a rejected row nothing was ever written for alone', () => {
    const dropped = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'rejected' });

    expect(dayReviewGap({ review: review({ rows: [dropped] }), ledger: [] })).toBeNull();
  });

  it('reports a row still awaiting a decision', () => {
    const weak = row({ issueKey: 'FIP-1', from: '09:00', minutes: 45, state: 'suggested' });
    const gap = dayReviewGap({ review: review({ rows: [weak] }), ledger: [] });

    expect(gap?.reasons).toEqual(['undecided']);
    expect(gap?.undecidedMs).toBe(45 * MINUTE);
  });

  it('reports observed time no issue claimed', () => {
    const gap = dayReviewGap({ review: review({ rows: [], unattributedMs: 90 * MINUTE }), ledger: [] });

    expect(gap?.reasons).toEqual(['unattributed']);
  });

  it('ignores a gap smaller than one rounding increment', () => {
    const crumb = row({ issueKey: 'FIP-1', from: '09:00', minutes: 5, state: 'accepted' });

    expect(dayReviewGap({ review: review({ rows: [crumb], unattributedMs: MINUTE }), ledger: [] })).toBeNull();
  });

  it('reads a synced row as changed when the sync writes attributes the hash was not given', () => {
    const logged = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'accepted' });
    const attributesByProposalId = { [logged.id]: { _Billable_: true } };
    const entry: SyncedWorklog = {
      ...ledgerFor(logged),
      contentHash: contentHashOf({ proposal: logged, attributes: attributesByProposalId[logged.id] }),
    };

    expect(dayReviewGap({ review: review({ rows: [logged] }), ledger: [entry] })?.reasons).toEqual(['unsynced']);
    expect(dayReviewGap({ review: review({ rows: [logged] }), ledger: [entry], attributesByProposalId })).toBeNull();
  });
});

describe('isNudgeDue', () => {
  const record = (options: Partial<DayNudgeRecord>): DayNudgeRecord => ({
    day: '2026-08-11',
    lastNudgedAt: null,
    silencedUntil: null,
    ...options,
  });

  it('says nothing before the minute the day is due', () => {
    expect(isNudgeDue({ now: at('17:29'), atMinute: 17 * 60 + 30 })).toBe(false);
    expect(isNudgeDue({ now: at('17:30'), atMinute: 17 * 60 + 30 })).toBe(true);
  });

  it('keeps reporting a day it already reported, so the banner stays up until the day is done', () => {
    expect(
      isNudgeDue({ now: at('18:00'), atMinute: 17 * 60 + 30, record: record({ lastNudgedAt: at('17:30') }) }),
    ).toBe(true);
  });

  it('stays quiet while the day is silenced', () => {
    const silenced = record({ lastNudgedAt: at('09:00'), silencedUntil: at('23:59') });

    expect(isNudgeDue({ now: at('19:00'), atMinute: 17 * 60 + 30, record: silenced })).toBe(false);
    expect(isNudgeDue({ now: at('23:59'), atMinute: 17 * 60 + 30, record: silenced })).toBe(true);
  });
});

describe('hasNudgeRepeatElapsed', () => {
  const fired = { day: '2026-08-11', lastNudgedAt: at('17:30'), silencedUntil: null };

  it('holds the notification back for the repeat window after it fired', () => {
    expect(hasNudgeRepeatElapsed({ now: at('18:00'), record: fired })).toBe(false);
    expect(
      hasNudgeRepeatElapsed({ now: new Date(at('17:30').getTime() + DEFAULT_NUDGE_REPEAT_MS), record: fired }),
    ).toBe(true);
  });

  it('sends the first one straight away', () => {
    expect(hasNudgeRepeatElapsed({ now: at('17:30') })).toBe(true);
  });
});

describe('dayNudge', () => {
  const unlogged = row({ issueKey: 'FIP-1', from: '09:00', minutes: 120, state: 'accepted' });

  it('words the day Tempo is behind on', () => {
    const nudge = dayNudge({
      day: '2026-08-11',
      review: review({ rows: [unlogged] }),
      ledger: [],
      now: at('17:30'),
      atMinute: 17 * 60 + 30,
    });

    expect(nudge?.title).toBe('Your day is not logged yet');
    expect(nudge?.body).toBe('2h 0m is not in Tempo yet');
  });

  it('leads with the review when nothing is owed to Tempo', () => {
    const nudge = dayNudge({
      day: '2026-08-11',
      review: review({ rows: [row({ issueKey: 'FIP-1', from: '09:00', minutes: 45, state: 'suggested' })] }),
      ledger: [],
      now: at('17:30'),
      atMinute: 17 * 60 + 30,
    });

    expect(nudge?.title).toBe('Your day still needs a review');
    expect(nudge?.body).toBe('45m is waiting for a yes or a no');
  });

  it('keeps the banner up after the notification has already gone out', () => {
    const nudge = dayNudge({
      day: '2026-08-11',
      review: review({ rows: [unlogged] }),
      ledger: [],
      now: at('18:00'),
      atMinute: 17 * 60 + 30,
      record: { day: '2026-08-11', lastNudgedAt: at('17:30'), silencedUntil: null },
    });

    expect(nudge?.notify).toBe(false);
    expect(nudge?.body).toBe('2h 0m is not in Tempo yet');
  });

  it('says nothing for a finished day, and nothing before its minute', () => {
    const finished = { day: '2026-08-11', ledger: [ledgerFor(unlogged)], atMinute: 17 * 60 + 30 };

    expect(dayNudge({ ...finished, review: review({ rows: [unlogged] }), now: at('17:30') })).toBeNull();
    expect(dayNudge({ ...finished, review: review({ rows: [unlogged] }), ledger: [], now: at('09:00') })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { WorklogProposal } from '../model/proposal';
import { UnnamedProposal } from '../rows/propose';
import { setRowDescription, setRowIssue, setRowState } from './edits';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const SDK = 'repo:/w/ethlete-sdk';
const APP = 'repo:/w/fifagg-frontend';
const SESSION = '2ddc51f5-2e3f-44b4-8070-8712d588fd46';
const FROM = new Date('2026-11-18T23:00:00.000Z');
const GERMAN = 'Übergabe der Doku-Rolle besprochen';

const row = (options: { id: string; laneKey: string; minutes: number; issueKey?: string; withheld?: string }) => ({
  id: options.id,
  from: FROM,
  to: new Date(FROM.getTime() + options.minutes * MINUTE),
  durationMs: options.minutes * MINUTE,
  observedMs: options.minutes * MINUTE,
  laneKey: options.laneKey,
  description: 'work',
  confidence: 'likely' as const,
  evidence: [],
  state: 'suggested' as const,
  ...(options.issueKey ? { issueKey: options.issueKey } : {}),
  ...(options.withheld ? { withheldIssueKey: options.withheld } : {}),
});

const dayRows = (proposals: WorklogProposal[], unnamed: UnnamedProposal[]): DayRows => ({
  proposals,
  unattributed: [],
  unnamed,
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const merged = () =>
  dayRows(
    [
      row({ id: `FIFAGG-12759@${FROM.toISOString()}`, laneKey: SDK, minutes: 15, issueKey: 'FIFAGG-12759' }),
      row({
        id: `FIFAGG-12759@${FROM.toISOString()}+${SESSION}`,
        laneKey: APP,
        minutes: 30,
        issueKey: 'FIFAGG-12759',
      }) as WorklogProposal,
    ] as WorklogProposal[],
    [],
  );

const split = (unnamed: Partial<Parameters<typeof row>[0]> = {}) =>
  dayRows(
    [row({ id: `ET-772@${FROM.toISOString()}`, laneKey: SDK, minutes: 15, issueKey: 'ET-772' }) as WorklogProposal],
    [row({ id: `unnamed:${APP}@${FROM.toISOString()}`, laneKey: APP, minutes: 30, ...unnamed }) as UnnamedProposal],
  );

const edited = (named: boolean): DayReviewEdits => {
  const target = reviewDay({ rows: merged() }).rows.find((candidate) => candidate.laneKey === APP) as ReviewedRow;
  const issue = named
    ? setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: target, issueKey: 'FIFAGG-12759' })
    : undefined;
  const described = setRowDescription({ edits: issue ?? EMPTY_DAY_REVIEW_EDITS, row: target, description: GERMAN });

  return setRowState({ edits: described, row: target, state: 'accepted' });
};

describe('an edit of a row that splits into per-lane pieces', () => {
  it('sticks to the piece in the lane of the issue the reviewer named', () => {
    const review = reviewDay({ rows: split(), edits: edited(true) });
    const piece = review.rows.find((candidate) => candidate.laneKey === APP);

    expect(piece).toMatchObject({ issueKey: 'FIFAGG-12759', description: GERMAN, state: 'accepted' });
    expect(review.rows.find((candidate) => candidate.laneKey === SDK)).toMatchObject({
      issueKey: 'ET-772',
      description: 'work',
    });
  });

  it('sticks to the piece that still holds the issue when the edit named no lane', () => {
    const review = reviewDay({ rows: split({ withheld: 'FIFAGG-12759' }), edits: edited(false) });

    expect(review.rows.find((candidate) => candidate.laneKey === APP)).toMatchObject({
      description: GERMAN,
      state: 'accepted',
    });
    expect(review.rows.find((candidate) => candidate.laneKey === SDK)?.description).toBe('work');
  });
});

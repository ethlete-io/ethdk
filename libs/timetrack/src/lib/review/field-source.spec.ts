import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { WorklogProposal } from '../model/proposal';
import { openStandIn } from '../model/stand-in';
import { resetRow, setRowDescription, setRowIssue, setRowStandIn, splitRow } from './edits';
import { DayReview, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
import { reviewDay } from './review-day';

const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const proposal = (options: { issueKey: string; from: string; to: string }): WorklogProposal => ({
  id: `${options.issueKey}@${at(options.from).toISOString()}`,
  issueKey: options.issueKey,
  from: at(options.from),
  to: at(options.to),
  durationMs: at(options.to).getTime() - at(options.from).getTime(),
  observedMs: at(options.to).getTime() - at(options.from).getTime(),
  description: `work on ${options.issueKey}`,
  confidence: 'certain',
  evidence: [],
  state: 'suggested',
});

const DAY: DayRows = {
  proposals: [
    proposal({ issueKey: 'ABC-1', from: '08:00', to: '09:00' }),
    proposal({ issueKey: 'ABC-2', from: '09:00', to: '10:00' }),
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

const JOURNEY = openStandIn({ name: 'Journey', day: '2026-08-11', now: at('07:00') });

const review = (edits: DayReviewEdits) => reviewDay({ rows: DAY, edits, standIns: [JOURNEY] });

const rowAt = (day: DayReview, time: string) => {
  const row = day.rows.find((candidate) => candidate.from.getTime() === at(time).getTime());

  if (!row) throw new Error(`no row at ${time}`);

  return row;
};

const timeOf = (row: ReviewedRow) => row.from.toISOString().slice(11, 16);

/** What auto mode would write: every row named and described, one field at a time. */
const autoPass = (edits: DayReviewEdits) =>
  review(edits)
    .rows.map(timeOf)
    .reduce((next, time) => {
      const issued = setRowIssue({ edits: next, row: rowAt(review(next), time), issueKey: 'AUTO-1', source: 'auto' });

      return setRowDescription({
        edits: issued,
        row: rowAt(review(issued), time),
        description: 'auto words',
        source: 'auto',
      });
    }, edits);

const named = (day: DayReview) =>
  day.rows.map((row) => [timeOf(row), row.issueKey || undefined, row.standInId, row.description]);

describe('field sources', () => {
  it('changes nothing in an auto pass after the user named and described every row', () => {
    const first = rowAt(review(EMPTY_DAY_REVIEW_EDITS), '08:00');
    const named1 = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row: first, issueKey: 'XYZ-1' });
    const human = setRowDescription({ edits: named1, row: rowAt(review(named1), '08:00'), description: 'mine' });
    const split = splitRow({ edits: human, row: rowAt(review(human), '09:00'), at: at('09:30') });
    const standIn = setRowStandIn({ edits: split, row: rowAt(review(split), '09:00'), standInId: JOURNEY.id });
    const second = setRowIssue({ edits: standIn, row: rowAt(review(standIn), '09:30'), issueKey: 'XYZ-2' });
    const described = [
      ['09:00', 'first half'],
      ['09:30', 'second half'],
    ].reduce(
      (edits, [time, description]) =>
        setRowDescription({ edits, row: rowAt(review(edits), time ?? ''), description: description ?? '' }),
      second,
    );

    expect(autoPass(described)).toBe(described);
    expect(named(review(described))).toEqual([
      ['08:00', 'XYZ-1', undefined, 'mine'],
      ['09:00', undefined, JOURNEY.id, 'first half'],
      ['09:30', 'XYZ-2', undefined, 'second half'],
    ]);
  });

  it('reads an edit stored before fields carried a source as the user’s', () => {
    const edits: DayReviewEdits = {
      ...EMPTY_DAY_REVIEW_EDITS,
      overrides: {
        'ABC-1@2026-08-11T08:00:00.000Z': { issueKey: 'OLD-1', description: 'typed long ago' },
        'ABC-2@2026-08-11T09:00:00.000Z': { issueKey: 'OLD-2', description: '' },
      },
    };

    expect(autoPass(edits)).toBe(edits);
  });

  it('lets auto mode write a field nobody set, and marks it as its own', () => {
    const edits = autoPass(EMPTY_DAY_REVIEW_EDITS);
    const row = rowAt(review(edits), '08:00');

    expect([row.issueKey, row.description]).toEqual(['AUTO-1', 'auto words']);
    expect(row.sources).toEqual({ issue: 'auto', description: 'auto' });
  });

  it('lets the user overwrite what auto mode wrote, and keeps auto mode off it from then on', () => {
    const auto = autoPass(EMPTY_DAY_REVIEW_EDITS);
    const human = setRowIssue({ edits: auto, row: rowAt(review(auto), '08:00'), issueKey: 'XYZ-1' });

    expect(rowAt(review(autoPass(human)), '08:00').issueKey).toBe('XYZ-1');
  });

  it('lets auto mode name both halves of a row the user split but never named', () => {
    const split = splitRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowAt(review(EMPTY_DAY_REVIEW_EDITS), '09:00'),
      at: at('09:30'),
    });

    expect(named(review(autoPass(split))).slice(1)).toEqual([
      ['09:00', 'AUTO-1', undefined, 'auto words'],
      ['09:30', 'AUTO-1', undefined, 'auto words'],
    ]);
  });

  it('hands a field back to auto mode only through a reset', () => {
    const human = setRowIssue({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowAt(review(EMPTY_DAY_REVIEW_EDITS), '08:00'),
      issueKey: 'XYZ-1',
    });
    const reset = resetRow({ edits: human, row: rowAt(review(human), '08:00') });

    expect(rowAt(review(autoPass(reset)), '08:00').issueKey).toBe('AUTO-1');
  });
});

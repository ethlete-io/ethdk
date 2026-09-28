import { describe, expect, it } from 'vitest';
import { ActionClasses } from '../agent-api/action-classes';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import {
  AUTO_DESCRIPTION_SETTLE_MS,
  autoDescriptionAsks,
  autoDescriptionRequest,
  withAutoModeDescription,
} from './auto-description';
import { setRowDescription } from './edits';
import { AutoModeDescription, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';
import { reviewDay } from './review-day';

const TODAY = '2026-08-11';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);
const NOW_MS = at('12:00').getTime();

const proposal = (options: Partial<WorklogProposal> & { id: string }): WorklogProposal => ({
  issueKey: 'ABC-1',
  from: at('08:00'),
  to: at('09:00'),
  durationMs: 3_600_000,
  observedMs: 3_600_000,
  laneKey: 'repo:/work/shop',
  description: 'Export the month',
  confidence: 'certain',
  evidence: [{ kind: 'commit', at: at('08:30'), detail: 'a commit', summary: 'Export the month as CSV' }],
  state: 'suggested',
  ...options,
});

const CODE = proposal({ id: 'ABC-1@08:00' });

const dayOf = (proposals: WorklogProposal[]): DayRows => ({
  proposals,
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const rowsOf = (edits: DayReviewEdits, proposals: WorklogProposal[] = [CODE]) =>
  reviewDay({ rows: dayOf(proposals), edits }).rows;

const asks = (options: {
  rows: ReviewedRow[];
  answers?: AutoModeDescription[];
  day?: string;
  nowMs?: number;
  classes?: ActionClasses;
}) =>
  autoDescriptionAsks({
    enabled: true,
    day: options.day ?? TODAY,
    today: TODAY,
    nowMs: options.nowMs ?? NOW_MS,
    classes: options.classes ?? {},
    rows: options.rows,
    answers: options.answers ?? [],
  }).map((row) => row.id);

const answerFor = (row: ReviewedRow, description?: string): AutoModeDescription => ({
  rowId: row.id,
  askedAtMs: NOW_MS,
  request: autoDescriptionRequest({ row }),
  ...(description === undefined ? {} : { description }),
});

const codeRow = (edits: DayReviewEdits = EMPTY_DAY_REVIEW_EDITS) => {
  const [row] = rowsOf(edits);

  if (!row) throw new Error('no row');

  return row;
};

describe('autoDescriptionAsks', () => {
  it('asks about a settled code row that names an issue', () => {
    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS) })).toEqual([CODE.id]);
  });

  it('writes the description once, as auto, and never asks about the row again', () => {
    const row = codeRow();

    const edits = withAutoModeDescription({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row,
      answer: answerFor(row, 'Exports the month as a CSV file.'),
    });
    const [written] = rowsOf(edits);

    expect(written?.description).toBe('Exports the month as a CSV file.');
    expect(written?.sources?.description).toBe('auto');
    expect(asks({ rows: rowsOf(edits), answers: edits.autoDescriptions })).toEqual([]);
  });

  it('asks a failed row no second time', () => {
    const row = codeRow();

    const edits = withAutoModeDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, answer: answerFor(row) });

    expect(rowsOf(edits)[0]?.description).toBe(CODE.description);
    expect(asks({ rows: rowsOf(edits), answers: edits.autoDescriptions })).toEqual([]);
  });

  it('skips a row whose description the user wrote', () => {
    const row = codeRow();

    const edits = setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, description: 'Mine' });

    expect(asks({ rows: rowsOf(edits) })).toEqual([]);
  });

  it('keeps a description the user wrote while the call ran', () => {
    const row = codeRow();

    const edited = setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, description: 'Mine' });
    const edits = withAutoModeDescription({ edits: edited, row, answer: answerFor(row, 'From the model') });

    expect(rowsOf(edits)[0]?.description).toBe('Mine');
    expect(rowsOf(edits)[0]?.sources?.description).toBe('human');
  });

  it('skips a code row without a ticket', () => {
    const unnamed: ReviewedRow = { ...codeRow(), issueKey: undefined };

    expect(asks({ rows: [unnamed] })).toEqual([]);
  });

  it('skips a call row', () => {
    const call = proposal({
      id: 'ABC-2@10:00',
      issueKey: 'ABC-2',
      from: at('10:00'),
      to: at('11:00'),
      laneKey: CALL_LANE_KEY,
      evidence: [{ kind: 'call', at: at('10:00'), detail: 'a call' }],
    });

    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS, [call]) })).toEqual([]);
  });

  it('waits until the row has settled', () => {
    const rows = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    expect(asks({ rows, nowMs: CODE.to.getTime() + AUTO_DESCRIPTION_SETTLE_MS - 1 })).toEqual([]);
    expect(asks({ rows, nowMs: CODE.to.getTime() + AUTO_DESCRIPTION_SETTLE_MS })).toEqual([CODE.id]);
  });

  it('asks nothing on another day, or where applying is stricter than local', () => {
    const rows = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    expect(asks({ rows, day: '2026-08-10' })).toEqual([]);
    expect(asks({ rows, classes: { 'autoMode.apply': 'external' } })).toEqual([]);
  });
});

describe('autoDescriptionRequest', () => {
  it('sends the checkout name, the length and the quotable wording, masked', () => {
    const row = codeRow();

    expect(autoDescriptionRequest({ row, maskedNames: ['shop'] })).toEqual({
      repo: expect.not.stringContaining('shop'),
      minutes: 60,
      notes: ['Export the month as CSV'],
      parents: [],
      issues: [],
    });
  });
});

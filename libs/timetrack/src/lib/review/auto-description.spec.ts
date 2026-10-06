import { describe, expect, it } from 'vitest';
import { ActionClasses } from '../agent-api/action-classes';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import {
  AUTO_MODE_SETTLE_MS,
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

  it("waits on the row's own session, which went on past the row's end", () => {
    const session = proposal({
      id: 'ABC-1@10:00',
      from: at('10:00'),
      to: at('10:15'),
      durationMs: 900_000,
      observedMs: 900_000,
      activeUntil: at('11:45'),
    });

    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS, [session]) })).toEqual([]);
    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS, [session]), nowMs: at('12:20').getTime() })).toEqual([
      session.id,
    ]);
  });

  it('settles a row with no piece on its end', () => {
    const plain = proposal({
      id: 'ABC-1@11:00',
      from: at('11:00'),
      to: at('11:15'),
      durationMs: 900_000,
      observedMs: 900_000,
    });

    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS, [plain]), nowMs: at('11:50').getTime() })).toEqual([plain.id]);
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

  it('asks again once the notes of a row it described changed, and rewrites its description', () => {
    const row = codeRow();
    const edits = withAutoModeDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, answer: answerFor(row, 'First') });
    const grown = proposal({
      id: CODE.id,
      evidence: [
        ...CODE.evidence,
        { kind: 'commit', at: at('08:40'), detail: 'a commit', summary: 'Add the export button' },
      ],
    });
    const [again] = rowsOf(edits, [grown]);

    expect(asks({ rows: rowsOf(edits, [grown]), answers: edits.autoDescriptions })).toEqual([CODE.id]);

    if (!again) throw new Error('no row');

    const rewritten = withAutoModeDescription({ edits, row: again, answer: answerFor(again, 'Second') });

    expect(rowsOf(rewritten, [grown])[0]?.description).toBe('Second');
  });

  it('asks nothing about a row whose only notes are acknowledgements', () => {
    const acknowledged = proposal({
      id: CODE.id,
      evidence: [{ kind: 'agent-session', at: at('08:30'), detail: 'Sounds good', summary: 'Sounds good' }],
    });

    expect(asks({ rows: rowsOf(EMPTY_DAY_REVIEW_EDITS, [acknowledged]) })).toEqual([]);
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

    expect(asks({ rows, nowMs: CODE.to.getTime() + AUTO_MODE_SETTLE_MS - 1 })).toEqual([]);
    expect(asks({ rows, nowMs: CODE.to.getTime() + AUTO_MODE_SETTLE_MS })).toEqual([CODE.id]);
  });

  it('asks nothing on another day, or where applying is stricter than local', () => {
    const rows = rowsOf(EMPTY_DAY_REVIEW_EDITS);

    expect(asks({ rows, day: '2026-08-10' })).toEqual([]);
    expect(asks({ rows, classes: { 'autoMode.apply': 'external' } })).toEqual([]);
  });
});

describe('autoDescriptionRequest', () => {
  it('sends the checkout name, the length, the ticket and the quotable wording, masked', () => {
    const row = codeRow();

    expect(autoDescriptionRequest({ row, issueSummary: 'Shop month export', maskedNames: ['shop', 'ABC'] })).toEqual({
      repo: expect.not.stringContaining('shop'),
      minutes: 60,
      issue: { key: expect.stringMatching(/^(?!ABC-)[A-Z]+-1$/), summary: expect.not.stringContaining('Shop') },
      notes: ['Export the month as CSV'],
    });
  });

  it('quotes nothing from an agent session with no title, so no session id or path is sent', () => {
    const row = {
      ...codeRow(),
      evidence: [{ kind: 'agent-session' as const, at: at('08:30'), detail: 'agent session 5f0c2a9e in /work/shop' }],
    };

    expect(autoDescriptionRequest({ row }).notes).toEqual([]);
  });

  it('drops prompts that only agree or ask what comes next, and keeps the work', () => {
    const session = (summary: string) => ({
      kind: 'agent-session' as const,
      at: at('08:30'),
      detail: summary,
      summary,
    });
    const row = {
      ...codeRow(),
      evidence: [
        session('Sounds good'),
        session('Agree.'),
        session('Where do we continue on now? The audit…'),
        { kind: 'work-file' as const, at: at('08:35'), detail: 'wrote a changeset', summary: 'changeset scan mediums' },
        {
          kind: 'commit' as const,
          at: at('08:40'),
          detail: 'a commit',
          summary: 'docs(core): Close the scan findings',
        },
      ],
    };

    expect(autoDescriptionRequest({ row }).notes).toEqual([
      'changeset scan mediums',
      'docs(core): Close the scan findings',
    ]);
  });

  it('sends the key alone where the ticket summary is not known', () => {
    expect(autoDescriptionRequest({ row: codeRow() }).issue).toEqual({ key: 'ABC-1' });
  });
});

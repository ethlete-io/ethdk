import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import { callWritingRequest } from '../ticket/write';
import { AUTO_CALL_TRANSCRIPT_SKIP_MS, callTranscriptExcerpt, isAutoModeCallRow } from './auto-call';
import { AUTO_MODE_SETTLE_MS } from './auto-description';
import {
  autoModeAsks,
  autoModeCreateRequest,
  autoModeReadout,
  autoModeSubjectKey,
  withAutoModeAnswer,
  withAutoModeRowNames,
} from './auto-mode';
import { setRowIssue } from './edits';
import { AutoModeAnswer, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const TODAY = '2026-08-11';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);
const CALL_ID = `unnamed:${CALL_LANE_KEY}@${at('10:00').toISOString()}`;

const DAY: DayRows = {
  proposals: [],
  unattributed: [],
  unnamed: [
    {
      id: CALL_ID,
      from: at('10:00'),
      to: at('10:45'),
      durationMs: 45 * 60_000,
      observedMs: 45 * 60_000,
      laneKey: CALL_LANE_KEY,
      description: 'Weekly sync',
      confidence: 'weak',
      evidence: [{ kind: 'call', at: at('10:00'), detail: 'call in _Weekly sync_', summary: 'Weekly sync' }],
      state: 'suggested',
    },
  ],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
};

const rowsOf = (edits: DayReviewEdits = EMPTY_DAY_REVIEW_EDITS) => reviewDay({ rows: DAY, edits }).rows;
const SETTLED_MS = at('10:45').getTime() + AUTO_MODE_SETTLE_MS;

const asks = (options: {
  edits?: DayReviewEdits;
  nowMs?: number;
  day?: string;
  answers?: AutoModeAnswer[];
  transcribedCalls?: ReadonlySet<string>;
}) =>
  autoModeAsks({
    enabled: true,
    day: options.day ?? TODAY,
    today: TODAY,
    nowMs: options.nowMs ?? SETTLED_MS,
    contexts: [],
    standIns: [],
    rows: rowsOf(options.edits),
    answers: options.answers ?? [],
    ...(options.transcribedCalls ? { transcribedCalls: options.transcribedCalls } : {}),
  }).map(autoModeSubjectKey);

const answer = (outcome: AutoModeAnswer['outcome']): AutoModeAnswer => ({
  subject: { kind: 'call', rowId: CALL_ID },
  askedAtMs: SETTLED_MS,
  request: callWritingRequest({ label: 'Weekly sync', observedMs: 45 * 60_000 }),
  outcome,
});

describe('auto mode on an unnamed call', () => {
  it('asks about a counted call row nobody named, once it settled', () => {
    expect(asks({ nowMs: SETTLED_MS - 1 })).toEqual([]);
    expect(asks({})).toEqual([`call:${CALL_ID}`]);
  });

  it('asks nothing on another day, and nothing twice', () => {
    expect(asks({ day: '2026-08-10' })).toEqual([]);
    expect(asks({ answers: [answer({ kind: 'failed' })] })).toEqual([]);
  });

  it('asks again once an excerpt exists for a call asked without one, and then never again', () => {
    const transcribedCalls = new Set([CALL_ID]);
    const without = answer({ kind: 'failed' });
    const sent = {
      ...without,
      request: callWritingRequest({ label: 'Weekly sync', observedMs: 45 * 60_000, transcript: 'the invite flow' }),
    };

    expect(asks({ answers: [without] })).toEqual([]);
    expect(asks({ answers: [without], transcribedCalls })).toEqual([`call:${CALL_ID}`]);
    expect(asks({ answers: [sent], transcribedCalls })).toEqual([]);
  });

  it('asks again only a call still unnamed and not named by the user', () => {
    const [row] = rowsOf();

    if (!row) throw new Error('no row');

    const transcribedCalls = new Set([CALL_ID]);
    const answers = [answer({ kind: 'match', issueKey: 'ABC-7' })];
    const mine = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row, issueKey: 'ABC-1' });

    expect(asks({ edits: mine, answers, transcribedCalls })).toEqual([]);
    expect(asks({ day: '2026-08-10', answers, transcribedCalls })).toEqual([]);
  });

  it('leaves a call the user named by hand, and one a rule excluded', () => {
    const [row] = rowsOf();

    if (!row) throw new Error('no row');

    expect(asks({ edits: setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row, issueKey: 'ABC-1' }) })).toEqual([]);
    expect(isAutoModeCallRow({ ...row, excluded: true })).toBe(false);
  });

  it('names the row with the match as auto, never by hand', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, answer({ kind: 'match', issueKey: 'ABC-7' }));
    const named = withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: [] });
    const [row] = rowsOf(named);

    expect(row?.issueKey).toBe('ABC-7');
    expect(row?.sources?.issue).toBe('auto');
  });

  it('keeps the name the user gave the call over a later match', () => {
    const [row] = rowsOf();

    if (!row) throw new Error('no row');

    const mine = setRowIssue({ edits: EMPTY_DAY_REVIEW_EDITS, row, issueKey: 'ABC-1' });
    const edits = withAutoModeAnswer(mine, answer({ kind: 'match', issueKey: 'ABC-7' }));
    const named = withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: [] });

    expect(rowsOf(named)[0]?.issueKey).toBe('ABC-1');
  });

  it('files no ticket it drafted for a call', () => {
    expect(
      autoModeCreateRequest(answer({ kind: 'draft', summary: 'Sync', description: 'Talk.', projectKey: 'ABC' })),
    ).toBeNull();
  });

  it('reads out the call by its label and links its row', () => {
    const edits = withAutoModeAnswer(EMPTY_DAY_REVIEW_EDITS, answer({ kind: 'match', issueKey: 'ABC-7' }));
    const named = withAutoModeRowNames({ edits, rows: rowsOf(edits), unattributed: [] });

    expect(
      autoModeReadout({ day: TODAY, edits: named, approvals: [], classes: {}, standIns: [], rows: rowsOf(named) }),
    ).toEqual([
      expect.objectContaining({
        kind: 'call',
        label: 'Weekly sync',
        issueKey: 'ABC-7',
        status: 'applied',
        rowId: CALL_ID,
      }),
    ]);
  });
});

describe('callWritingRequest', () => {
  it('sends the label, the minutes, the issues and the transcript, masked', () => {
    expect(
      callWritingRequest({
        label: 'Shop weekly',
        observedMs: 45 * 60_000,
        transcript: 'we talked about the Shop export',
        issues: [{ key: 'SHOP-3', id: '3', issueType: 'Task', summary: 'Shop export' }],
        maskedNames: ['Shop'],
      }),
    ).toEqual({
      minutes: 45,
      notes: [],
      call: {
        label: expect.not.stringContaining('Shop'),
        transcript: expect.not.stringContaining('Shop'),
      },
      parents: [],
      issues: [{ key: expect.not.stringContaining('SHOP'), summary: expect.not.stringContaining('Shop') }],
    });
  });

  it('sends no transcript where none was given', () => {
    expect(callWritingRequest({ label: 'Weekly', observedMs: 60_000 }).call).toEqual({ label: 'Weekly' });
  });
});

describe('callTranscriptExcerpt', () => {
  const call = { appId: 'com.hnc.Discord', from: at('10:00') };
  const window = { from: at('10:00'), to: at('10:45') };
  const chunk = (offsetMs: number, text: string, appId = 'com.hnc.Discord.helper.Renderer') => ({
    atMs: at('10:00').getTime() + offsetMs,
    appId,
    text,
  });

  it("reads only the call's own application, after its opening, in order", () => {
    expect(
      callTranscriptExcerpt({
        call,
        window,
        chunks: [
          chunk(60_000, 'then  the export'),
          chunk(AUTO_CALL_TRANSCRIPT_SKIP_MS - 1, 'Upp dum dum'),
          chunk(30_000, 'we start with'),
          chunk(40_000, 'another room', 'us.zoom.xos'),
          chunk(46 * 60_000, 'after the row'),
        ],
      }),
    ).toBe('we start with then the export');
  });

  it('cuts a long transcript at a word', () => {
    const excerpt = callTranscriptExcerpt({
      call,
      window,
      maxChars: 20,
      chunks: [chunk(60_000, 'alpha beta gamma delta epsilon')],
    });

    expect(excerpt).toBe('alpha beta gamma…');
  });

  it('answers nothing where nothing was heard', () => {
    expect(callTranscriptExcerpt({ call, window, chunks: [] })).toBeUndefined();
  });
});

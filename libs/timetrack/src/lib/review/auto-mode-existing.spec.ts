import { describe, expect, it } from 'vitest';
import { ActivityBlock, contextKey } from '../model/block';
import { WorkGroup } from '../rows/merge';
import { unnamedRowId } from '../rows/propose';
import { TicketCandidate } from '../ticket/match-candidates';
import { TicketWritingRequest } from '../ticket/write';
import {
  autoModeApplies,
  autoModeCreateRequest,
  autoModeDeclinedCreates,
  autoModeExistingOf,
  autoModeQueuedAnswer,
  withAutoModeDeclined,
  withAutoModeRowNames,
} from './auto-mode';
import { setRowIssue } from './edits';
import { AutoModeAnswer, EMPTY_DAY_REVIEW_EDITS, ReviewedRow } from './model';

const DAY = '2026-11-19';
const at = (time: string) => new Date(`${DAY}T${time}:00Z`);

const REPO = '/work/fifagg-frontend';
const BRANCH = 'refactor/shell';

const groupAt = (from: string, to: string, context: ActivityBlock['context']): WorkGroup => ({
  from: at(from),
  to: at(to),
  observedMs: 3_600_000,
  confidence: 'weak',
  evidence: [],
  blocks: [{ from: at(from), to: at(to), context, evidence: [] }],
});

const BOOKED = groupAt('08:00', '09:00', { repoPath: REPO, branch: BRANCH, session: 'claude-1' });
const ASKED = groupAt('10:00', '11:00', { repoPath: REPO, branch: BRANCH });
const OTHER = groupAt('12:00', '13:00', { repoPath: REPO, branch: 'feature/other' });
const SUBJECT = { kind: 'context' as const, contextId: contextKey(ASKED.blocks[0]!.context) };

const CANDIDATES: TicketCandidate[] = [
  { key: 'FIFAGG-12000', id: '1', summary: 'Shell navigation', issueType: 'Story' },
  { key: 'FIFAGG-12769', id: '2', summary: 'Refactor the shell', issueType: 'Story' },
];

const row = (group: WorkGroup, issueKey = ''): Pick<ReviewedRow, 'id' | 'issueKey'> => ({
  id: unnamedRowId(group),
  issueKey,
});

const REQUEST: TicketWritingRequest = { notes: [], parents: [], issues: [], repo: 'fifagg-frontend', branch: BRANCH };

const draftOf = (existing?: ReturnType<typeof autoModeExistingOf>): AutoModeAnswer => ({
  subject: SUBJECT,
  askedAtMs: 0,
  request: REQUEST,
  outcome: {
    kind: 'draft',
    summary: 'Visuelle Baselines für die Shell integrieren',
    description: 'Baselines.',
    projectKey: 'FIFAGG',
    ...(existing ? { existing } : {}),
  },
});

describe('autoModeExistingOf', () => {
  it('leads with the issue the same branch already books that day', () => {
    const existing = autoModeExistingOf({
      subject: SUBJECT,
      candidates: CANDIDATES,
      unattributed: [BOOKED, ASKED],
      rows: [row(BOOKED, 'FIFAGG-12769'), row(ASKED)],
    });

    expect(existing).toEqual({ issueKey: 'FIFAGG-12769', summary: 'Refactor the shell', leads: true });
    expect(autoModeCreateRequest(draftOf(existing))).toMatchObject({
      op: 'jira.create',
      existing: { issueKey: 'FIFAGG-12769', leads: true },
    });
  });

  it('offers the best-ranked candidate as the alternative where no band of the branch is booked', () => {
    expect(
      autoModeExistingOf({
        subject: SUBJECT,
        candidates: CANDIDATES,
        unattributed: [OTHER, ASKED],
        rows: [row(OTHER, 'FIFAGG-1'), row(ASKED)],
      }),
    ).toEqual({ issueKey: 'FIFAGG-12000', summary: 'Shell navigation' });
  });

  it('skips a parent issue as the alternative', () => {
    expect(
      autoModeExistingOf({
        subject: SUBJECT,
        candidates: CANDIDATES,
        parentKeys: new Set(['FIFAGG-12000']),
        unattributed: [ASKED],
        rows: [row(ASKED)],
      }),
    ).toEqual({ issueKey: 'FIFAGG-12769', summary: 'Refactor the shell' });
  });

  it('leads with the issue the subject held before the new draft', () => {
    const held: AutoModeAnswer = { ...draftOf(), outcome: { kind: 'match', issueKey: 'FIFAGG-12769' } };

    expect(
      autoModeExistingOf({ subject: SUBJECT, candidates: [], unattributed: [ASKED], rows: [row(ASKED)], held: [held] }),
    ).toEqual({ issueKey: 'FIFAGG-12769', leads: true });
  });

  it('keeps the alternative when the draft points at a shared create', () => {
    const existing = { issueKey: 'FIFAGG-12769', leads: true as const };
    const queued = autoModeQueuedAnswer(draftOf(existing), {
      id: 'a-1',
      request: { op: 'jira.create', summary: 'Baselines', description: '', projectKey: 'FIFAGG' },
    });

    expect(queued.outcome).toMatchObject({ approvalId: 'a-1', existing });
  });
});

describe('a draft with an existing issue on the band', () => {
  const rows = [{ ...row(ASKED), sources: undefined }] as unknown as ReviewedRow[];
  const local = { 'autoMode.apply': 'local' } as const;

  it('names the band with the existing issue only when it leads', () => {
    const flipped = draftOf({ issueKey: 'FIFAGG-12769', leads: true });
    const plain = draftOf({ issueKey: 'FIFAGG-12769' });

    expect(autoModeApplies({ day: DAY, answer: flipped, classes: local, approvals: [] })).toBe(true);
    expect(autoModeApplies({ day: DAY, answer: plain, classes: local, approvals: [] })).toBe(false);

    const named = withAutoModeRowNames({
      edits: { ...EMPTY_DAY_REVIEW_EDITS, auto: [flipped] },
      rows,
      unattributed: [ASKED],
    });

    expect(Object.values(named.overrides)[0]).toMatchObject({ issueKey: 'FIFAGG-12769' });
  });

  it('keeps a leading issue on rows the replaced answer named', () => {
    const flipped = draftOf({ issueKey: 'FIFAGG-12769', leads: true });
    const superseded = { ...flipped, outcome: { ...flipped.outcome, supersededKey: 'FIFAGG-12769' } } as AutoModeAnswer;
    const edits = setRowIssue({
      edits: { ...EMPTY_DAY_REVIEW_EDITS, auto: [superseded] },
      row: rows[0]!,
      issueKey: 'FIFAGG-12769',
      source: 'auto',
    });
    const named = withAutoModeRowNames({
      edits,
      rows: [{ ...rows[0]!, issueKey: 'FIFAGG-12769', sources: { issue: 'auto' } }],
      unattributed: [ASKED],
    });

    expect(named).toBe(edits);
  });

  it('turns a rejected or expired create into a match on the existing issue', () => {
    const queued = {
      ...draftOf({ issueKey: 'FIFAGG-12769' }),
      outcome: { ...draftOf({ issueKey: 'FIFAGG-12769' }).outcome, approvalId: 'a-1' },
    } as AutoModeAnswer;
    const bare = {
      ...draftOf(),
      subject: { kind: 'stand-in' as const, standInId: 's' },
      outcome: { ...draftOf().outcome, approvalId: 'a-2' },
    } as AutoModeAnswer;
    const approvals = [
      { id: 'a-1', state: 'rejected' },
      { id: 'a-2', state: 'expired' },
    ];

    expect(autoModeDeclinedCreates({ answers: [queued, bare], approvals })).toEqual([
      { answer: queued, approvalId: 'a-1' },
    ]);
    expect(autoModeDeclinedCreates({ answers: [queued], approvals: [{ id: 'a-1', state: 'queued' }] })).toEqual([]);

    const edits = withAutoModeDeclined({ ...EMPTY_DAY_REVIEW_EDITS, auto: [queued] }, { approvalId: 'a-1' });

    expect(edits.auto?.[0]?.outcome).toEqual({ kind: 'match', issueKey: 'FIFAGG-12769' });
  });
});

import { ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { streamKeyLabel, streamKeyRepoPath } from '../model/block';
import { QUOTABLE_EVIDENCE_KINDS } from '../model/evidence';
import { mayAutoWrite, rowFieldSourceOf, storedSourceOf } from '../model/field-source';
import { maskIssueKey, maskNames, pseudonymMap } from '../reason/pseudonym';
import { DEFAULT_MAX_TICKET_NOTES } from '../ticket/draft';
import { WorklogWritingRequest } from '../ticket/worklog';
import { setRowDescription } from './edits';
import { AutoModeDescription, DayReviewEdits, ReviewedRow } from './model';

/** How long a row's end has to lie behind now before auto mode writes its description. */
export const AUTO_DESCRIPTION_SETTLE_MS = 30 * 60_000;

/** The id auto mode keys a row's description by: the id an edit to the row is written against. */
export const autoDescriptionRowId = (row: Pick<ReviewedRow, 'id' | 'recutOf'>) => row.recutOf ?? row.id;

const isCodeRow = (row: Pick<ReviewedRow, 'laneKey'>) => !!row.laneKey && !!streamKeyRepoPath(row.laneKey);

/**
 * The rows of today auto mode still has to describe: settled code rows that name an issue, whose
 * description the user did not write, and that hold no answer yet. Nothing on any day but today,
 * nothing while auto mode is off, and nothing where the user made `autoMode.apply` stricter than `local`.
 */
export const autoDescriptionAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  nowMs: number;
  classes: ActionClasses;
  rows: readonly ReviewedRow[];
  answers: readonly AutoModeDescription[];
  settleMs?: number;
}): ReviewedRow[] => {
  if (!options.enabled || options.day !== options.today) return [];
  if (actionClassOf('autoMode.apply', options.classes) !== 'local') return [];

  const settledBy = options.nowMs - (options.settleMs ?? AUTO_DESCRIPTION_SETTLE_MS);
  const answered = new Set(options.answers.map((answer) => answer.rowId));
  const asked = new Set<string>();

  return options.rows.filter((row) => {
    const id = autoDescriptionRowId(row);

    if (answered.has(id) || asked.has(id)) return false;
    if (!row.issueKey || row.hidden || row.unattended || row.excluded || row.state === 'rejected') return false;
    if (!isCodeRow(row) || row.to.getTime() > settledBy) return false;
    if (!mayAutoWrite(rowFieldSourceOf(row, 'description'))) return false;

    asked.add(id);

    return true;
  });
};

/**
 * The masked payload the worklog call is sent for a row: its checkout's name, its length, its ticket
 * and the wording its own quotable evidence carries. `issueSummary` is the ticket's title, where Jira
 * could be read.
 */
export const autoDescriptionRequest = (options: {
  row: Pick<ReviewedRow, 'laneKey' | 'observedMs' | 'evidence' | 'issueKey'>;
  issueSummary?: string;
  maskedNames?: readonly string[];
  maxNotes?: number;
}): WorklogWritingRequest => {
  const { row } = options;
  const map = pseudonymMap(options.maskedNames ?? []);
  const notes: string[] = [];

  for (const entry of row.evidence) {
    const note = QUOTABLE_EVIDENCE_KINDS.includes(entry.kind) ? (entry.summary ?? entry.detail) : undefined;

    if (note && !notes.includes(note)) notes.push(note);
  }

  const summary = options.issueSummary?.trim();

  return {
    ...(row.laneKey ? { repo: maskNames({ text: streamKeyLabel(row.laneKey), map }) } : {}),
    minutes: Math.round(row.observedMs / 60_000),
    issue: {
      key: maskIssueKey({ issueKey: row.issueKey ?? '', map }),
      ...(summary ? { summary: maskNames({ text: summary, map }) } : {}),
    },
    notes: notes.slice(0, options.maxNotes ?? DEFAULT_MAX_TICKET_NOTES).map((note) => maskNames({ text: note, map })),
  };
};

const storedDescriptionSource = (edits: DayReviewEdits, id: string) => {
  const pinned = edits.pinned.find((entry) => entry.id === id);

  if (pinned) return storedSourceOf({ set: !!pinned.description, source: pinned.sources?.description });

  const override = edits.overrides[id];

  return storedSourceOf({ set: override?.description !== undefined, source: override?.sources?.description });
};

/**
 * Stores what auto mode answered for a row and writes its description as `auto`. The source is read
 * from the edits the answer lands on, so a description the user wrote while the call ran is kept.
 */
export const withAutoModeDescription = (options: {
  edits: DayReviewEdits;
  row: ReviewedRow;
  answer: AutoModeDescription;
}): DayReviewEdits => {
  const { edits, row, answer } = options;
  const stored: DayReviewEdits = {
    ...edits,
    autoDescriptions: [...(edits.autoDescriptions ?? []).filter((held) => held.rowId !== answer.rowId), answer],
  };
  const description = answer.description?.trim();

  if (!description) return stored;

  const source = storedDescriptionSource(edits, answer.rowId);

  return setRowDescription({
    edits: stored,
    row: { ...row, sources: { ...row.sources, description: source } },
    description,
    source: 'auto',
  });
};

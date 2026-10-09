import { ActionClasses, actionClassOf } from '../agent-api/action-classes';
import { streamKeyLabel, streamKeyRepoPath } from '../model/block';
import { isAcknowledgement } from '../model/acknowledgement';
import { QUOTABLE_EVIDENCE_KINDS } from '../model/evidence';
import { mayAutoWrite, rowFieldSourceOf, storedSourceOf } from '../model/field-source';
import { maskIssueKey, maskNames, pseudonymMap } from '../reason/pseudonym';
import { DEFAULT_MAX_TICKET_NOTES } from '../ticket/draft';
import { WorklogWritingRequest } from '../ticket/worklog';
import { projectKeyOf } from '../ticket/project';
import { shiftDayKey } from './day';
import { setRowDescription } from './edits';
import { AutoModeDescription, DayReviewEdits, ReviewedRow } from './model';

/**
 * How long work has to be quiet before auto mode asks about it: 30 minutes past a row's end, or past the
 * last activity of its own session where it has a piece. It gates a row's description and an unnamed
 * context's ticket alike.
 */
export const AUTO_MODE_SETTLE_MS = 30 * 60_000;

/** The id auto mode keys a row's description by: the id an edit to the row is written against. */
export const autoDescriptionRowId = (row: Pick<ReviewedRow, 'id' | 'recutOf'>) => row.recutOf ?? row.id;

const isCodeRow = (row: Pick<ReviewedRow, 'laneKey'>) => !!row.laneKey && !!streamKeyRepoPath(row.laneKey);

/** The wording a row's quotable evidence lends a prompt, each note once, acknowledgements left out. */
export const quotableNotesOf = (evidence: ReviewedRow['evidence']) => {
  const notes: string[] = [];

  for (const entry of evidence) {
    const note = QUOTABLE_EVIDENCE_KINDS.includes(entry.kind) ? entry.summary?.trim() : undefined;

    if (note && !isAcknowledgement(note) && !notes.includes(note)) notes.push(note);
  }

  return notes;
};

const sameNotes = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((note, index) => note === right[index]);

/** How many days back a day that is over may still have its tickets described. */
export const AUTO_DESCRIPTION_PAST_DAYS = 7;

/**
 * What auto mode describes in one call: a single row, keyed by {@link autoDescriptionRowId}, or every
 * row of one ticket of a day that is over, keyed `ticket:<key>`.
 */
export type AutoDescriptionAsk = { id: string; rows: ReviewedRow[] };

/** The answer id of the call that describes every row of one ticket on a day. */
export const autoDescriptionTicketId = (issueKey: string) => `ticket:${issueKey}`;

/**
 * Whether a row's ticket is one the whole day books on rather than this stretch's own: a standing rule
 * named it, or its project is a background project. Such rows are described once, together.
 */
export const describedPerTicket = (options: {
  row: Pick<ReviewedRow, 'issueKey' | 'evidence' | 'sources'>;
  backgroundProjects?: readonly string[];
}) => {
  const { row } = options;
  const project = row.issueKey ? projectKeyOf(row.issueKey) : undefined;
  const background = (options.backgroundProjects ?? []).some((key) => key.trim().toUpperCase() === project);
  const ruled =
    rowFieldSourceOf(row, 'issue') === 'observed' && row.evidence.some((entry) => entry.kind === 'attribution-rule');

  return !!project && (background || ruled);
};

/**
 * What auto mode still has to describe on a day: settled code rows that name an issue, whose
 * description the user did not write, and that hold notes no answer was asked from yet: an ask whose
 * notes changed since its answer is asked again, and one with none is not asked. A row whose ticket a
 * rule or a background project names ({@link describedPerTicket}) waits until its day is over, and is
 * then asked once per ticket with the notes of all its rows, on a day at most
 * {@link AUTO_DESCRIPTION_PAST_DAYS} back that Tempo holds nothing of yet (`heldByTempo` false). Any
 * other row is asked on today only. Nothing while auto mode is off, and nothing where the user made
 * `autoMode.apply` stricter than `local`.
 */
export const autoDescriptionAsks = (options: {
  enabled: boolean;
  day: string;
  today: string;
  nowMs: number;
  classes: ActionClasses;
  rows: readonly ReviewedRow[];
  answers: readonly AutoModeDescription[];
  /** The names the requests are masked with, so a held answer's notes compare to the row's own. */
  maskedNames?: readonly string[];
  settleMs?: number;
  backgroundProjects?: readonly string[];
  /** Whether Tempo holds work on the day. Absent or `null` while unknown, which asks no ticket. */
  heldByTempo?: boolean | null;
}): AutoDescriptionAsk[] => {
  if (!options.enabled || actionClassOf('autoMode.apply', options.classes) !== 'local') return [];

  const isToday = options.day === options.today;
  const isOver = options.day < options.today && options.day >= shiftDayKey(options.today, -AUTO_DESCRIPTION_PAST_DAYS);

  if (!isToday && !(isOver && options.heldByTempo === false)) return [];

  const settledBy = options.nowMs - (options.settleMs ?? AUTO_MODE_SETTLE_MS);
  const answered = new Map(options.answers.map((answer) => [answer.rowId, answer.request.notes]));
  const describable = options.rows.filter(
    (row) =>
      !!row.issueKey &&
      !row.hidden &&
      !row.unattended &&
      !row.excluded &&
      row.state !== 'rejected' &&
      isCodeRow(row) &&
      Math.max(row.to.getTime(), row.activeUntil?.getTime() ?? 0) <= settledBy &&
      mayAutoWrite(rowFieldSourceOf(row, 'description')),
  );
  const asks = new Map<string, ReviewedRow[]>();

  for (const row of describable) {
    const perTicket = describedPerTicket({ row, backgroundProjects: options.backgroundProjects });

    if (perTicket ? !isOver : !isToday) continue;

    const id = perTicket ? autoDescriptionTicketId(row.issueKey ?? '') : autoDescriptionRowId(row);

    if (!perTicket && asks.has(id)) continue;

    asks.set(id, [...(asks.get(id) ?? []), row]);
  }

  return [...asks].flatMap(([id, rows]) => {
    const { notes } = autoDescriptionRequest({ rows, maskedNames: options.maskedNames });
    const heldNotes = answered.get(id);

    return notes.length === 0 || (heldNotes && sameNotes(heldNotes, notes)) ? [] : [{ id, rows }];
  });
};

const sameLabel = (rows: readonly Pick<ReviewedRow, 'laneKey'>[]) => {
  const labels = new Set(rows.map((row) => (row.laneKey ? streamKeyLabel(row.laneKey) : '')));

  return labels.size === 1 ? [...labels][0] : undefined;
};

/**
 * The masked payload the worklog call is sent for an ask: its checkout's name where all its rows share
 * one, their length, their ticket and the wording their own quotable evidence carries, the longest
 * row's first. `issueSummary` is the ticket's title, where Jira could be read.
 */
export const autoDescriptionRequest = (options: {
  rows: readonly Pick<ReviewedRow, 'laneKey' | 'observedMs' | 'evidence' | 'issueKey'>[];
  issueSummary?: string;
  maskedNames?: readonly string[];
  maxNotes?: number;
}): WorklogWritingRequest => {
  const rows = [...options.rows].sort((left, right) => right.observedMs - left.observedMs);
  const map = pseudonymMap(options.maskedNames ?? []);
  const notes = [...new Set(rows.flatMap((row) => quotableNotesOf(row.evidence)))];
  const summary = options.issueSummary?.trim();
  const repo = sameLabel(rows);

  return {
    ...(repo ? { repo: maskNames({ text: repo, map }) } : {}),
    minutes: Math.round(rows.reduce((sum, row) => sum + row.observedMs, 0) / 60_000),
    issue: {
      key: maskIssueKey({ issueKey: rows[0]?.issueKey ?? '', map }),
      ...(summary ? { summary: maskNames({ text: summary, map }) } : {}),
    },
    notes: notes.slice(0, options.maxNotes ?? DEFAULT_MAX_TICKET_NOTES).map((note) => maskNames({ text: note, map })),
  };
};

/** Who wrote the description the edits hold for a row, or `observed` where none is stored. */
export const storedDescriptionSource = (edits: DayReviewEdits, id: string) => {
  const pinned = edits.pinned.find((entry) => entry.id === id);

  if (pinned) return storedSourceOf({ set: !!pinned.description, source: pinned.sources?.description });

  const override = edits.overrides[id];

  return storedSourceOf({ set: override?.description !== undefined, source: override?.sources?.description });
};

/**
 * Stores what auto mode answered for an ask and writes its description as `auto` on each of its rows.
 * The source is read from the edits the answer lands on, so a description the user wrote while the call
 * ran is kept.
 */
export const withAutoModeDescription = (options: {
  edits: DayReviewEdits;
  rows: readonly ReviewedRow[];
  answer: AutoModeDescription;
}): DayReviewEdits => {
  const { edits, rows, answer } = options;
  const rowIds = rows.map(autoDescriptionRowId);
  const held: AutoModeDescription = rowIds.length === 1 && rowIds[0] === answer.rowId ? answer : { ...answer, rowIds };
  const stored: DayReviewEdits = {
    ...edits,
    autoDescriptions: [...(edits.autoDescriptions ?? []).filter((entry) => entry.rowId !== answer.rowId), held],
  };
  const description = answer.description?.trim();

  if (!description) return stored;

  return rows.reduce(
    (written, row) =>
      setRowDescription({
        edits: written,
        row: {
          ...row,
          sources: { ...row.sources, description: storedDescriptionSource(edits, autoDescriptionRowId(row)) },
        },
        description,
        source: 'auto',
      }),
    stored,
  );
};

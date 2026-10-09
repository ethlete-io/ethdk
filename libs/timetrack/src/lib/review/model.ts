import { DayRows } from '../rows/build-rows';
import { BehindStretch } from '../rows/cut';
import { DayCheck } from '../rows/round';
import { Confidence, Evidence } from '../model/evidence';
import { PresenceStatement } from '../model/statement';
import { WorklogProposal } from '../model/proposal';
import { RowFieldSources } from '../model/field-source';
import { TicketWritingRequest } from '../ticket/write';
import { WorklogWritingRequest } from '../ticket/worklog';
import { DisputeAnswer, DisputeResolvingRequest } from '../ticket/dispute';

/** The fields a reviewer can change on a machine-proposed row, keyed by the proposal's id. */
export type ProposalOverride = {
  issueKey?: string;
  /**
   * The lane the row was in when the reviewer named it, so a later read can tell which lane a naming
   * belongs to. A proposal id holds no lane of its own for a row no checkout is behind — a call, a
   * meeting — and `laneIssueUses` is what reads this back.
   */
  laneKey?: string;
  /**
   * The stand-in the reviewer named the row with, while Jira holds no issue for the work. It sits
   * beside an absent `issueKey` rather than in it, so the row is still not one a sync can write.
   */
  standInId?: string;
  description?: string;
  /** An explicit review decision. Without one, the row's confidence decides whether it syncs. */
  state?: 'accepted' | 'rejected';
  /** Whether the reviewer took this row off the timeline. See {@link DayReview.hidden}. */
  hidden?: boolean;
  /** Who set each field this override holds. A field set without one is the user's. */
  sources?: RowFieldSources;
};

/**
 * A row the reviewer built by splitting, merging, moving or adding, stored whole because nothing the
 * engine produces corresponds to it. It replaces the proposals in `replaces`, which are dropped from a
 * re-correlation.
 */
export type PinnedRow = {
  id: string;
  /**
   * Proposal ids this row was built from. Empty for a row the reviewer added by hand, which stands in
   * for nothing the engine ever proposed — `addManualRow` is the only thing that writes one.
   */
  replaces: string[];
  /**
   * Absent right after a cut, before either half has been named. An unnamed row is a legal state and
   * never syncs — a split has to be able to leave both halves waiting for an answer.
   */
  issueKey?: string;
  /** The stand-in naming the row, while Jira holds no issue for the work. See `StandIn`. */
  standInId?: string;
  storyKey?: string;
  from: Date;
  to: Date;
  durationMs: number;
  observedMs: number;
  /** The lane the row was cut out of, so a cut keeps its checkout's column on the day screen. */
  laneKey?: string;
  /** True where the day's own row still decides this end. See {@link PinnedRow.tracksTo}. */
  tracksFrom?: boolean;
  /**
   * True where the day's own row still decides this end. A drag pins only the end it moved, so
   * dragging a row's start leaves its end following a day that is still being worked. A pin holds:
   * once an end is false, a later drag at the other end never sets it back to true.
   */
  tracksTo?: boolean;
  /**
   * Where the row ended before `endRowAt` cut it off its call, in epoch milliseconds: only such an end
   * is handed back by `followCallAgain`, and never shorter than this. A later edit of the row drops it.
   */
  snippedFromMs?: number;
  description: string;
  confidence: Confidence;
  evidence: Evidence[];
  /** `undefined` leaves the decision to `edited`; a reviewer can still reject a row they built. */
  state?: 'accepted' | 'rejected';
  /** Whether the reviewer took this row off the timeline. See {@link DayReview.hidden}. */
  hidden?: boolean;
  /**
   * What the band this row was built from is, which the reviewer's edit does not change: a rule said
   * the room is not work, or nobody was at the machine. Stored rather than re-read off the day,
   * because a split leaves two rows and only one of them can still match a band the engine produces.
   * See {@link WorklogProposal.excluded} and {@link WorklogProposal.unattended}.
   */
  excluded?: boolean;
  unattended?: boolean;
  workedOn?: string;
  withheldIssueKey?: string;
  /** Who set each field. A field holding a value without one is the user's. */
  sources?: RowFieldSources;
};

/**
 * Everything a reviewer changed about one day. The engine's own output is stored alongside it only once
 * Tempo holds the day: see {@link DayReviewEdits.frozenRows}.
 */
export type DayReviewEdits = {
  overrides: Record<string, ProposalOverride>;
  pinned: PinnedRow[];
  /** What the reviewer said the day's stretches were. See {@link PresenceStatement}. */
  statements: PresenceStatement[];
  /** What auto mode asked about this day and what it answered, one entry per band or stand-in. */
  auto?: AutoModeAnswer[];
  /** The descriptions auto mode wrote for this day's settled code rows, one entry per row it asked about. */
  autoDescriptions?: AutoModeDescription[];
  /** What auto mode answered for this day's disputed bands, one entry per band and pair of answers. */
  autoDisputes?: AutoModeDispute[];
  /**
   * The engine's rows as they stood when Tempo first held the finished day, from `withFrozenRows`.
   * `reviewDay` reads these instead of the rows it is handed, so a model change never re-cuts a booked day.
   */
  frozenRows?: DayRows;
};

/** What auto mode asks about: an unnamed context of the day, or an open stand-in the day holds. */
export type AutoModeSubject = { kind: 'context'; contextId: string } | { kind: 'stand-in'; standInId: string };

/**
 * What the model answered. A `draft` is the ticket auto mode queued for the user's approval;
 * `approvalId` names the queue item and `createdKey` the issue its approval filed.
 */
export type AutoModeOutcome =
  | {
      kind: 'match';
      issueKey: string;
      reason?: string;
      /** Jira had the issue in its done category when the answer came, so auto mode never applies it. */
      done?: boolean;
      /** The issue is a parent in the project's issues, so auto mode never applies it without an approval. */
      parent?: boolean;
      summary?: string;
      /** Only the offered list named the issue, never the evidence, so auto mode never applies it without an approval. */
      listOnly?: boolean;
    }
  | {
      kind: 'draft';
      summary: string;
      description: string;
      projectKey?: string;
      parentKey?: string;
      approvalId?: string;
      createdKey?: string;
      /** The issue the answer this draft replaced named. Rows auto mode named with it lose it until the create is approved. */
      supersededKey?: string;
    }
  | { kind: 'failed' };

export type AutoModeAnswer = {
  subject: AutoModeSubject;
  askedAtMs: number;
  /** The masked payload that left the machine: what the "Ask AI" press would have shown. */
  request: TicketWritingRequest;
  outcome: AutoModeOutcome;
};

/** The other answer of a disputed band: the issue or the stand-in a second rung named. */
export type DisputedTarget = { kind: 'issue'; issueKey: string } | { kind: 'stand-in'; standInId: string };

/**
 * What auto mode asked for one disputed band: the key the band booked, the other answer, and what the
 * model chose. A run that failed holds no `answer`, and is not asked again.
 */
export type AutoModeDispute = {
  rowId: string;
  askedAtMs: number;
  booked: string;
  other: DisputedTarget;
  /** The masked payload that left the machine. */
  request: DisputeResolvingRequest;
  answer?: DisputeAnswer;
  /** The issue keys of the pair Jira had in its done category when the answer came. Auto mode never applies one. */
  doneKeys?: string[];
};

/** What auto mode asked for one settled row. A run that failed holds no `description`, and is not asked again. */
export type AutoModeDescription = {
  rowId: string;
  askedAtMs: number;
  /** The masked payload that left the machine. */
  request: WorklogWritingRequest;
  description?: string;
};

export const EMPTY_DAY_REVIEW_EDITS: DayReviewEdits = { overrides: {}, pinned: [], statements: [] };

/** A worklog row as the review UI shows it: the engine's proposal with any local edit applied. */
export type ReviewedRow = Omit<WorklogProposal, 'issueKey'> & {
  /** Absent on a row a cut left unnamed. Such a row is shown and never written. */
  issueKey?: string;
  /** The stand-in naming the row, while Jira holds no issue for the work. See `StandIn`. */
  standInId?: string;
  /** True when a local edit produced this row, so re-correlation must leave it alone. */
  edited: boolean;
  /**
   * The row this one was cut out of, where the day's re-cut split a background row a foreground row
   * sits inside. An edit on any piece is written against this id, so naming one half names the work
   * both halves are, and a piece the next re-cut does not produce leaves nothing dangling behind.
   */
  recutOf?: string;
  /**
   * The single-increment rows the day folded into this one. They are gone from the day, so an edit
   * that restructures this row has to replace them along with it.
   */
  folded?: string[];
  /** What the engine proposed before the edit, when there is still a proposal to reset to. */
  proposed?: WorklogProposal;
  /** Whether the reviewer took this row off the timeline. See {@link DayReview.hidden}. */
  hidden: boolean;
  /** The remote time the row draws and does not book, when there is any. See ADR 0033. */
  unbookedMs?: number;
  /** Who set each field. A field absent here holds what the engine observed. See `rowFieldSourceOf`. */
  sources?: RowFieldSources;
};

/** A row that names an issue. It is the only kind a sync writes, and the only kind Tempo can take. */
export type NamedRow = ReviewedRow & { issueKey: string };

/** Whether a row names an issue. A row a cut left unnamed is shown, counted as undecided, never written. */
export const isNamedRow = (row: ReviewedRow): row is NamedRow => !!row.issueKey;

/**
 * Whether a row waits on a stand-in rather than on the reviewer. Such a row is shown and never
 * written, like any unnamed row, and it is not one the day still has to ask about.
 */
export const isStandInRow = (row: Pick<ReviewedRow, 'issueKey' | 'standInId'>) => !row.issueKey && !!row.standInId;

export type DayReview = {
  /** The rows on the timeline. A hidden row is not among them — read {@link DayReview.hidden} for those. */
  rows: ReviewedRow[];
  /**
   * The rows the reviewer took off the timeline, newest decision last.
   *
   * A hidden row is neither written nor counted as unattributed: this list is where its time went, and
   * the only way back. Hiding is the undo-able form of throwing a row away, which is why nothing
   * deletes a proposal outright.
   */
  hidden: ReviewedRow[];
  /**
   * The stretches a background row lost, drawn behind the rows that took them. The machine's own cut
   * with the reviewer's edits cut into it, so a resized meeting moves the band beside it.
   */
  behind: BehindStretch[];
  check: DayCheck;
  /**
   * Observed time inside the proposals a local edit replaced that the edited rows no longer account
   * for — new evidence arriving under a row you already split or merged. Never silently absorbed.
   */
  unreconciledMs: number;
};

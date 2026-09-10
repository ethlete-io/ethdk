import { DayCheck } from '../rows/round';
import { Confidence, Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';

/** The fields a reviewer can change on a machine-proposed row, keyed by the proposal's id. */
export type ProposalOverride = {
  issueKey?: string;
  description?: string;
  durationMs?: number;
  /** An explicit review decision. Without one, the row's confidence decides whether it syncs. */
  state?: 'accepted' | 'rejected';
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
  storyKey?: string;
  from: Date;
  to: Date;
  durationMs: number;
  observedMs: number;
  description: string;
  confidence: Confidence;
  evidence: Evidence[];
  /** `undefined` leaves the decision to `edited`; a reviewer can still reject a row they built. */
  state?: 'accepted' | 'rejected';
};

/** Everything a reviewer changed about one day. The engine's own output is never stored alongside it. */
export type DayReviewEdits = {
  overrides: Record<string, ProposalOverride>;
  pinned: PinnedRow[];
};

export const EMPTY_DAY_REVIEW_EDITS: DayReviewEdits = { overrides: {}, pinned: [] };

/** A worklog row as the review UI shows it: the engine's proposal with any local edit applied. */
export type ReviewedRow = Omit<WorklogProposal, 'issueKey'> & {
  /** Absent on a row a cut left unnamed. Such a row is shown and never written. */
  issueKey?: string;
  /** True when a local edit produced this row, so re-correlation must leave it alone. */
  edited: boolean;
  /** What the engine proposed before the edit, when there is still a proposal to reset to. */
  proposed?: WorklogProposal;
};

/** A row that names an issue. It is the only kind a sync writes, and the only kind Tempo can take. */
export type NamedRow = ReviewedRow & { issueKey: string };

/** Whether a row names an issue. A row a cut left unnamed is shown, counted as undecided, never written. */
export const isNamedRow = (row: ReviewedRow): row is NamedRow => !!row.issueKey;

export type DayReview = {
  rows: ReviewedRow[];
  check: DayCheck;
  /**
   * Observed time inside the proposals a local edit replaced that the edited rows no longer account
   * for — new evidence arriving under a row you already split or merged. Never silently absorbed.
   */
  unreconciledMs: number;
};

import { DayCheck } from '../correlate/round';
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
 * A row the reviewer built by splitting or merging, stored whole because nothing the engine produces
 * corresponds to it. It replaces the proposals in `replaces`, which are dropped from a re-correlation.
 */
export type PinnedRow = {
  id: string;
  /** Proposal ids this row was built from. Never empty — a pinned row always comes from a proposal. */
  replaces: string[];
  issueKey: string;
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
export type ReviewedRow = WorklogProposal & {
  /** True when a local edit produced this row, so re-correlation must leave it alone. */
  edited: boolean;
  /** What the engine proposed before the edit, when there is still a proposal to reset to. */
  proposed?: WorklogProposal;
};

export type DayReview = {
  rows: ReviewedRow[];
  check: DayCheck;
  /**
   * Observed time inside the proposals a local edit replaced that the edited rows no longer account
   * for — new evidence arriving under a row you already split or merged. Never silently absorbed.
   */
  unreconciledMs: number;
};

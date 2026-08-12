export type EvidenceKind =
  | 'branch'
  | 'inherited-branch'
  | 'commit'
  | 'agent-session'
  | 'merge-request'
  | 'issue-view'
  | 'tempo-history'
  | 'window-title'
  | 'calendar'
  | 'timer';

/**
 * One concrete observation behind a block or a proposal. `detail` is shown verbatim in the review
 * UI, so it has to read as something the user can recognise ("17 commits on `feat/FIP-2177-…`"),
 * not as an internal identifier.
 */
export type Evidence = {
  kind: EvidenceKind;
  at: Date;
  detail: string;
  /**
   * The wording this observation lends to a worklog description, when it has any — a commit
   * subject, an agent session's title. Kept apart from `detail` so building a description never
   * has to parse a string written for the UI.
   */
  summary?: string;
};

export type Confidence = 'certain' | 'likely' | 'weak';

const CONFIDENCE_RANK: Record<Confidence, number> = { weak: 0, likely: 1, certain: 2 };

/** Orders confidence from `weak` to `certain`, for picking the strongest of several candidates. */
export const compareConfidence = (a: Confidence, b: Confidence) => CONFIDENCE_RANK[a] - CONFIDENCE_RANK[b];

/** `certain` and `likely` sync without per-row review; `weak` never syncs until it is accepted. */
export const syncsWithoutReview = (confidence: Confidence) => confidence !== 'weak';

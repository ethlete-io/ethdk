import { JiraIssue } from '../jira/issue';

/** A word this short carries no meaning to match on, in either English or German. */
const MIN_TOKEN_LENGTH = 3;

export type ParentCandidate = {
  issue: JiraIssue;
  /** How much wording the issue shares with the draft, from 0 to 1. */
  score: number;
};

const tokensOf = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= MIN_TOKEN_LENGTH),
  );

/** Dice coefficient: shared words against the size of both sides, so a long summary is not punished. */
const similarity = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (!a.size || !b.size) return 0;

  let shared = 0;

  for (const token of a) {
    if (b.has(token)) shared++;
  }

  return (2 * shared) / (a.size + b.size);
};

/**
 * Orders the open issues of a project by how much wording they share with the draft.
 *
 * The sort is stable and the caller passes the issues in Jira's own `updated DESC` order, so two
 * issues that share nothing with the draft — the usual case — stay in recency order. That is what
 * makes an empty match still a useful list rather than an arbitrary one.
 */
export const rankParentCandidates = (options: { summary: string; issues: readonly JiraIssue[] }): ParentCandidate[] => {
  const draft = tokensOf(options.summary);

  return options.issues
    .map((issue) => ({ issue, score: similarity(draft, tokensOf(issue.summary)) }))
    .sort((a, b) => b.score - a.score);
};

/** How much wording a parent must share with the draft before the form fills it in by itself. */
export const MIN_PARENT_SUGGESTION_SCORE = 0.3;

/** How far ahead of the runner-up the leader must be. Two near-equal matches are a question. */
export const MIN_PARENT_SUGGESTION_LEAD = 0.1;

/**
 * The parent the form starts on, or nothing when the ranking cannot say.
 *
 * A leader that only just beats the next issue is not an answer, it is a coin toss — and a coin toss
 * pre-filled reads as a decision the user made. The whole ranked list stays under the field either
 * way, so a suggestion that is wrong costs one click.
 */
export const suggestParentKey = (candidates: readonly ParentCandidate[]) => {
  const [leader, runnerUp] = candidates;

  if (!leader || leader.score < MIN_PARENT_SUGGESTION_SCORE) return undefined;
  if (runnerUp && leader.score - runnerUp.score < MIN_PARENT_SUGGESTION_LEAD) return undefined;

  return leader.issue.key;
};

/** How much wording an open issue must share with the draft before it is offered as the same work. */
export const MIN_EXISTING_ISSUE_SCORE = 0.4;

/** How many are offered. A list of maybes is a list nobody reads to the end. */
export const DEFAULT_MAX_EXISTING_ISSUES = 3;

/**
 * The open issues that may already be this work, best first.
 *
 * Filing a second ticket for something the backlog already holds is the expensive mistake here: the
 * duplicate is somebody else's to notice, and the time lands on the wrong key until they do. The bar
 * is higher than the parent suggestion's, because this offer asks the user to abandon their draft.
 */
export const matchExistingIssues = (options: {
  summary: string;
  issues: readonly JiraIssue[];
  max?: number;
}): ParentCandidate[] =>
  rankParentCandidates({ summary: options.summary, issues: options.issues })
    .filter((candidate) => candidate.score >= MIN_EXISTING_ISSUE_SCORE)
    .slice(0, options.max ?? DEFAULT_MAX_EXISTING_ISSUES);

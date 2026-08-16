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

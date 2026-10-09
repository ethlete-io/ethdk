import { DEFAULT_OPEN_ISSUE_LIMIT } from '../jira/candidates';
import { JiraIssue } from '../jira/issue';

/** An issue the work could already be. `inEpic` marks an open child of an epic the checkout works in. */
export type TicketCandidate = JiraIssue & { inEpic?: true };

const keyOf = (issue: JiraIssue) => issue.key.toUpperCase();

const keysOf = (issues: readonly JiraIssue[]) => new Set(issues.map(keyOf));

const uniqueByKey = <T extends JiraIssue>(issues: readonly T[]) =>
  issues.filter((issue, index) => issues.findIndex((other) => keyOf(other) === keyOf(issue)) === index);

/**
 * The issues a ticket call may name as the work: `open` in its own order, `limit` of them, then the
 * issues the user logged on. Each key once, no sub-task.
 */
export const ticketMatchCandidates = (options: {
  open: readonly TicketCandidate[];
  logged: readonly JiraIssue[];
  limit?: number;
}): TicketCandidate[] => {
  const open = uniqueByKey(options.open.filter((issue) => !issue.isSubtask)).slice(
    0,
    options.limit ?? DEFAULT_OPEN_ISSUE_LIMIT,
  );
  const listed = keysOf(open);

  return [...open, ...uniqueByKey(options.logged.filter((issue) => !listed.has(keyOf(issue))))];
};

/** The parents of `issues`, each once, in the order the issues came. A sub-task's parent is not an epic. */
export const epicKeysOfIssues = (issues: readonly JiraIssue[]) => [
  ...new Set(issues.flatMap((issue) => (!issue.isSubtask && issue.parentKey ? [issue.parentKey.toUpperCase()] : []))),
];

import { DEFAULT_EPIC_CHILD_CANDIDATE_LIMIT, DEFAULT_OPEN_ISSUE_LIMIT } from '../jira/candidates';
import { JiraIssue } from '../jira/issue';
import { projectKeyOf } from './project';

/** An issue the work could already be. `inEpic` marks an open child of an epic the checkout works in. */
export type TicketCandidate = JiraIssue & { inEpic?: true };

const keyOf = (issue: JiraIssue) => issue.key.toUpperCase();

const keysOf = (issues: readonly JiraIssue[]) => new Set(issues.map(keyOf));

const uniqueByKey = <T extends JiraIssue>(issues: readonly T[]) =>
  issues.filter((issue, index) => issues.findIndex((other) => keyOf(other) === keyOf(issue)) === index);

/**
 * The issues a ticket call may name as the work: the open children of the checkout's epics first, then
 * the project's open issues, `limit` of both together, then the issues the user logged on. Each key
 * once, no sub-task, and no epic child outside `projectKey`.
 */
export const ticketMatchCandidates = (options: {
  projectKey?: string;
  epic?: readonly JiraIssue[];
  open: readonly JiraIssue[];
  logged: readonly JiraIssue[];
  epicLimit?: number;
  limit?: number;
}): TicketCandidate[] => {
  const projectKey = options.projectKey?.trim().toUpperCase();
  const limit = options.limit ?? DEFAULT_OPEN_ISSUE_LIMIT;
  const epic = uniqueByKey(
    (options.epic ?? []).filter((issue) => !issue.isSubtask && (!projectKey || projectKeyOf(issue.key) === projectKey)),
  )
    .slice(0, Math.min(limit, options.epicLimit ?? DEFAULT_EPIC_CHILD_CANDIDATE_LIMIT))
    .map((issue): TicketCandidate => ({ ...issue, inEpic: true }));
  const open = uniqueByKey(options.open.filter((issue) => !issue.isSubtask && !keysOf(epic).has(keyOf(issue)))).slice(
    0,
    limit - epic.length,
  );
  const listed = keysOf([...epic, ...open]);

  return [...epic, ...open, ...uniqueByKey(options.logged.filter((issue) => !listed.has(keyOf(issue))))];
};

/** The parents of `issues`, each once, in the order the issues came. A sub-task's parent is not an epic. */
export const epicKeysOfIssues = (issues: readonly JiraIssue[]) => [
  ...new Set(issues.flatMap((issue) => (!issue.isSubtask && issue.parentKey ? [issue.parentKey.toUpperCase()] : []))),
];

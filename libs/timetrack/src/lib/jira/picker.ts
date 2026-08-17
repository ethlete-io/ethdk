import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssue, toJiraIssue } from './issue';
import { searchJiraIssues$ } from './search';

/** How many issues a picker reads. A list longer than this is one nobody scrolls to the end of. */
export const DEFAULT_JIRA_PICKER_LIMIT = 100;

/** What narrows the issues a picker offers. Everything is optional, and each part narrows further. */
export type JiraIssuePickerFilter = {
  /** The projects to read. Empty reads every project the token can see, which is rarely what a user wants. */
  projectKeys?: readonly string[];
  /** Free text, matched against the issues' own wording. A key is not text — type it instead. */
  text?: string;
  /** Only the issues the token's own account is assigned. */
  assignedToMe?: boolean;
  /** Whether to include issues that are already done. Off, because today's work is rarely one of them. */
  includeDone?: boolean;
  limit?: number;
};

/** A project key, a type name and typed text all reach JQL as literals, and all three are user input. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The clauses the filter states, in the order JQL reads them. A filter that states nothing yields the
 * open issues of every project the token can see, ordered by recency.
 */
const jqlFor = (filter: JiraIssuePickerFilter) => {
  const projectKeys = (filter.projectKeys ?? []).map((key) => key.trim()).filter(Boolean);
  const text = filter.text?.trim();

  return [
    ...(projectKeys.length ? [`project in (${projectKeys.map(quoted).join(', ')})`] : []),
    ...(filter.includeDone ? [] : ['statusCategory != Done']),
    ...(filter.assignedToMe ? ['assignee = currentUser()'] : []),
    ...(text ? [`text ~ ${quoted(`${text}*`)}`] : []),
  ].join(' AND ');
};

/**
 * The issues a picker offers, most recently worked in first.
 *
 * One read for every issue field a picker shows, narrowed by whatever the user asked for. The recency
 * ordering is what makes the first page useful without any typing at all: the issue today's work
 * belongs to is nearly always one the account touched this week.
 *
 * A key the list does not hold is not this function's problem to solve. A picker that accepts a typed
 * key can always reach an issue nobody has touched in months, and searching for one by key is how a
 * text search over a hundred thousand issues turns into a call that times out.
 */
export const fetchJiraIssuePicks$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  filter?: JiraIssuePickerFilter;
  subjectField?: string;
}): Observable<JiraIssue[]> => {
  const filter = options.filter ?? {};
  const jql = jqlFor(filter);

  return searchJiraIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `${jql ? `${jql} ` : ''}ORDER BY updated DESC`,
    fields: ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])],
    describe: 'issues to pick from',
    options: { pageSize: filter.limit ?? DEFAULT_JIRA_PICKER_LIMIT, maxPages: 1 },
  }).pipe(map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])));
};

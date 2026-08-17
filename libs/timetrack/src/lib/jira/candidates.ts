import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssue, toJiraIssue } from './issue';
import { searchJiraIssues$ } from './search';

/** How many parents a picker offers. A list nobody scrolls is a list nobody reads. */
export const DEFAULT_PARENT_CANDIDATE_LIMIT = 30;

/** How many open issues the duplicate check reads. Wide enough that a real match is in it. */
export const DEFAULT_OPEN_ISSUE_LIMIT = 100;

/** A project key or a type name reaches JQL as a literal, and both are user input. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The open issues in one project, most recently active first.
 *
 * Only open ones: a done issue is not something today's work belongs to, and offering it is how a
 * closed epic quietly reopens. The ordering carries the recency the ranking then re-sorts by wording,
 * so a project with no textual match still offers what the user was last working in.
 */
export const fetchJiraOpenIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  /** The types to read, such as `Story` and `Epic`. Empty accepts any type. */
  issueTypeNames?: readonly string[];
  subjectField?: string;
  limit?: number;
}): Observable<JiraIssue[]> => {
  const types = (options.issueTypeNames ?? []).filter((name) => !!name.trim());
  const jql = [
    `project = ${quoted(options.projectKey)}`,
    'statusCategory != Done',
    ...(types.length ? [`issuetype in (${types.map(quoted).join(', ')})`] : []),
  ].join(' AND ');

  return searchJiraIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `${jql} ORDER BY updated DESC`,
    fields: ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])],
    describe: `open issues in ${options.projectKey}`,
    options: { pageSize: options.limit ?? DEFAULT_OPEN_ISSUE_LIMIT, maxPages: 1 },
  }).pipe(map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])));
};

/** The open issues a new ticket could roll up to: the same read, narrowed to the parent types. */
export const fetchJiraParentCandidates$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  /** The types that may be a parent, such as `Story` and `Epic`. Empty accepts any type. */
  issueTypeNames: readonly string[];
  subjectField?: string;
  limit?: number;
}): Observable<JiraIssue[]> =>
  fetchJiraOpenIssues$({ ...options, limit: options.limit ?? DEFAULT_PARENT_CANDIDATE_LIMIT });

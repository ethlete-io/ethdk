import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { projectKeyOf } from '../ticket/project';
import { JiraIssue, fetchJiraIssues$, toJiraIssue } from './issue';
import { searchJiraTopIssues$ } from './search';

/** How many parents a picker offers. A list nobody scrolls is a list nobody reads. */
export const DEFAULT_PARENT_CANDIDATE_LIMIT = 30;

/** How many open issues the duplicate check reads. Wide enough that a real match is in it. */
export const DEFAULT_OPEN_ISSUE_LIMIT = 100;

/** A project key or a type name reaches JQL as a literal, and both are user input. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The open issues in one project, most recently active first.
 *
 * Only open ones: offering a done issue as a parent is how a closed epic quietly reopens. The done
 * issues the user still logs on come from `fetchJiraLoggedIssues$`. The ordering carries the recency
 * the ranking then re-sorts by wording, so a project with no textual match still offers what the
 * user was last working in.
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

  return searchJiraTopIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `${jql} ORDER BY updated DESC`,
    fields: ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])],
    describe: `open issues in ${options.projectKey}`,
    limit: options.limit ?? DEFAULT_OPEN_ISSUE_LIMIT,
  }).pipe(map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])));
};

/**
 * The issues of one project among `loggedKeys`, whatever their status, in the order the keys came.
 *
 * Feed it the keys of the user's own Tempo history, newest first. An issue the user still logs time
 * on is work they hold to be open, even after Jira moved it to done.
 */
export const fetchJiraLoggedIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  loggedKeys: readonly string[];
  subjectField?: string;
}): Observable<JiraIssue[]> => {
  const projectKey = options.projectKey.trim().toUpperCase();
  const keys = [...new Set(options.loggedKeys.map((key) => key.trim().toUpperCase()))].filter(
    (key) => projectKeyOf(key) === projectKey,
  );

  return fetchJiraIssues$({ ...options, keys }).pipe(
    map((issues) => {
      const byKey = new Map(issues.map((issue) => [issue.key.toUpperCase(), issue]));

      return keys.flatMap((key) => byKey.get(key) ?? []);
    }),
  );
};

/**
 * The issues a new ticket could duplicate: every open issue, and every issue created in the last day
 * whatever its status, newest first. A create whose answer was lost is the newest issue even when the
 * project starts new issues in a done status or holds more open issues than one page.
 */
export const fetchJiraDuplicateCandidates$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  subjectField?: string;
  limit?: number;
}): Observable<JiraIssue[]> =>
  searchJiraTopIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `project = ${quoted(options.projectKey)} AND (statusCategory != Done OR created >= -1d) ORDER BY created DESC`,
    fields: ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])],
    describe: `open and new issues in ${options.projectKey}`,
    limit: options.limit ?? DEFAULT_OPEN_ISSUE_LIMIT,
  }).pipe(map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])));

/**
 * The open issues a new ticket could roll up to: the same read, narrowed to the parent types.
 *
 * Sub-tasks are dropped whatever the types say, because Jira accepts none of them as a parent.
 */
export const fetchJiraParentCandidates$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  /** The types that may be a parent, such as `Story` and `Epic`. Empty accepts any parent type. */
  issueTypeNames: readonly string[];
  subjectField?: string;
  limit?: number;
}): Observable<JiraIssue[]> =>
  fetchJiraOpenIssues$({ ...options, limit: options.limit ?? DEFAULT_PARENT_CANDIDATE_LIMIT }).pipe(
    map((issues) => issues.filter((issue) => !issue.isSubtask)),
  );

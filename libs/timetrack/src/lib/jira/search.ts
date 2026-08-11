import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

export type JiraIssueFields = Record<string, unknown> & {
  summary?: string;
  updated?: string;
  issuetype?: { name?: string };
  parent?: { key?: string };
};

export type JiraIssueResource = {
  id?: string;
  key?: string;
  fields?: JiraIssueFields;
};

type JiraSearchPage = {
  issues?: JiraIssueResource[];
  nextPageToken?: string;
};

export type JiraSearchOptions = {
  /** Issues per request. Jira caps this well below its old 1000. */
  pageSize: number;
  /** A runaway JQL must not page forever against a rate-limited API. */
  maxPages: number;
};

export const DEFAULT_JIRA_SEARCH_OPTIONS: JiraSearchOptions = {
  pageSize: 100,
  maxPages: 20,
};

/**
 * Pages `/rest/api/3/search/jql`. The older `/search` endpoint is gone, and its `startAt` paging
 * with it — this one is cursor-based and requires `fields` to be named explicitly.
 */
export const searchJiraIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  jql: string;
  fields: string[];
  describe: string;
  options?: Partial<JiraSearchOptions>;
}): Observable<JiraIssueResource[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_JIRA_SEARCH_OPTIONS, ...options.options };
  const page$ = (nextPageToken?: string) =>
    jiraRequest$<JiraSearchPage>({
      transport: options.transport,
      credentials: options.credentials,
      path: '/rest/api/3/search/jql',
      describe: options.describe,
      query: {
        jql: options.jql,
        fields: options.fields.join(','),
        maxResults: pageSize,
        nextPageToken,
      },
    });

  return page$().pipe(
    expand((page, index) => (page.nextPageToken && index < maxPages - 1 ? page$(page.nextPageToken) : EMPTY)),
    map((page) => page.issues ?? []),
    reduce((all: JiraIssueResource[], issues) => [...all, ...issues], []),
  );
};

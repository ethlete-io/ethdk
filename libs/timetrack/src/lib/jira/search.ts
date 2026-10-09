import { EMPTY, Observable, expand, map, reduce, throwError } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

export type JiraIssueFields = Record<string, unknown> & {
  summary?: string;
  updated?: string;
  issuetype?: { name?: string; subtask?: boolean };
  parent?: { key?: string; fields?: { summary?: string } };
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

type SearchRequest = {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  jql: string;
  fields: string[];
  describe: string;
};

const searchPage$ = (options: SearchRequest & { pageSize: number; nextPageToken?: string }) =>
  jiraRequest$<JiraSearchPage>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/search/jql',
    describe: options.describe,
    query: {
      jql: options.jql,
      fields: options.fields.join(','),
      maxResults: options.pageSize,
      nextPageToken: options.nextPageToken,
    },
  });

/**
 * Pages `/rest/api/3/search/jql`. The older `/search` endpoint is gone, and its `startAt` paging
 * with it — this one is cursor-based and requires `fields` to be named explicitly.
 *
 * Errors when Jira still offers a page after `maxPages`, so a caller never reads a truncated result as
 * complete. To read only the first issues of an ordered query, use {@link searchJiraTopIssues$}.
 */
export const searchJiraIssues$ = (
  options: SearchRequest & { options?: Partial<JiraSearchOptions> },
): Observable<JiraIssueResource[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_JIRA_SEARCH_OPTIONS, ...options.options };
  const page$ = (nextPageToken?: string) => searchPage$({ ...options, pageSize, nextPageToken });

  return page$().pipe(
    expand((page, index) => {
      if (!page.nextPageToken) return EMPTY;
      if (index >= maxPages - 1) {
        return throwError(() => new Error(`Jira offered more than ${maxPages} pages of ${options.describe}.`));
      }

      return page$(page.nextPageToken);
    }),
    map((page) => page.issues ?? []),
    reduce((all: JiraIssueResource[], issues) => [...all, ...issues], []),
  );
};

/** The first `limit` issues of a JQL search, in its own order, from a single request. */
export const searchJiraTopIssues$ = (options: SearchRequest & { limit: number }): Observable<JiraIssueResource[]> =>
  searchPage$({ ...options, pageSize: options.limit }).pipe(map((page) => page.issues ?? []));

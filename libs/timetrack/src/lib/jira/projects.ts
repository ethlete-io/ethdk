import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

/** A project a new ticket can be filed into. */
export type JiraProject = {
  key: string;
  name: string;
};

/** Projects per request. `/project/search` caps a page at 50 whatever is asked for. */
export const JIRA_PROJECT_PAGE_SIZE = 50;

/** An instance with hundreds of projects must not page forever against a rate-limited API. */
export const DEFAULT_JIRA_PROJECT_MAX_PAGES = 10;

type JiraProjectResource = {
  key?: string;
  name?: string;
};

type JiraProjectPage = {
  values?: JiraProjectResource[];
  isLast?: boolean;
  startAt?: number;
};

const toProject = (resource: JiraProjectResource): JiraProject[] =>
  resource.key ? [{ key: resource.key, name: resource.name ?? resource.key }] : [];

/**
 * The projects the token can file into, the most recently worked in first.
 *
 * `lastIssueUpdatedTime` puts the project the user has actually been in at the top, which is nearly
 * always the one a new ticket belongs to. A guessed key in a text field cannot do that, and a key
 * typed one character wrong is a ticket in a project nobody watches.
 */
export const fetchJiraProjects$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  maxPages?: number;
}): Observable<JiraProject[]> => {
  const maxPages = options.maxPages ?? DEFAULT_JIRA_PROJECT_MAX_PAGES;
  const page$ = (startAt: number) =>
    jiraRequest$<JiraProjectPage>({
      transport: options.transport,
      credentials: options.credentials,
      path: '/rest/api/3/project/search',
      describe: 'projects',
      query: { startAt, maxResults: JIRA_PROJECT_PAGE_SIZE, orderBy: '-lastIssueUpdatedTime' },
    });

  return page$(0).pipe(
    // An empty page ends the paging too: `isLast` is absent on some instances, and trusting it alone
    // would ask for the same offset forever.
    expand((page, index) => {
      const read = page.values?.length ?? 0;

      return page.isLast === false && read > 0 && index < maxPages - 1 ? page$((page.startAt ?? 0) + read) : EMPTY;
    }),
    map((page) => page.values ?? []),
    reduce((all: JiraProject[], values) => [...all, ...values.flatMap(toProject)], []),
  );
};

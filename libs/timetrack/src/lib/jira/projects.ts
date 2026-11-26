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

/** The projects the token can file into, the most recently updated first. */
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
    map((page) => ({ page, startAt: 0 })),
    expand(({ page, startAt }, index) => {
      const read = page.values?.length ?? 0;
      const more = page.isLast === false || (page.isLast === undefined && read >= JIRA_PROJECT_PAGE_SIZE);

      return more && read > 0 && index < maxPages - 1
        ? page$(startAt + read).pipe(map((next) => ({ page: next, startAt: startAt + read })))
        : EMPTY;
    }),
    map(({ page }) => page.values ?? []),
    reduce((all: JiraProject[], values) => [...all, ...values.flatMap(toProject)], []),
  );
};

import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, JiraRequestError, jiraRequest$ } from './client';

/** A status an issue can stand in, by the name Jira shows. */
export type JiraStatus = {
  id: string;
  name: string;
};

/** A move one issue can make right now, and the status it lands in. */
export type JiraTransition = {
  id: string;
  name: string;
  toStatusName: string;
};

/**
 * What a move did. `unavailable` means the workflow offers no transition to the named status, and
 * names the ones it does offer; `failed` means Jira refused the read or the move.
 */
export type JiraStatusMove =
  | { kind: 'moved'; statusName: string }
  | { kind: 'unavailable'; statusName: string; offered: string[] }
  /** Jira refused the read or the move. The issue is filed, and it stands where the workflow put it. */
  | { kind: 'failed'; statusName: string; message: string };

type JiraStatusResource = {
  id?: string;
  name?: string;
};

type JiraTransitionResource = {
  id?: string;
  name?: string;
  to?: { name?: string };
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Every status the instance defines, by name, without duplicates.
 *
 * One name can carry several ids, because a status is defined per workflow scheme. The name is what a
 * user reads in Jira and what a setting can be written against, so the list is folded onto it.
 */
export const fetchJiraStatuses$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
}): Observable<JiraStatus[]> =>
  jiraRequest$<JiraStatusResource[]>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/status',
    describe: 'the instance statuses',
  }).pipe(
    map((resources) => {
      const byName = new Map<string, JiraStatus>();

      for (const resource of resources ?? []) {
        if (resource.id && resource.name && !byName.has(resource.name)) {
          byName.set(resource.name, { id: resource.id, name: resource.name });
        }
      }

      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    }),
  );

/** The name of the status one issue stands in right now. */
export const fetchJiraIssueStatus$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  issueKey: string;
}): Observable<string> =>
  jiraRequest$<{ fields?: { status?: JiraStatusResource } }>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/rest/api/3/issue/${encodeURIComponent(options.issueKey)}`,
    query: { fields: 'status' },
    describe: `the status of ${options.issueKey}`,
  }).pipe(map((body) => body.fields?.status?.name ?? ''));

/**
 * Where one issue stands in Jira right now: `gone` when Jira has no issue under the key any more, or
 * answers with another key because the issue moved to another project.
 */
export type JiraIssueState = 'open' | 'done' | 'gone';

/** Reads {@link JiraIssueState} for one key. Any failure but a 404 errors. */
export const fetchJiraIssueState$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  issueKey: string;
}): Observable<JiraIssueState> =>
  jiraRequest$<{ key?: string; fields?: { status?: { statusCategory?: { key?: string } } } }>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/rest/api/3/issue/${encodeURIComponent(options.issueKey)}`,
    query: { fields: 'status' },
    describe: `the state of ${options.issueKey}`,
  }).pipe(
    map((body): JiraIssueState => {
      if (body.key?.toUpperCase() !== options.issueKey.trim().toUpperCase()) return 'gone';

      return body.fields?.status?.statusCategory?.key === 'done' ? 'done' : 'open';
    }),
    catchError((error: unknown) =>
      error instanceof JiraRequestError && error.status === 404 ? of<JiraIssueState>('gone') : throwError(() => error),
    ),
  );

/** The moves this issue offers this account right now. An issue at the end of its workflow offers none. */
export const fetchJiraTransitions$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  issueKey: string;
}): Observable<JiraTransition[]> =>
  jiraRequest$<{ transitions?: JiraTransitionResource[] }>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/rest/api/3/issue/${encodeURIComponent(options.issueKey)}/transitions`,
    describe: `the moves ${options.issueKey} offers`,
  }).pipe(
    map((body) =>
      (body.transitions ?? []).flatMap((resource) =>
        resource.id && resource.to?.name
          ? [{ id: resource.id, name: resource.name ?? '', toStatusName: resource.to.name }]
          : [],
      ),
    ),
  );

/**
 * Moves an issue to the status of the given name.
 *
 * Jira files every issue at the first status of its workflow and takes no status on a create, so a
 * ticket that has to start somewhere else is created and then moved. Only a move offered right now can
 * be made: the workflow decides what follows the first status, and asking for anything else is a 400.
 */
export const moveJiraIssueTo$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  issueKey: string;
  statusName: string;
}): Observable<JiraStatusMove> => {
  const { transport, credentials, issueKey, statusName } = options;

  return fetchJiraTransitions$({ transport, credentials, issueKey }).pipe(
    switchMap((transitions) => {
      const wanted = transitions.find((transition) => sameName(transition.toStatusName, statusName));

      if (!wanted) {
        return of<JiraStatusMove>({
          kind: 'unavailable',
          statusName,
          offered: transitions.map((transition) => transition.toStatusName),
        });
      }

      return jiraRequest$<unknown>({
        transport,
        credentials,
        path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
        describe: `the move of ${issueKey} to ${statusName}`,
        method: 'POST',
        body: { transition: { id: wanted.id } },
      }).pipe(map((): JiraStatusMove => ({ kind: 'moved', statusName: wanted.toStatusName })));
    }),
  );
};

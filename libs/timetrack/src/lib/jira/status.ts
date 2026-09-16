import { Observable, map, of, switchMap } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

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
 * What a move did.
 *
 * `unavailable` is not `failed`: the issue is filed either way, but a workflow that offers no way to the
 * named status is a thing the user configured, while a `failed` move is something that went wrong on the
 * wire. Only the first one is corrected by changing the setting, so only it names what was offered.
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

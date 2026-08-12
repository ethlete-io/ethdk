import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

/** The account the configured token authenticates as. */
export type JiraMyself = {
  /** The id Tempo keys worklogs by. Nothing else identifies an author to Tempo. */
  accountId: string;
  displayName: string;
  emailAddress?: string;
};

type JiraMyselfResource = {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
};

/**
 * Reads who the token belongs to. Every Tempo call is scoped to an account id, and the id is not
 * something the user can be asked for — it is not shown anywhere in Jira's own UI.
 *
 * An answer without an account id fails rather than resolving: continuing would read one person's
 * worklogs and write another's.
 */
export const fetchJiraMyself$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
}): Observable<JiraMyself> =>
  jiraRequest$<JiraMyselfResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/myself',
    describe: 'the authenticated account',
  }).pipe(
    map((resource) => {
      if (!resource.accountId) throw new Error('Jira answered without an account id, so no worklog can be attributed.');

      return {
        accountId: resource.accountId,
        displayName: resource.displayName ?? '',
        emailAddress: resource.emailAddress,
      };
    }),
  );

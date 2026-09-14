import { Observable, map, of, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { JiraIssueInput, createJiraIssue$ } from '../jira/create';
import { fetchJiraOpenIssues$ } from '../jira/candidates';
import { TimetrackTransport } from '../transport/ports';
import { alreadyFiled } from './parents';

/** The issue a press landed on, and whether Jira already held it. */
export type FiledTicket = {
  issueKey: string;
  /** Absent for an issue the project already held, whose id the open-issue read may not carry. */
  issueId?: string;
  /** True where the project already held an issue with this summary, so nothing new was filed. */
  duplicate: boolean;
};

/**
 * Files a ticket, unless the project already holds an open issue with this very summary.
 *
 * The read in front of the write is what makes a second press safe. Jira has no idempotency key, so a
 * create whose answer was lost on the wire looks exactly like a create that never happened, and
 * guarding only the call still in flight leaves that case filing a duplicate. Nothing else can tell
 * the two apart — see {@link alreadyFiled}.
 *
 * A duplicate is answered rather than thrown. The press still means "this work is that issue", so a
 * caller writes the same standing rule either way; what differs is only that Jira already had it.
 */
export const fileTicketOnce$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  input: JiraIssueInput;
}): Observable<FiledTicket> => {
  const { transport, credentials, input } = options;

  return fetchJiraOpenIssues$({
    transport,
    credentials,
    projectKey: input.projectKey,
    subjectField: input.subjectField,
  }).pipe(
    switchMap((issues) => {
      const held = alreadyFiled({ summary: input.summary, issues });

      if (held) return of<FiledTicket>({ issueKey: held.key, issueId: held.id, duplicate: true });

      return createJiraIssue$({ transport, credentials, input }).pipe(
        map((created): FiledTicket => ({ issueKey: created.key, issueId: created.id, duplicate: false })),
      );
    }),
  );
};

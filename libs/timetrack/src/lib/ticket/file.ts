import { Observable, map } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { JiraIssueInput, createJiraIssue$ } from '../jira/create';
import { TimetrackTransport } from '../transport/ports';

/** The issue a press landed on, and whether Jira already held it. */
export type FiledTicket = {
  issueKey: string;
  /** Absent for an issue the project already held, whose id the open-issue read may not carry. */
  issueId?: string;
  /** True where the project already held an issue with this summary, so nothing new was filed. */
  duplicate: boolean;
  /** Why the link to the parent failed. The ticket is filed regardless, so a retry must not file it again. */
  linkError?: string;
};

/**
 * Files a ticket through {@link createJiraIssue$}, whose guard answers an issue the project already
 * holds instead of filing it again. The press still means "this work is that issue", so a caller
 * writes the same standing rule either way.
 */
export const fileTicketOnce$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  input: JiraIssueInput;
}): Observable<FiledTicket> =>
  createJiraIssue$(options).pipe(
    map((created): FiledTicket => ({
      issueKey: created.key,
      issueId: created.id,
      duplicate: !!created.duplicate,
      ...(created.linkError ? { linkError: created.linkError } : {}),
    })),
  );

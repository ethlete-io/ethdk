import { Observable, map, of, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { fetchJiraMyself$ } from '../jira/myself';
import { RecurrenceOptions, RecurringPattern, detectRecurringPatterns } from '../model/recurrence';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { fetchTempoWorklogs$, toHistoricalWorklogs } from './worklogs';

/** How far back the history read goes when the caller names no span. */
export const DEFAULT_PATTERN_WEEKS = 8;

const DAY_MS = 24 * 60 * 60_000;

/**
 * Reads the user's own Tempo history and turns it into the standing commitments the recurrence rung
 * attributes from — the Monday planning, the Thursday review.
 *
 * Every worklog counts, including the ones this app wrote. The record is what the user's week looks
 * like, and who typed a given hour into Tempo does not change that.
 *
 * Three round trips, the same three `fetchTempoDayCoverage$` makes: the account, the worklogs over
 * the span, and the keys behind the issue ids Tempo names.
 */
export const fetchRecurringPatterns$ = (options: {
  transport: TimetrackTransport;
  jira: JiraCredentials;
  tempo: TempoCredentials;
  /** How many weeks back to read. Defaults to `DEFAULT_PATTERN_WEEKS`. */
  weeks?: number;
  /** The last day of the span, inclusive. Defaults to today. */
  until?: Date;
  recurrence?: Partial<RecurrenceOptions>;
}): Observable<RecurringPattern[]> => {
  const until = options.until ?? new Date();
  const from = new Date(until.getTime() - (options.weeks ?? DEFAULT_PATTERN_WEEKS) * 7 * DAY_MS);

  return fetchJiraMyself$({ transport: options.transport, credentials: options.jira }).pipe(
    switchMap((account) =>
      fetchTempoWorklogs$({
        transport: options.transport,
        credentials: options.tempo,
        accountId: account.accountId,
        from,
        to: until,
      }),
    ),
    switchMap((worklogs) =>
      worklogs.length
        ? fetchJiraIssueKeysByIds$({
            transport: options.transport,
            credentials: options.jira,
            ids: worklogs.map((worklog) => worklog.issueId),
          }).pipe(map((keysByIssueId) => toHistoricalWorklogs({ worklogs, keysByIssueId })))
        : of([]),
    ),
    map((history) => detectRecurringPatterns({ worklogs: history, options: options.recurrence })),
  );
};

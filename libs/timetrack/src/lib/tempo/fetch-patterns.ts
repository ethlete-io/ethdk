import { Observable, map, of, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { fetchJiraMyself$ } from '../jira/myself';
import { LoggedIssue, RecurrenceOptions, RecurringPattern, detectRecurringPatterns } from '../model/recurrence';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { fetchTempoWorklogs$, toHistoricalWorklogs, toLoggedIssues } from './worklogs';

/** How far back the history read goes when the caller names no span. */
export const DEFAULT_PATTERN_WEEKS = 8;

const DAY_MS = 24 * 60 * 60_000;

/** Everything one read of the user's Tempo history answers. */
export type TempoHistory = {
  /** The standing commitments the recurrence rung attributes from. */
  patterns: RecurringPattern[];
  /** Every issue the span logged against, most recently logged first. */
  loggedIssues: LoggedIssue[];
};

const EMPTY_HISTORY: TempoHistory = { patterns: [], loggedIssues: [] };

/**
 * Reads the user's own Tempo history: the standing commitments the recurrence rung attributes from —
 * the Monday planning, the Thursday review — and the issues the span logged against at all.
 *
 * Every worklog counts, including the ones this app wrote. The record is what the user's week looks
 * like, and who typed a given hour into Tempo does not change that.
 *
 * Three round trips, the same three `fetchTempoDayCoverage$` makes: the account, the worklogs over
 * the span, and the keys behind the issue ids Tempo names. Both answers come out of that one read,
 * because a second reader of the same weeks would spend the same three calls to learn the same thing.
 */
export const fetchTempoHistory$ = (options: {
  transport: TimetrackTransport;
  jira: JiraCredentials;
  tempo: TempoCredentials;
  /** How many weeks back to read. Defaults to `DEFAULT_PATTERN_WEEKS`. */
  weeks?: number;
  /** The last day of the span, inclusive. Defaults to today. */
  until?: Date;
  recurrence?: Partial<RecurrenceOptions>;
}): Observable<TempoHistory> => {
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
          }).pipe(
            map((keysByIssueId): TempoHistory => ({
              patterns: detectRecurringPatterns({
                worklogs: toHistoricalWorklogs({ worklogs, keysByIssueId }),
                options: options.recurrence,
              }),
              loggedIssues: toLoggedIssues({ worklogs, keysByIssueId }),
            })),
          )
        : of(EMPTY_HISTORY),
    ),
  );
};

/** The standing commitments alone, for a caller that needs no list of issues beside them. */
export const fetchRecurringPatterns$ = (
  options: Parameters<typeof fetchTempoHistory$>[0],
): Observable<RecurringPattern[]> => fetchTempoHistory$(options).pipe(map((history) => history.patterns));

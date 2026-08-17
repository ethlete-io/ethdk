import { Observable, combineLatest, map, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { fetchJiraMyself$ } from '../jira/myself';
import { localDayRange } from '../review/day';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoDayCoverage, tempoDayCoverageOf } from './coverage';
import { fetchTempoWorklogs$ } from './worklogs';

/**
 * Reads what Tempo already holds for one day, for a surface that is not planning a sync.
 *
 * Ownership is read from the ledger exactly as `planTempoSync` reads it: a worklog no ledger entry
 * points at is foreign. Only foreign time lands in the record, because what this app wrote is already
 * in the day's own rows and counting it here would count it twice.
 *
 * Three round trips — the account, the day's worklogs, and the keys behind the issue ids Tempo names.
 * The keys are what make the record comparable to a proposal at all: a subtraction matches on the
 * issue key, and Tempo states only a numeric id.
 */
export const fetchTempoDayCoverage$ = (options: {
  transport: TimetrackTransport;
  jira: JiraCredentials;
  tempo: TempoCredentials;
  ledger: TimetrackLedgerStore;
  /** The local calendar day to read. */
  day: string;
  /** Stamped on the record. Defaults to the moment it is built. */
  observedAt?: Date;
}): Observable<TempoDayCoverage> => {
  // Tempo's range is by inclusive date, so both ends are the day itself.
  const at = localDayRange(options.day).from;

  return fetchJiraMyself$({ transport: options.transport, credentials: options.jira }).pipe(
    switchMap((account) =>
      combineLatest({
        remote: fetchTempoWorklogs$({
          transport: options.transport,
          credentials: options.tempo,
          accountId: account.accountId,
          from: at,
          to: at,
        }),
        ledger: options.ledger.entriesForDay$(options.day),
      }),
    ),
    switchMap(({ remote, ledger }) => {
      const owned = new Set(ledger.map((entry) => entry.tempoWorklogId));
      const foreign = remote.filter((worklog) => !owned.has(worklog.id));

      return fetchJiraIssueKeysByIds$({
        transport: options.transport,
        credentials: options.jira,
        ids: foreign.map((worklog) => worklog.issueId),
      }).pipe(
        map((keysByIssueId) =>
          tempoDayCoverageOf({
            day: options.day,
            observedAt: options.observedAt,
            foreign: foreign.flatMap((worklog) => {
              const issueKey = keysByIssueId.get(worklog.issueId);

              return issueKey ? [{ issueKey, durationMs: worklog.durationMs }] : [];
            }),
          }),
        ),
      );
    }),
  );
};

import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { fetchJiraMyself$ } from '../jira/myself';
import { MIDNIGHT, localDayRange } from '../review/day';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from '../tempo/client';
import { tempoDay, tempoTimeOfDay } from '../tempo/wall-clock';
import { fetchTempoWorklogs$ } from '../tempo/worklogs';
import { deleteTempoWorklog$ } from '../tempo/write';
import { AgentApiTempoDelete } from './model';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Deletes one of the account's own Tempo worklogs on one day, and drops the ledger entries that owned it.
 *
 * The worklog must be among the account's own worklogs of that day as Tempo reads them, so an id of
 * another user's worklog, or of one on another day, is refused before anything is written.
 */
export const deleteOwnTempoWorklog$ = (options: {
  transport: TimetrackTransport;
  jira: JiraCredentials;
  tempo: TempoCredentials;
  ledger: TimetrackLedgerStore;
  day: string;
  worklogId: string;
}): Observable<AgentApiTempoDelete> => {
  const { transport, jira, tempo, ledger, day, worklogId } = options;
  const at = localDayRange(day, MIDNIGHT).from;

  return fetchJiraMyself$({ transport, credentials: jira }).pipe(
    switchMap((account) =>
      fetchTempoWorklogs$({ transport, credentials: tempo, accountId: account.accountId, from: at, to: at }),
    ),
    switchMap((worklogs) => {
      const target = worklogs.find((worklog) => worklog.id === worklogId && tempoDay(worklog.from) === day);

      if (!target) {
        return throwError(
          () => new Error(`Your Tempo worklogs on ${day} hold no worklog ${worklogId}. Nothing was deleted.`),
        );
      }

      return fetchJiraIssueKeysByIds$({ transport, credentials: jira, ids: [target.issueId] }).pipe(
        switchMap((keysByIssueId) =>
          deleteTempoWorklog$({ transport, credentials: tempo, tempoWorklogId: worklogId }).pipe(
            map(() => ({
              id: target.id,
              day,
              startTime: tempoTimeOfDay(target.from).slice(0, 5),
              minutes: Math.round(target.durationMs / 60_000),
              issueKey: keysByIssueId.get(target.issueId),
              description: target.description,
            })),
          ),
        ),
      );
    }),
    switchMap((deleted) =>
      ledger.entriesForDay$(day).pipe(
        switchMap((entries) => {
          const owning = entries.filter((entry) => entry.tempoWorklogId === worklogId);

          return owning.length ? ledger.remove$(owning.map((entry) => entry.proposalId)) : of(undefined);
        }),
        map((): AgentApiTempoDelete => ({ deleted })),
        catchError((error: unknown) => of<AgentApiTempoDelete>({ deleted, unrecorded: messageOf(error) })),
      ),
    ),
  );
};

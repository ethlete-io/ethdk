import { Observable, combineLatest, map, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueIds$, fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { JiraMyself, fetchJiraMyself$ } from '../jira/myself';
import { WorklogProposal } from '../model/proposal';
import { localDayRange } from '../review/day';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoDayCoverage, tempoDayCoverageOf } from './coverage';
import { TempoSyncPlan, planTempoSync } from './diff';
import { TempoMarkerScheme } from './marker';
import { TempoWorklog, fetchTempoWorklogs$ } from './worklogs';

export type TempoSyncPreview = {
  plan: TempoSyncPlan;
  /** The account the sync would write as, and whose worklogs were read. */
  account: JiraMyself;
  /** Everything the day already holds in Tempo, app-owned and foreign alike. */
  remote: TempoWorklog[];
  /** Issue keys for the ids the remote worklogs reference. Tempo names only the numeric id. */
  keysByIssueId: Map<string, string>;
  /**
   * What the foreign worklogs cover, for the caller to store. This is the only place in the app that
   * asks Tempo, so it is the only place that can answer the question for a surface with no token.
   */
  coverage: TempoDayCoverage;
};

/**
 * Reads everything a {@link planTempoSync} needs and returns the plan, without writing anything.
 *
 * The account lookup comes first and on its own: both of the other reads are scoped to an account id,
 * and Jira is the only place it can be had. The ledger is read for the whole day rather than for the
 * proposals under review, so a worklog this app wrote for a proposal the day stopped producing is
 * planned as a delete instead of reading as somebody else's.
 *
 * `keysByIssueId` costs a second Jira round trip, for the issue ids only the remote worklogs mention.
 * Without it the foreign list — the whole point of which is to be recognised as your own already-logged
 * time — would name every row by a numeric id nobody has ever seen.
 */
export const previewTempoSync$ = (options: {
  transport: TimetrackTransport;
  jira: JiraCredentials;
  tempo: TempoCredentials;
  ledger: TimetrackLedgerStore;
  proposals: WorklogProposal[];
  /** The local calendar day under review. Both the remote range and the ledger read come from it. */
  day: string;
  marker?: TempoMarkerScheme;
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  /** Stamped on the coverage. Defaults to the moment the preview is built. */
  observedAt?: Date;
}): Observable<TempoSyncPreview> => {
  // Tempo's range is by date and inclusive, so both ends are the day itself: passing the range's `to`
  // — midnight of the day after — would read the next day's worklogs into this day's foreign list.
  const at = localDayRange(options.day).from;

  return fetchJiraMyself$({ transport: options.transport, credentials: options.jira }).pipe(
    switchMap((account) =>
      combineLatest({
        issueIdsByKey: fetchJiraIssueIds$({
          transport: options.transport,
          credentials: options.jira,
          keys: options.proposals.map((proposal) => proposal.issueKey),
        }),
        remote: fetchTempoWorklogs$({
          transport: options.transport,
          credentials: options.tempo,
          accountId: account.accountId,
          from: at,
          to: at,
        }),
        ledger: options.ledger.entriesForDay$(options.day),
      }).pipe(
        switchMap(({ issueIdsByKey, remote, ledger }) => {
          const known = new Map([...issueIdsByKey].map(([key, id]) => [id, key]));
          const unknown = remote.map((worklog) => worklog.issueId).filter((id) => !known.has(id));

          return fetchJiraIssueKeysByIds$({
            transport: options.transport,
            credentials: options.jira,
            ids: unknown,
          }).pipe(
            map((resolved): TempoSyncPreview => {
              const keysByIssueId = new Map([...known, ...resolved]);
              const plan = planTempoSync({
                proposals: options.proposals,
                ledger,
                remote,
                issueIdsByKey,
                marker: options.marker,
                attributesByProposalId: options.attributesByProposalId,
              });

              return {
                account,
                remote,
                keysByIssueId,
                plan,
                coverage: tempoDayCoverageOf({
                  day: options.day,
                  observedAt: options.observedAt,
                  foreign: plan.foreign.flatMap((worklog) => {
                    const issueKey = keysByIssueId.get(worklog.issueId);

                    return issueKey ? [{ issueKey, durationMs: worklog.durationMs }] : [];
                  }),
                }),
              };
            }),
          );
        }),
      ),
    ),
  );
};

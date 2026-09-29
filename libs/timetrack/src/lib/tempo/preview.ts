import { Observable, combineLatest, map, switchMap } from 'rxjs';
import { JiraCredentials } from '../jira/client';
import { fetchJiraIssueIds$, fetchJiraIssueKeysByIds$ } from '../jira/issue';
import { JiraMyself, fetchJiraMyself$ } from '../jira/myself';
import { WorklogProposal } from '../model/proposal';
import { DayBoundary } from '../review/day';
import { ledgerEntriesForRange$ } from '../store/ledger-range';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoDayCoverage, tempoDayCoverageOf } from './coverage';
import { TempoSyncPlan, planTempoSync } from './diff';
import { TempoMarkerScheme } from './marker';
import { TempoWorklog, fetchTempoDayWorklogs$ } from './worklogs';

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
  /** The day under review. Both the remote read and the ledger read come from it. */
  day: string;
  /** The boundary the proposals and the ledger key the day by. */
  boundary: DayBoundary;
  marker?: TempoMarkerScheme;
  /** The projects whose rows give way to project work. See {@link planTempoSync}. */
  backgroundProjects?: readonly string[];
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  /** Stamped on the coverage. Defaults to the moment the preview is built. */
  observedAt?: Date;
}): Observable<TempoSyncPreview> => {
  return fetchJiraMyself$({ transport: options.transport, credentials: options.jira }).pipe(
    switchMap((account) =>
      combineLatest({
        issueIdsByKey: fetchJiraIssueIds$({
          transport: options.transport,
          credentials: options.jira,
          keys: options.proposals.map((proposal) => proposal.issueKey),
        }),
        remote: fetchTempoDayWorklogs$({
          transport: options.transport,
          credentials: options.tempo,
          accountId: account.accountId,
          day: options.day,
          boundary: options.boundary,
        }),
        ledger: ledgerEntriesForRange$({ ledger: options.ledger, day: options.day, boundary: options.boundary }),
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
                backgroundProjects: options.backgroundProjects,
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

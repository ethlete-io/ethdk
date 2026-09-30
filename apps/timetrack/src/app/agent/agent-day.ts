import { toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentApiRowEdit,
  DayReview,
  DayReviewEdits,
  ManualRow,
  RepoNamingDecisions,
  ReviewedRow,
  TempoDayCoverage,
  addManualRow,
  agedNamings,
  dayBoundaryOf,
  fetchJiraIssueTouchedAt$,
  fetchTempoDayCoverage$,
  hideRow,
  localDayKey,
  namedIssueKeys,
  readJiraCredentials$,
  readTempoCredentials$,
  repoNamingDecisions,
  resetRow,
  setRowDescription,
  setRowIssue,
  setRowRange,
  setRowState,
  showRow,
} from '@ethlete/timetrack';
import { Observable, catchError, concatMap, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectDayReview } from '../day-review/day-review';
import { injectLaneIssueHistory } from '../jira';
import { readEpicOptions$ } from '../naming/epic-siblings';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectProjectLinks } from '../project-links';
import { DayRead, readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';

const applyRowEdit = ({
  edits,
  row,
  edit,
}: {
  edits: DayReviewEdits;
  row: ReviewedRow;
  edit: AgentApiRowEdit;
}): DayReviewEdits => {
  switch (edit.kind) {
    case 'range':
      return setRowRange({ edits, row, from: new Date(edit.fromMs), to: new Date(edit.toMs) });
    case 'issue':
      return setRowIssue({ edits, row, issueKey: edit.issueKey });
    case 'description':
      return setRowDescription({ edits, row, description: edit.description });
    case 'state':
      return setRowState({ edits, row, state: edit.state });
    case 'hidden':
      return edit.hidden ? hideRow({ edits, row }) : showRow({ edits, row });
    case 'reset':
      return resetRow({ edits, row });
  }
};

/**
 * Any day as the day screen draws it, read and written without moving the screen or its saved view.
 *
 * It leaves out what only the screen holds in memory: the names a provider run inferred on screen.
 */
const AGENT_DAY_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const projectLinks = injectProjectLinks();
  const review = injectDayReview();
  const recurring = injectRecurringPatterns();
  const laneIssues = injectLaneIssueHistory();
  const git = injectGitCollector();
  const windows = injectWindowCollector();

  const discovery$ = toObservable(git.discovery).pipe(
    filter((found) => !!found),
    take(1),
  );

  const refreshCoverage$ = (day: string): Observable<TempoDayCoverage | null> =>
    forkJoin({
      jira: readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }),
      tempo: readTempoCredentials$({ secrets: ports.secrets }),
    }).pipe(
      switchMap(({ jira, tempo }) =>
        jira && tempo
          ? fetchTempoDayCoverage$({
              transport: ports.transport,
              jira,
              tempo,
              ledger: ports.ledger,
              day,
              boundary: dayBoundaryOf(settings.settings()),
            }).pipe(concatMap((read) => ports.coverage.save$(read).pipe(map(() => read))))
          : of(null),
      ),
      catchError(() => of(null)),
    );

  const touchedAt$ = (keys: readonly string[]): Observable<ReadonlyMap<string, Date>> =>
    keys.length
      ? readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((jira) =>
            jira
              ? fetchJiraIssueTouchedAt$({ transport: ports.transport, credentials: jira, keys: [...keys] })
              : of(new Map<string, Date>()),
          ),
          catchError(() => of(new Map<string, Date>())),
        )
      : of(new Map<string, Date>());

  const read$ = (day: string): Observable<DayRead> =>
    settings.ready$.pipe(
      switchMap((current) =>
        forkJoin({
          discovery: discovery$,
          settled: recurring.settled$,
          coverage: refreshCoverage$(day),
          touchedAt: touchedAt$(namedIssueKeys({ namings: current.meetingNamings, callNamings: current.callNamings })),
        }).pipe(
          switchMap(({ discovery, touchedAt }) => {
            const read = {
              ports,
              settings: current,
              repoRoots: discovery?.repos ?? [],
              links: projectLinks(),
              worktrees: git.worktrees(),
              patterns: recurring.patterns(),
              windowsSeenThroughMs: windows.lastRun()?.at.getTime(),
              day,
            };
            const now = new Date();
            const check = {
              agedNamings: agedNamings({
                namings: current.meetingNamings,
                callNamings: current.callNamings,
                touchedAt,
                now,
              }),
              finished: day !== localDayKey(now, dayBoundaryOf(current)),
            };

            return readEpicOptions$(read).pipe(
              take(1),
              switchMap((epics) => readDay$({ ...read, epics, check })),
              take(1),
            );
          }),
        ),
      ),
    );

  const editsOf = (read: DayRead) => review.heldEditsOf(read.key) ?? read.edits;

  const review$ = (day: string): Observable<DayReview> =>
    read$(day).pipe(map((read) => read.reviewWith(editsOf(read))));

  const inputs$ = (day: string) =>
    read$(day).pipe(map((read) => ({ day, rows: read.day.rows, edits: editsOf(read), cut: read.cut })));

  const namingDecisions$ = (day: string): Observable<RepoNamingDecisions> =>
    read$(day).pipe(
      map((read) =>
        repoNamingDecisions({
          checkouts: read.day.streams.flatMap((stream) =>
            stream.repoPath
              ? [{ repoPath: stream.repoPath, branches: stream.branches, observedMs: stream.engagedMs }]
              : [],
          ),
          links: projectLinks(),
          rules: settings.settings().attributionRules,
          worklogs: recurring.worklogs(),
          loggedIssues: recurring.loggedIssues(),
        }),
      ),
    );

  /**
   * Makes the edits a caller stated against a day, and answers how many landed and the day they left.
   *
   * Each is resolved against the day as the ones before it left it, so a caller may name a row and then
   * move it in one call. An edit naming a row the day no longer holds is counted out.
   */
  const editRows$ = (options: {
    day: string;
    edits: readonly AgentApiRowEdit[];
  }): Observable<{ applied: number; review: DayReview }> =>
    read$(options.day).pipe(
      switchMap((read) => {
        let applied = 0;
        let named = false;
        let after = read.edits;

        return review
          .changeDay$(options.day, (held) => {
            applied = 0;
            named = false;
            after = options.edits.reduce((current, edit) => {
              const drawn = read.reviewWith(current);
              const row = [...drawn.rows, ...drawn.hidden].find((candidate) => candidate.id === edit.rowId);

              if (!row) return current;

              applied += 1;
              named ||= edit.kind === 'issue';

              return applyRowEdit({ edits: current, row, edit });
            }, held);

            return after;
          })
          .pipe(
            take(1),
            tap(() => {
              if (named) laneIssues.reload();
            }),
            map(() => ({ applied, review: read.reviewWith(after) })),
          );
      }),
    );

  const addRow$ = (options: { day: string; row: ManualRow }): Observable<void> =>
    review.changeDay$(options.day, (edits) => addManualRow({ edits, row: options.row })).pipe(take(1));

  return { review$, inputs$, namingDecisions$, editRows$, addRow$ };
});

export const injectAgentDay = /* @__PURE__ */ toInjectFn(AGENT_DAY_DEF);

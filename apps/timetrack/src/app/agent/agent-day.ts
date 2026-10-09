import { toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentApiRowEdit,
  AutoModeAnswer,
  AutoModeSubject,
  DayReview,
  DayReviewEdits,
  ManualRow,
  RepoNamingDecisions,
  ReviewedRow,
  TempoDayCoverage,
  addManualRow,
  autoModeReaskSubjectOf,
  agedNamings,
  dayBoundaryOf,
  fetchJiraIssueTouchedAt$,
  fetchTempoDayCoverage$,
  hideRow,
  ledgerEntriesForRange$,
  localDayKey,
  localDayRange,
  matchAttributionRule,
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
  unnamedContexts,
  withAutoModeRowNames,
  withFrozenRows,
} from '@ethlete/timetrack';
import { Observable, catchError, concatMap, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectDayReview } from '../day-review/day-review';
import { injectLaneIssueHistory } from '../jira';
import { readEpicOptions$ } from '../naming/epic-siblings';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectCheckoutDependencies } from '../checkout-dependencies';
import { injectProjectLinks } from '../project-links';
import { ownDayRowsOf } from '../peers/day-rows';
import { DayRead, readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';

type AgentDaySubjectOf = (row: ReviewedRow) => AutoModeSubject | undefined;

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
  const dependencies = injectCheckoutDependencies();
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

  const liveRead$ = (day: string): Observable<DayRead> =>
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
              dependencies: dependencies(),
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

  const ledgerOf$ = (day: string) =>
    ledgerEntriesForRange$({ ledger: ports.ledger, day, boundary: dayBoundaryOf(settings.settings()) }).pipe(
      take(1),
      catchError(() => of([])),
    );

  const read$ = (day: string): Observable<DayRead> =>
    liveRead$(day).pipe(
      switchMap((read) =>
        ledgerOf$(day).pipe(
          switchMap((ledger) => {
            const finished = day !== localDayKey(new Date(), dayBoundaryOf(settings.settings()));
            const freeze = (edits: DayReviewEdits) => withFrozenRows({ edits, rows: read.day.rows, ledger, finished });

            if (!freeze(editsOf(read))) return of(read);

            return review
              .changeDay$(day, (edits) => freeze(edits) ?? edits)
              .pipe(
                take(1),
                map(() => {
                  const edits = editsOf(read);

                  return { ...read, edits, review: read.reviewWith(edits) };
                }),
                concatMap((frozen) =>
                  ports.peers
                    .setDayRows$(
                      ownDayRowsOf({
                        day,
                        frozen: true,
                        rows: frozen.review.rows,
                        ledger,
                        standIns: settings.settings().standIns,
                      }),
                      localDayRange(day, dayBoundaryOf(settings.settings())).from,
                    )
                    .pipe(
                      catchError(() => of(undefined)),
                      map(() => frozen),
                    ),
                ),
              );
          }),
        ),
      ),
    );

  const askEvidenceOf = (read: DayRead) => {
    const { unattributed } = read.day.rows;
    const contexts = unnamedContexts({ unattributed });
    const rules = settings.settings().attributionRules;

    return {
      dayRows: read.day.rows,
      contexts,
      unattributed,
      ruledContextIds: new Set(
        contexts.filter((context) => matchAttributionRule({ context: context.context, rules })).map(({ id }) => id),
      ),
    };
  };

  const askSubjectsOf = (read: DayRead): AgentDaySubjectOf => {
    const evidence = askEvidenceOf(read);

    return (row) =>
      autoModeReaskSubjectOf({
        row,
        day: read.key,
        contexts: evidence.contexts,
        ruledContextIds: evidence.ruledContextIds,
        unattributed: evidence.unattributed,
        standIns: settings.settings().standIns,
      }) ?? undefined;
  };

  const review$ = (day: string): Observable<{ review: DayReview; askSubjectOf: AgentDaySubjectOf }> =>
    read$(day).pipe(map((read) => ({ review: read.reviewWith(editsOf(read)), askSubjectOf: askSubjectsOf(read) })));

  const inputs$ = (day: string) =>
    read$(day).pipe(map((read) => ({ day, rows: read.day.rows, edits: editsOf(read), cut: read.cut })));

  const namingDecisionsOf = (read: DayRead): RepoNamingDecisions =>
    repoNamingDecisions({
      checkouts: read.day.streams.flatMap((stream) =>
        stream.repoPath ? [{ repoPath: stream.repoPath, branches: stream.branches, observedMs: stream.engagedMs }] : [],
      ),
      links: projectLinks(),
      rules: settings.settings().attributionRules,
      worklogs: recurring.worklogs(),
      loggedIssues: recurring.loggedIssues(),
    });

  const namingDecisions$ = (day: string): Observable<RepoNamingDecisions> => read$(day).pipe(map(namingDecisionsOf));

  /**
   * Makes the edits a caller stated against a day, and answers how many landed and the day they left.
   *
   * Each is resolved against the day as the ones before it left it, so a caller may name a row and then
   * move it in one call. An edit naming a row the day no longer holds is counted out.
   */
  const editRows$ = (options: {
    day: string;
    edits: readonly AgentApiRowEdit[];
  }): Observable<{ applied: number; review: DayReview; askSubjectOf: AgentDaySubjectOf }> =>
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
            map(() => ({ applied, review: read.reviewWith(after), askSubjectOf: askSubjectsOf(read) })),
          );
      }),
    );

  const askEvidence$ = (day: string) =>
    read$(day).pipe(
      map((read) => ({
        ...askEvidenceOf(read),
        rows: read.reviewWith(editsOf(read)).rows,
        events: read.events,
        streams: read.day.streams,
        offeredCheckouts: namingDecisionsOf(read).offers.map((offer) => offer.repoPath),
      })),
    );

  const applyAutoModeNames$ = (options: {
    day: string;
    applies: (answer: AutoModeAnswer) => boolean;
  }): Observable<void> =>
    read$(options.day).pipe(
      switchMap((read) =>
        review.changeDay$(options.day, (held) =>
          withAutoModeRowNames({
            edits: held,
            rows: read.reviewWith(held).rows,
            unattributed: read.day.rows.unattributed,
            applies: options.applies,
          }),
        ),
      ),
      take(1),
    );

  const addRow$ = (options: { day: string; row: ManualRow }): Observable<void> =>
    review.changeDay$(options.day, (edits) => addManualRow({ edits, row: options.row })).pipe(take(1));

  const freeze$ = (day: string): Observable<void> => read$(day).pipe(map(() => undefined));

  return { review$, inputs$, namingDecisions$, editRows$, addRow$, askEvidence$, applyAutoModeNames$, freeze$ };
});

export const injectAgentDay = /* @__PURE__ */ toInjectFn(AGENT_DAY_DEF);

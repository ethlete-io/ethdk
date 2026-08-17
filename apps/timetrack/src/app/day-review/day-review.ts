import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AttributionRule,
  ClosedTimerRun,
  CollectedEvent,
  CorrelateDayOptions,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  InferredAttribution,
  ReviewedRow,
  AttributionTarget,
  SyncedWorklog,
  TempoDayCoverage,
  TimeWindow,
  TimerRun,
  UnnamedContext,
  closeTimerRun,
  correlateDay,
  coveredMsOf,
  fetchTempoDayCoverage$,
  gitFlowConfigFor,
  localDayKey,
  localDayRange,
  matchAttributionRule,
  mergeRows,
  moveRowBoundary,
  pauseWindows,
  readJiraCredentials$,
  readTempoCredentials$,
  reasoningCandidates,
  reasoningPlan,
  resetRow,
  reviewDay,
  runReasoning$,
  setRowDescription,
  setRowDuration,
  setRowIssue,
  setRowState,
  shiftDayKey,
  splitRow,
  unnamedContexts,
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  debounceTime,
  groupBy,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectTimer } from '../timer';
import { readViewState, rememberViewState } from '../view-state';

/** How long typing settles before a day's edits are written. */
const SAVE_DEBOUNCE_MS = 300;

/**
 * Whether a stored coverage record still states what Tempo holds, without asking Tempo again.
 *
 * A record observed after its day ended cannot go stale by itself — no more work lands in a day that
 * is over. Today's can, because the rest of today has not happened. Time somebody adds to a past day
 * afterwards is the case this misses on purpose; `recorrelate` re-reads the day for it.
 */
const isSettled = (coverage: TempoDayCoverage, dayEnd: Date) => coverage.observedAt >= dayEnd;

/** A load tagged with the day it was asked for, so a stale answer is recognised rather than shown. */
type Loaded<T> = { key: string; value: T | null; failure: string | null };

/** One day's raw inputs, loaded together so a half-loaded day is never correlated. */
type DayEvidence = { events: CollectedEvent[]; runs: ClosedTimerRun[]; pauses: TimeWindow[] };

/**
 * Cuts an open run off at now, or at the end of the day being read, whichever comes first.
 *
 * Closing it at the day's end would hand a timer that is still going every hour left until midnight.
 * On a past day the end *is* the honest maximum - and a run left open across midnight lands in the
 * unobserved-timer warning, which is where a forgotten timer belongs.
 */
const closedThrough = (runs: TimerRun[], dayEnd: Date): ClosedTimerRun[] => {
  const at = new Date(Math.min(Date.now(), dayEnd.getTime()));

  return runs.map((run) => closeTimerRun(run, at));
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const loadedFor = <T>(options: { key: string; load$: Observable<T> }): Observable<Loaded<T>> =>
  options.load$.pipe(
    map((value): Loaded<T> => ({ key: options.key, value, failure: null })),
    catchError((error: unknown) => of<Loaded<T>>({ key: options.key, value: null, failure: messageOf(error) })),
  );

/**
 * One day of work as the review UI reads it: the engine re-run over the day's stored events, with the
 * reviewer's own edits on top.
 *
 * The engine's rows are never stored — only the edits are. So a day whose evidence grew since it was
 * reviewed shows the new evidence, and the reviewer's decisions still win over it.
 */
const DAY_REVIEW_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const destroyRef = inject(DestroyRef);
  const windows = injectWindowCollector();
  const agentSessions = injectAgentSessionCollector();
  const git = injectGitCollector();
  const timers = injectTimer();
  const settings = injectTimetrackSettings();

  const day = signal(readViewState().day ?? localDayKey(new Date()));
  const targetMs = computed(() => settings.settings().dayTargetMs);
  const local = signal<Record<string, DayReviewEdits>>({});
  const expanded = signal<ReadonlySet<string>>(new Set());
  const selection = signal<readonly string[]>([]);
  const reload = signal(0);
  /** Set by `recorrelate` and cleared by `goToDay`, so only the day the reviewer asked about is re-read. */
  const coverageReload = signal(false);
  const saves$ = new Subject<{ key: string; edits: DayReviewEdits }>();

  const probe = computed(() => ({
    key: day(),
    reload: reload(),
    windows: windows.lastRun(),
    sessions: agentSessions.lastRun(),
    git: git.lastRun(),
    timers: timers.revision(),
  }));

  const loadedDay = toSignal(
    toObservable(probe).pipe(
      switchMap(({ key }) => {
        const { from, to } = localDayRange(key);
        const through = new Date(Math.min(Date.now(), to.getTime()));

        return loadedFor<DayEvidence>({
          key,
          load$: combineLatest({
            events: ports.events.eventsBetween$(from, to),
            runs: ports.timers.runsBetween$(from, to).pipe(map((runs) => closedThrough(runs, to))),
          }).pipe(
            map((loaded) => ({
              ...loaded,
              // The same rule as an open timer run, for the same reason: a pause taken this morning
              // must not claim every hour left until midnight.
              pauses: pauseWindows({ events: loaded.events, window: { from, to }, through }),
            })),
          ),
        });
      }),
      startWith(null),
    ),
    { initialValue: null },
  );

  const loadedEdits = toSignal(
    toObservable(day).pipe(
      switchMap((key) => loadedFor<DayReviewEdits | null>({ key, load$: ports.review.editsFor$(key) })),
      startWith(null),
    ),
    { initialValue: null },
  );

  /**
   * What Tempo already holds for the day, read from Tempo when the store has no settled record.
   *
   * A day logged by hand proposes nothing at all — every row is reduced to zero by the same foreign
   * time — so without this the day compares `0m` against the target and reports a finished day as
   * short. What is read is stored, which is also what lets the week view and the reminder answer with
   * no token and no network.
   */
  const readCoverage$ = (key: string): Observable<TempoDayCoverage | null> =>
    combineLatest({
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
              day: key,
            }).pipe(
              concatMap((read) =>
                ports.coverage.save$(read).pipe(
                  catchError(() => of(undefined)),
                  map(() => read),
                ),
              ),
            )
          : of(null),
      ),
      // Tempo is an extra, not the day. A missing token, an expired one or an offline machine leaves
      // the day reading exactly as it did before this was here.
      catchError(() => of(null)),
    );

  const loadedCoverage = toSignal(
    toObservable(computed(() => ({ key: day(), forced: coverageReload() }))).pipe(
      switchMap(({ key, forced }) => {
        const dayEnd = localDayRange(key).to;

        return loadedFor<TempoDayCoverage | null>({
          key,
          load$: ports.coverage.forDay$(key).pipe(
            catchError(() => of(null)),
            switchMap((stored) => (stored && !forced && isSettled(stored, dayEnd) ? of(stored) : readCoverage$(key))),
          ),
        });
      }),
      startWith(null),
    ),
    { initialValue: null },
  );

  const coverage = computed(() => {
    const loaded = loadedCoverage();

    return loaded?.key === day() ? loaded.value : null;
  });

  const evidenceLoad = computed(() => {
    const loaded = loadedDay();

    return loaded?.key === day() ? loaded : null;
  });

  const editsLoad = computed(() => {
    const loaded = loadedEdits();

    return loaded?.key === day() ? loaded : null;
  });

  const evidence = computed(() => evidenceLoad()?.value ?? null);
  const edits = computed(() => local()[day()] ?? editsLoad()?.value ?? EMPTY_DAY_REVIEW_EDITS);

  const correlateOptions = computed((): CorrelateDayOptions => ({
    config: gitFlowConfigFor(settings.settings()),
    rules: settings.settings().attributionRules,
    links: settings.settings().projectLinks,
    sessionize: { repoRoots: git.discovery()?.repos ?? [] },
    fill: { maxFillGapMs: settings.settings().gapFillMs },
  }));

  /**
   * The day as the deterministic pipeline reads it, with no model answer in it. This is what the
   * unnamed-work card and the provider's own payload are derived from, so asking a second time asks
   * the same question — an answer that fed back into its own input would narrow every later run.
   */
  const correlation = computed(() => {
    const collected = evidence();

    return collected
      ? correlateDay({
          events: collected.events,
          timerRuns: collected.runs,
          pauses: collected.pauses,
          ...correlateOptions(),
        })
      : null;
  });

  const unnamed = computed(() => unnamedContexts({ unattributed: correlation()?.unattributed ?? [] }));

  /**
   * The standing rule that already covers a context, for the naming card to say so.
   *
   * A donating context stays on the list on a day with no attributed work to join, because there is
   * nothing to hand its time to — and without this the card looks exactly as it did before the user
   * answered, which reads as a button that did nothing.
   */
  const rulesByContext = computed(() => {
    const rules = settings.settings().attributionRules;
    const found = new Map<string, AttributionRule>();

    for (const context of unnamed()) {
      const match = matchAttributionRule({ context: context.context, rules });

      if (match) found.set(context.id, match.rule);
    }

    return found;
  });

  const plan = computed(() => {
    const correlated = correlation();

    return correlated
      ? reasoningPlan({
          contexts: unnamed(),
          unattributed: correlated.unattributed,
          candidates: reasoningCandidates({ proposals: correlated.proposals }),
        })
      : null;
  });

  const answers = signal<Record<string, InferredAttribution[]>>({});
  const asking = signal(false);

  /** Keyed by payload rather than by day: a day whose evidence grew is a new question, and only then. */
  const inferred = computed(() => answers()[plan()?.hash ?? ''] ?? []);

  const reasoned = computed(() => {
    const collected = evidence();
    const proposed = inferred();

    return collected && proposed.length
      ? correlateDay({
          events: collected.events,
          timerRuns: collected.runs,
          pauses: collected.pauses,
          inferred: proposed,
          ...correlateOptions(),
        })
      : correlation();
  });

  const review = computed(() => {
    const correlated = reasoned();

    return correlated
      ? reviewDay({
          correlation: correlated,
          edits: edits(),
          check: { targetMs: targetMs(), coveredMs: coveredMsOf(coverage()) },
        })
      : null;
  });

  const rows = computed(() => review()?.rows ?? []);

  // The whole day's ledger, not the rows': an entry no row claims is a worklog the sync has to delete,
  // and a read by row id can never return it. The failure stays inside the switch, or one failed read
  // would end the subscription and no later day would be read at all.
  const ledger = toSignal(
    toObservable(day).pipe(
      switchMap((key) => ports.ledger.entriesForDay$(key).pipe(catchError(() => of<SyncedWorklog[]>([])))),
    ),
    { initialValue: [] as SyncedWorklog[] },
  );

  const syncedIds = computed(() => new Set(ledger().map((entry) => entry.proposalId)));

  saves$
    .pipe(
      groupBy((entry) => entry.key),
      mergeMap((perDay) =>
        perDay.pipe(
          debounceTime(SAVE_DEBOUNCE_MS),
          concatMap(({ key, edits: next }) => ports.review.save$(key, next).pipe(catchError(() => of(undefined)))),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const apply = (next: DayReviewEdits) => {
    const key = day();

    local.update((all) => ({ ...all, [key]: next }));
    saves$.next({ key, edits: next });
  };

  /**
   * Asks the local agent CLI about the contexts nothing could name. One run per payload: the answer
   * is kept against the payload's own hash, so re-opening the day, or a collector tick that changed
   * nothing about the question, reads the answer back instead of spawning the CLI again.
   */
  const ask = () => {
    const current = plan();

    if (!current || asking() || current.hash in answers()) return;

    asking.set(true);

    runReasoning$({
      runner: ports.processes,
      plan: current,
      options: { command: settings.settings().reasoning.command, model: settings.settings().reasoning.model },
    })
      .pipe(
        tap((proposed) => {
          answers.update((all) => ({ ...all, [current.hash]: proposed }));
          asking.set(false);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const goToDay = (key: string) => {
    day.set(key);
    rememberViewState({ day: key });
    coverageReload.set(false);
    selection.set([]);
    expanded.set(new Set());
  };

  const selectedRows = computed(() => {
    const byId = new Map(rows().map((row) => [row.id, row]));

    return selection()
      .map((id) => byId.get(id))
      .filter((row): row is ReviewedRow => !!row);
  });

  return {
    dayKey: day.asReadonly(),
    targetMs,
    rows,
    review,
    /** The sessionized day behind the rows, for the timeline. */
    correlation: reasoned,
    /**
     * The day with no model answer in it, which is what a ticket draft quotes — the same input the
     * unnamed-work card and the reasoning payload are built from. Drafting off `reasoned` would leave
     * a context the provider already named with no evidence to quote at all.
     */
    deterministic: correlation,
    /**
     * The contexts the day could not name an issue for, widest first. In a repository the branch
     * grammar cannot read, this is most of the day, and naming one of them is what turns it into
     * worklogs — here and on every later day the context appears in.
     *
     * A context the provider proposed an issue for stays on this list. Its rows carry the proposal,
     * but the standing answer is still missing, and writing that one down is what stops the day from
     * asking again tomorrow.
     */
    unnamed,
    /** The rule already covering an unnamed context, by context id. */
    rulesByContext,
    /**
     * Time in a path the user marked private. The day reports it rather than hiding it: a reviewer who
     * cannot see that the app watched has no way to tell a working link from a broken one.
     */
    privateTime: computed(() => correlation()?.private ?? []),
    /** Exactly what a reasoning run would send, for the UI to show before anything leaves the machine. */
    reasoningPayload: computed(() => plan()?.request ?? null),
    /** What the provider proposed, by context id, for the naming card to offer as an answer. */
    inferredByContext: computed(() => new Map(inferred().map((entry) => [entry.contextId, entry]))),
    isAsking: asking.asReadonly(),
    hasAsked: computed(() => {
      const current = plan();

      return !!current && current.hash in answers();
    }),
    canAsk: computed(() => settings.settings().reasoning.enabled && (plan()?.request.contexts.length ?? 0) > 0),
    ask,
    /** The day's timed runs, so an unnamed one can be named rather than only warned about. */
    timerRuns: computed(() => evidence()?.runs ?? []),
    openRunId: computed(() => timers.running()?.id ?? null),
    isLoading: computed(() => !evidenceLoad()),
    failure: computed(() => evidenceLoad()?.failure ?? editsLoad()?.failure ?? null),
    /** What Tempo already holds for the day, and when that was read. `null` while it is unknown. */
    coverage,
    /** Rows this app has already written to Tempo, by proposal id. */
    syncedIds,
    /** How many of the day's rows Tempo holds. An entry no row claims is not one — the sync deletes it. */
    syncedRowCount: computed(() => rows().filter((row) => syncedIds().has(row.id)).length),
    expanded: expanded.asReadonly(),
    selection: selection.asReadonly(),
    selectedRows,

    goToDay,
    goToToday: () => goToDay(localDayKey(new Date())),
    shiftDay: (byDays: number) => goToDay(shiftDayKey(day(), byDays)),
    recorrelate: () => {
      coverageReload.set(true);
      reload.update((count) => count + 1);
    },

    setIssue: (row: ReviewedRow, issueKey: string) => apply(setRowIssue({ edits: edits(), row, issueKey })),
    setDescription: (row: ReviewedRow, description: string) =>
      apply(setRowDescription({ edits: edits(), row, description })),
    setDuration: (row: ReviewedRow, durationMs: number) => apply(setRowDuration({ edits: edits(), row, durationMs })),
    setState: (row: ReviewedRow, state: 'accepted' | 'rejected') => apply(setRowState({ edits: edits(), row, state })),
    reset: (row: ReviewedRow) => apply(resetRow({ edits: edits(), row })),
    split: (row: ReviewedRow, at: Date) => apply(splitRow({ edits: edits(), row, at })),
    moveBoundary: (move: { before: ReviewedRow; after: ReviewedRow; at: Date }) =>
      apply(moveRowBoundary({ edits: edits(), ...move })),

    mergeSelection: () => {
      apply(mergeRows({ edits: edits(), rows: selectedRows() }));
      selection.set([]);
    },

    toggleExpanded: (id: string) =>
      expanded.update((ids) => {
        const next = new Set(ids);

        if (!next.delete(id)) next.add(id);

        return next;
      }),

    toggleSelected: (id: string) =>
      selection.update((ids) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id])),

    clearSelection: () => selection.set([]),

    labelRun: (id: string, label: { issueKey: string; note: string }) => timers.label(id, label),

    /**
     * Writes the rule that names a context. It is a setting rather than an edit on this day: the same
     * branch comes back tomorrow, and answering for it once is the whole point.
     */
    /**
     * Takes a path out of the working day for good. It is the answer for a side project the collectors
     * cannot tell from a client's checkout, and the day stops asking about it from here on.
     */
    markPathPrivate: (path: string) => settings.addProjectLink({ path, target: { kind: 'private' } }),

    /** Takes back the standing answer for a context, so the day asks about it again. */
    forgetRule: (id: string) => settings.removeAttributionRule(id),

    nameContext: (context: UnnamedContext, target: AttributionTarget) =>
      settings.addAttributionRule({
        ...context.suggestion,
        id: `${context.id}#${Date.now()}`,
        target: target.kind === 'issue' ? { kind: 'issue', issueKey: target.issueKey.trim().toUpperCase() } : target,
        createdAt: new Date(),
      }),
  };
});

export const injectDayReview = /* @__PURE__ */ toInjectFn(DAY_REVIEW_DEF);

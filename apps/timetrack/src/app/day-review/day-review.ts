import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ClosedTimerRun,
  CollectedEvent,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  ReviewedRow,
  AttributionTarget,
  SyncedWorklog,
  TimerRun,
  UnnamedContext,
  closeTimerRun,
  correlateDay,
  gitFlowConfigFor,
  localDayKey,
  localDayRange,
  mergeRows,
  resetRow,
  reviewDay,
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
} from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectTimer } from '../timer';

/** How long typing settles before a day's edits are written. */
const SAVE_DEBOUNCE_MS = 300;

/** A load tagged with the day it was asked for, so a stale answer is recognised rather than shown. */
type Loaded<T> = { key: string; value: T | null; failure: string | null };

/** One day's raw inputs, loaded together so a half-loaded day is never correlated. */
type DayEvidence = { events: CollectedEvent[]; runs: ClosedTimerRun[] };

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

  const day = signal(localDayKey(new Date()));
  const targetMs = computed(() => settings.settings().dayTargetMs);
  const local = signal<Record<string, DayReviewEdits>>({});
  const expanded = signal<ReadonlySet<string>>(new Set());
  const selection = signal<readonly string[]>([]);
  const reload = signal(0);
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

        return loadedFor<DayEvidence>({
          key,
          load$: combineLatest({
            events: ports.events.eventsBetween$(from, to),
            runs: ports.timers.runsBetween$(from, to).pipe(map((runs) => closedThrough(runs, to))),
          }),
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

  const correlation = computed(() => {
    const collected = evidence();

    return collected
      ? correlateDay({
          events: collected.events,
          timerRuns: collected.runs,
          config: gitFlowConfigFor(settings.settings()),
          rules: settings.settings().attributionRules,
          sessionize: { repoRoots: git.discovery()?.repos ?? [] },
        })
      : null;
  });

  const review = computed(() => {
    const correlated = correlation();

    return correlated ? reviewDay({ correlation: correlated, edits: edits(), check: { targetMs: targetMs() } }) : null;
  });

  const rows = computed(() => review()?.rows ?? []);
  const rowIds = computed(() =>
    rows()
      .map((row) => row.id)
      .join(' '),
  );

  const ledger = toSignal(
    toObservable(rowIds).pipe(
      switchMap((ids) => (ids ? ports.ledger.entriesFor$(ids.split(' ')) : of<SyncedWorklog[]>([]))),
      catchError(() => of<SyncedWorklog[]>([])),
    ),
    { initialValue: [] as SyncedWorklog[] },
  );

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

  const goToDay = (key: string) => {
    day.set(key);
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
    correlation,
    /**
     * The contexts the day could not name an issue for, widest first. In a repository the branch
     * grammar cannot read, this is most of the day, and naming one of them is what turns it into
     * worklogs — here and on every later day the context appears in.
     */
    unnamed: computed(() => unnamedContexts({ unattributed: correlation()?.unattributed ?? [] })),
    /** The day's timed runs, so an unnamed one can be named rather than only warned about. */
    timerRuns: computed(() => evidence()?.runs ?? []),
    openRunId: computed(() => timers.running()?.id ?? null),
    isLoading: computed(() => !evidenceLoad()),
    failure: computed(() => evidenceLoad()?.failure ?? editsLoad()?.failure ?? null),
    /** Rows this app has already written to Tempo, by proposal id. */
    syncedIds: computed(() => new Set(ledger().map((entry) => entry.proposalId))),
    expanded: expanded.asReadonly(),
    selection: selection.asReadonly(),
    selectedRows,

    goToDay,
    goToToday: () => goToDay(localDayKey(new Date())),
    shiftDay: (byDays: number) => goToDay(shiftDayKey(day(), byDays)),
    recorrelate: () => reload.update((count) => count + 1),

    setIssue: (row: ReviewedRow, issueKey: string) => apply(setRowIssue({ edits: edits(), row, issueKey })),
    setDescription: (row: ReviewedRow, description: string) =>
      apply(setRowDescription({ edits: edits(), row, description })),
    setDuration: (row: ReviewedRow, durationMs: number) => apply(setRowDuration({ edits: edits(), row, durationMs })),
    setState: (row: ReviewedRow, state: 'accepted' | 'rejected') => apply(setRowState({ edits: edits(), row, state })),
    reset: (row: ReviewedRow) => apply(resetRow({ edits: edits(), row })),
    split: (row: ReviewedRow, at: Date) => apply(splitRow({ edits: edits(), row, at })),

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

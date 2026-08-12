import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  CollectedEvent,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  ReviewedRow,
  SyncedWorklog,
  correlateDay,
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
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  groupBy,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { injectAgentSessionCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';

export const DEFAULT_DAY_TARGET_MS = 8 * 60 * 60_000;

/** How long typing settles before a day's edits are written. */
const SAVE_DEBOUNCE_MS = 300;

/** A load tagged with the day it was asked for, so a stale answer is recognised rather than shown. */
type Loaded<T> = { key: string; value: T | null; failure: string | null };

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

  const day = signal(localDayKey(new Date()));
  const targetMs = signal(DEFAULT_DAY_TARGET_MS);
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
  }));

  const loadedEvents = toSignal(
    toObservable(probe).pipe(
      switchMap(({ key }) => {
        const { from, to } = localDayRange(key);

        return loadedFor<CollectedEvent[]>({ key, load$: ports.events.eventsBetween$(from, to) });
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

  const eventsLoad = computed(() => {
    const loaded = loadedEvents();

    return loaded?.key === day() ? loaded : null;
  });

  const editsLoad = computed(() => {
    const loaded = loadedEdits();

    return loaded?.key === day() ? loaded : null;
  });

  const events = computed(() => eventsLoad()?.value ?? null);
  const edits = computed(() => local()[day()] ?? editsLoad()?.value ?? EMPTY_DAY_REVIEW_EDITS);

  const correlation = computed(() => {
    const collected = events();

    return collected ? correlateDay({ events: collected }) : null;
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
    isLoading: computed(() => !eventsLoad()),
    failure: computed(() => eventsLoad()?.failure ?? editsLoad()?.failure ?? null),
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
  };
});

export const injectDayReview = /* @__PURE__ */ toInjectFn(DAY_REVIEW_DEF);

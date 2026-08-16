import { computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  TempoSyncOutcome,
  TempoSyncPlan,
  TempoSyncPreview,
  executeTempoSync$,
  fetchTempoWorkAttributes$,
  previewTempoSync$,
  readJiraCredentials$,
  readTempoCredentials$,
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  concat,
  exhaustMap,
  map,
  of,
  startWith,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectDayReview } from '../day-review/day-review';
import { injectTimetrackSettings } from '../settings/settings';

const IDLE = { kind: 'idle' } as const;

/** A preview is always about one day, so it carries the day it was built for and nothing else. */
type SyncPreviewStatus =
  | typeof IDLE
  | { kind: 'loading' }
  | { kind: 'ready'; day: string; preview: TempoSyncPreview }
  | { kind: 'failed'; day: string; message: string };

/** `unrecorded` is set when Tempo took the writes but the ledger did not take the ownership record. */
type SyncRunStatus =
  | typeof IDLE
  | { kind: 'writing'; day: string }
  | { kind: 'written'; day: string; outcome: TempoSyncOutcome; unrecorded: string | null }
  | { kind: 'failed'; day: string; message: string };

type SyncRequest = { day: string; plan: TempoSyncPlan; authorAccountId: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const writeCount = (plan: TempoSyncPlan) => plan.creates.length + plan.updates.length + plan.deletes.length;

/**
 * The two phases of a sync: what one would do to the day under review, and — once the reviewer
 * confirms it — the writes themselves.
 *
 * The plan is deliberately not reactive to the day's rows: a plan is a statement about a moment, and
 * one that re-planned itself under the reviewer while they edited would read as if Tempo were
 * changing. Stepping to another day drops both the plan and the run instead of showing yesterday's
 * under today's date.
 *
 * A plan is spent once it has been submitted, and `canSync` stays false until a new one is read. Tempo
 * is eventually consistent, so a plan read straight after a write can report a worklog it just took as
 * missing — re-planning on the app's own initiative is how the same hour gets logged twice.
 */
const SYNC_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const dayReview = injectDayReview();
  const settings = injectTimetrackSettings();

  const requests$ = new Subject<void>();

  const load$ = (): Observable<SyncPreviewStatus> => {
    const day = dayReview.dayKey();
    const proposals = dayReview.rows();

    return combineLatest({
      jira: readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }),
      tempo: readTempoCredentials$({ secrets: ports.secrets }),
    }).pipe(
      switchMap(({ jira, tempo }) => {
        if (!jira) return throwError(() => new Error('Jira needs a host, an account email and a token in Settings.'));
        if (!tempo) return throwError(() => new Error('Tempo needs its own API token in Settings.'));

        return previewTempoSync$({
          transport: ports.transport,
          jira,
          tempo,
          ledger: ports.ledger,
          proposals,
          day,
        });
      }),
      map((preview): SyncPreviewStatus => ({ kind: 'ready', day, preview })),
      catchError((error: unknown) => of<SyncPreviewStatus>({ kind: 'failed', day, message: messageOf(error) })),
    );
  };

  const status = toSignal(
    requests$.pipe(switchMap(() => load$().pipe(startWith<SyncPreviewStatus>({ kind: 'loading' })))),
    { initialValue: IDLE as SyncPreviewStatus },
  );

  const current = computed((): SyncPreviewStatus => {
    const value = status();

    if (value.kind === 'idle' || value.kind === 'loading') return value;

    return value.day === dayReview.dayKey() ? value : IDLE;
  });

  const ready = computed(() => {
    const value = current();

    return value.kind === 'ready' ? value.preview : null;
  });

  const runs$ = new Subject<SyncRequest>();
  const submitted = signal<TempoSyncPreview | null>(null);

  /**
   * Stores what the run now owns. A worklog Tempo took but the ledger forgot is foreign for good, so
   * this failure is reported rather than folded into the row statuses.
   */
  const record$ = (outcome: TempoSyncOutcome): Observable<string | null> => {
    const writes = [
      ...(outcome.ledger.length ? [ports.ledger.upsert$(outcome.ledger)] : []),
      ...(outcome.prunedProposalIds.length ? [ports.ledger.remove$(outcome.prunedProposalIds)] : []),
    ];

    if (!writes.length) return of(null);

    return concat(...writes).pipe(
      toArray(),
      map(() => null),
      catchError((error: unknown) => of(messageOf(error))),
    );
  };

  // The plan and the writes must read the same marker scheme, or every synced worklog compares as
  // edited in Tempo forever. Both run `none` here; change them together.
  const write$ = (request: SyncRequest): Observable<SyncRunStatus> =>
    readTempoCredentials$({ secrets: ports.secrets }).pipe(
      switchMap((tempo) => {
        if (!tempo) return throwError(() => new Error('Tempo needs its own API token in Settings.'));

        return fetchTempoWorkAttributes$({ transport: ports.transport, credentials: tempo }).pipe(
          switchMap((workAttributes) =>
            executeTempoSync$({
              transport: ports.transport,
              credentials: tempo,
              plan: request.plan,
              authorAccountId: request.authorAccountId,
              workAttributes,
            }),
          ),
        );
      }),
      switchMap((outcome) =>
        record$(outcome).pipe(
          map((unrecorded): SyncRunStatus => ({ kind: 'written', day: request.day, outcome, unrecorded })),
        ),
      ),
      catchError((error: unknown) =>
        of<SyncRunStatus>({ kind: 'failed', day: request.day, message: messageOf(error) }),
      ),
    );

  // `exhaustMap`, never `switchMap`: cancelling a run in flight would abandon writes Tempo has already
  // taken, leaving them unowned.
  const runStatus = toSignal(
    runs$.pipe(
      exhaustMap((request) => write$(request).pipe(startWith<SyncRunStatus>({ kind: 'writing', day: request.day }))),
    ),
    { initialValue: IDLE as SyncRunStatus },
  );

  const run = computed((): SyncRunStatus => {
    const value = runStatus();

    return value.kind === 'idle' || value.day === dayReview.dayKey() ? value : IDLE;
  });

  const written = computed(() => {
    const value = run();

    return value.kind === 'written' ? value : null;
  });

  const isWriting = computed(() => run().kind === 'writing');

  const submit = (plan: TempoSyncPlan) => {
    const preview = ready();

    if (!preview || isWriting() || writeCount(plan) === 0) return;

    submitted.set(preview);
    runs$.next({ day: dayReview.dayKey(), plan, authorAccountId: preview.account.accountId });
  };

  return {
    dayKey: dayReview.dayKey,
    /** The rows the next preview would be built from, so the view can say what it is about to plan. */
    rows: dayReview.rows,
    status: current,
    plan: computed(() => ready()?.plan ?? null),
    account: computed(() => ready()?.account ?? null),
    remote: computed(() => ready()?.remote ?? []),
    keysByIssueId: computed(() => ready()?.keysByIssueId ?? new Map<string, string>()),
    isLoading: computed(() => current().kind === 'loading'),
    failure: computed(() => {
      const value = current();

      return value.kind === 'failed' ? value.message : null;
    }),
    credentials: settings.credentials,

    isWriting,
    /** Every row the finished run attempted, and what became of it. */
    runRows: computed(() => written()?.outcome.rows ?? []),
    /** How many rows did not land. They are retried from the run's own plan, never from a new read. */
    retryCount: computed(() => {
      const outcome = written()?.outcome;

      return outcome ? writeCount(outcome.retry) : 0;
    }),
    unrecorded: computed(() => written()?.unrecorded ?? null),
    runFailure: computed(() => {
      const value = run();

      return value.kind === 'failed' ? value.message : null;
    }),
    writeCount: computed(() => {
      const plan = ready()?.plan;

      return plan ? writeCount(plan) : 0;
    }),
    canSync: computed(() => {
      const preview = ready();

      return !!preview && submitted() !== preview && !isWriting() && writeCount(preview.plan) > 0;
    }),

    refresh: () => requests$.next(),
    sync: () => {
      const preview = ready();

      if (preview && submitted() !== preview) submit(preview.plan);
    },
    retry: () => {
      const outcome = written()?.outcome;

      if (outcome) submit(outcome.retry);
    },
  };
});

export const injectTempoSync = /* @__PURE__ */ toInjectFn(SYNC_DEF);

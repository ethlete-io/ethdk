import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  TempoSyncPreview,
  localDayRange,
  previewTempoSync$,
  readJiraCredentials$,
  readTempoCredentials$,
} from '@ethlete/timetrack';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap, throwError } from 'rxjs';
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

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What a sync of the day under review would do, read on demand and never written.
 *
 * It is deliberately not reactive to the day's rows: a plan is a statement about a moment, and one
 * that re-planned itself under the reviewer while they edited would read as if Tempo were changing.
 * Stepping to another day drops it instead of showing yesterday's plan under today's date.
 */
const SYNC_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const dayReview = injectDayReview();
  const settings = injectTimetrackSettings();

  const requests$ = new Subject<void>();

  const load$ = (): Observable<SyncPreviewStatus> => {
    const day = dayReview.dayKey();
    const { from, to } = localDayRange(day);
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
          from,
          to,
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

    refresh: () => requests$.next(),
  };
});

export const injectTempoSyncPreview = /* @__PURE__ */ toInjectFn(SYNC_DEF);

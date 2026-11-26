import { TempoSyncRow, TempoSyncRowKind, TempoSyncRowStatus, TempoWorkAttribute } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

export type SyncRunRecord =
  { kind: 'written'; rows: TempoSyncRow[]; unrecorded: string | null } | { kind: 'failed'; message: string };

/** The last write the Sync view ran for each day, in the encrypted store. A write replaces its day's record. */
export type TauriSyncRunStore = {
  forDay$(day: string): Observable<SyncRunRecord | null>;
  save$(day: string, run: SyncRunRecord): Observable<void>;
};

type StoredSyncRow = Omit<TempoSyncRow, 'error'> & { errorMessage?: string };

type StoredSyncRun =
  { kind: 'written'; rows: StoredSyncRow[]; unrecorded: string | null } | Extract<SyncRunRecord, { kind: 'failed' }>;

const KINDS: readonly TempoSyncRowKind[] = ['create', 'update', 'delete'];
const STATUSES: readonly TempoSyncRowStatus[] = ['written', 'blocked', 'skipped', 'failed'];

export const toStoredSyncRun = (run: SyncRunRecord): StoredSyncRun =>
  run.kind === 'failed'
    ? run
    : {
        kind: 'written',
        unrecorded: run.unrecorded,
        rows: run.rows.map(({ error, ...row }) => ({ ...row, ...(error ? { errorMessage: error.message } : {}) })),
      };

const parseRow = (stored: unknown): TempoSyncRow[] => {
  const raw = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const kind = KINDS.find((known) => known === raw['kind']);
  const status = STATUSES.find((known) => known === raw['status']);
  const proposalId = raw['proposalId'];

  if (!kind || !status || typeof proposalId !== 'string') return [];

  return [
    {
      kind,
      status,
      proposalId,
      ...(typeof raw['tempoWorklogId'] === 'string' ? { tempoWorklogId: raw['tempoWorklogId'] } : {}),
      ...(Array.isArray(raw['missing']) ? { missing: raw['missing'] as TempoWorkAttribute[] } : {}),
      ...(raw['missingDescription'] === true ? { missingDescription: true } : {}),
      ...(typeof raw['errorMessage'] === 'string' ? { error: new Error(raw['errorMessage']) } : {}),
    },
  ];
};

export const parseSyncRun = (stored: unknown): SyncRunRecord | null => {
  const raw = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};

  if (raw['kind'] === 'failed') {
    return typeof raw['message'] === 'string' ? { kind: 'failed', message: raw['message'] } : null;
  }

  if (raw['kind'] !== 'written' || !Array.isArray(raw['rows'])) return null;

  return {
    kind: 'written',
    rows: raw['rows'].flatMap(parseRow),
    unrecorded: typeof raw['unrecorded'] === 'string' ? raw['unrecorded'] : null,
  };
};

export const createTauriSyncRunStore = (): TauriSyncRunStore => ({
  forDay$: (day) => invokeHost$<unknown>('tempo_sync_run_for_day', { day }).pipe(map(parseSyncRun)),
  save$: (day, run) => invokeHost$<void>('set_tempo_sync_run', { day, run: toStoredSyncRun(run) }),
});

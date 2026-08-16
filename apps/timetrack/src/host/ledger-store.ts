import { SyncedWorklog, TimetrackLedgerStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredWorklog = {
  proposalId: string;
  day: string;
  tempoWorklogId: string;
  contentHash: string;
  syncedAtMs: number;
};

const toStored = (entry: SyncedWorklog): StoredWorklog => ({
  proposalId: entry.proposalId,
  day: entry.day,
  tempoWorklogId: entry.tempoWorklogId,
  contentHash: entry.contentHash,
  syncedAtMs: entry.syncedAt.getTime(),
});

const revive = (stored: StoredWorklog): SyncedWorklog => ({
  proposalId: stored.proposalId,
  day: stored.day,
  tempoWorklogId: stored.tempoWorklogId,
  contentHash: stored.contentHash,
  syncedAt: new Date(stored.syncedAtMs),
});

export const createTauriLedgerStore = (): TimetrackLedgerStore => ({
  entriesForDay$: (day) =>
    invokeHost$<StoredWorklog[]>('ledger_entries_for_day', { day }).pipe(map((rows) => rows.map(revive))),
  upsert$: (entries) => invokeHost$<void>('ledger_upsert', { entries: entries.map(toStored) }),
  remove$: (proposalIds) => invokeHost$<void>('ledger_remove', { proposalIds }),
});

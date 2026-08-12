import { SyncedWorklog, TimetrackLedgerStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredWorklog = {
  proposalId: string;
  tempoWorklogId: string;
  contentHash: string;
  syncedAtMs: number;
};

const toStored = (entry: SyncedWorklog): StoredWorklog => ({
  proposalId: entry.proposalId,
  tempoWorklogId: entry.tempoWorklogId,
  contentHash: entry.contentHash,
  syncedAtMs: entry.syncedAt.getTime(),
});

const revive = (stored: StoredWorklog): SyncedWorklog => ({
  proposalId: stored.proposalId,
  tempoWorklogId: stored.tempoWorklogId,
  contentHash: stored.contentHash,
  syncedAt: new Date(stored.syncedAtMs),
});

export const createTauriLedgerStore = (): TimetrackLedgerStore => ({
  entriesFor$: (proposalIds) =>
    invokeHost$<StoredWorklog[]>('ledger_entries_for', { proposalIds }).pipe(map((rows) => rows.map(revive))),
  upsert$: (entries) => invokeHost$<void>('ledger_upsert', { entries: entries.map(toStored) }),
  remove$: (proposalIds) => invokeHost$<void>('ledger_remove', { proposalIds }),
});

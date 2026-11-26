import { Observable, concat, map, toArray } from 'rxjs';
import { SyncedWorklog } from '../model/proposal';
import { TimetrackLedgerStore } from './ports';

/** The ledger half of a sync outcome: entries to keep, and proposals whose entries must go. */
export type LedgerChanges = {
  ledger: SyncedWorklog[];
  prunedProposalIds: string[];
};

/**
 * Writes a sync outcome's ledger changes to the store: upserts first, then removals.
 *
 * A proposal listed in both is upserted and not removed. `executeTempoSync$` never emits one, but a
 * hand-built or merged change set can, and removing an entry that a write just created would leave the
 * worklog in Tempo with nothing pointing at it — the one failure the ledger exists to prevent.
 */
export const applyLedgerChanges$ = (options: {
  store: TimetrackLedgerStore;
  changes: LedgerChanges;
}): Observable<void> => {
  const { ledger, prunedProposalIds } = options.changes;
  const owning = new Set(ledger.map((entry) => entry.proposalId));
  const pruned = [...new Set(prunedProposalIds)].filter((id) => !owning.has(id));

  return concat(
    ...(ledger.length > 0 ? [options.store.upsert$(ledger)] : []),
    ...(pruned.length > 0 ? [options.store.remove$(pruned)] : []),
  ).pipe(
    toArray(),
    map(() => undefined),
  );
};

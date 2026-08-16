import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SyncedWorklog } from '../model/proposal';
import { applyLedgerChanges$ } from './ledger';
import { TimetrackLedgerStore } from './ports';

type Call = { kind: 'upsert'; proposalIds: string[] } | { kind: 'remove'; proposalIds: string[] };

const recordingStore = () => {
  const calls: Call[] = [];
  const store: TimetrackLedgerStore = {
    entriesFor$: () => of([]),
    upsert$: (entries) => {
      calls.push({ kind: 'upsert', proposalIds: entries.map((entry) => entry.proposalId) });

      return of(undefined);
    },
    remove$: (proposalIds) => {
      calls.push({ kind: 'remove', proposalIds });

      return of(undefined);
    },
  };

  return { calls, store };
};

const entry = (proposalId: string): SyncedWorklog => ({
  proposalId,
  day: '2026-08-11',
  tempoWorklogId: `tempo-${proposalId}`,
  contentHash: 'hash',
  syncedAt: new Date(2026, 7, 11, 12, 0),
});

const run = (source: Observable<void>) => {
  let completed = false;

  source.subscribe({ complete: () => (completed = true) });

  return completed;
};

describe('applyLedgerChanges$', () => {
  it('upserts before removing', () => {
    const { calls, store } = recordingStore();

    run(applyLedgerChanges$({ store, changes: { ledger: [entry('a')], prunedProposalIds: ['b'] } }));

    expect(calls).toEqual([
      { kind: 'upsert', proposalIds: ['a'] },
      { kind: 'remove', proposalIds: ['b'] },
    ]);
  });

  it('drops an id that appears in both, keeping the entry the write just created', () => {
    const { calls, store } = recordingStore();

    run(applyLedgerChanges$({ store, changes: { ledger: [entry('a')], prunedProposalIds: ['a', 'b'] } }));

    expect(calls).toEqual([
      { kind: 'upsert', proposalIds: ['a'] },
      { kind: 'remove', proposalIds: ['b'] },
    ]);
  });

  it('de-duplicates the ids it removes', () => {
    const { calls, store } = recordingStore();

    run(applyLedgerChanges$({ store, changes: { ledger: [], prunedProposalIds: ['b', 'b', 'c'] } }));

    expect(calls).toEqual([{ kind: 'remove', proposalIds: ['b', 'c'] }]);
  });

  it('touches the store for neither half when there is nothing to do, and still completes', () => {
    const { calls, store } = recordingStore();

    expect(run(applyLedgerChanges$({ store, changes: { ledger: [], prunedProposalIds: [] } }))).toBe(true);
    expect(calls).toEqual([]);
  });

  it('completes once both halves have run', () => {
    const { store } = recordingStore();

    expect(run(applyLedgerChanges$({ store, changes: { ledger: [entry('a')], prunedProposalIds: ['b'] } }))).toBe(true);
  });
});

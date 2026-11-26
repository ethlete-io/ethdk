import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SyncedWorklog } from '../model/proposal';
import { localDayKey } from '../review/day';
import { ledgerEntriesForRange$ } from './ledger-range';
import { TimetrackLedgerStore } from './ports';

const storeOf = (entries: SyncedWorklog[]): TimetrackLedgerStore => ({
  entriesForDay$: (day) => of(entries.filter((entry) => entry.day === day)),
  upsert$: () => of(undefined),
  remove$: () => of(undefined),
});

const entryAt = (from: Date, day: string): SyncedWorklog => ({
  proposalId: `FIP-1@${from.toISOString()}`,
  day,
  tempoWorklogId: 'w1',
  contentHash: 'h',
  syncedAt: new Date(2026, 7, 12),
});

const read = (options: Parameters<typeof ledgerEntriesForRange$>[0]) => {
  let result: SyncedWorklog[] = [];

  ledgerEntriesForRange$(options).subscribe((entries) => (result = entries));

  return result;
};

describe('ledgerEntriesForRange$', () => {
  it('finds a late-night entry written under a midnight boundary after the boundary moved to 04:00', () => {
    const late = new Date(2026, 7, 12, 1, 0);
    const written = entryAt(late, localDayKey(late, { startHour: 0 }));
    const boundary = { startHour: 4 };

    expect(written.day).toBe('2026-08-12');
    expect(read({ ledger: storeOf([written]), day: '2026-08-11', boundary })).toEqual([written]);
    expect(read({ ledger: storeOf([written]), day: '2026-08-12', boundary })).toEqual([]);
  });

  it('keeps an entry whose id names no instant under its stored day', () => {
    const named: SyncedWorklog = { ...entryAt(new Date(2026, 7, 11, 9), '2026-08-11'), proposalId: 'p1' };

    expect(read({ ledger: storeOf([named]), day: '2026-08-11', boundary: { startHour: 0 } })).toEqual([named]);
    expect(read({ ledger: storeOf([named]), day: '2026-08-12', boundary: { startHour: 0 } })).toEqual([]);
  });

  it('places entries by instant over the 23-hour day the clocks go forward, with a 04:00 boundary', () => {
    const boundary = { startHour: 4 };
    const first = entryAt(new Date(2026, 2, 29, 4, 0), '2026-03-29');
    const last = entryAt(new Date(2026, 2, 30, 3, 59), '2026-03-30');
    const next = entryAt(new Date(2026, 2, 30, 4, 0), '2026-03-30');
    const ledger = storeOf([first, last, next]);

    expect(read({ ledger, day: '2026-03-29', boundary })).toEqual([first, last]);
    expect(read({ ledger, day: '2026-03-30', boundary })).toEqual([next]);
  });

  it('reads nothing for a day with no entries around it', () => {
    expect(read({ ledger: storeOf([]), day: '2026-01-01', boundary: { startHour: 0 } })).toEqual([]);
  });

  it('places an entry by the instant after the last @, whatever the issue key holds', () => {
    const entry = {
      ...entryAt(new Date(2026, 7, 11, 9), '2026-08-12'),
      proposalId: `unnamed:a@b@${new Date(2026, 7, 11, 9).toISOString()}`,
    };

    expect(read({ ledger: storeOf([entry]), day: '2026-08-11', boundary: { startHour: 0 } })).toEqual([entry]);
  });
});

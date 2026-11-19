import { SyncedWorklog } from '@ethlete/timetrack';
import { Observable, Subject, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { reloadableLedger$ } from './reloadable-ledger';

const entry = (proposalId: string): SyncedWorklog => ({
  proposalId,
  day: '2026-11-18',
  tempoWorklogId: `w-${proposalId}`,
  contentHash: 'h',
  syncedAt: new Date('2026-11-18T18:00:00Z'),
});

describe('reloadableLedger$', () => {
  const run = () => {
    const day$ = new Subject<string>();
    const reload$ = new Subject<void>();
    const stored: SyncedWorklog[] = [];
    const seen: { key: string; ids: string[] }[] = [];

    reloadableLedger$({ day$, reload$, read$: () => of([...stored]) }).subscribe(({ key, entries }) =>
      seen.push({ key, ids: entries.map((one) => one.proposalId) }),
    );

    return { day$, reload$, stored, seen };
  };

  it('reads the entries a sync wrote after the day was read, so the day sends them as booked', () => {
    const { day$, reload$, stored, seen } = run();

    day$.next('2026-11-18');
    stored.push(entry('row-a'));
    reload$.next();

    expect(seen).toEqual([
      { key: '2026-11-18', ids: [] },
      { key: '2026-11-18', ids: ['row-a'] },
    ]);
  });

  it('reads the day on screen again, not the one left', () => {
    const { day$, reload$, seen } = run();

    day$.next('2026-11-17');
    day$.next('2026-11-18');
    reload$.next();

    expect(seen.map((one) => one.key)).toEqual(['2026-11-17', '2026-11-18', '2026-11-18']);
  });

  it('keeps reading after a read fails', () => {
    const day$ = new Subject<string>();
    const reload$ = new Subject<void>();
    let fail = true;
    const seen: number[] = [];

    reloadableLedger$({
      day$,
      reload$,
      read$: () =>
        new Observable<SyncedWorklog[]>((subscriber) =>
          fail ? subscriber.error(new Error('down')) : (subscriber.next([entry('row-a')]), subscriber.complete()),
        ),
    }).subscribe(({ entries }) => seen.push(entries.length));

    day$.next('2026-11-18');
    fail = false;
    reload$.next();

    expect(seen).toEqual([0, 1]);
  });
});

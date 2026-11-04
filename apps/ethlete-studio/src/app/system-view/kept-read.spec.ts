import { firstValueFrom, of, Subject, throwError, toArray } from 'rxjs';
import { keptRead$ } from './kept-read';

describe('keptRead$', () => {
  it('keeps the last items and carries the error when a later read fails', async () => {
    const asks = new Subject<number>();
    const reads = firstValueFrom(
      asks.pipe(
        keptRead$({
          read: (ask: number) => (ask === 1 ? of(['a']) : throwError(() => new Error('down'))),
          empty: [] as string[],
        }),
        toArray(),
      ),
    );

    asks.next(1);
    asks.next(2);
    asks.complete();

    expect(await reads).toEqual([
      { items: ['a'], error: null },
      { items: ['a'], error: 'down' },
    ]);
  });

  it('carries the error with the empty items when the first read fails', async () => {
    const reads = await firstValueFrom(
      of(1).pipe(keptRead$({ read: () => throwError(() => 'boom'), empty: [] as string[] }), toArray()),
    );

    expect(reads).toEqual([{ items: [], error: 'boom' }]);
  });

  it('drops the items of another subject when the read fails', async () => {
    const asks = new Subject<string>();
    const reads = firstValueFrom(
      asks.pipe(
        keptRead$({
          read: (ask: string) => (ask === 'a' ? of(['a']) : throwError(() => new Error('down'))),
          empty: [] as string[],
          subjectOf: (ask) => ask,
        }),
        toArray(),
      ),
    );

    asks.next('a');
    asks.next('b');
    asks.complete();

    expect(await reads).toEqual([
      { items: ['a'], error: null },
      { items: [], error: 'down' },
    ]);
  });
});

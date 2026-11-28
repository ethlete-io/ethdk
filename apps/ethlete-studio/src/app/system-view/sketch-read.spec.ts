import { BehaviorSubject, firstValueFrom, toArray } from 'rxjs';
import { OPENED_FIRST_STATES, sketchRead$ } from './sketch-read';

const sketch = { target: 'a' };

describe('sketchRead$', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries the error and keeps the quick items when the full listing fails', async () => {
    let calls = 0;

    vi.stubGlobal('fetch', async () => {
      if (++calls === 2) throw new TypeError('Failed to fetch');

      return new Response(JSON.stringify({ sketches: [sketch], unreadable: [] }));
    });

    const reads = await firstValueFrom(sketchRead$({ port: 1, product: 'p' }).pipe(toArray()));

    expect(reads).toEqual([
      { product: 'p', items: [sketch], error: null },
      { product: 'p', items: [sketch], error: 'Failed to fetch' },
    ]);
  });

  it('carries the error of a full listing that failed after the server held the request open', async () => {
    let calls = 0;

    vi.stubGlobal('fetch', async () =>
      ++calls === 2
        ? new Response(`   ${JSON.stringify({ error: 'product "p" is gone' })}`)
        : new Response(JSON.stringify({ sketches: [sketch], unreadable: [] })),
    );

    const reads = await firstValueFrom(sketchRead$({ port: 1, product: 'p' }).pipe(toArray()));

    expect(reads.at(-1)).toEqual({ product: 'p', items: [sketch], error: 'product "p" is gone' });
  });

  it('compares the picked sketch alone after the quick listing and before the full one', async () => {
    const asked: string[] = [];
    const other = { target: 'b' };
    const compared = { ...sketch, compared: true };

    vi.stubGlobal('fetch', async (url: string) => {
      const query = new URL(url).searchParams;
      const kind = query.get('sketch') ?? (query.get('targets') ? 'names' : query.get('unchanged') ? 'quick' : 'full');

      asked.push(kind);

      return new Response(JSON.stringify({ sketches: kind === 'a' ? [compared] : [sketch, other], unreadable: [] }));
    });

    const reads = await firstValueFrom(sketchRead$({ port: 1, product: 'p', picked: 'sketch:a' }).pipe(toArray()));

    expect(asked).toEqual(['names', 'quick', 'a', 'a', 'full']);
    expect(reads.map(({ items }) => items)).toEqual([
      [sketch, other],
      [sketch, other],
      [compared, other],
      [compared, other],
      [sketch, other],
    ]);
  });

  it('answers the leading states of the picked sketch while the compare of all its states still runs', async () => {
    const leading = { ...sketch, pending: ['late'] };

    vi.stubGlobal('fetch', (url: string) => {
      const query = new URL(url).searchParams;

      if (query.get('sketch') === 'a' && !query.has('first')) return new Promise(() => undefined);

      return Promise.resolve(
        new Response(JSON.stringify({ sketches: query.has('first') ? [leading] : [sketch], unreadable: [] })),
      );
    });

    const reads: unknown[] = [];
    const read = sketchRead$({ port: 1, product: 'p', picked: 'sketch:a' }).subscribe(({ items }) => reads.push(items));

    await vi.waitFor(() => expect(reads).toContainEqual([leading]));
    read.unsubscribe();
  });

  it('asks for the names, the quick listing and the compare of the picked sketch without waiting on each other', async () => {
    const asked: string[] = [];

    vi.stubGlobal('fetch', (url: string) => {
      asked.push(new URL(url).search);

      return new Promise(() => undefined);
    });

    const read = sketchRead$({ port: 1, product: 'p', picked: 'sketch:a' }).subscribe();

    expect(asked).toEqual([
      '?product=p&unchanged=no&targets=no',
      '?product=p&unchanged=no',
      `?product=p&sketch=a&first=${OPENED_FIRST_STATES}`,
    ]);
    read.unsubscribe();
  });

  it('compares a sketch picked after the start alone while the full listing runs', async () => {
    const asked: string[] = [];
    const other = { target: 'b' };
    const compared = { ...other, compared: true };
    const picks = new BehaviorSubject<string | null>('sketch:a');
    let answerFull = () => undefined as void;

    vi.stubGlobal('fetch', async (url: string) => {
      const query = new URL(url).searchParams;
      const kind = query.get('sketch') ?? (query.get('targets') ? 'names' : query.get('unchanged') ? 'quick' : 'full');

      asked.push(kind);
      if (kind === 'full') {
        picks.next('sketch:b');
        await new Promise<void>((done) => (answerFull = done));
      }
      if (kind === 'b') setTimeout(() => answerFull());

      return new Response(JSON.stringify({ sketches: kind === 'b' ? [compared] : [sketch, other], unreadable: [] }));
    });

    const reads = await firstValueFrom(
      sketchRead$({ port: 1, product: 'p', picked: 'sketch:a', picks }).pipe(toArray()),
    );

    expect(asked).toEqual(['names', 'quick', 'a', 'a', 'full', 'b']);
    expect(reads.map(({ items }) => items).slice(4)).toEqual([
      [sketch, compared],
      [sketch, other],
    ]);
  });
});

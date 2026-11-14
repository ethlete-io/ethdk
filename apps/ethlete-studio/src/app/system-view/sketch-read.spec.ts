import { firstValueFrom, toArray } from 'rxjs';
import { sketchRead$ } from './sketch-read';

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

    expect(asked).toEqual(['names', 'quick', 'a', 'full']);
    expect(reads.map(({ items }) => items)).toEqual([
      [sketch, other],
      [sketch, other],
      [compared, other],
      [sketch, other],
    ]);
  });
});

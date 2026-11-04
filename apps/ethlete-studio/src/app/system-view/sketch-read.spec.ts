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
});

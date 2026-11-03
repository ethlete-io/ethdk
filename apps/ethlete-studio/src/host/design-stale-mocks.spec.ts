import { staleDesignMocks$, StaleDesignMocks } from './design-stale-mocks';

const STALE: StaleDesignMocks = {
  stale: ['button.ts'],
  command: 'NX_NO_CLOUD=true npx nx build components',
  message: 'REFUSED STALE DESIGN MOCKS',
};

const answering = (bodies: unknown[]) => {
  const fetch = vi.fn<(url: string) => Promise<Response>>(() => {
    const body = bodies.length > 1 ? bodies.shift() : bodies[0];

    return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
  });

  vi.stubGlobal('fetch', fetch);

  return fetch;
};

describe('staleDesignMocks$', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports the stale mocks and drops them once the server answers null after a rebuild', async () => {
    const fetch = answering([{ stale: STALE }, { stale: STALE }, { stale: null }]);
    const seen: (StaleDesignMocks | null)[] = [];
    const subscription = staleDesignMocks$(4401).subscribe((stale) => seen.push(stale));

    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([STALE]);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://localhost:4401/__design/stale-mocks');

    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toEqual([STALE]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toEqual([STALE, null]);

    subscription.unsubscribe();
  });

  it('shows nothing while the server cannot answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const seen: (StaleDesignMocks | null)[] = [];
    const subscription = staleDesignMocks$(4401).subscribe((stale) => seen.push(stale));

    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([null]);

    subscription.unsubscribe();
  });
});

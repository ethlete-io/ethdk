import { afterEach, describe, expect, it, vi } from 'vitest';

const probes = vi.hoisted(() => {
  const state = { calls: 0, release: () => undefined as void, slow: Promise.resolve() };

  state.slow = new Promise<void>((resolve) => {
    state.release = resolve;
  });

  return state;
});

vi.mock('../browser', () => ({ chromiumOf: async () => true }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    ssrLoadModule: async () => ({ default: { states: { rest: {} } } }),
  }),
}));
vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({}),
}));

const fakePage = () => ({
  goto: async () => undefined,
  setContent: async () => undefined,
  evaluate: async () => [],
  mouse: { move: async () => undefined },
  locator: () => ({ first: () => ({ waitFor: async () => undefined }), waitFor: async () => undefined }),
});

vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  createPartShooter: () => ({
    close: async () => undefined,
    pictureOf: async () => ({ markup: '<div></div>', png: Buffer.alloc(0), marks: [] }),
  }),
}));
vi.mock('../thumb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumb')>()),
  createDrawQueue: () => ({
    close: async () => undefined,
    run: async (job: (browser: unknown) => unknown) =>
      job({ newContext: async () => ({ newPage: async () => fakePage(), close: async () => undefined }) }),
  }),
}));
vi.mock('./pointer-focus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pointer-focus')>()),
  probePointerFocus: async () => {
    const call = probes.calls++;

    if (call > 0) await probes.slow;

    return null;
  },
}));
vi.mock('./actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./actions')>();
  const mk = (key: string) => ({ key, occurrence: 0, probe: 0, action: null, control: null });

  return {
    ...actual,
    pairElementsOf: () => ({
      paired: ['button "A"', 'button "B"'].map((key) => ({
        app: mk(key),
        design: { ...mk(key), owners: [], within: [] },
      })),
      missing: [],
    }),
  };
});

import { checkActions } from './actions-command';

describe('checkActions streaming', () => {
  it('reports an element lines before a later, slower element has finished', async () => {
    const seen: string[] = [];
    const done = checkActions({
      target: '/tmp/none',
      config: {} as never,
      product: { name: 'app-a', presets: {}, parts: [] } as never,
      part: 'components/chip',
      url: 'http://localhost:9',
      only: null,
      onLine: (line) => void seen.push(line.element),
    });

    await vi.waitFor(() => expect(seen).toEqual(['button "A"']));
    expect(probes.calls).toBe(2);

    probes.release();

    const result = await done;

    expect(typeof result).toBe('object');
    expect(seen).toEqual(['button "A"', 'button "B"']);
  });
});

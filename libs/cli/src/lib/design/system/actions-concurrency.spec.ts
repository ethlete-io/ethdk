import { describe, expect, it, vi } from 'vitest';

const budget = vi.hoisted(() => {
  const state = {
    probing: 0,
    maxProbing: 0,
    drawing: 0,
    maxDrawing: 0,
  };

  return state;
});

const STATES = ['a', 'a-hover', 'b', 'b-hover', 'c', 'c-hover', 'd', 'e'];
const CHECKED = STATES.filter((state) => !state.endsWith('-hover'));

vi.mock('../browser', () => ({ chromiumOf: async () => true }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    shotStore: () => undefined,
    ssrLoadModule: async () => ({ default: { states: Object.fromEntries(STATES.map((state) => [state, {}])) } }),
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

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  createPartShooter: () => ({
    close: async () => undefined,
    pictureOf: async ({ state }: { state: string }) => {
      budget.maxDrawing = Math.max(budget.maxDrawing, ++budget.drawing);
      await tick();
      budget.drawing--;

      return {
        markup: state.endsWith('-hover') ? '<button data-et-force="hover">A</button>' : '<div></div>',
        png: Buffer.alloc(0),
        marks: [],
      };
    },
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
    budget.maxProbing = Math.max(budget.maxProbing, ++budget.probing);
    await tick();
    budget.probing--;

    return null;
  },
}));
vi.mock('./actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./actions')>();
  const mk = (key: string) => ({ key, occurrence: 0, probe: 0, action: null, control: null });

  return {
    ...actual,
    pairElementsOf: () => ({
      paired: [{ app: mk('button "A"'), design: { ...mk('button "A"'), owners: [], within: [] } }],
      missing: [],
    }),
  };
});

import { checkActions } from './actions-command';

describe('checkActions budget', () => {
  it('draws the start states and checks the unforced states of a batch at once, and keeps the lines in state order', async () => {
    const result = await checkActions({
      target: '/tmp/none',
      config: {} as never,
      product: { name: 'app-a', config: {}, presets: {}, parts: [] } as never,
      part: 'components/chip',
      url: 'http://localhost:9',
      only: null,
    });

    if (typeof result === 'string') throw new Error(result);

    expect(budget.maxDrawing).toBe(STATES.length);
    expect(budget.maxProbing).toBe(4);
    expect(result.lines.map((line) => line.state)).toEqual(CHECKED);
  });
});

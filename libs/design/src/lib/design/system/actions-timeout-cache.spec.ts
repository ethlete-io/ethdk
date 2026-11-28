import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const probes = vi.hoisted(() => ({ fail: [] as string[] }));

vi.mock('../browser', () => ({ chromiumOf: async () => true }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    shotStore: () => undefined,
    ssrLoadModule: async () => ({ default: { states: { rest: {}, open: {} } } }),
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
  locator: () => ({
    first: () => ({ waitFor: async () => undefined, count: async () => 0 }),
    waitFor: async () => undefined,
  }),
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
    const state = probes.fail.shift();

    if (state) throw new Error(`locator.waitFor: Timeout 15000ms exceeded.\n  waiting for ${state}`);

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

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  probes.fail = [];
});

const setup = () => {
  const target = mkdtempSync(join(tmpdir(), 'et-actions-timeout-'));
  const appRoot = join(target, 'built');

  dirs.push(target);
  mkdirSync(join(target, 'node_modules'));
  mkdirSync(appRoot);
  writeFileSync(join(appRoot, 'main.js'), 'built');

  return (only: readonly string[] | null) =>
    checkActions({
      target,
      config: {} as never,
      product: { name: 'app-a', config: {}, presets: {}, parts: [] } as never,
      part: 'components/chip',
      url: 'http://localhost:9',
      only,
      appRoot,
    });
};

const timeoutsOf = (result: Awaited<ReturnType<typeof checkActions>>) =>
  typeof result === 'string'
    ? [result]
    : result.lines.filter((line) => line.failure?.includes('Timeout')).map((line) => `${line.state} ${line.element}`);

describe('checkActions cache', () => {
  it('runs an action again after it failed at a harness timeout instead of replaying the timeout', async () => {
    const run = setup();

    probes.fail = ['rest'];
    expect(timeoutsOf(await run(['rest']))).toEqual(['rest button "A" pointer focus']);

    expect(timeoutsOf(await run(['rest']))).toEqual([]);
  });

  it('checks and replays only the selected states', async () => {
    const run = setup();

    await run(null);
    const selected = await run(['open']);

    expect(typeof selected === 'string' ? selected : [...new Set(selected.lines.map((line) => line.state))]).toEqual([
      'open',
    ]);
  });
});

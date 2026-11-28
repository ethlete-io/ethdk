import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { describe, expect, it } from 'vitest';
import { gitExec } from '@ethlete/cli-core/git-test-env.fixtures';
import { harnessBuildKeyOf, harnessCacheDirOf } from './harness-build-cache';
import { BuildCommandOf } from './harness-server';
import {
  changedAtOf,
  createHarnessWatch,
  isWatchBuildCurrent,
  startWatch,
  WatchState,
  watchLineOf,
} from './harness-watch';
import { HARNESS_PATH } from './part-compare';
import { ResolvedProduct } from './resolve-product';

describe('watchLineOf', () => {
  it.each([
    ['ethlete-studio: ❯ Building...', 'start'],
    ['ethlete-studio: ✔ Building...', null],
    ['ethlete-studio: ❯ Changes detected. Rebuilding...', 'start'],
    ['ethlete-studio: ✔ Changes detected. Rebuilding...', null],
    ['ethlete-studio: Application bundle generation complete. [0.907 seconds] - 2026-11-06T11:00:17.449Z', null],
    ['ethlete-studio: Output location: /tmp/et-design-harness-watch-6r2KgG/out', 'built'],
    ['ethlete-studio: Application bundle generation failed. [0.879 seconds] - 2026-11-06T11:00:23.419Z', 'failed'],
    [
      "ethlete-studio: ✘ [ERROR] TS2322: Type 'string' is not assignable to type 'number'. [plugin angular-compiler]",
      null,
    ],
    ['Waiting for ethlete-studio:build:development in another nx process', 'busy'],
    ['> nx run ethlete-studio:build:development --watch', null],
  ])('reads %s as %s', (line, kind) => {
    expect(watchLineOf(line)).toBe(kind);
  });
});

const built = (startedAt: number, endedAt: number): WatchState['last'] => ({ startedAt, endedAt, ok: true, log: [] });

const current = (state: WatchState, changedAt: number | null, now: number, waitingSince = now) =>
  isWatchBuildCurrent({ state, changedAt, waitingSince, now, settle: 1_000, slack: 50 });

describe('isWatchBuildCurrent', () => {
  it('waits for the first build', () => {
    expect(current({ last: null, inFlight: { startedAt: 0, prime: false } }, null, 5_000)).toBe(false);
  });

  it('serves the last build when no input changed', () => {
    expect(current({ last: built(0, 100), inFlight: null }, null, 200)).toBe(true);
  });

  it('serves the last build while only the warm-up rebuild runs', () => {
    expect(current({ last: built(0, 100), inFlight: { startedAt: 150, prime: true } }, null, 200)).toBe(true);
  });

  it('waits while a rebuild of a change runs', () => {
    expect(current({ last: built(0, 100), inFlight: { startedAt: 150, prime: false } }, null, 200)).toBe(false);
  });

  it('serves a build that started after the change', () => {
    expect(current({ last: built(1_100, 1_900), inFlight: null }, 1_000, 2_000)).toBe(true);
  });

  it('waits for the watcher to pick up a change newer than the last build', () => {
    expect(current({ last: built(0, 100), inFlight: null }, 1_000, 1_200, 1_100)).toBe(false);
    expect(current({ last: built(990, 1_500), inFlight: null }, 1_000, 1_600, 1_100)).toBe(false);
  });

  it('serves the last build once the watcher ignored a change for the settle time', () => {
    expect(current({ last: built(0, 100), inFlight: null }, 1_000, 2_100, 1_100)).toBe(true);
    expect(current({ last: built(0, 100), inFlight: { startedAt: 2_000, prime: true } }, 1_000, 2_100, 1_100)).toBe(
      false,
    );
  });
});

describe('changedAtOf', () => {
  const confirmed = new Map([
    ['a.ts', '1'],
    ['b.ts', '1'],
  ]);
  const mtimeOf = (path: string) => ({ 'a.ts': 10, 'b.ts': 20, 'c.ts': 30 })[path] ?? null;

  it('is null when every input matches', () => {
    expect(changedAtOf({ confirmed, inputs: confirmed, mtimeOf, now: 99 })).toBeNull();
  });

  it('is the latest modification time of a changed or added input', () => {
    expect(
      changedAtOf({
        confirmed,
        inputs: new Map([
          ['a.ts', '2'],
          ['b.ts', '1'],
        ]),
        mtimeOf,
        now: 99,
      }),
    ).toBe(10);
    expect(
      changedAtOf({
        confirmed,
        inputs: new Map([
          ['a.ts', '2'],
          ['b.ts', '1'],
          ['c.ts', '1'],
        ]),
        mtimeOf,
        now: 99,
      }),
    ).toBe(30);
  });

  it('is now for a removed input', () => {
    expect(changedAtOf({ confirmed, inputs: new Map([['a.ts', '1']]), mtimeOf, now: 99 })).toBe(99);
  });
});

const ANGULAR_WATCH = `
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const out = process.argv[1];
console.log('app: ❯ Building...');
console.log('app: Application bundle generation complete. [0.100 seconds]');
setTimeout(() => {
  console.log('app: Output location: ' + out);
  setTimeout(() => {
    mkdirSync(join(out, 'browser'), { recursive: true });
    writeFileSync(join(out, 'browser', 'index.html'), '<!doctype html>');
  }, 20);
}, 400);
setInterval(() => undefined, 1_000);
`;

describe('startWatch', () => {
  it('serves the browser output that Angular writes after it logs the output location', async () => {
    const target = mkdtempSync(join(tmpdir(), 'et-harness-watch-spec-'));
    const watch = startWatch({
      target,
      root: target,
      app: 'app',
      project: 'app',
      key: 'key',
      inputs: new Map(),
      commandOf: ({ outputPath }) => ({ command: process.execPath, args: ['-e', ANGULAR_WATCH, outputPath] }),
      settle: 1_000,
      timeout: 10_000,
    });

    try {
      if (typeof watch === 'string') throw new Error(watch);

      const served = await watch.wait(new Map());

      if (typeof served === 'string') throw new Error(served);
      expect((await fetch(`${served.url}${HARNESS_PATH}`)).status).toBe(200);
    } finally {
      if (typeof watch !== 'string') await watch.stop();
      rmSync(target, { recursive: true, force: true });
    }
  });
});

const NEVER_BUILDS = `console.log('app: ❯ Building...'); setInterval(() => undefined, 1_000);`;

const harnessCheckout = () => {
  const root = mkdtempSync(join(tmpdir(), 'et-harness-watch-cache-spec-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };

  gitExec(['init', '-q'], { cwd: root });
  write('tsconfig.base.json', JSON.stringify({ compilerOptions: {} }));
  write(
    'apps/app/project.json',
    JSON.stringify({ name: 'app', targets: { build: { options: { browser: 'apps/app/src/main.ts' } } } }),
  );
  write('apps/app/src/main.ts', 'export const main = 1;');

  const product = {
    name: 'app',
    config: { harness: { app: 'apps/app', map: 'apps/app/src/harness.ts' } },
  } as unknown as ResolvedProduct;
  const buildCommandOf: BuildCommandOf = ({ outputPath }) => ({
    command: 'build',
    args: [`--outputPath=${outputPath}`],
  });
  const cacheDir = join(root, 'cache');
  const storedDir = () =>
    join(
      harnessCacheDirOf({ target: root, project: 'app', base: cacheDir }),
      harnessBuildKeyOf({ target: root, app: 'apps/app', command: ['build', '--outputPath=<out>'] }) ?? 'none',
    );

  return { root, product, buildCommandOf, cacheDir, storedDir };
};

describe('createHarnessWatch', () => {
  it('serves a stored build of the same inputs while the first watch build runs', async () => {
    const { root, product, buildCommandOf, cacheDir, storedDir } = harnessCheckout();

    mkdirSync(join(storedDir(), 'browser'), { recursive: true });
    writeFileSync(join(storedDir(), 'browser', 'index.html'), 'stored');

    const harness = createHarnessWatch({
      target: root,
      commandOf: () => ({ command: process.execPath, args: ['-e', NEVER_BUILDS] }),
      buildCommandOf,
      cacheDir,
      timeout: 2_000,
    });

    try {
      const served = await harness.current(product);

      if (typeof served === 'string' || served === null) throw new Error(String(served));
      expect(await (await fetch(`${served.url}${HARNESS_PATH}`)).text()).toBe('stored');
    } finally {
      await harness.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stores an idle watch build for the next start', async () => {
    const { root, product, buildCommandOf, cacheDir, storedDir } = harnessCheckout();
    const harness = createHarnessWatch({
      target: root,
      commandOf: ({ outputPath }) => ({ command: process.execPath, args: ['-e', ANGULAR_WATCH, outputPath] }),
      buildCommandOf,
      cacheDir,
      timeout: 10_000,
    });

    try {
      const served = await harness.current(product);

      if (typeof served === 'string' || served === null) throw new Error(String(served));

      const stored = join(storedDir(), 'browser', 'index.html');

      for (let waited = 0; !existsSync(stored) && waited < 5_000; waited += 50) await delay(50);

      expect(readFileSync(stored, 'utf8')).toBe('<!doctype html>');
    } finally {
      await harness.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

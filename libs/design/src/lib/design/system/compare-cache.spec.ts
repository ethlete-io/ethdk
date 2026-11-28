import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { withRunSignal } from '../run-abort';
import { builtAppHashOf, createAppShotCache } from './compare-cache';
import { cachedAppShotOf } from './compare-command';

type Shot = Parameters<typeof cachedAppShotOf>[0]['shot'];

const builtApp = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-compare-app-'));

  mkdirSync(join(root, 'chunks'));
  writeFileSync(join(root, 'index.html'), '<script src="main.js"></script>');
  writeFileSync(join(root, 'main.js'), 'boot()');
  writeFileSync(join(root, 'chunks/page.js'), 'page()');

  return root;
};

const urlOf = (state: string, props: unknown, port = 4000) =>
  `http://127.0.0.1:${port}/__design/harness?part=pages%2Fsketches&state=${state}&props=${encodeURIComponent(JSON.stringify(props))}`;

const shotsOf = (port = 4000): Record<string, Shot> => ({
  a: { url: urlOf('a', { zoom: 1 }, port), size: null, width: 800, panes: 0 },
  b: {
    url: urlOf('b', { zoom: 2 }, port),
    size: null,
    width: 800,
    panes: 1,
    opened: { control: 'menu', markup: '<div data-et-pane>menu</div>' },
  },
  c: {
    url: urlOf('c', { zoom: 3 }, port),
    size: null,
    width: 800,
    panes: 0,
    ambient: {
      fontFamily: 'Inter',
      fontSize: '14px',
      fontWeight: '400',
      fontStyle: 'normal',
      lineHeight: '20px',
      letterSpacing: '0',
    },
  },
});

const compareRun = async (options: { dir: string; app: string; shots: Record<string, Shot> }) => {
  const cache = {
    salt: 'cli 1 playwright@1',
    built: builtAppHashOf(options.app),
    cache: createAppShotCache(options.dir),
  };
  const drawn: string[] = [];

  for (const [state, shot] of Object.entries(options.shots))
    await cachedAppShotOf({
      cache,
      shot,
      draw: async () => {
        drawn.push(state);

        return { app: Buffer.from(`app ${state}`) };
      },
    });

  return drawn;
};

const shotAndRepeat = async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-compare-cache-'));
  const app = builtApp();

  expect(await compareRun({ dir, app, shots: shotsOf() })).toEqual(['a', 'b', 'c']);
  expect(await compareRun({ dir, app, shots: shotsOf(4001) })).toEqual([]);

  return { dir, app };
};

describe('the app pictures compare keeps on disk', () => {
  it('shoots every state once and serves an unchanged run from disk, whatever port the harness has', async () => {
    await shotAndRepeat();
  });

  it('shoots again only the state whose props changed', async () => {
    const { dir, app } = await shotAndRepeat();
    const shots = shotsOf();

    shots['b'] = { ...shots['b'], url: urlOf('b', { zoom: 5 }) } as Shot;

    expect(await compareRun({ dir, app, shots })).toEqual(['b']);
  });

  it('shoots again only the state whose design markup of the opened control changed', async () => {
    const { dir, app } = await shotAndRepeat();
    const shots = shotsOf();

    shots['b'] = { ...shots['b'], opened: { control: 'menu', markup: '<div data-et-pane>other menu</div>' } } as Shot;

    expect(await compareRun({ dir, app, shots })).toEqual(['b']);
  });

  it('shoots again only the state whose design text style changed', async () => {
    const { dir, app } = await shotAndRepeat();
    const shots = shotsOf();

    shots['c'] = { ...shots['c'], ambient: { ...shots['c']?.ambient, fontSize: '16px' } } as Shot;

    expect(await compareRun({ dir, app, shots })).toEqual(['c']);
  });

  it('shoots again only the state whose design gained a forced frame or a look', async () => {
    const { dir, app } = await shotAndRepeat();
    const shots = shotsOf();

    shots['a'] = { ...shots['a'], forcesInFrames: true } as Shot;
    shots['b'] = { ...shots['b'], looks: [{ look: '[&_.x]:h-10', selector: '.x', part: 'components/x' }] } as Shot;

    expect(await compareRun({ dir, app, shots })).toEqual(['a', 'b']);
  });

  it('shoots every state again once a file of the built app changed', async () => {
    const { dir, app } = await shotAndRepeat();

    writeFileSync(join(app, 'chunks/page.js'), 'page(2)');

    expect(await compareRun({ dir, app, shots: shotsOf() })).toEqual(['a', 'b', 'c']);
  });

  it('draws and keeps nothing without a built app to hash', async () => {
    const drawn: string[] = [];
    const draw = async () => (drawn.push('a'), { app: Buffer.from('app a') });

    await cachedAppShotOf({ cache: null, shot: shotsOf()['a'] as Shot, draw });
    await cachedAppShotOf({ cache: null, shot: shotsOf()['a'] as Shot, draw });

    expect(drawn).toEqual(['a', 'a']);
  });

  it('keeps no picture drawn after its run was aborted, so the next run draws it again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-compare-cache-'));
    const app = builtApp();
    const run = new AbortController();
    const cache = { salt: 'cli 1 playwright@1', built: builtAppHashOf(app), cache: createAppShotCache(dir) };
    const shots = shotsOf();

    await withRunSignal(run.signal, async () => {
      await cachedAppShotOf({ cache, shot: shots['a'] as Shot, draw: async () => ({ app: Buffer.from('a') }) });
      await cachedAppShotOf({
        cache,
        shot: shots['b'] as Shot,
        draw: async () => (run.abort(), { app: Buffer.from('browser has been closed') }),
      });
    });

    expect(await compareRun({ dir, app, shots: { a: shots['a'] as Shot, b: shots['b'] as Shot } })).toEqual(['b']);
  });
});

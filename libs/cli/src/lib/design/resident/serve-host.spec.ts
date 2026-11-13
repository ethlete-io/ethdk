import { randomUUID } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResidentClient, runThroughResident, SHARED_SERVE_ENV, sharedServeWanted, stopResident } from './client';
import { readDiscovery, writeDiscovery } from './discovery';
import { hostResidentInServe, SharedDraw } from './resident-process';
import { startResidentServer } from './server';

const designSketch = vi.hoisted(() => vi.fn());
const createDesignServer = vi.hoisted(() => vi.fn());
const createDrawQueue = vi.hoisted(() => vi.fn());

vi.mock('../sketch-command', () => ({ designSketch }));
vi.mock('../check', () => ({ checkDesign: vi.fn() }));
vi.mock('../system/compare-command', () => ({ designCompare: vi.fn(), shootStatesWith: () => vi.fn() }));
vi.mock('../system/harness-watch', () => ({ createHarnessWatch: () => ({ current: vi.fn(), stop: vi.fn() }) }));
vi.mock('../system/stale-design-mocks', () => ({ guardsDesignMocks: () => false, designMocksFresh: () => true }));
vi.mock('../system/stale-dist', () => ({
  libBuildStampOf: () => 'stamp',
  readFreshDist: async () => ({ ok: true, release: () => undefined }),
  staleLibsOf: () => [],
}));
vi.mock('../design-config', () => ({ readConfig: () => ({}) }));
vi.mock('../serve', () => ({ createDesignServer }));
vi.mock('../thumb', () => ({ createDrawQueue }));

const live = new Set<number>();
let nextPid = 60_000;
const closers: (() => Promise<void>)[] = [];
const dirs: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  designSketch.mockResolvedValue(0);
  createDrawQueue.mockReturnValue({ run: vi.fn(), close: async () => undefined });
});

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const checkoutOf = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-resident-serve-'));

  dirs.push(dir);

  return dir;
};

const startFake = async (options: { target: string; build?: string; owner?: 'serve' }) => {
  const { target, build = 'b1', owner } = options;
  const pid = nextPid++;
  const token = randomUUID();
  const stopped = vi.fn(() => void live.delete(pid));
  const ran = vi.fn(async () => 0);

  live.add(pid);

  const server = await startResidentServer({
    token,
    identity: { pid, build, checkout: target },
    run: ran,
    onExit: stopped,
  });

  closers.push(server.close);
  writeDiscovery(target, {
    pid,
    port: server.port,
    checkout: target,
    build,
    token,
    startedAt: '',
    ...(owner ? { owner } : {}),
  });

  return { stopped, ran, pid };
};

const clientOf = (overrides: Partial<ResidentClient> = {}) => {
  const out: string[] = [];
  const client: ResidentClient = {
    build: 'b1',
    env: {},
    alive: (pid) => live.has(pid) || pid === process.pid,
    kill: vi.fn(),
    start: vi.fn(),
    out: (text) => void out.push(text),
    err: () => undefined,
    now: () => Date.now(),
    sleep: async (ms) => void (await delay(Math.min(ms, 20))),
    startTimeoutMs: 2_000,
    pingTimeoutMs: 500,
    stopGraceMs: 100,
    silenceMs: 2_000,
    ...overrides,
  };

  return { client, out };
};

const sharedOf = (): SharedDraw => {
  const server = { forgetDrawn: vi.fn(), close: vi.fn(), takeDeniedIds: () => [] };

  return { server: server as unknown as SharedDraw['server'], chromiumOf: vi.fn() };
};

describe('a design serve that hosts the resident', () => {
  it('stops a standalone resident of the checkout and takes its discovery file', async () => {
    const target = checkoutOf();
    const standalone = await startFake({ target });
    const { client } = clientOf();
    const close = await hostResidentInServe({ target, shared: sharedOf(), client, log: () => undefined });

    closers.push(close);

    expect(standalone.stopped).toHaveBeenCalled();
    expect(readDiscovery(target)).toEqual(expect.objectContaining({ pid: process.pid, owner: 'serve' }));

    await close();

    expect(readDiscovery(target)).toBeNull();
  });

  it('runs a sketch check on the design server and Chromium of the serve, starting neither', async () => {
    const target = checkoutOf();
    const shared = sharedOf();
    const { client } = clientOf();

    closers.push(await hostResidentInServe({ target, shared, client, log: () => undefined }));

    const code = await runThroughResident({
      target,
      argv: ['sketch', 'check', 'pages/start'],
      invocation: 'et',
      client,
    });
    const warm = designSketch.mock.calls[0]?.[0].warm;

    expect(code).toBe(0);
    expect(client.start).not.toHaveBeenCalled();
    expect(await warm.server({})).toBe(shared.server);
    warm.queue();
    expect(createDrawQueue).toHaveBeenCalledWith(expect.objectContaining({ chromiumOf: shared.chromiumOf }));
    expect(createDesignServer).not.toHaveBeenCalled();
  });

  it('forgets what the serve drew before a hosted run, so a run after an edit draws the edit', async () => {
    const target = checkoutOf();
    const shared = sharedOf();
    const { client } = clientOf();
    const run = () =>
      runThroughResident({ target, argv: ['sketch', 'check', 'pages/start'], invocation: 'et', client });

    const forgetDrawn = vi.mocked(shared.server.forgetDrawn);
    const drawing = async ({ warm }: { warm: { server: (options: object) => Promise<unknown> } }) => {
      await warm.server({});

      return 0;
    };

    designSketch.mockImplementationOnce(drawing).mockImplementationOnce(drawing);
    closers.push(await hostResidentInServe({ target, shared, client, log: () => undefined }));

    await run();
    const forgotten = forgetDrawn.mock.calls.length;

    await run();

    expect(forgetDrawn.mock.calls.length).toBeGreaterThan(forgotten);
  });

  it('leaves the resident to a serve that already hosts one', async () => {
    const target = checkoutOf();
    const first = await startFake({ target, owner: 'serve' });
    const { client } = clientOf();
    const log = vi.fn();

    closers.push(await hostResidentInServe({ target, shared: sharedOf(), client, log }));

    expect(first.stopped).not.toHaveBeenCalled();
    expect(readDiscovery(target)?.pid).toBe(first.pid);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already hosts'));
  });
});

describe('the client of a serve-hosted resident', () => {
  it('never stops the serve on et design stop', async () => {
    const target = checkoutOf();
    const served = await startFake({ target, owner: 'serve' });
    const { client, out } = clientOf();

    expect(await stopResident(target, client)).toBe(0);
    expect(served.stopped).not.toHaveBeenCalled();
    expect(client.kill).not.toHaveBeenCalled();
    expect(out.join('')).toContain('ends with that server');
  });

  it('runs in-process instead of stopping a serve with another cli build', async () => {
    const target = checkoutOf();
    const served = await startFake({ target, owner: 'serve', build: 'b0' });
    const { client } = clientOf();

    expect(await runThroughResident({ target, argv: ['compare', 'pages/start'], invocation: 'et', client })).toBeNull();
    expect(served.stopped).not.toHaveBeenCalled();
    expect(client.kill).not.toHaveBeenCalled();
    expect(client.start).not.toHaveBeenCalled();
  });

  it('in CI uses a serve-hosted resident only with the flag set to 1, and never starts one', async () => {
    const target = checkoutOf();
    const ci = clientOf({ env: { CI: '1', [SHARED_SERVE_ENV]: '1' } }).client;
    const call = () => runThroughResident({ target, argv: ['compare', 'pages/start'], invocation: 'et', client: ci });

    expect(await call()).toBeNull();
    expect(ci.start).not.toHaveBeenCalled();

    const served = await startFake({ target, owner: 'serve' });

    expect(await call()).toBe(0);
    expect(served.ran).toHaveBeenCalled();
  });

  it('turns the shared serve on locally and off in CI or with the flag at 0', () => {
    expect(sharedServeWanted({})).toBe(true);
    expect(sharedServeWanted({ CI: '1' })).toBe(false);
    expect(sharedServeWanted({ [SHARED_SERVE_ENV]: '0' })).toBe(false);
    expect(sharedServeWanted({ ETHLETE_DESIGN_RESIDENT: '0' })).toBe(false);
    expect(sharedServeWanted({ CI: '1', [SHARED_SERVE_ENV]: '1' })).toBe(true);
  });
});

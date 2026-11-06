import { randomUUID } from 'crypto';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResidentClient, runThroughResident, stopResident } from './client';
import { readDiscovery, writeDiscovery } from './discovery';
import { ResidentRun, startResidentServer } from './server';

const DEAD_PID = 2 ** 22 + 17;
const live = new Set<number>();
let nextPid = 50_000;
const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

const checkoutOf = () => mkdtempSync(join(tmpdir(), 'cli-resident-client-'));

const startFake = async (options: { target: string; build?: string; run?: ResidentRun; pid?: number }) => {
  const { target, build = 'b1', pid = nextPid++ } = options;
  const token = randomUUID();
  const stopped = vi.fn(() => void live.delete(pid));

  live.add(pid);

  const server = await startResidentServer({
    token,
    identity: { pid, build, checkout: target },
    run: options.run ?? (async () => 0),
    onExit: stopped,
  });

  closers.push(server.close);
  writeDiscovery(target, { pid, port: server.port, checkout: target, build, token, startedAt: '' });

  return { server, stopped, pid };
};

const clientOf = (overrides: Partial<ResidentClient> = {}) => {
  const out: string[] = [];
  const err: string[] = [];
  const client: ResidentClient = {
    build: 'b1',
    env: {},
    alive: (pid) => live.has(pid),
    kill: vi.fn(),
    start: vi.fn(),
    out: (text) => void out.push(text),
    err: (text) => void err.push(text),
    now: () => Date.now(),
    sleep: async (ms) => void (await delay(Math.min(ms, 20))),
    startTimeoutMs: 2_000,
    pingTimeoutMs: 500,
    stopGraceMs: 100,
    silenceMs: 2_000,
    ...overrides,
  };

  return { client, out, err };
};

describe('runThroughResident', () => {
  it('streams the stdout and stderr of the run to the caller and answers its exit code', async () => {
    const target = checkoutOf();
    const seen: string[][] = [];

    await startFake({
      target,
      run: async ({ argv, env }) => {
        seen.push(argv);
        process.stdout.write('header OK\n');
        process.stderr.write(`PHASE x ${env.ETHLETE_DESIGN_PHASES}\n`);
        process.stdout.write('default DIFF 21 px\n');

        return 3;
      },
    });

    const { client, out, err } = clientOf({ env: { ETHLETE_DESIGN_PHASES: '1' } });
    const code = await runThroughResident({
      target,
      argv: ['compare', 'pages/start'],
      invocation: 'et design',
      client,
    });

    expect(code).toBe(3);
    expect(seen).toEqual([['compare', 'pages/start']]);
    expect(out.join('')).toBe('header OK\ndefault DIFF 21 px\n');
    expect(err.join('')).toBe('PHASE x 1\n');
    expect(client.start).not.toHaveBeenCalled();
  });

  it('keeps the in-process path in CI and with ETHLETE_DESIGN_RESIDENT=0', async () => {
    const target = checkoutOf();

    for (const env of [{ CI: 'true' }, { ETHLETE_DESIGN_RESIDENT: '0' }]) {
      const { client, err } = clientOf({ env });

      expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(
        null,
      );
      expect(client.start).not.toHaveBeenCalled();
      expect(err).toEqual([]);
    }
  });

  it('starts a process when none runs, prints the cold start once, then sends the request', async () => {
    const target = checkoutOf();
    const { client, err } = clientOf({ start: vi.fn(() => void startFake({ target, run: async () => 7 })) });

    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(7);
    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(7);
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(err.filter((line) => line.startsWith('starting the resident design process (cold start, ~'))).toHaveLength(
      1,
    );
  });

  it('replaces a discovery file whose process died', async () => {
    const target = checkoutOf();

    writeDiscovery(target, { pid: DEAD_PID, port: 1, checkout: target, build: 'b1', token: 't', startedAt: '' });

    const { client } = clientOf({ start: vi.fn(() => void startFake({ target })) });

    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(0);
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(readDiscovery(target)?.pid).not.toBe(DEAD_PID);
  });

  it('stops a process of another CLI build and starts one of its own', async () => {
    const target = checkoutOf();
    const old = await startFake({ target, build: 'b0' });
    const { client } = clientOf({ start: vi.fn(() => void startFake({ target, run: async () => 4 })) });

    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(4);
    expect(old.stopped).toHaveBeenCalledWith('stop');
    expect(client.start).toHaveBeenCalledTimes(1);
  });

  it('falls back to the in-process path with one line when a live process does not answer', async () => {
    const target = checkoutOf();
    const hung = nextPid++;

    live.add(hung);
    writeDiscovery(target, { pid: hung, port: 9, checkout: target, build: 'b1', token: 't', startedAt: '' });

    const { client, err } = clientOf({ kill: vi.fn((pid) => void live.delete(pid)) });

    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(null);
    expect(client.kill).toHaveBeenCalledWith(hung, 'SIGKILL');
    expect(client.start).not.toHaveBeenCalled();
    expect(err).toEqual([
      `the resident design process (pid ${hung}) did not answer and was stopped - running in-process\n`,
    ]);
  });

  it('falls back to the in-process path with one line when the process ends during the run', async () => {
    const target = checkoutOf();
    const fake = await startFake({
      target,
      run: async () => {
        process.stdout.write('header OK\n');
        setTimeout(() => void fake.server.close(), 20);
        await delay(100);

        return 0;
      },
    });
    const { client, out, err } = clientOf();

    expect(await runThroughResident({ target, argv: ['compare', 'a/b'], invocation: 'et design', client })).toBe(null);
    expect(out).toEqual(['header OK\n']);
    expect(err).toEqual([
      `the resident design process (pid ${fake.pid}) ended without an answer - running in-process\n`,
    ]);
  });
});

describe('stopResident', () => {
  it('ends the running process and says when none runs', async () => {
    const target = checkoutOf();
    const fake = await startFake({ target });
    const { client, out } = clientOf();

    expect(await stopResident(target, client)).toBe(0);
    expect(fake.stopped).toHaveBeenCalledWith('stop');
    expect(await stopResident(target, client)).toBe(0);
    expect(out).toEqual([
      `stopped the resident design process (pid ${fake.pid})\n`,
      'no resident design process runs\n',
    ]);
  });
});

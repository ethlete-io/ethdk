import { cpSync, mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serveDesign } from './serve';
import { liveOpenPointsWorkers, stopOpenPointsWorkers } from './system/open-points-runner';

const httpServer = Object.assign(new EventEmitter(), { address: () => null });

vi.mock('vite', () => ({
  createLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    warnOnce: () => undefined,
    error: () => undefined,
    clearScreen: () => undefined,
    hasErrorLogged: () => false,
    hasWarned: false,
  }),
  createServer: async () => ({
    httpServer,
    listen: async () => undefined,
    printUrls: () => undefined,
    close: async () => undefined,
  }),
}));

vi.mock('@tailwindcss/postcss', () => ({ default: () => ({}) }));

vi.mock('./system/slow-run-host', () => ({ startSlowRunnerInWorker: () => ({ stop: async () => undefined }) }));

const cwd = process.cwd();
const targets: string[] = [];

afterEach(async () => {
  process.chdir(cwd);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await stopOpenPointsWorkers();
  await Promise.all(targets.splice(0).map((target) => rm(target, { recursive: true, force: true, maxRetries: 5 })));
});

const untilLive = async (count: number, timeoutMs: number) => {
  const end = Date.now() + timeoutMs;

  while (liveOpenPointsWorkers() !== count && Date.now() < end) await delay(20);

  return liveOpenPointsWorkers();
};

describe('serveDesign workers', () => {
  it('ends the warmed open-points workers when its server closes', { timeout: 60_000 }, async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubEnv('ETHLETE_DESIGN_SLOW_CHECKS', 'on');

    const target = mkdtempSync(join(tmpdir(), 'cli-serve-workers-'));

    targets.push(target);
    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    expect(await serveDesign({ target })).toBe(0);
    expect(liveOpenPointsWorkers()).toBe(2);

    httpServer.emit('close');

    expect(await untilLive(0, 10_000)).toBe(0);
  });
});

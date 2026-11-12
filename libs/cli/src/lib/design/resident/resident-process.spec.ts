import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runsInResident } from './client';
import { createWarmRuns } from './resident-process';

const designSketch = vi.hoisted(() => vi.fn());
const designCompare = vi.hoisted(() => vi.fn());
const forgetDrawn = vi.hoisted(() => vi.fn());
const checkDesign = vi.hoisted(() => vi.fn());
const readFreshDist = vi.hoisted(() => vi.fn());
const current = vi.hoisted(() => vi.fn());
const startHarnessServer = vi.hoisted(() => vi.fn());

vi.mock('../sketch-command', () => ({ designSketch }));
vi.mock('../check', () => ({ checkDesign }));
vi.mock('../system/compare-command', () => ({ designCompare, shootStatesWith: () => vi.fn() }));
vi.mock('../system/harness-watch', () => ({ createHarnessWatch: () => ({ current, stop: vi.fn() }) }));
vi.mock('../system/harness-server', () => ({ startHarnessServer }));
vi.mock('../system/stale-design-mocks', () => ({ guardsDesignMocks: () => false, designMocksFresh: () => true }));
vi.mock('../system/stale-dist', () => ({
  libBuildStampOf: () => 'stamp',
  readFreshDist,
  staleLibsOf: () => [],
}));
vi.mock('../design-config', () => ({ readConfig: () => ({}) }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({ listen: async () => undefined, close: async () => undefined, forgetDrawn }),
}));
vi.mock('../thumb', () => ({
  createDrawQueue: () => ({ run: async (draw: () => Promise<unknown>) => draw(), close: async () => undefined }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  designSketch.mockResolvedValue(0);
  checkDesign.mockResolvedValue(0);
  designCompare.mockResolvedValue(0);
  readFreshDist.mockResolvedValue({ ok: true, release: () => undefined });
});

const runsIn = () => createWarmRuns({ target: mkdtempSync(join(tmpdir(), 'cli-resident-runs-')) });

describe('the resident design process', () => {
  it('runs compare, sketch check and sketch ready, and nothing else', () => {
    expect(runsInResident(['compare', 'pages/start'])).toBe(true);
    expect(runsInResident(['sketch', 'check', 'pages/start'])).toBe(true);
    expect(runsInResident(['sketch', 'ready', 'pages/start'])).toBe(true);
    expect(runsInResident(['sketch', 'new', 'pages/start'])).toBe(false);
    expect(runsInResident(['sketch', 'merge', 'pages/start'])).toBe(false);
    expect(runsInResident(['check', 'pages/start'])).toBe(false);
    expect(runsInResident(['check', '--product', 'studio'])).toBe(true);
    expect(runsInResident(['check', '--part', 'pages/start'])).toBe(true);
    expect(runsInResident(['check', '--product', 'studio', '--rules'])).toBe(false);
    expect(runsInResident(['check', '--product', 'studio', '--receipt', 'r.json'])).toBe(false);
    expect(runsInResident(['check', '--call', 'hero'])).toBe(false);
  });

  it('runs a sketch check on its warm design server and Chromium', async () => {
    const runs = runsIn();

    expect(await runs.run({ argv: ['sketch', 'check', 'pages/start'], invocation: 'et design', env: {} })).toBe(0);
    expect(designSketch).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['check', 'pages/start'],
        warm: expect.objectContaining({ server: expect.any(Function) }),
      }),
    );
    expect(designCompare).not.toHaveBeenCalled();
  });

  it('refuses a command it does not run', async () => {
    const runs = runsIn();

    expect(await runs.run({ argv: ['sketch', 'merge', 'pages/start'], invocation: 'et design', env: {} })).toBe(2);
    expect(designSketch).not.toHaveBeenCalled();
  });

  it('forgets what its warm design server drew before each request', async () => {
    const runs = runsIn();

    await runs.warmUp();
    await runs.run({ argv: ['sketch', 'ready', 'pages/start'], invocation: 'et design', env: {} });
    await runs.run({ argv: ['sketch', 'ready', 'pages/start'], invocation: 'et design', env: {} });

    expect(forgetDrawn).toHaveBeenCalledTimes(2);
  });

  it('runs a check of a product on its warm design server and Chromium', async () => {
    const runs = runsIn();

    expect(await runs.run({ argv: ['check', '--product', 'studio'], invocation: 'et design', env: {} })).toBe(0);
    expect(checkDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['--product', 'studio'],
        warm: expect.objectContaining({ queue: expect.any(Function) }),
      }),
    );
  });

  it('lets a compare jump into a running check, on the lib build the check holds', async () => {
    const runs = runsIn();
    const request = { argv: ['compare', 'pages/start'], invocation: 'et design', env: {} };

    expect(runs.jumps(request)).toBe(false);

    checkDesign.mockImplementation(async () => {
      expect(runs.jumps(request)).toBe(true);
      expect(await runs.run(request)).toBe(0);

      return 0;
    });

    expect(await runs.run({ argv: ['check', '--product', 'studio'], invocation: 'et design', env: {} })).toBe(0);
    expect(designCompare).toHaveBeenCalledTimes(1);
    expect(readFreshDist).toHaveBeenCalledTimes(1);
  });

  it('builds the harness app of another checkout, such as a compare base, instead of serving its own watch build', async () => {
    const runs = runsIn();
    const product = { name: 'app-a' };

    startHarnessServer.mockResolvedValue({ url: 'http://base', stop: async () => undefined });
    await runs.run({ argv: ['compare', 'pages/start', '--base', 'HEAD~1'], invocation: 'et design', env: {} });

    const { start } = designCompare.mock.calls[0]?.[0] as { start: (options: unknown) => Promise<unknown> };

    expect(await start({ target: '/elsewhere', product })).toEqual({ url: 'http://base', stop: expect.any(Function) });
    expect(startHarnessServer).toHaveBeenCalledWith({ target: '/elsewhere', product });
    expect(current).not.toHaveBeenCalled();
  });
});

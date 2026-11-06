import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runsInResident } from './client';
import { createWarmRuns } from './resident-process';

const designSketch = vi.hoisted(() => vi.fn());
const designCompare = vi.hoisted(() => vi.fn());
const forgetDrawn = vi.hoisted(() => vi.fn());

vi.mock('../sketch-command', () => ({ designSketch }));
vi.mock('../system/compare-command', () => ({ designCompare, shootStatesWith: () => vi.fn() }));
vi.mock('../system/harness-watch', () => ({ createHarnessWatch: () => ({ current: vi.fn(), stop: vi.fn() }) }));
vi.mock('../system/stale-design-mocks', () => ({ guardsDesignMocks: () => false, designMocksFresh: () => true }));
vi.mock('../system/stale-dist', () => ({
  libBuildStampOf: () => 'stamp',
  readFreshDist: async () => ({ ok: true, release: () => undefined }),
}));
vi.mock('../paths', () => ({ readConfig: () => ({}) }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({ listen: async () => undefined, close: async () => undefined, forgetDrawn }),
}));
vi.mock('../thumb', () => ({
  createDrawQueue: () => ({ run: async (draw: () => Promise<unknown>) => draw(), close: async () => undefined }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  designSketch.mockResolvedValue(0);
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
});

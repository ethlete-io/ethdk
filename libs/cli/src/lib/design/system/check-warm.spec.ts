import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../design-config';
import { WarmDraw } from '../warm-draw';
import { checkSystemRendered } from './check-system';

const spies = vi.hoisted(() => ({
  createDesignServer: vi.fn(),
  createDrawQueue: vi.fn(),
  bespoke: vi.fn(async () => []),
  dropped: vi.fn(async () => []),
  actionLost: vi.fn(async () => []),
  render: vi.fn(async () => ({ unavailable: 'no Chromium in this spec' })),
}));

vi.mock('../serve', async (actual) => ({
  ...(await actual<typeof import('../serve')>()),
  createDesignServer: spies.createDesignServer,
}));
vi.mock('../thumb', async (actual) => ({
  ...(await actual<typeof import('../thumb')>()),
  createDrawQueue: spies.createDrawQueue,
}));
vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: spies.render,
}));
vi.mock('./bespoke-controls', () => ({ bespokeControlProblemsOf: spies.bespoke }));
vi.mock('./dropped-props', async (actual) => ({
  ...(await actual<typeof import('./dropped-props')>()),
  droppedPropProblemsOf: spies.dropped,
}));
vi.mock('./action-lost', async (actual) => ({
  ...(await actual<typeof import('./action-lost')>()),
  actionLostProblemsOf: spies.actionLost,
}));

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-warm-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const drawsOf = () =>
  [spies.render, spies.bespoke, spies.dropped, spies.actionLost].map(
    (step) => (step.mock.calls.at(-1) as unknown as [{ warm?: WarmDraw }] | undefined)?.[0].warm,
  );

const checked = async (warm?: WarmDraw) => {
  vi.stubEnv('CI', '1');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.values(spies).forEach((spy) => spy.mockClear());

  const target = acme();

  await checkSystemRendered({
    target,
    config: readConfig(target) ?? {},
    products: ['acme'],
    chromiumOf: async () => null,
    warm,
  });

  return drawsOf();
};

describe('design check on a warm draw', () => {
  it('hands one per-run draw of the warm process to every drawing step and starts no design server or Chromium of its own', async () => {
    const warm: WarmDraw = { server: vi.fn(), queue: vi.fn() };
    const draws = await checked(warm);

    expect(new Set(draws).size).toBe(1);
    expect(draws[0]).toMatchObject({ server: warm.server, queue: warm.queue, perRun: true });
    expect(spies.createDesignServer).not.toHaveBeenCalled();
    expect(spies.createDrawQueue).not.toHaveBeenCalled();
  });

  it('shares one per-run draw between the drawing steps without a warm process', async () => {
    const draws = await checked();

    expect(new Set(draws).size).toBe(1);
    expect(draws[0]?.perRun).toBe(true);
  });
});

import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../paths';
import { WarmDraw } from '../warm-draw';
import { checkSystemRendered } from './check-system';

const spies = vi.hoisted(() => ({
  createDesignServer: vi.fn(),
  createDrawQueue: vi.fn(),
  bespoke: vi.fn(async () => []),
  dropped: vi.fn(async () => []),
  actionLost: vi.fn(async () => []),
}));

vi.mock('../serve', async (actual) => ({
  ...(await actual<typeof import('../serve')>()),
  createDesignServer: spies.createDesignServer,
}));
vi.mock('../thumb', async (actual) => ({
  ...(await actual<typeof import('../thumb')>()),
  createDrawQueue: spies.createDrawQueue,
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

describe('design check on a warm draw', () => {
  it('hands the warm draw to every drawing step and starts no design server or Chromium of its own', async () => {
    vi.stubEnv('CI', '1');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const target = acme();
    const warm: WarmDraw = { server: vi.fn(), queue: vi.fn() };

    await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      chromiumOf: async () => null,
      warm,
    });

    for (const step of [spies.bespoke, spies.dropped, spies.actionLost])
      expect(step).toHaveBeenCalledWith(expect.objectContaining({ warm }));
    expect(spies.createDesignServer).not.toHaveBeenCalled();
    expect(spies.createDrawQueue).not.toHaveBeenCalled();
  });
});

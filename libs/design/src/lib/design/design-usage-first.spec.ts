import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';

const calls = vi.hoisted(() => ({ libBuild: 0, resident: 0 }));

vi.mock('./system/stale-dist', () => ({
  readFreshDist: vi.fn(async () => {
    calls.libBuild += 1;

    return { ok: true, release: () => undefined };
  }),
}));

vi.mock('./resident/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./resident/client')>();

  return {
    ...original,
    realResidentClient: vi.fn(() => {
      calls.resident += 1;

      return {};
    }),
    runThroughResident: vi.fn(async () => {
      calls.resident += 1;

      return null;
    }),
  };
});

describe('design usage errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'design-usage-'));

  afterEach(() => {
    calls.libBuild = 0;
    calls.resident = 0;
  });

  it.each([
    ['an unknown flag', ['sketch', 'ready', 'pages/sketches@x', '--by', 'm', '--variant', 'x']],
    ['a missing --by', ['sketch', 'ready', 'pages/sketches@x']],
    ['an unknown flag on sketch check', ['sketch', 'check', '--nope']],
  ])('exits 2 on %s before the resident call and the lib build', async (_name, argv) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(designCommand({ root, argv, invocation: 'et design' })).resolves.toBe(2);
    expect(error.mock.calls.flat().join('\n')).toContain('usage: et design sketch ready');
    expect(calls).toEqual({ libBuild: 0, resident: 0 });
    error.mockRestore();
  });

  it('removes its scratch root', () => {
    rmSync(root, { recursive: true, force: true });
  });
});

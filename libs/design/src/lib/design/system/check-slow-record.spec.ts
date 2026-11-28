import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { recordCheckedBuildReady } from './check-record';
import { acme, output } from './check-system.fixtures';
import { checkSlow } from './slow-run';

vi.mock('./slow-run', async (actual) => ({
  ...(await actual<typeof import('./slow-run')>()),
  checkSlow: vi.fn(async () => 0),
}));

vi.mock('./check-record', async (actual) => {
  const real = await actual<typeof import('./check-record')>();

  return { ...real, recordCheckedBuildReady: vi.fn(real.recordCheckedBuildReady) };
});

describe('design check --slow', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes the check record of each part it ran, as the fast check of that part does', async () => {
    const target = acme();

    output();

    await checkDesign({
      target,
      argv: ['--product', 'acme', '--part', 'elements/hero', '--slow'],
      invocation: 'et design',
    });

    expect(checkSlow).toHaveBeenCalledOnce();
    expect(vi.mocked(recordCheckedBuildReady).mock.calls.map(([options]) => options.parts)).toEqual([
      ['elements/hero'],
    ]);
  });
});

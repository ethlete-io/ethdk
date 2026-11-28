import { describe, expect, it, vi } from 'vitest';
import type { ResolvedProduct } from './resolve-product';
import { checkActions, partActionFailuresOf } from './actions-command';

vi.mock('./harness-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./harness-map')>()),
  harnessStaleOf: () => null,
}));

const product = { name: 'studio', parts: [] } as unknown as ResolvedProduct;

describe('partActionFailuresOf', () => {
  it('hands the root of the harness it started to the action check, which keys its cache by that app', async () => {
    const check = vi.fn<typeof checkActions>(async () => ({ lines: [], hosts: [], pictures: null, embedded: 0 }));

    await partActionFailuresOf({
      target: '/checkout',
      config: {},
      product,
      part: 'components/button',
      start: async () => ({ url: 'http://harness.invalid', root: '/harness/app', stop: async () => undefined }),
      check,
    });

    expect(check.mock.calls[0]?.[0].appRoot).toBe('/harness/app');
  });
});

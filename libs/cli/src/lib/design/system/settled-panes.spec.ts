import { describe, expect, it, vi } from 'vitest';
import { settle } from './action-press';
import { settledPanesOf } from './settled-panes';

type Page = Parameters<typeof settledPanesOf>[0]['page'];

const pageOf = () => {
  const waitForFunction = vi.fn(() => Promise.reject(new Error('Timeout 1ms exceeded')));

  return { page: { waitForFunction } as unknown as Page, waitForFunction };
};

describe('waits with a spent budget', () => {
  it('settledPanesOf gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await expect(settledPanesOf({ page, count: 1, timeout: 0 })).resolves.toBe(false);

    for (const call of waitForFunction.mock.calls as unknown as [string, unknown, { timeout: number }][])
      expect(call[2].timeout).toBe(1);
  });

  it('settle gives Playwright 1 ms, not the 0 it reads as no limit', async () => {
    const { page, waitForFunction } = pageOf();

    await settle(page, 0);

    expect((waitForFunction.mock.calls[0] as unknown as [string, unknown, { timeout: number }])[2].timeout).toBe(1);
  });
});

import { Locator, Page, expect } from '@playwright/test';

const SETTLE_MS = 50;

export async function expectTouchMode(page: Page): Promise<void> {
  const isCoarsePointer = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

  expect(isCoarsePointer).toBe(true);
}

export async function tap(locator: Locator, settleMs = SETTLE_MS): Promise<void> {
  await locator.tap();
  await locator.page().waitForTimeout(settleMs);
}

import { Page } from '@playwright/test';

const SETTLE_MS = 75;

export async function pressKey(page: Page, key: string, settleMs = SETTLE_MS): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(settleMs);
}

export async function pressKeys(page: Page, keys: string[], settleMs = SETTLE_MS): Promise<void> {
  for (const key of keys) {
    await pressKey(page, key, settleMs);
  }
}

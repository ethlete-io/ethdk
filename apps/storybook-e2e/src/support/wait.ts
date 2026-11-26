import { Page } from '@playwright/test';

/**
 * Waits a fixed time. Use it only for a test that must prove that nothing happens - a paused
 * autoplay timer, a tooltip that never opens. Everything else needs a web assertion, which
 * retries and does not slow the suite down.
 */
export async function settle(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

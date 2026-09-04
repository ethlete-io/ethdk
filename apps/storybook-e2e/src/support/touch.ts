import { CDPSession, Locator, Page, expect } from '@playwright/test';

const SETTLE_MS = 50;

export async function expectTouchMode(page: Page): Promise<void> {
  const isCoarsePointer = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

  expect(isCoarsePointer).toBe(true);
}

export async function tap(locator: Locator, settleMs = SETTLE_MS): Promise<void> {
  await locator.tap();
  await locator.page().waitForTimeout(settleMs);
}

export interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchDragOptions {
  /** Time the finger rests on `from` before it moves, for long-press gestures. */
  holdMs?: number;
  steps?: number;
}

/** Drags one finger from `from` to `to` through CDP, so the page sees real touch events, not synthesized pointer events. */
export async function touchDrag(
  page: Page,
  from: TouchPoint,
  to: TouchPoint,
  opts: TouchDragOptions = {},
): Promise<void> {
  const { holdMs = 0, steps = 12 } = opts;
  const client: CDPSession = await page.context().newCDPSession(page);

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });

  if (holdMs > 0) await page.waitForTimeout(holdMs);

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;

    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }

  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function touchSwipe(page: Page, from: TouchPoint, to: TouchPoint, steps = 12): Promise<void> {
  await touchDrag(page, from, to, { steps });
}

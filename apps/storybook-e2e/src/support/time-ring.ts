import { Locator, Page } from '@playwright/test';
import { boxOf } from './geometry';
import { TouchPoint } from './touch';

/** The `et-time-picker` handles sit on the track at 112 of the ring's 140 px half-width. */
const TRACK_SHARE = 0.8;

/** The point on the track of an `et-time-picker` ring where a minute of the day sits, midnight at the top. */
export async function ringPoint(ring: Locator, minute: number): Promise<TouchPoint> {
  const box = await boxOf(ring);
  const radius = (box.width / 2) * TRACK_SHARE;
  const angle = (minute / 1440) * 2 * Math.PI;

  return {
    x: box.x + box.width / 2 + radius * Math.sin(angle),
    y: box.y + box.height / 2 - radius * Math.cos(angle),
  };
}

export async function clickRing(page: Page, ring: Locator, minute: number): Promise<void> {
  const point = await ringPoint(ring, minute);

  await page.mouse.click(point.x, point.y);
}

export async function tapRing(page: Page, ring: Locator, minute: number): Promise<void> {
  const point = await ringPoint(ring, minute);

  await page.touchscreen.tap(point.x, point.y);
}

/** Presses the mouse at one minute and drags along the ring through the others, keeping the button down. */
export async function mouseDownAlongRing(
  page: Page,
  ring: Locator,
  start: number,
  path: readonly number[],
): Promise<void> {
  const from = await ringPoint(ring, start);
  const rest = await Promise.all(path.map((minute) => ringPoint(ring, minute)));

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();

  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
}

/** Drags one finger along the ring through CDP, so the page sees real touch input. */
export async function touchDragAlongRing(
  page: Page,
  ring: Locator,
  start: number,
  path: readonly number[],
): Promise<void> {
  const from = await ringPoint(ring, start);
  const rest = await Promise.all(path.map((minute) => ringPoint(ring, minute)));
  const client = await page.context().newCDPSession(page);

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });

  for (const point of rest) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }

  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

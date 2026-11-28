import { Browser } from '../thumb';
import { HARNESS_HOST_SELECTOR } from './part-compare';

export const HARNESS_ERROR_SELECTOR = '[data-design-harness-error]';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export class HarnessRefusedError extends Error {}

/**
 * Waits until the harness page shows its host element and throws a `HarnessRefusedError` carrying the harness's own
 * error text when the page shows its error marker instead.
 */
export const waitForHarnessHost = async (page: Page, timeout: number) => {
  await page
    .locator(`${HARNESS_HOST_SELECTOR}, ${HARNESS_ERROR_SELECTOR}`)
    .first()
    .waitFor({ state: 'attached', timeout });

  const marker = page.locator(HARNESS_ERROR_SELECTOR).first();

  if ((await marker.count()) > 0) {
    const part = new URL(page.url()).searchParams.get('part') ?? '';
    const text = ((await marker.textContent()) ?? '').trim();

    throw new HarnessRefusedError(`harness refused part ${part}: ${text}`);
  }

  await page.locator(HARNESS_HOST_SELECTOR).first().waitFor({ state: 'visible', timeout });
};

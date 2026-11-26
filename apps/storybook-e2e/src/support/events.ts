import { Locator } from '@playwright/test';

type Counted = HTMLElement & { __clicks: number };

export async function countClicks(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    const counted = el as Counted;
    counted.__clicks = 0;
    el.addEventListener('click', () => (counted.__clicks += 1));
  });
}

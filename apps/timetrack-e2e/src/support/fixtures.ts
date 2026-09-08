import { test as base } from '@playwright/test';
import { seedWorld } from './seed-world';

/**
 * The instant every spec starts at. Time then runs forward normally. The playwright config pins the
 * browser to UTC, so the local calendar day is `E2E_DAY_KEY` whatever zone the run happens on.
 */
export const E2E_NOW = '2026-08-12T18:00:00.000Z';

/** The day the default fixture describes, as the app keys it. */
export const E2E_DAY_KEY = '2026-08-12';

/**
 * `page` with the default world already seeded. A spec that needs more calls `seedWorld` itself: the
 * later `addInitScript` runs last and its seed wins.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await seedWorld(page, { now: E2E_NOW });
    await use(page);
  },
});

export { expect } from '@playwright/test';

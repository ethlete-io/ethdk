import { Page } from '@playwright/test';

/**
 * Routes to one of the views the sidebar no longer links — start, week and sync.
 *
 * The hash is written inside the page rather than navigated to: the fake host keeps the day's edits
 * and everything else it was told in the document, so a reload would take them with it.
 */
export const goToView = async (page: Page, view: 'start' | 'week' | 'sync') => {
  await page.evaluate((path) => {
    window.location.hash = `#/${path}`;
  }, view);
};

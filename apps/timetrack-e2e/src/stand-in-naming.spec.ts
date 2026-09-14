import { Page } from '@playwright/test';
import { defaultSettings } from '@ethlete/timetrack/testing';
import {
  E2E_NOW,
  closeDebug,
  editSurface,
  expect,
  openBand,
  openWaitingForAName,
  readTray,
  seedWorld,
  test,
} from './support';

/** What the fixture's keyless branch is called, which is what the drafted name reads as. */
const DRAFTED_NAME = 'Pdf export';

/** A name given on an earlier day. The panel offers it rather than asking for the work again. */
const STAND_IN = {
  id: 'stand-in-pdf',
  name: 'The export nobody filed yet',
  state: 'open' as const,
  days: [],
  author: 'user' as const,
  createdAt: new Date(0),
};

const bandNamed = (page: Page, name: string) => page.locator(`[data-kind="row"][title^="${name}"]`);

test.describe('naming work Jira does not hold yet', () => {
  test('names the work in one press, with no field to fill in', async ({ page }) => {
    await page.goto('/day');
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Name it myself' }).first().click();

    await expect(bandNamed(page, DRAFTED_NAME)).toHaveCount(1);
  });

  test('leaves the named band waiting on a ticket rather than bookable', async ({ page }) => {
    await page.goto('/day');
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Name it myself' }).first().click();
    await expect(bandNamed(page, DRAFTED_NAME)).toHaveCount(1);
    await closeDebug(page);

    const title = await bandNamed(page, DRAFTED_NAME).getAttribute('title');

    await openBand(page, title as string);

    await expect(editSurface(page).getByRole('checkbox')).not.toBeChecked();
    await expect.poll(async () => (await readTray(page))?.total).toContain('waiting on a ticket');
  });

  test('offers a name already given, so the next context takes it instead of retyping it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: { ...defaultSettings(), standIns: [STAND_IN] } });
    await page.goto('/day');
    await openWaitingForAName(page);

    const field = page.locator('et-form-field').filter({ hasText: 'Or a name you gave' }).first();

    await expect(field).toBeVisible();
    await field.locator('et-select').click();
    await page.getByRole('option', { name: STAND_IN.name }).click();

    await expect(bandNamed(page, STAND_IN.name)).toHaveCount(1);
  });
});

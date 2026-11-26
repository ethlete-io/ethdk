import { Page } from '@playwright/test';
import { expect, readBackend, seedWorld, test } from './support';

const notYetNamed = (page: Page) => page.locator('[data-kind="row"][title^="Not yet named"]');

test.describe('filing a ticket for a band that is not yet named', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page);
    await page.goto('/day');
  });

  test('names the band with the ticket it filed', async ({ page }) => {
    await expect(notYetNamed(page)).toHaveCount(1);
    await notYetNamed(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Create a ticket' }).click();

    await expect(page.locator('ethlete-create-ticket')).toBeVisible();
    await page.getByRole('button', { name: 'Create in Jira' }).click();
    await page.getByRole('button', { name: 'File it now' }).click();

    await expect.poll(async () => (await readBackend(page)).jira.created.length).toBe(1);

    const key = (await readBackend(page)).jira.created[0]?.key ?? '';

    await page.locator('ethlete-day-debug').getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(page.locator(`[data-kind="row"][title^="${key}"]`)).toHaveCount(1);
    await expect(notYetNamed(page)).toHaveCount(0);
  });
});

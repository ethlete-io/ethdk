import { Page } from '@playwright/test';
import { E2E_PARENT_ID, E2E_PARENT_KEY, E2E_REPO, defaultSettings, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_NOW, closeStandIns, editSurface, expect, openBand, openStandIns, seedWorld, test } from './support';

/** The checkout is work and files its tickets in ABC. Nothing yet says which issue that work is. */
const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const band = (page: Page) => page.locator('[data-kind="row"][data-stand-in]');

test.describe('a linked checkout Jira holds no ticket for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
  });

  test('opens its own stand-in without being asked for one', async ({ page }) => {
    await openStandIns(page);

    await expect(page.locator('ethlete-stand-ins-list [data-stand-in]')).toHaveCount(1);
  });

  test('draws the band as work that is named and still waiting', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);
    await expect(band(page)).toHaveAttribute('title', /Pdf export/);
    await expect(band(page)).toHaveClass(/et-color--pending/);
  });

  test('names it from the branch and says in the list what it drew on', async ({ page }) => {
    await openStandIns(page);

    const card = page.locator('ethlete-stand-ins-list [data-stand-in]').first();

    await expect(card).toContainText('Pdf export');
  });
});

test.describe('the band of a checkout that waits on a ticket', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
    await expect(band(page)).toHaveCount(1);
  });

  test('says in its own modal what it waits for', async ({ page }) => {
    await openBand(page, (await band(page).getAttribute('title')) as string);

    await expect(editSurface(page).locator('[data-stand-in-waiting]')).toContainText('waiting on a ticket');
    await expect(editSurface(page).locator('[data-stand-in-waiting]')).toContainText('1 day');
  });

  test('opens the ticket form on that stand-in from one press', async ({ page }) => {
    await openBand(page, (await band(page).getAttribute('title')) as string);
    await editSurface(page).getByRole('button', { name: 'File its ticket' }).click();

    const form = page.locator('ethlete-stand-ins-list ethlete-create-ticket');

    await expect(form).toBeVisible();
    await expect(form).toContainText('A ticket for Pdf export');
    await expect(form).toContainText('Filing it resolves the placeholder');
  });

  test('titles that dialog with the placeholder it was opened on, not with the list', async ({ page }) => {
    await openBand(page, (await band(page).getAttribute('title')) as string);
    await editSurface(page).getByRole('button', { name: 'File its ticket' }).click();

    await expect(page.getByRole('heading', { name: 'Pdf export', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting on a ticket' })).toHaveCount(0);
  });
});

test.describe('the ticket a stand-in was waiting for', () => {
  test('resolves the stand-in when it is filed, and gives the band the key', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
    await expect(band(page)).toHaveCount(1);

    await openStandIns(page);

    const card = page.locator('ethlete-stand-ins-list [data-stand-in]').first();

    await card.getByRole('button', { name: 'File a ticket' }).click();
    await card.getByRole('button', { name: 'Create in Jira' }).click();

    await expect(card).toContainText(/Filed ABC-/);
    await expect(card).toContainText('is no longer waiting');
    await expect(card).toHaveAttribute('data-state', 'resolved');
    await expect(band(page)).toHaveCount(0);
  });
});

const goTo = (page: Page, view: 'Day' | 'Settings') =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: view }).click();

/**
 * The work under the checkout is still unnamed after the delete, so the next pass would open a
 * replacement within seconds. Every replacement also replaced the rule of the one before it, which
 * left that record open and in the list for good — four rows for one checkout on a real day.
 */
test.describe('a stand-in the app opened and the user deleted', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
    await expect(band(page)).toHaveCount(1);

    await openStandIns(page);
    await page
      .locator('ethlete-stand-ins-list [data-stand-in]')
      .first()
      .getByRole('button', { name: 'Delete' })
      .click();
  });

  test('stays deleted, and the checkout goes back to waiting for a name', async ({ page }) => {
    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);
    await expect(page.locator('ethlete-stand-ins-list [data-stand-in]')).toHaveCount(0);
  });

  test('is opened again once the settings screen allows the checkout', async ({ page }) => {
    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);

    await closeStandIns(page);
    await goTo(page, 'Settings');
    await page.getByRole('tab', { name: 'The day' }).click();

    const refused = page.locator(`[data-no-stand-in="${E2E_REPO}"]`);

    await expect(refused).toContainText(E2E_REPO);
    await refused.getByRole('button', { name: 'Allow again' }).click();

    await goTo(page, 'Day');
    await expect(band(page)).toHaveCount(1);
  });
});

test.describe('a checkout no link covers', () => {
  test('opens nothing, and the day keeps asking about it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/day');

    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);
    await expect((await openStandIns(page)).locator('[data-stand-in]')).toHaveCount(0);
  });
});

/** Five earlier days on the one task the project's hours went to, which is what makes the offer. */
const HISTORY = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-11'].map((day, index) =>
  tempoWorklogOn({ day, minutes: 120, issueId: E2E_PARENT_ID, id: `w-history-${index}`, description: 'SDK work' }),
);

/**
 * The record already names the checkout an issue, so a placeholder would answer a question nobody has.
 * Worse, the rule it writes replaces the one the offer would have written and the offer reads a rule as
 * an answer — so accepting it would never be possible again.
 */
test.describe('a linked checkout the record already names an issue for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
      tempo: { worklogs: HISTORY },
    });
    await page.goto('/day');
    await expect(page.locator(`[data-offer="${E2E_REPO}"]`)).toContainText(E2E_PARENT_KEY);
  });

  test('opens no stand-in, and keeps offering the issue', async ({ page }) => {
    await expect(band(page)).toHaveCount(0);
    await expect((await openStandIns(page)).locator('[data-stand-in]')).toHaveCount(0);
  });
});

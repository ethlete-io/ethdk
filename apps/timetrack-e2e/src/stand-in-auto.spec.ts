import { Page } from '@playwright/test';
import { E2E_PARENT_ID, E2E_PARENT_KEY, E2E_REPO, defaultSettings, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_NOW, editSurface, expect, openBand, seedWorld, test } from './support';

/** The checkout is work and files its tickets in ABC. Nothing yet says which issue that work is. */
const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const band = (page: Page) => page.locator('[data-kind="row"][data-stand-in]');

const openList = async (page: Page) => {
  await page.locator('[data-waiting-on-a-ticket]').click();
  await expect(page.locator('ethlete-stand-ins')).toBeVisible();
};

test.describe('a linked checkout Jira holds no ticket for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
  });

  test('opens its own stand-in without being asked for one', async ({ page }) => {
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveText(/1 waiting on a ticket/);
  });

  test('draws the band as work that is named and still waiting', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);
    await expect(band(page)).toHaveAttribute('title', /Pdf export/);
    await expect(band(page)).toHaveClass(/et-color--pending/);
  });

  test('names it from the branch and says in the list what it drew on', async ({ page }) => {
    await openList(page);

    const card = page.locator('ethlete-stand-ins [data-stand-in]').first();

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

    const form = page.locator('ethlete-stand-ins ethlete-create-ticket');

    await expect(form).toBeVisible();
    await expect(form).toContainText('A ticket for Pdf export');
    await expect(form).toContainText('Filing it resolves the placeholder');
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

    await openList(page);

    const card = page.locator('ethlete-stand-ins [data-stand-in]').first();

    await card.getByRole('button', { name: 'File a ticket' }).click();
    await card.getByRole('button', { name: 'Create in Jira' }).click();

    await expect(card).toContainText(/Filed ABC-/);
    await expect(card).toContainText('is no longer waiting');
    await expect(card).toHaveAttribute('data-state', 'resolved');
    await expect(band(page)).toHaveCount(0);
  });
});

test.describe('a checkout no link covers', () => {
  test('opens nothing, and the day keeps asking about it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/day');

    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveCount(0);
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
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveCount(0);
    await expect(band(page)).toHaveCount(0);
  });
});

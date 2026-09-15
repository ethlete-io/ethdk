import { Page } from '@playwright/test';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openWaitingForAName, seedWorld, test } from './support';

const ABC = { key: 'ABC', name: 'Fifagg' };

const openSuggestions = async (page: Page) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Suggestions' }).click();
};

test.describe('the name list the anonymiser reads', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { repoPath: E2E_REPO },
      jira: { projects: [ABC] },
      settings: { ...defaultSettings(), favoriteProjects: [ABC] },
    });
    await page.goto('/day');
  });

  test('offers the picked project by key and by name, and a press moves one onto the list', async ({ page }) => {
    await openSuggestions(page);

    const list = page.locator('ethlete-masked-names');

    await expect(list.locator('[data-offered-name="ABC"]')).toBeVisible();
    await expect(list.locator('[data-offered-name="Fifagg"]')).toBeVisible();

    await list.locator('[data-offered-name="Fifagg"]').click();

    await expect(list.locator('[data-masked-name="Fifagg"]')).toBeVisible();
    await expect(list.locator('[data-offered-name="Fifagg"]')).toHaveCount(0);
    await expect(list.locator('[data-offered-name="ABC"]')).toBeVisible();
  });

  test('takes a typed name and gives it back on Remove', async ({ page }) => {
    await openSuggestions(page);

    const list = page.locator('ethlete-masked-names');

    await list.locator('input.et-input-native').fill('Braune');
    await list.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(list.locator('[data-masked-name="Braune"]')).toBeVisible();

    await list.getByRole('button', { name: 'Stop masking Braune' }).click();

    await expect(list.locator('[data-masked-name="Braune"]')).toHaveCount(0);
  });
});

test.describe('the prompt preview', () => {
  test('marks a capitalised word the list does not hold, and the press masks it', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { repoPath: E2E_REPO },
      jira: { projects: [ABC] },
      settings: { ...defaultSettings(), favoriteProjects: [ABC] },
    });
    await page.goto('/day');

    const strip = await openWaitingForAName(page);
    const warning = strip.locator('ethlete-unmasked-words');
    const details = strip.locator('details').filter({ hasText: 'What gets sent' });

    await details.locator('> summary').click();
    await expect(details.locator('pre')).toContainText('ABC-3010');
    await expect(warning.locator('[data-unmasked-word="ABC"]')).toBeVisible();

    await warning.locator('[data-unmasked-word="ABC"]').click();

    await expect(warning.locator('[data-unmasked-word="ABC"]')).toHaveCount(0);
    await expect(details.locator('pre')).not.toContainText('ABC-3010');
  });
});

test.describe('the ticket form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Create a ticket' }).click();
  });

  test('asks the model behind a press labelled Ask AI', async ({ page }) => {
    await expect(
      page.locator('ethlete-create-ticket').getByRole('button', { name: 'Ask AI', exact: true }),
    ).toBeVisible();
  });

  test('marks what its own payload sends as written, and the press masks it', async ({ page }) => {
    const form = page.locator('ethlete-create-ticket');
    const warning = form.locator('ethlete-unmasked-words');
    const details = form.locator('details').filter({ hasText: 'What gets sent' });

    await details.locator('> summary').click();
    await expect(details.locator('pre')).toContainText('ABC-3010');

    await warning.locator('[data-unmasked-word="ABC"]').click();

    await expect(details.locator('pre')).not.toContainText('ABC-3010');
  });
});

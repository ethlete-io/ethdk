import { Page } from '@playwright/test';
import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, pickIssue, seedWorld, test } from './support';

/** The name the user gave the work before Jira held a ticket for it. */
const STAND_IN = {
  id: 'stand-in-pdf',
  name: 'The export nobody filed yet',
  state: 'open' as const,
  days: ['2026-08-12'],
  author: 'user' as const,
  createdAt: new Date(0),
};

/** The keyless stretch of the fixture day, named by the stand-in rather than by a key. */
const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

const list = (page: Page) => page.locator('ethlete-stand-ins');

const card = (page: Page) => list(page).locator(`[data-stand-in="${STAND_IN.id}"]`);

const band = (page: Page) => page.locator(`[data-kind="row"][title^="${STAND_IN.name}"]`);

const namedBand = (page: Page) => page.locator('[data-kind="row"][title^="ABC-2000"]');

const openList = async (page: Page) => {
  await page.locator('[data-waiting-on-a-ticket]').click();
  await expect(list(page)).toBeVisible();
};

test.describe('the work waiting on a ticket', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [STAND_IN] },
    });
    await page.goto('/day');
  });

  test('is counted in the day header, and the count opens the list', async ({ page }) => {
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveText(/1 waiting on a ticket/);

    await openList(page);

    await expect(card(page)).toContainText(STAND_IN.name);
  });

  test('gives its band the key once it is resolved', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);

    await openList(page);
    await pickIssue(page, card(page), /ABC-2000/);
    await card(page).getByRole('button', { name: 'Resolve' }).click();

    await expect(card(page)).toContainText('Resolved to ABC-2000');
    await expect(namedBand(page)).toHaveCount(1);
    await expect(band(page)).toHaveCount(0);
  });

  test('takes the key back off the band when the resolve is undone', async ({ page }) => {
    await openList(page);
    await pickIssue(page, card(page), /ABC-2000/);
    await card(page).getByRole('button', { name: 'Resolve' }).click();
    await expect(namedBand(page)).toHaveCount(1);

    await card(page).getByRole('button', { name: 'Undo' }).click();

    await expect(band(page)).toHaveCount(1);
    await expect(namedBand(page)).toHaveCount(0);
  });

  test('puts its band back to waiting for a name once it is deleted', async ({ page }) => {
    await openList(page);
    await card(page).getByRole('button', { name: 'Delete' }).click();

    await expect(card(page)).toHaveCount(0);
    await expect(band(page)).toHaveCount(0);
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveCount(0);
  });
});

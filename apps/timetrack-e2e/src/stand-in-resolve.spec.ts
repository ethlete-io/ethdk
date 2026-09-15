import { Page } from '@playwright/test';
import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openStandIns, pickIssue, seedWorld, test } from './support';

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

const list = (page: Page) => page.locator('ethlete-stand-ins-list');

const card = (page: Page) => list(page).locator(`[data-stand-in="${STAND_IN.id}"]`);

const band = (page: Page) => page.locator(`[data-kind="row"][title^="${STAND_IN.name}"]`);

const namedBand = (page: Page) => page.locator('[data-kind="row"][title^="ABC-2000"]');

test.describe('the work waiting on a ticket', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [STAND_IN] },
    });
    await page.goto('/day');
  });

  test('is listed under the name the user gave it', async ({ page }) => {
    await openStandIns(page);

    await expect(card(page)).toContainText(STAND_IN.name);
  });

  test('gives its band the key once it is resolved', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);

    await openStandIns(page);
    await pickIssue(page, card(page), /ABC-2000/);
    await card(page).getByRole('button', { name: 'Resolve' }).click();

    await expect(card(page)).toContainText('Resolved to ABC-2000');
    await expect(namedBand(page)).toHaveCount(1);
    await expect(band(page)).toHaveCount(0);
  });

  test('takes the key back off the band when the resolve is undone', async ({ page }) => {
    await openStandIns(page);
    await pickIssue(page, card(page), /ABC-2000/);
    await card(page).getByRole('button', { name: 'Resolve' }).click();
    await expect(namedBand(page)).toHaveCount(1);

    await card(page).getByRole('button', { name: 'Undo' }).click();

    await expect(band(page)).toHaveCount(1);
    await expect(namedBand(page)).toHaveCount(0);
  });

  test('offers the model the whole stand-in from the ticket form it opens', async ({ page }) => {
    await openStandIns(page);
    await card(page).getByRole('button', { name: 'File a ticket' }).click();

    const form = page.locator('ethlete-create-ticket');
    const details = form.locator('details').filter({ hasText: 'What gets sent' });

    await expect(form.getByRole('button', { name: 'Ask AI', exact: true })).toBeVisible();

    await details.locator('> summary').click();

    await expect(details.locator('pre')).toContainText(STAND_IN.name);
    await expect(details.locator('pre')).toContainText('"days": 1');
    await expect(details.locator('pre')).not.toContainText('minutes');
  });

  test('puts its band back to waiting for a name once it is deleted', async ({ page }) => {
    await openStandIns(page);
    await card(page).getByRole('button', { name: 'Delete' }).click();

    await expect(card(page)).toHaveCount(0);
    await expect(band(page)).toHaveCount(0);
    await expect(list(page).locator('[data-stand-in]')).toHaveCount(0);
  });
});

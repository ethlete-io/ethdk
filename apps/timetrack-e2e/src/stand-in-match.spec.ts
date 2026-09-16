import { Page } from '@playwright/test';
import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openStandIns, seedWorld, test } from './support';

/** A stand-in that names its project, so the parents and the open issues are read before the press. */
const STAND_IN = {
  id: 'stand-in-export',
  name: 'The export nobody filed yet',
  description: 'It writes the month as one file.',
  projectKey: 'ABC',
  state: 'open' as const,
  days: ['2026-08-12'],
  author: 'user' as const,
  createdAt: new Date(0),
};

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

const form = (page: Page) => page.locator('ethlete-create-ticket');

const summaryField = (page: Page) => form(page).locator('et-form-field').filter({ hasText: 'Summary' });

const parentField = (page: Page) => form(page).locator('et-form-field').filter({ hasText: 'Parent' });

const matchPress = (page: Page) => form(page).getByRole('button', { name: 'Ask AI to find a match' });

const openTheForm = async (page: Page) => {
  await openStandIns(page);
  await page.locator(`[data-stand-in="${STAND_IN.id}"]`).getByRole('button', { name: 'File a ticket' }).click();
};

test.describe('asking what already tracks the work the user named', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [STAND_IN] },
    });
    await page.goto('/day');
  });

  test('offers the press on a stand-in, whose words the user wrote themselves', async ({ page }) => {
    await openTheForm(page);

    await expect(matchPress(page)).toBeVisible();
  });

  test('leaves the summary and the description exactly as the user wrote them', async ({ page }) => {
    await openTheForm(page);
    await expect(summaryField(page).locator('input')).toHaveValue(STAND_IN.name);

    await matchPress(page).click();

    await expect(page.getByText('This work may already have a ticket.')).toBeVisible();
    await expect(summaryField(page).locator('input')).toHaveValue(STAND_IN.name);
    await expect(form(page).locator('et-textarea textarea')).toHaveValue(STAND_IN.description);
  });

  test('fills the parent and names the issue that may already be this work', async ({ page }) => {
    await openTheForm(page);

    await matchPress(page).click();

    await expect(parentField(page)).toContainText(/ABC-/);
    await expect(page.getByText('it names the same work')).toBeVisible();
  });

  test('files nothing on its own, so the issue it named is still the user to take', async ({ page }) => {
    await openTheForm(page);

    await matchPress(page).click();
    await expect(page.getByText('it names the same work')).toBeVisible();

    await expect(form(page).getByRole('button', { name: /^Log on ABC-/ })).toBeVisible();
    await expect(page.locator(`[data-stand-in="${STAND_IN.id}"]`)).not.toContainText('Resolved to');
  });
});

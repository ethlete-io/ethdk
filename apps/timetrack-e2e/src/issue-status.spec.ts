import { Page } from '@playwright/test';
import { E2E_ISSUE_KEY } from '@ethlete/timetrack/testing';
import { E2E_NOW, editSurface, expect, openBand, readBackend, seedWorld, test } from './support';

const KEYED_BAND = `${E2E_ISSUE_KEY} · 1h 30m`;

const statusControl = (page: Page) => editSurface(page).locator(`[data-issue-status="${E2E_ISSUE_KEY}"]`);

const statusRequests = async (page: Page) =>
  (await readBackend(page)).requests.filter((request) => request.url.includes(`/issue/${E2E_ISSUE_KEY}`));

const standingIn = async (page: Page) =>
  (await readBackend(page)).jira.issues.find((issue) => issue.key === E2E_ISSUE_KEY)?.status;

test.describe('the status of the issue a band names', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/day');
  });

  test('is read when the band is opened, not when the day loads', async ({ page }) => {
    await expect(page.locator(`[data-kind="row"][title="${KEYED_BAND}"]`)).toBeVisible();
    expect(await statusRequests(page)).toEqual([]);

    await openBand(page, KEYED_BAND);

    await expect(statusControl(page).locator('[data-status-name]')).toHaveText('Backlog');
  });

  test('offers the moves the workflow offers and moves the issue on a press', async ({ page }) => {
    await openBand(page, KEYED_BAND);
    await statusControl(page).getByRole('button', { name: 'Change status' }).click();

    const moves = statusControl(page).getByRole('group', { name: 'Move to' }).getByRole('button');

    await expect(moves).toHaveText(['In Progress', 'Done']);

    await moves.filter({ hasText: 'In Progress' }).click();

    await expect(statusControl(page).locator('[data-status-name]')).toHaveText('In Progress');
    await expect(statusControl(page).getByRole('group', { name: 'Move to' })).toBeHidden();
    await expect.poll(() => standingIn(page)).toBe('In Progress');
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
  });

  test('has no control on a band that names no issue', async ({ page }) => {
    await page.locator('[data-kind="row"][title^="Not yet named"]').first().click();
    await expect(editSurface(page)).toBeVisible();

    await expect(editSurface(page).locator('[data-issue-status]')).toHaveCount(0);
  });
});

test.describe('a move Jira refuses', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      faults: [
        {
          url: `/issue/${E2E_ISSUE_KEY}/transitions`,
          method: 'POST',
          status: 400,
          body: { errorMessages: ['A resolution is required.'] },
        },
      ],
    });
    await page.goto('/day');
  });

  test('shows why a refused move did not happen and leaves the status as it was', async ({ page }) => {
    await openBand(page, KEYED_BAND);
    await statusControl(page).getByRole('button', { name: 'Change status' }).click();
    await statusControl(page).getByRole('button', { name: 'Done' }).click();

    await expect(statusControl(page).locator('[data-status-error]')).toContainText('A resolution is required.');
    await expect(statusControl(page).locator('[data-status-name]')).toHaveText('Backlog');
    expect(await standingIn(page)).toBeUndefined();
  });
});

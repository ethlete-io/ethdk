import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_PARENT_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, readStoredSettings, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

const idle = (clock: string, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
  at: at(clock),
  source: 'idle',
  kind,
});

const aDayWithABreak = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:22', '09:37', '09:52', '10:07', '10:22'].map(editing),
  idle('10:22', 'idle-start'),
  idle('11:43', 'idle-end'),
  { at: at('11:43'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_PARENT_BRANCH },
  ...['11:43', '11:58', '12:13', '12:28', '12:43', '13:00'].map(editing),
];

const goTo = (page: Page, view: 'Day' | 'Settings') =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: view }).click();

const pick = async (page: Page, field: 'Date' | 'Clock', option: string) => {
  await page.locator('et-form-field').filter({ hasText: field }).locator('et-select').click();
  await page.getByRole('option', { name: option }).click();
};

test.describe('how dates and times read', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDayWithABreak() });
    await page.goto('/day');
  });

  test('is day-month and 24 hours until the user says otherwise', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Wednesday, 12 August' })).toBeVisible();
    await expect(page.locator('[data-break]').first()).toHaveAttribute('title', '10:15 - 11:30');
  });

  test('follows the month-day and 12-hour settings', async ({ page }) => {
    await goTo(page, 'Settings');
    await pick(page, 'Date', 'Oct 7');
    await pick(page, 'Clock', '12-hour');
    await goTo(page, 'Day');

    await expect(page.getByRole('heading', { name: 'Wednesday, August 12' })).toBeVisible();
    await expect(page.locator('[data-break]').first()).toHaveAttribute('title', '10:15 AM - 11:30 AM');
    await expect
      .poll(async () => (await readStoredSettings(page))?.display)
      .toEqual({
        dateStyle: 'month-day',
        clock: '12h',
      });
  });

  test('writes ISO dates', async ({ page }) => {
    await goTo(page, 'Settings');
    await pick(page, 'Date', '2026-10-07');
    await goTo(page, 'Day');

    await expect(page.getByRole('heading', { name: '2026-08-12' })).toBeVisible();
  });
});

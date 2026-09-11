import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_KEYLESS_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string, title: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'com.microsoft.VSCode',
  title,
});

/**
 * One checkout, worked on the branch that names an issue and then on one that names none, with no
 * gap between them. The default fixture leaves half an hour between the two, and a merge is only
 * offered where one band ends where the next starts.
 */
const twoBandsThatMeet = (): CollectedEvent[] => [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:00', '09:25', '09:50'].map((clock) => editing(clock, 'invite.ts - fut-frontend - Visual Studio Code')),
  { at: at('10:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_KEYLESS_BRANCH },
  ...['10:00', '10:25', '10:50'].map((clock) => editing(clock, 'pdf-export.ts - fut-frontend - Visual Studio Code')),
  { at: at('11:00'), source: 'idle', kind: 'idle-start' },
];

test.beforeEach(async ({ page }) => {
  await seedWorld(page, { now: E2E_NOW, events: twoBandsThatMeet() });
  await page.goto('/day');
  await expect(bands(page)).toHaveCount(2);
});

test.describe('the band menu of an observed row', () => {
  test('offers no reset while the row still is what the engine proposed', async ({ page }) => {
    await bands(page).first().click({ button: 'right' });

    await expect(item(page, 'Split in half')).toBeVisible();
    await expect(item(page, 'Reset to the proposal')).toBeHidden();
  });

  test('names no removal, because only a hand-written row can be removed', async ({ page }) => {
    await bands(page).first().click({ button: 'right' });

    await expect(item(page, 'Hide this row')).toBeVisible();
    await expect(item(page, 'Remove this row')).toBeHidden();
  });

  test('offers the reset once a merge has edited the row', async ({ page }) => {
    await merge(page, bands(page).first());
    await expect(bands(page)).toHaveCount(1);

    await bands(page).first().click({ button: 'right' });

    await expect(item(page, 'Reset to the proposal')).toBeVisible();
  });

  test('gives both bands back when the reset runs from the band itself', async ({ page }) => {
    const proposed = await bands(page).first().getAttribute('title');

    await merge(page, bands(page).first());
    await bands(page).first().click({ button: 'right' });
    await item(page, 'Reset to the proposal').click();

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', `${proposed}`);
  });
});

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });

const merge = async (page: Page, band: Locator) => {
  await band.click({ button: 'right' });
  await item(page, 'Merge with the next band').click();
  await expect(page.locator('et-menu')).toBeHidden();
};

import { Page, expect, test } from '@playwright/test';

/**
 * The prospective flow: a ticket, the branch the grammar names for it, and a draft merge request.
 *
 * The branch carries `<KEY>` in the plan and the real key in the outcome, which is the one thing
 * about this flow that cannot be shown before it runs. Every test drives it through the form the way
 * a user does, so what the plan promises and what the run reports are checked against each other.
 */
const openTheForm = async (page: Page) => {
  await page.getByRole('link', { name: 'Start' }).click();
  await page.getByLabel('Repository').click();
  await page.getByRole('option', { name: '/Users/e2e/dev/fut-frontend' }).click();
  // the project field is a picker over the instance's projects, and it takes a typed key too
  const project = page.locator('ethlete-project-select input');

  await project.fill('ABC');
  await project.press('Enter');
  await page.getByLabel('Summary').fill('Logout confirmation');
};

test.describe('starting work', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('names the branch before anything is filed', async ({ page }) => {
    await openTheForm(page);

    const summary = page.getByRole('definition');

    await expect(summary.nth(0)).toHaveText('feat/<KEY>-logout-confirmation');
    await expect(summary.nth(1)).toHaveText('origin/next');
    await expect(summary.nth(2)).toHaveText('next');
  });

  test('shows every step and its undo before anything runs', async ({ page }) => {
    await openTheForm(page);

    const steps = page.getByRole('listitem');

    await expect(steps.filter({ hasText: 'File a Task in ABC' })).toBeVisible();
    await expect(
      steps.filter({ hasText: 'git switch -c feat/<KEY>-logout-confirmation --no-track origin/next' }),
    ).toBeVisible();
    await expect(steps.filter({ hasText: 'git push -u origin feat/<KEY>-logout-confirmation' })).toBeVisible();
    await expect(page.getByText('Undo: git push origin --delete feat/<KEY>-logout-confirmation')).toBeVisible();
  });

  test('nests the branch under the story it rolls up to', async ({ page }) => {
    await openTheForm(page);
    await page.getByRole('button', { name: /ABC-2000/ }).click();

    const summary = page.getByRole('definition');

    await expect(summary.nth(0)).toHaveText('sub/feat/ABC-2000-member-onboarding/<KEY>-logout-confirmation');
    await expect(summary.nth(2)).toHaveText('feat/ABC-2000-member-onboarding');
  });

  test('runs nothing until the steps are confirmed', async ({ page }) => {
    await openTheForm(page);

    await expect(page.getByRole('button', { name: 'Run these steps' })).toBeEnabled();
    await expect(page.getByText('Started')).toBeHidden();
  });

  test('refuses a summary it cannot name a branch from', async ({ page }) => {
    await openTheForm(page);
    await page.getByLabel('Summary').fill('');

    await expect(page.getByText('it is both the issue title and the branch subject')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run these steps' })).toBeHidden();
  });

  test('reports the issue, the branch and the draft merge request after the run', async ({ page }) => {
    await openTheForm(page);
    await page.getByRole('button', { name: 'Run these steps' }).click();

    await expect(page.getByText(/ABC-9999 is filed and you are on feat\/ABC-9999-logout-confirmation/)).toBeVisible();
    await expect(
      page.getByText('https://gitlab.example.com/braune-digital/fut-frontend/-/merge_requests/42'),
    ).toBeVisible();
  });
});

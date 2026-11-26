import { Page } from '@playwright/test';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { TimetrackSettings } from '@ethlete/timetrack';
import { E2E_NOW, askAgent, editSurface, expect, openApprovals, queuedId, seedWorld, test } from './support';

const withAutoMode = (settings: TimetrackSettings): TimetrackSettings => ({
  ...settings,
  reasoning: { ...settings.reasoning, autoMode: true },
});

const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const heading = (page: Page) => page.locator('ethlete-day-review header h2');
const autoCreate = (page: Page) => page.locator('[data-band-approval][data-op="jira.create"]');

const goToThePreviousDay = async (page: Page) => {
  await expect(autoCreate(page)).toHaveCount(1);

  const today = (await heading(page).textContent()) ?? '';

  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(heading(page)).not.toHaveText(today);
  await expect(autoCreate(page)).toHaveCount(0);

  return today;
};

test.describe('a create auto mode queued for a band of another day', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');
  });

  test('takes the day screen to that day and opens the band', async ({ page }) => {
    const today = await goToThePreviousDay(page);
    const dialog = await openApprovals(page);

    await dialog.locator('[data-op="jira.create"]').getByRole('button', { name: 'Show on the day' }).click();

    await expect(dialog).toBeHidden();
    await expect(heading(page)).toHaveText(today);
    await expect(editSurface(page).locator('[data-row-approval]')).toContainText(/New issue\s*Drafted/);
  });
});

test.describe('a create auto mode queued for a stand-in no band of the day in view holds', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      jira: { issues: [] },
      settings: withAutoMode({ ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] }),
    });
    await page.goto('/day');
  });

  test('opens the ticket of its stand-in in the stand-ins, and leaves the day where it is', async ({ page }) => {
    await goToThePreviousDay(page);

    const shown = await heading(page).textContent();
    const dialog = await openApprovals(page);

    await dialog.locator('[data-op="jira.create"]').getByRole('button', { name: 'Show in stand-ins' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('ethlete-stand-ins-list ethlete-create-ticket')).toBeVisible();
    await expect(heading(page)).toHaveText(shown ?? '');
  });
});

test.describe('a create a CLI asks for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/day');
  });

  test('offers no place to show it, since it names neither a band nor a stand-in', async ({ page }) => {
    const id = queuedId(
      await askAgent(page, {
        op: 'jira.create',
        summary: 'Export the bracket',
        description: 'Asked from a CLI.',
        projectKey: 'ABC',
        client: 'Claude Code',
      }),
    );
    const dialog = await openApprovals(page);
    const item = dialog.locator(`[data-approval="${id}"]`);

    await expect(item.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(item.locator('[data-show]')).toHaveCount(0);
  });
});

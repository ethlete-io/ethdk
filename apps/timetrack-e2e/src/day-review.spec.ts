import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  FakeJiraIssue,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, addAnEntry, expect, openBand, openWaitingForAName, seedWorld, test } from './support';

const ABC = { key: 'ABC', name: 'Alpha' };

/** A second project the user picked, which the linked checkout must keep out of its picker. */
const BETA = { key: 'XYZ', name: 'Beta' };

test.describe('the day view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('reconstructs the seeded morning into a row that names its issue', async ({ page }) => {
    await expect(page.locator('[data-kind="row"]').first()).toHaveAttribute('title', 'ABC-3010 · 1h 30m');
    await expect(page.getByText('feat(users): Invite a member by email').first()).toBeVisible();
  });

  /**
   * The work nothing could name is a band of its own, drawn once. It used to be a block behind the
   * rows as well, which drew the same hour twice.
   */
  test('reports the work no issue claims as a band rather than dropping it', async ({ page }) => {
    await expect(page.getByText(/matched no issue/).first()).toBeVisible();

    const bands = page.locator('[data-kind="row"]');

    await expect(bands).toHaveCount(2);
    await expect(bands.nth(1)).toHaveAttribute('title', 'Not yet named · 1h 0m');
  });

  test('says so when the agent named nothing, rather than looking unpressed', async ({ page }) => {
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Ask for suggestions' }).click();

    await expect(page.getByText('The agent had no suggestion')).toBeVisible();
  });

  test('runs the agent again when the button offers to', async ({ page }) => {
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Ask for suggestions' }).click();

    const again = page.getByRole('button', { name: 'Ask again' });

    await expect(again).toBeVisible();

    await again.click();

    await expect(page.getByText('Suggested ABC-3010')).toBeVisible();
  });

  test('opens the create-ticket form on no parent, never on a guess', async ({ page }) => {
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const parent = page.locator('et-form-field').filter({ hasText: 'Parent' }).locator('input');

    await expect(parent).toHaveValue('');
  });

  test('drafts the summary and the description from what the work left behind', async ({ page }) => {
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const field = (label: string) => page.locator('et-form-field').filter({ hasText: label });

    await expect(field('Summary').locator('input')).toHaveValue('Pdf export');
    await expect(field('Description').locator('textarea')).toHaveValue(/Recorded from .* on branch feat\/pdf-export/);
  });

  test('quotes only the commit subject, never a window title', async ({ page }) => {
    await openWaitingForAName(page);
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const description = page.locator('et-form-field').filter({ hasText: 'Description' }).locator('textarea');

    await expect(description).toHaveValue(/Try pdfkit for the invoice export/);
    await expect(description).not.toHaveValue(/pdf-export\.ts/);
  });
});

/**
 * A row's checkout is what decides which project its picker offers, so the fixture holds an issue of
 * a second picked project: without the scope, the picker would offer it too.
 */
test.describe('the day view, with the checkout linked to one project', () => {
  const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;

  const ISSUES: FakeJiraIssue[] = [
    { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated: UPDATED },
    { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'Member onboarding', issueType: 'Story', updated: UPDATED },
    { id: '10400', key: 'XYZ-4200', summary: 'Invoice run', issueType: 'Task', updated: UPDATED },
  ];

  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      jira: { issues: ISSUES, projects: [ABC, BETA] },
      settings: {
        ...defaultSettings(),
        favoriteProjects: [ABC, BETA],
        projectLinks: [
          { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: ABC.key }, createdAt: new Date(0) },
        ],
      },
    });
    await page.goto('/day');
  });

  test('offers only the linked project on a row the checkout is behind', async ({ page }) => {
    const surface = await openBand(page, 'ABC-3010 · 1h 30m');

    await surface.locator('ethlete-issue-select et-select').click();

    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { name: /ABC-3010/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /XYZ-4200/ })).toHaveCount(0);
  });

  test('offers every picked project on a row no checkout is behind', async ({ page }) => {
    const surface = await addAnEntry(page);

    await surface.locator('ethlete-issue-select et-select').click();

    await expect(page.getByRole('option', { name: /ABC-3010/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /XYZ-4200/ })).toBeVisible();
  });
});

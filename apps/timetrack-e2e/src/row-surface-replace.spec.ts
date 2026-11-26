import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_BRANCH,
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  FakeJiraIssue,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, pickIssue, saveSurface, seedWorld, test } from './support';

const ABC = { key: 'ABC', name: 'Alpha' };

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string, title: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'com.microsoft.VSCode',
  title,
});

const twoBands = (): CollectedEvent[] => [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:00', '09:25', '09:50'].map((clock) => editing(clock, 'invite.ts - fut-frontend - Visual Studio Code')),
  { at: at('10:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_KEYLESS_BRANCH },
  ...['10:00', '10:25', '10:50'].map((clock) => editing(clock, 'pdf-export.ts - fut-frontend - Visual Studio Code')),
  { at: at('11:00'), source: 'idle', kind: 'idle-start' },
];

const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;

const ISSUES: FakeJiraIssue[] = [
  { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated: UPDATED },
  { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'Member onboarding', issueType: 'Story', updated: UPDATED },
];

test.beforeEach(async ({ page }) => {
  await seedWorld(page, {
    now: E2E_NOW,
    events: twoBands(),
    jira: { issues: ISSUES, projects: [ABC] },
    settings: {
      ...defaultSettings(),
      favoriteProjects: [ABC],
      projectLinks: [
        { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: ABC.key }, createdAt: new Date(0) },
      ],
    },
  });
  await page.goto('/day');
  await expect(bands(page)).toHaveCount(2);
});

test.describe('pressing another band while a surface has its issue picker open', () => {
  test('replaces the surface instead of opening a second one, and saves to the band it was opened for', async ({
    page,
  }) => {
    const [first, second] = [bands(page).first(), bands(page).last()];
    const firstTitle = await first.getAttribute('title');

    await first.click();
    await expect(editSurface(page)).toHaveCount(1);
    await editSurface(page).locator('ethlete-issue-select et-select').click();
    await expect(page.getByRole('option').first()).toBeVisible();

    await second.click();

    await expect(page.locator('.et-overlay-runtime-entry')).toHaveCount(1);
    await expect(editSurface(page)).toHaveCount(1);
    await pickIssue(page, editSurface(page), new RegExp(E2E_PARENT_KEY));
    await saveSurface(page);

    await expect(first).toHaveAttribute('title', `${firstTitle}`);
    await expect(second).toHaveAttribute('title', new RegExp(`^${E2E_PARENT_KEY}`));
  });
});

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

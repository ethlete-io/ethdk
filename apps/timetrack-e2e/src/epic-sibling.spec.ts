import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The second checkout: the same work's specifications, which the branch grammar knows no type for. */
const SPECS_REPO = '/Users/e2e/dev/specs';

/** Both branches end in `pdf-export`, which is the whole of what joins the two checkouts. */
const SPECS_BRANCH = 'spec/pdf-export';

const FREE_CHILD = 'ABC-3011';
const SECOND_FREE_CHILD = 'ABC-3012';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string, title: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title,
});

const EVENTS: CollectedEvent[] = [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_KEYLESS_BRANCH },
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: SPECS_REPO, branch: SPECS_BRANCH },
  editing('09:00', 'invite.ts - fut-frontend - Visual Studio Code'),
  editing('09:15', 'invite.ts - fut-frontend - Visual Studio Code'),
  editing('09:30', 'pdf-export.md - specs - Visual Studio Code'),
  editing('09:45', 'pdf-export.md - specs - Visual Studio Code'),
  editing('10:00', 'pdf-export.md - specs - Visual Studio Code'),
];

/** The frontend checkout's own answer, written down. The specs checkout has none. */
const NAMES_THE_FRONTEND = {
  id: 'rule-frontend',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'issue' as const, issueKey: E2E_ISSUE_KEY },
  author: 'user' as const,
  createdAt: new Date(0),
};

const linked = (id: string, path: string) => ({
  id,
  path,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
});

const settings = () => ({
  ...defaultSettings(),
  attributionRules: [NAMES_THE_FRONTEND],
  projectLinks: [linked('link-frontend', E2E_REPO), linked('link-specs', SPECS_REPO)],
  nudge: { ...defaultSettings().nudge, enabled: false },
});

const issue = (key: string, summary: string) => ({
  id: key.replace('ABC-', '1'),
  key,
  summary,
  issueType: 'Task',
  parentKey: E2E_PARENT_KEY,
  updated: E2E_NOW,
});

/** The epic, the task the frontend books, and the open task nobody books yet. */
const ISSUES = [
  { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'PDF export', issueType: 'Epic', updated: E2E_NOW },
  {
    id: E2E_ISSUE_ID,
    key: E2E_ISSUE_KEY,
    summary: 'User management',
    issueType: 'Task',
    parentKey: E2E_PARENT_KEY,
    updated: E2E_NOW,
  },
  issue(FREE_CHILD, 'Write the export specification'),
];

const open = (page: Page, issues: typeof ISSUES) =>
  seedWorld(page, {
    now: E2E_NOW,
    events: EVENTS,
    settings: settings(),
    git: { extraRepos: [SPECS_REPO] },
    jira: { issues },
  }).then(() => page.goto('/day'));

const rows = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

/**
 * ADR 0029. The two checkouts share nothing but the last segment of their branch names, and both link
 * to the same Jira project — so a project link can never tell them apart, and only the epic can.
 */
test.describe('a checkout that shares a branch name with a checkout that is already named', () => {
  test('books the one open child of the named issue’s epic that nobody else holds', async ({ page }) => {
    await open(page, ISSUES);

    await expect(rows(page).filter({ hasText: E2E_ISSUE_KEY })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: FREE_CHILD })).toHaveCount(1);
  });

  test('names the sibling checkout and the epic in the row’s evidence', async ({ page }) => {
    await open(page, ISSUES);

    await rows(page).filter({ hasText: FREE_CHILD }).click();

    await expect(page.getByRole('heading', { name: 'Evidence' })).toBeVisible();
    await expect(page.getByText(`\`fut-frontend\` books ${E2E_ISSUE_KEY} on the same branch name`)).toBeVisible();
    await expect(page.getByText(`only other open child of ${E2E_PARENT_KEY} (Epic)`)).toBeVisible();
  });

  test('names nothing when the two checkouts file into different Jira projects', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: EVENTS,
      settings: {
        ...settings(),
        projectLinks: [
          linked('link-frontend', E2E_REPO),
          { ...linked('link-specs', SPECS_REPO), target: { kind: 'project' as const, projectKey: 'XYZ' } },
        ],
      },
      git: { extraRepos: [SPECS_REPO] },
      jira: { issues: ISSUES },
    });
    await page.goto('/day');

    await expect(rows(page).filter({ hasText: E2E_ISSUE_KEY })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: FREE_CHILD })).toHaveCount(0);
  });

  test('names nothing when the epic holds a second open child nobody books', async ({ page }) => {
    await open(page, [...ISSUES, issue(SECOND_FREE_CHILD, 'Review the export specification')]);

    await expect(rows(page).filter({ hasText: E2E_ISSUE_KEY })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: FREE_CHILD })).toHaveCount(0);
    await expect(rows(page).filter({ hasText: SECOND_FREE_CHILD })).toHaveCount(0);
  });
});

/** How deep the rung reads an epic is a guard on a network read, so the user sets it. */
test.describe('the epic child limit', () => {
  test('is offered on the Jira tab, showing the number the day reads with', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: { ...settings(), epicChildLimit: 500 } });
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Jira' }).click();

    await expect(page.getByText('How far an epic is read')).toBeVisible();
    await expect(page.locator('et-form-field').filter({ hasText: 'Children read' })).toContainText('500 children');
  });
});

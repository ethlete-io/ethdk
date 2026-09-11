import { Locator, Page } from '@playwright/test';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  FakeJiraIssue,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, addAnEntry, expect, openBand, readBackend, seedWorld, test } from './support';

const ABC = { key: 'ABC', name: 'Alpha' };

/** A second picked project, so a scope that does not reach Jira is visible as an issue nobody asked for. */
const XYZ = { key: 'XYZ', name: 'Beta' };

const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;

const ISSUES: FakeJiraIssue[] = [
  { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated: UPDATED },
  { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'Member onboarding', issueType: 'Story', updated: UPDATED },
  { id: '10400', key: 'XYZ-4200', summary: 'Invoice run', issueType: 'Task', updated: UPDATED },
];

test.beforeEach(async ({ page }) => {
  await seedWorld(page, {
    now: E2E_NOW,
    jira: { issues: ISSUES, projects: [ABC, XYZ] },
    settings: {
      ...defaultSettings(),
      favoriteProjects: [ABC, XYZ],
      projectLinks: [
        { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: ABC.key }, createdAt: new Date(0) },
      ],
    },
  });
  await page.goto('/day');
});

test.describe('an issue picker', () => {
  test('asks Jira for its own project, rather than reading every project and dropping most of it', async ({ page }) => {
    await openPicker(await openBand(page, 'ABC-3010 · 1h 30m'));

    await expect
      .poll(() => jqls(page))
      .toContain('project in ("ABC") AND statusCategory != Done ORDER BY updated DESC');
  });

  test('searches Jira for what is typed, so the answer is not limited to the page in hand', async ({ page }) => {
    const picker = await openPicker(await addAnEntry(page));

    await type(picker, 'invoice');

    await expect(page.getByRole('option', { name: /XYZ-4200/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /ABC-3010/ })).toHaveCount(0);
    await expect.poll(() => jqls(page)).toContainEqual(expect.stringContaining('text ~ "invoice*"'));
  });

  test('lets typing rest, so a word costs one call and not one per letter', async ({ page }) => {
    const picker = await openPicker(await addAnEntry(page));

    await picker.locator('input[etSelectSearch]').pressSequentially('invoice', { delay: 20 });

    await expect(page.getByRole('option', { name: /XYZ-4200/ })).toBeVisible();
    await expect
      .poll(async () => (await jqls(page)).filter((jql) => jql.includes('text ~')))
      .toEqual(['project in ("ABC", "XYZ") AND statusCategory != Done AND text ~ "invoice*" ORDER BY updated DESC']);
  });

  test('answers a whole key with that issue, even outside the project it is narrowed to', async ({ page }) => {
    const picker = await openPicker(await openBand(page, 'ABC-3010 · 1h 30m'));

    await type(picker, 'XYZ-4200');

    await expect(page.getByRole('option', { name: /XYZ-4200/ })).toBeVisible();
    await expect.poll(() => jqls(page)).toContainEqual(expect.stringContaining('key in (XYZ-4200)'));
  });
});

const openPicker = async (surface: Locator) => {
  const picker = surface.locator('ethlete-issue-select et-select');

  await picker.click();

  return picker;
};

const type = (picker: Locator, text: string) => picker.locator('input[etSelectSearch]').fill(text);

/** Every JQL the app has asked Jira for, read at the wire rather than off the screen. */
const jqls = async (page: Page) =>
  (await readBackend(page)).requests
    .map((request) => new URL(request.url).searchParams.get('jql'))
    .filter((jql): jql is string => !!jql);

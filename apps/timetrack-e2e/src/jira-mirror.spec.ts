import { Page } from '@playwright/test';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_REPO,
  FakeBackend,
  TIMETRACK_E2E_BACKEND_KEY,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { TimetrackSettings } from '@ethlete/timetrack';
import { E2E_NOW, editSurface, expect, openAutoModeReadout, openStandIns, seedWorld, test } from './support';

const OLD_KEY = 'ABC-4242';

const JIRA = {
  issues: [
    {
      id: E2E_ISSUE_ID,
      key: E2E_ISSUE_KEY,
      summary: 'User management',
      issueType: 'Task',
      updated: '2026-08-11T08:00:00.000Z',
    },
    ...Array.from({ length: 150 }, (_, index) => ({
      id: `${40000 + index}`,
      key: `ABC-${20000 + index}`,
      summary: `Other work ${index}`,
      issueType: 'Task',
      updated: '2026-08-10T08:00:00.000Z',
    })),
    {
      id: '39000',
      key: OLD_KEY,
      summary: 'Export the invoice as a PDF',
      issueType: 'Story',
      updated: '2026-01-01T08:00:00.000Z',
    },
  ],
};

const settings = (): TimetrackSettings => {
  const base = defaultSettings();

  return {
    ...base,
    reasoning: { ...base.reasoning, autoMode: true },
    projectLinks: [
      { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: 'ABC' }, createdAt: new Date(0) },
    ],
  };
};

const changeInJira = (page: Page, change: 'done' | 'deleted') =>
  page.evaluate(
    ([key, issueKey, kind]) => {
      const { jira } = (globalThis as Record<string, unknown>)[key] as FakeBackend;

      jira.issues =
        kind === 'done'
          ? jira.issues.map((issue) => (issue.key === issueKey ? { ...issue, status: 'Done' } : issue))
          : jira.issues.filter((issue) => issue.key !== issueKey);
    },
    [TIMETRACK_E2E_BACKEND_KEY, OLD_KEY, change] as const,
  );

const waitingSection = async (page: Page) => {
  await expect(page.locator('[data-band-approval][data-op="autoMode.apply"]')).toContainText(`Auto · Name ${OLD_KEY}`);
  await page.locator('[data-kind="row"][data-stand-in][data-pending]').click();

  const section = editSurface(page).locator('[data-row-approval]');

  await expect(section).toContainText(`${OLD_KEY} Export the invoice as a PDF`);

  return section;
};

const refusalOf = async (page: Page) =>
  (await openAutoModeReadout(page)).locator('[data-auto-entry][data-status="failed"]');

const standInState = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.locator('ethlete-day-debug')).toBeHidden();
  await openStandIns(page);

  return page.locator('ethlete-stand-ins-list [data-stand-in]').first();
};

test.describe('auto mode reading candidates from the Jira mirror', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: settings(), jira: JIRA });
    await page.goto('/day');
  });

  test('offers an old issue whose words the work carries first, and only the best of the project', async ({ page }) => {
    const readout = await openAutoModeReadout(page);
    const call = readout.locator('[data-model-call]').filter({ hasText: '"standIn"' }).first();

    await call.locator('summary').click();

    const sent = JSON.parse(await call.locator('[data-model-call-sent]').innerText()) as { issues: { key: string }[] };

    expect(sent.issues[0]?.key).toBe(OLD_KEY);
    expect(sent.issues.length).toBeLessThanOrEqual(30);
  });

  test('applies the approved match once Jira still holds it open', async ({ page }) => {
    const section = await waitingSection(page);

    await section.getByRole('button', { name: 'Approve' }).click();
    await openStandIns(page);

    const standIn = page.locator('ethlete-stand-ins-list [data-stand-in]').first();

    await expect(standIn).toHaveAttribute('data-state', 'resolved');
    await expect(standIn).toContainText(OLD_KEY);
  });

  test('refuses the approved match once Jira has it done', async ({ page }) => {
    const section = await waitingSection(page);

    await changeInJira(page, 'done');
    await section.getByRole('button', { name: 'Approve' }).click();

    await expect(await refusalOf(page)).toContainText('is done in Jira now');
    await expect(await standInState(page)).toHaveAttribute('data-state', 'open');
  });

  test('refuses the approved match once Jira no longer holds it', async ({ page }) => {
    const section = await waitingSection(page);

    await changeInJira(page, 'deleted');
    await section.getByRole('button', { name: 'Approve' }).click();

    await expect(await refusalOf(page)).toContainText('Jira no longer holds ABC-4242');
    await expect(await standInState(page)).toHaveAttribute('data-state', 'open');
  });
});

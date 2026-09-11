import { Page } from '@playwright/test';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  FakeJiraIssue,
  tempoWorklogOn,
} from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, openWaitingForAName, seedWorld, test } from './support';

const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;

/** An issue of a project nothing on this day touches, so only the history can put it on the list. */
const COLLECTOR: FakeJiraIssue = {
  id: '10400',
  key: 'XYZ-4200',
  summary: 'Invoice run',
  issueType: 'Task',
  updated: UPDATED,
};

const ISSUES: FakeJiraIssue[] = [
  { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated: UPDATED },
  { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'Member onboarding', issueType: 'Story', updated: UPDATED },
  COLLECTOR,
];

/** A week before the day under review, which is inside the span the pattern read already covers. */
const LAST_WEEK = '2026-08-05';

test.describe('what the agent may choose from', () => {
  test('holds an issue only the recent tempo history names', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      jira: { issues: ISSUES },
      tempo: {
        worklogs: [tempoWorklogOn({ day: LAST_WEEK, minutes: 60, issueId: COLLECTOR.id, description: 'Invoice run' })],
      },
    });
    await page.goto('/day');

    const payload = await sentPayload(page);

    await expect(payload).toContainText('ABC-3010');
    await expect(payload).toContainText('XYZ-4200');
  });

  test('holds nothing the day never reached when tempo holds no history', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, jira: { issues: ISSUES } });
    await page.goto('/day');

    const payload = await sentPayload(page);

    await expect(payload).toContainText('ABC-3010');
    await expect(payload).not.toContainText('XYZ-4200');
  });
});

/** The document the review shows before anything is sent, opened out of its own summary. */
const sentPayload = async (page: Page) => {
  const strip = await openWaitingForAName(page);
  const details = strip.locator('details').filter({ hasText: 'What gets sent' });

  await details.locator('> summary').click();

  return details.locator('pre');
};

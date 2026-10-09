import { AgentApiDayRows, CollectedEvent, DayReviewEdits } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, askAgent, expect, seedWorld, test } from './support';

const BOOKED_DAY = '2026-08-11';
const ROW_ID = `${E2E_ISSUE_KEY}@${BOOKED_DAY}T11:00:00.000Z`;

const hourOn = (day: string): CollectedEvent[] => [
  {
    at: new Date(`${day}T11:00:00.000Z`),
    source: 'git',
    kind: 'git-checkout',
    repoPath: E2E_REPO,
    branch: E2E_ISSUE_BRANCH,
  },
  {
    at: new Date(`${day}T11:01:00.000Z`),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: 'user-management.ts - fut-frontend - Visual Studio Code',
  },
  {
    at: new Date(`${day}T11:40:00.000Z`),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: E2E_ISSUE_BRANCH,
    sha: 'a1b2c3d',
    subject: 'Invite a member by email',
  },
  { at: new Date(`${day}T12:00:00.000Z`), source: 'idle', kind: 'idle-start' },
];

const seedBookedDay = (page: Page, storedReviews?: Record<string, unknown>) =>
  seedWorld(page, {
    now: E2E_NOW,
    events: hourOn(BOOKED_DAY),
    tempo: {
      worklogs: [
        tempoWorklogOn({
          day: BOOKED_DAY,
          minutes: 30,
          startTime: '11:00:00',
          id: 'w-1',
          description: 'Invited a member',
        }),
      ],
    },
    ledger: [
      {
        proposalId: ROW_ID,
        day: BOOKED_DAY,
        tempoWorklogId: 'w-1',
        contentHash: 'booked',
        syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
      },
    ],
    ...(storedReviews ? { storedReviews } : {}),
  });

const inputsOf = async (page: Page) => {
  const answer = await askAgent<{ edits: DayReviewEdits }>(page, { op: 'day.inputs', day: BOOKED_DAY });

  return answer.ok ? answer.value.edits : null;
};

const rowsOf = async (page: Page) => {
  const answer = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: BOOKED_DAY });

  return answer.ok ? answer.value.rows : null;
};

const inStoredForm = (value: unknown): unknown => {
  if (value instanceof Date) return { $dateMs: value.getTime() };
  if (Array.isArray(value)) return value.map(inStoredForm);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, inStoredForm(entry)]));
  }

  return value;
};

test.describe('a booked day', () => {
  test('is stored as Tempo holds the row this app wrote, once the day is opened', async ({ page }) => {
    await seedBookedDay(page);
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();

    await expect(page.locator('[data-kind="row"]', { hasText: E2E_ISSUE_KEY })).toContainText('30m');

    const booked = (await inputsOf(page))?.booked;
    const [row] = booked?.review?.rows ?? [];

    expect(booked?.written.map((worklog) => worklog.worklogId)).toEqual(['w-1']);
    expect(row).toMatchObject({
      id: ROW_ID,
      issueKey: E2E_ISSUE_KEY,
      durationMs: 30 * 60_000,
      description: 'Invited a member',
      worklogIds: ['w-1'],
    });
  });

  test('is drawn from the review it was stored with, not by today’s rules', async ({ page }) => {
    await seedBookedDay(page);
    await page.goto('/day');
    await expect.poll(async () => !!(await inputsOf(page))?.booked?.review).toBe(true);

    const stored = await inputsOf(page);
    const review = stored?.booked?.review;

    expect(review).toBeTruthy();

    const asBooked = {
      ...stored,
      booked: {
        ...stored?.booked,
        review: {
          ...review,
          rows: review?.rows.map((row) => ({ ...row, description: 'As it was booked', durationMs: 45 * 60_000 })),
        },
      },
    };

    await seedBookedDay(page, { [BOOKED_DAY]: inStoredForm(asBooked) });
    await page.goto('/day');

    await expect
      .poll(async () => (await rowsOf(page))?.map((row) => [row.id, row.description, row.durationMs]))
      .toEqual([[ROW_ID, 'As it was booked', 45 * 60_000]]);
    expect(inStoredForm((await inputsOf(page))?.booked)).toEqual(inStoredForm(asBooked.booked));
  });
});

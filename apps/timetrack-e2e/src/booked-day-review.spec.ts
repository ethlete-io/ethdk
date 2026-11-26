import { AgentApiDayRows, CollectedEvent, DayReviewEdits } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, askAgent, editSurface, expect, seedWorld, test } from './support';

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

const RECUT_ROW_ID = `${E2E_ISSUE_KEY}@${BOOKED_DAY}T14:00:00.000Z`;

const seedBookedDay = (page: Page, storedReviews?: Record<string, unknown>, options?: { recut?: boolean }) =>
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
        ...(options?.recut
          ? [
              tempoWorklogOn({
                day: BOOKED_DAY,
                minutes: 30,
                startTime: '14:00:00',
                id: 'w-2',
                description: 'Reviewed the invite flow',
              }),
            ]
          : []),
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
      ...(options?.recut
        ? [
            {
              proposalId: RECUT_ROW_ID,
              day: BOOKED_DAY,
              tempoWorklogId: 'w-2',
              contentHash: 'booked',
              syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
            },
          ]
        : []),
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

  test('draws a worklog this app wrote that no stored row carries, without a resync', async ({ page }) => {
    await seedBookedDay(page);
    await page.goto('/day');
    await expect.poll(async () => !!(await inputsOf(page))?.booked?.review).toBe(true);

    const stored = await inputsOf(page);
    const recut = {
      proposalId: RECUT_ROW_ID,
      worklogId: 'w-2',
      issueKey: E2E_ISSUE_KEY,
      from: new Date(`${BOOKED_DAY}T14:00:00.000Z`),
      durationMs: 30 * 60_000,
      description: 'Reviewed the invite flow',
    };
    const storedBefore = {
      ...stored,
      booked: { ...stored?.booked, written: [...(stored?.booked?.written ?? []), recut] },
    };

    await seedBookedDay(page, { [BOOKED_DAY]: inStoredForm(storedBefore) }, { recut: true });
    await page.goto('/day');

    await expect
      .poll(async () => (await rowsOf(page))?.map((row) => [row.id, row.description, row.durationMs]))
      .toEqual([
        [ROW_ID, 'Invited a member', 30 * 60_000],
        [RECUT_ROW_ID, 'Reviewed the invite flow', 30 * 60_000],
      ]);
  });

  test('marks an accepted row Tempo holds none of as not in Tempo', async ({ page }) => {
    await seedBookedDay(page);
    await page.goto('/day');
    await expect.poll(async () => !!(await inputsOf(page))?.booked?.review).toBe(true);

    const stored = await inputsOf(page);
    const review = stored?.booked?.review;
    const [booked] = review?.rows ?? [];
    const unwritten = {
      ...booked,
      id: RECUT_ROW_ID,
      from: new Date(`${BOOKED_DAY}T14:00:00.000Z`),
      to: new Date(`${BOOKED_DAY}T14:30:00.000Z`),
      description: 'Reviewed the invite flow',
      state: 'accepted',
      worklogIds: undefined,
    };

    await seedBookedDay(page, {
      [BOOKED_DAY]: inStoredForm({
        ...stored,
        booked: { ...stored?.booked, review: { ...review, rows: [...(review?.rows ?? []), unwritten] } },
      }),
    });
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();

    await expect(page.locator(`[data-row-id="${RECUT_ROW_ID}"] [data-not-in-tempo]`)).toHaveText('· not in Tempo');
    await expect(page.locator(`[data-row-id="${ROW_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-row-id="${ROW_ID}"] [data-not-in-tempo]`)).toHaveCount(0);
  });

  test('takes no edit on a worklog no stored row carries', async ({ page }) => {
    await seedBookedDay(page);
    await page.goto('/day');
    await expect.poll(async () => !!(await inputsOf(page))?.booked?.review).toBe(true);

    const stored = await inputsOf(page);
    const recut = {
      proposalId: RECUT_ROW_ID,
      worklogId: 'w-2',
      issueKey: E2E_ISSUE_KEY,
      from: new Date(`${BOOKED_DAY}T14:00:00.000Z`),
      durationMs: 30 * 60_000,
      description: 'Reviewed the invite flow',
    };

    await seedBookedDay(
      page,
      {
        [BOOKED_DAY]: inStoredForm({
          ...stored,
          booked: { ...stored?.booked, written: [...(stored?.booked?.written ?? []), recut] },
        }),
      },
      { recut: true },
    );
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();

    const band = page.locator(`[data-row-id="${RECUT_ROW_ID}"]`);
    const drawn = [RECUT_ROW_ID, recut.from.getTime(), 30 * 60_000];
    const recutRow = async () =>
      (await rowsOf(page))?.filter((row) => row.id === RECUT_ROW_ID).map((row) => [row.id, row.fromMs, row.durationMs]);

    await expect(band).toBeVisible();
    await expect(band.locator('.cursor-ns-resize')).toHaveCount(0);

    await band.click();
    await expect.poll(recutRow).toEqual([drawn]);
    await expect(editSurface(page)).toHaveCount(0);

    const box = (await band.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 10 });
    await expect(page.locator('[data-dragging]')).toHaveCount(0);
    await page.mouse.up();
    await expect.poll(recutRow).toEqual([drawn]);

    await band.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Copy as anonymous report' })).toBeVisible();
    await expect(page.getByRole('menuitem')).toHaveCount(1);
  });
});

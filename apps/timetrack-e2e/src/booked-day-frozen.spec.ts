import { AgentApiDayRows, CollectedEvent, DayReviewEdits } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, askAgent, expect, seedWorld, test } from './support';

const BOOKED_DAY = '2026-08-11';
const OPEN_DAY = '2026-08-10';

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

const inputsOf = async (page: Parameters<typeof askAgent>[0], day: string) => {
  const answer = await askAgent<{ edits: DayReviewEdits }>(page, { op: 'day.inputs', day });

  return answer.ok ? answer.value.edits : null;
};

test.describe('a finished day Tempo holds', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [OPEN_DAY, BOOKED_DAY, E2E_DAY_KEY].flatMap(hourOn),
      tempo: {
        worklogs: [BOOKED_DAY, E2E_DAY_KEY].map((day, at) =>
          tempoWorklogOn({ day, minutes: 30, startTime: '15:00:00', id: `w-foreign-${at}` }),
        ),
      },
    });
    await page.goto('/day');
  });

  test('keeps the rows it was booked with, and only that day', async ({ page }) => {
    await expect.poll(async () => !!(await inputsOf(page, BOOKED_DAY))?.frozenRows).toBe(true);

    const rows = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: BOOKED_DAY });
    const frozen = await inputsOf(page, BOOKED_DAY);

    expect(rows.ok && rows.value.rows.map((row) => row.id)).toEqual(frozen?.frozenRows?.proposals.map((row) => row.id));
    expect((await inputsOf(page, OPEN_DAY))?.frozenRows).toBeUndefined();
    expect((await inputsOf(page, E2E_DAY_KEY))?.frozenRows).toBeUndefined();
  });
});

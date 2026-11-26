import { AgentApiDayRows, CollectedEvent, DayReviewEdits } from '@ethlete/timetrack';
import { E2E_ISSUE_KEY, E2E_REPO, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_NOW, askAgent, expect, seedWorld, test } from './support';

const BOOKED_DAY = '2026-08-11';

const events: CollectedEvent[] = [
  {
    at: new Date(`${BOOKED_DAY}T11:00:00.000Z`),
    source: 'git',
    kind: 'git-checkout',
    repoPath: E2E_REPO,
    branch: 'main',
  },
  {
    at: new Date(`${BOOKED_DAY}T11:01:00.000Z`),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: `${E2E_ISSUE_KEY} notes.md - fut-frontend - Visual Studio Code`,
  },
  { at: new Date(`${BOOKED_DAY}T12:00:00.000Z`), source: 'idle', kind: 'idle-start' },
];

const ROW_ID = `${E2E_ISSUE_KEY}@${BOOKED_DAY}T11:00:00.000Z`;

const rowsOf = async (page: Parameters<typeof askAgent>[0]) => {
  const answer = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: BOOKED_DAY });

  return answer.ok ? answer.value : null;
};

const frozenOf = async (page: Parameters<typeof askAgent>[0]) => {
  const answer = await askAgent<{ edits: DayReviewEdits }>(page, { op: 'day.inputs', day: BOOKED_DAY });

  return answer.ok && !!answer.value.edits.frozenRows;
};

test.describe('a booked day with a row auto mode described', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events,
      tempo: { worklogs: [tempoWorklogOn({ day: BOOKED_DAY, minutes: 60, startTime: '11:00:00', id: 'w-1' })] },
      ledger: [
        {
          proposalId: ROW_ID,
          day: BOOKED_DAY,
          tempoWorklogId: 'w-1',
          contentHash: 'booked',
          syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
        },
      ],
      reviewOverrides: {
        [BOOKED_DAY]: { [ROW_ID]: { description: 'Invited members by email', sources: { description: 'auto' } } },
      },
    });
    await page.goto('/day');
  });

  test('keeps the row in the state it was booked in, and the day its logged time', async ({ page }) => {
    await expect.poll(() => frozenOf(page)).toBe(true);

    const day = await rowsOf(page);

    expect(
      day?.rows.map((row) => ({ id: row.id, confidence: row.confidence, state: row.state, edited: row.edited })),
    ).toEqual([{ id: ROW_ID, confidence: 'weak', state: 'edited', edited: true }]);
    expect(day?.loggedMs).toBe(60 * 60_000);
  });
});

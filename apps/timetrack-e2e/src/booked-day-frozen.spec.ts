import { AgentApiDayRows, CollectedEvent, DayReviewEdits } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO, FakeDiscoveredMachine, tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, askAgent, expect, seedWorld, test } from './support';

const BOOKED_DAY = '2026-08-11';
const ELSEWHERE_DAY = '2026-08-10';

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

test.describe('a finished day this app booked', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [ELSEWHERE_DAY, BOOKED_DAY, E2E_DAY_KEY].flatMap(hourOn),
      tempo: {
        worklogs: [ELSEWHERE_DAY, BOOKED_DAY, E2E_DAY_KEY].map((day, at) =>
          tempoWorklogOn({ day, minutes: 30, startTime: '15:00:00', id: `w-${at}` }),
        ),
      },
      ledger: [BOOKED_DAY, E2E_DAY_KEY].map((day) => ({
        proposalId: `booked@${day}`,
        day,
        tempoWorklogId: `w-${day === BOOKED_DAY ? 1 : 2}`,
        contentHash: 'booked',
        syncedAt: new Date(`${day}T16:00:00.000Z`),
      })),
    });
    await page.goto('/day');
  });

  test('keeps the rows it was booked with, and only that day', async ({ page }) => {
    await expect.poll(async () => !!(await inputsOf(page, BOOKED_DAY))?.frozenRows).toBe(true);

    const rows = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: BOOKED_DAY });
    const frozen = await inputsOf(page, BOOKED_DAY);

    expect(rows.ok && rows.value.rows.map((row) => row.id)).toEqual(frozen?.frozenRows?.proposals.map((row) => row.id));
    expect((await inputsOf(page, ELSEWHERE_DAY))?.frozenRows).toBeUndefined();
    expect((await inputsOf(page, E2E_DAY_KEY))?.frozenRows).toBeUndefined();
  });
});

test.describe('a booked day a paired machine’s events reach afterwards', () => {
  const MAC_REPO = '/Users/mac/code/fut-frontend';
  const KEY_OF_EVERY_FAKE_CHECKOUT = 'gitlab.example.com/braune-digital/fut-frontend';
  const CODE = '246810';
  const MACBOOK: FakeDiscoveredMachine = {
    machineId: 'mac-1',
    label: 'MacBook',
    addresses: ['192.168.1.20'],
    port: 52741,
    fingerprint: 'fp-mac',
    paired: false,
    lastSeenMs: new Date(E2E_NOW).getTime(),
  };

  const onTheMac = (minutes: number): CollectedEvent[] => {
    const at = new Date(new Date(`${BOOKED_DAY}T13:00:00.000Z`).getTime() + minutes * 60_000);

    return [
      { at, source: 'window', kind: 'window-focus', appId: 'code', title: 'invite.ts - fut-frontend - Code' },
      {
        at,
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: 'mac',
        cwd: MAC_REPO,
        gitBranch: E2E_ISSUE_BRANCH,
      },
    ];
  };

  test('draws the MacBook’s booked work beside the frozen rows and says the day changed', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: hourOn(BOOKED_DAY),
      tempo: {
        worklogs: [
          tempoWorklogOn({ day: BOOKED_DAY, minutes: 30, startTime: '15:00:00', id: 'w-1' }),
          tempoWorklogOn({ day: BOOKED_DAY, minutes: 120, startTime: '13:00:00', id: 'w-mac' }),
        ],
      },
      ledger: [
        {
          proposalId: `booked@${BOOKED_DAY}`,
          day: BOOKED_DAY,
          tempoWorklogId: 'w-1',
          contentHash: 'booked',
          syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
        },
      ],
      peers: {
        discovered: [MACBOOK],
        code: CODE,
        received: Array.from({ length: 25 }, (_, step) => onTheMac(step * 5)).flatMap((events) =>
          events.map((event) => ({ machineId: MACBOOK.machineId, event })),
        ),
        repoKeys: { [MACBOOK.machineId]: { [MAC_REPO]: KEY_OF_EVERY_FAKE_CHECKOUT } },
      },
    });
    await page.goto('/day');
    await expect.poll(async () => !!(await inputsOf(page, BOOKED_DAY))?.frozenRows).toBe(true);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Sources' }).click();

    const machines = page.locator('[data-paired-machines]');

    await machines.locator('[data-discovered-machine]', { hasText: 'MacBook' }).click();
    await machines.locator('[data-pair-code] input').fill(CODE);
    await machines.getByRole('button', { name: 'Pair', exact: true }).click();
    await expect(machines.locator('[data-pair-done]')).toHaveText('Paired with MacBook.');

    await page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: /^Day / }).click();
    await page.getByRole('button', { name: 'Previous day' }).click();

    await expect(page.locator('[data-peer-band]')).toHaveCount(1);
    await expect(page.locator('[data-peer-band]')).toHaveText('Booked on MacBook');
    await expect(page.locator('[data-changed-after-booking]')).toBeVisible();

    const rows = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: BOOKED_DAY });
    const frozen = await inputsOf(page, BOOKED_DAY);

    expect(rows.ok && rows.value.rows.map((row) => row.id)).toEqual(frozen?.frozenRows?.proposals.map((row) => row.id));
  });
});

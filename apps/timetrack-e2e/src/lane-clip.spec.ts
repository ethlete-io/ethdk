import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_BRANCH,
  E2E_ISSUE_KEY,
  E2E_REPO,
  FakePairedMachine,
  defaultSettings,
  tempoWorklogOn,
} from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const BOOKED_DAY = '2026-08-11';
const SIDE_REPO = '/Users/e2e/dev/side-project';
const LONG_MACHINE = 'Human-MacBook-Pro-With-A-Very-Long-Hostname.local';

const PEER: FakePairedMachine = {
  machineId: 'mac-1',
  label: LONG_MACHINE,
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: new Date(E2E_NOW).getTime(),
  clockOffsetMs: 0,
  pairedAtMs: new Date(E2E_NOW).getTime(),
  lastPullMs: null,
};

const hourIn = (repoPath: string, from: string, to: string): CollectedEvent[] => [
  {
    at: new Date(`${BOOKED_DAY}T${from}:00.000Z`),
    source: 'git',
    kind: 'git-checkout',
    repoPath,
    branch: E2E_ISSUE_BRANCH,
  },
  {
    at: new Date(`${BOOKED_DAY}T${from}:01.000Z`),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: 'user-management.ts - fut-frontend - Visual Studio Code',
  },
  { at: new Date(`${BOOKED_DAY}T${to}:00.000Z`), source: 'idle', kind: 'idle-start' },
];

const peerRow = (laneKey: string, from: string, to: string) => ({
  laneKey,
  from: new Date(`${BOOKED_DAY}T${from}:00.000Z`),
  to: new Date(`${BOOKED_DAY}T${to}:00.000Z`),
  description: '',
  issueKey: E2E_ISSUE_KEY,
  state: 'booked' as const,
  worklogId: 'w-mac',
});

const COLUMNS = '[data-lane], [data-peer-side]';
const LABELS =
  '[data-label], [data-peer-band] > span, [data-behind] > span, [data-break] > span, [data-carried-behind]';

type Box = { x: number; y: number; width: number; height: number };

const boxOf = async (locator: ReturnType<Page['locator']>) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('no box');

  return box;
};

const expectLabelsInColumns = async (page: Page) => {
  const columns = page.locator(COLUMNS);
  const boxes: Box[] = [];

  for (let at = 0; at < (await columns.count()); at++) boxes.push(await boxOf(columns.nth(at)));

  for (let at = 1; at < boxes.length; at++) {
    const before = boxes[at - 1] as Box;
    const column = boxes[at] as Box;

    expect(column.x).toBeGreaterThanOrEqual(before.x + before.width - 1);
  }

  let checked = 0;

  for (let at = 0; at < boxes.length; at++) {
    const column = boxes[at] as Box;
    const labels = columns.nth(at).locator(LABELS);

    for (let label = 0; label < (await labels.count()); label++) {
      const box = await boxOf(labels.nth(label));

      expect(box.x).toBeGreaterThanOrEqual(column.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width + 1);
      checked++;
    }
  }

  expect(checked).toBeGreaterThan(0);
};

const expectNoBandOverBlock = async (page: Page) => {
  const peers = page.locator('[data-peer-band]');
  const blocks = page.locator('[data-kind="row"]');

  for (let at = 0; at < (await peers.count()); at++) {
    const peer = await boxOf(peers.nth(at));

    for (let block = 0; block < (await blocks.count()); block++) {
      const box = await boxOf(blocks.nth(block));
      const apart = box.x >= peer.x + peer.width - 1 || peer.x >= box.x + box.width - 1;
      const stacked = box.y >= peer.y + peer.height || peer.y >= box.y + box.height;

      expect(apart || stacked).toBe(true);
    }
  }
};

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height && b.y < a.y + a.height;

const textBoxOf = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((node) => {
    const range = document.createRange();

    range.selectNodeContents(node);

    const { x, y, width, height } = range.getBoundingClientRect();

    return { x, y, width, height };
  });

const expectNoLabelOverLabel = async (page: Page) => {
  const labels = page.locator(LABELS);
  const boxes: Box[] = [];

  for (let at = 0; at < (await labels.count()); at++) boxes.push(await textBoxOf(labels.nth(at)));

  expect(boxes.length).toBeGreaterThan(1);

  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      expect(intersects(boxes[a] as Box, boxes[b] as Box), `label ${a} over label ${b}`).toBe(false);
    }
  }
};

const expectGapBetweenStackedBoxes = async (page: Page) => {
  const stacked = page.locator('[data-kind="row"], [data-peer-band], [data-behind]');
  const boxes: Box[] = [];

  for (let at = 0; at < (await stacked.count()); at++) boxes.push(await boxOf(stacked.nth(at)));

  for (let a = 0; a < boxes.length; a++) {
    for (let b = 0; b < boxes.length; b++) {
      const first = boxes[a] as Box;
      const second = boxes[b] as Box;
      const sharesColumn = first.x < second.x + second.width - 0.5 && second.x < first.x + first.width - 0.5;

      if (a !== b && sharesColumn) expect(Math.abs(second.y - (first.y + first.height))).toBeGreaterThan(0.5);
    }
  }
};

test.describe('a day with two checkouts and a paired machine with a long name', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { extraRepos: [SIDE_REPO] },
      events: [...hourIn(E2E_REPO, '11:00', '12:00'), ...hourIn(SIDE_REPO, '11:00', '12:00')],
      tempo: { worklogs: [tempoWorklogOn({ day: BOOKED_DAY, minutes: 60, startTime: '11:00:00', id: 'w-mac' })] },
      ledger: [
        {
          proposalId: `booked@${BOOKED_DAY}`,
          day: BOOKED_DAY,
          tempoWorklogId: 'w-mac',
          contentHash: 'booked',
          syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
        },
      ],
      peers: {
        paired: [PEER],
        dayRows: [
          {
            machineId: PEER.machineId,
            rows: {
              day: BOOKED_DAY,
              frozen: true,
              rows: [
                peerRow(`repo:${E2E_REPO}`, '11:00', '12:00'),
                peerRow('repo:/Users/mac/elsewhere', '11:00', '12:00'),
              ],
            },
          },
        ],
      },
    });
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('[data-peer-band]').first()).toBeVisible();
  });

  test('keeps every label inside its own column, and the columns apart', async ({ page }) => {
    await expectLabelsInColumns(page);
    expect(await page.locator('[data-peer-side]').count()).toBeGreaterThan(0);
  });

  test('keeps a peer band off every block', async ({ page }) => {
    await expectNoBandOverBlock(page);
  });
});

test.describe('a day where a worktree worked beside its main checkout', () => {
  const WORKTREE = '/Users/e2e/dev/fut-frontend-altcha';

  const sessionIn = (cwd: string, branch: string): CollectedEvent[] =>
    Array.from({ length: 13 }, (_, step) => ({
      at: new Date(new Date(`${BOOKED_DAY}T09:00:00.000Z`).getTime() + step * 5 * 60_000),
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: `session-${cwd}`,
      cwd,
      gitBranch: branch,
    }));

  test('keeps the overlapping blocks of one lane inside that lane', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [...sessionIn(E2E_REPO, 'fix/security-audit-general'), ...sessionIn(WORKTREE, 'feat/login-altcha')],
      git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
    });
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('[data-lane] [data-kind="row"]').first()).toBeVisible();

    await expectLabelsInColumns(page);
  });
});

test.describe('a day of short rows, background bands and back-to-back stand-ins', () => {
  const WORKTREE = '/Users/e2e/dev/fut-frontend-altcha';
  const FIRST_BRANCH = 'fix/visual-suite';
  const SECOND_BRANCH = 'fix/combobox-round-2';
  const THIRD_BRANCH = 'fix/build-slice';

  const standIn = (id: string, name: string, branch: string) => ({
    id,
    name,
    state: 'open' as const,
    days: [],
    author: 'user' as const,
    createdAt: new Date(0),
    rule: {
      id: `rule-${id}`,
      repoPath: E2E_REPO,
      branch,
      target: { kind: 'stand-in' as const, standInId: id },
      author: 'user' as const,
      createdAt: new Date(0),
    },
  });

  const STAND_INS = [
    standIn('si-1', 'Visual suite slice with a long name', FIRST_BRANCH),
    standIn('si-2', 'Build slice 7.10a with a long name', SECOND_BRANCH),
    standIn('si-3', 'Combobox fix round 2 with a long name', THIRD_BRANCH),
  ];

  const session = (options: { cwd: string; branch: string; from: number; steps: number; title: string }) =>
    Array.from({ length: options.steps }, (_, step) => ({
      at: new Date(new Date(`${BOOKED_DAY}T09:00:00.000Z`).getTime() + (options.from + step * 5) * 60_000),
      source: 'agent-session' as const,
      kind: 'agent-session' as const,
      sessionId: `session-${options.cwd}-${options.branch}`,
      cwd: options.cwd,
      gitBranch: options.branch,
      title: options.title,
    }));

  test('draws no two labels over each other, and leaves a gap between stacked boxes', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        ...session({ cwd: E2E_REPO, branch: FIRST_BRANCH, from: 0, steps: 4, title: 'Visual suite slice' }),
        ...session({ cwd: E2E_REPO, branch: SECOND_BRANCH, from: 15, steps: 4, title: 'Build slice 7.10a' }),
        ...session({ cwd: E2E_REPO, branch: THIRD_BRANCH, from: 30, steps: 4, title: 'Combobox fix round 2' }),
        ...session({ cwd: WORKTREE, branch: E2E_ISSUE_BRANCH, from: 5, steps: 12, title: 'Parallel work' }),
        ...session({ cwd: WORKTREE, branch: E2E_ISSUE_BRANCH, from: 50, steps: 4, title: 'Parallel work' }),
      ],
      git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
      tempo: { worklogs: [tempoWorklogOn({ day: BOOKED_DAY, minutes: 60, startTime: '11:00:00', id: 'w-mac' })] },
      ledger: [
        {
          proposalId: `booked@${BOOKED_DAY}`,
          day: BOOKED_DAY,
          tempoWorklogId: 'w-mac',
          contentHash: 'booked',
          syncedAt: new Date(`${BOOKED_DAY}T16:00:00.000Z`),
        },
      ],
      peers: {
        paired: [PEER],
        dayRows: [
          {
            machineId: PEER.machineId,
            rows: {
              day: BOOKED_DAY,
              frozen: true,
              rows: [
                peerRow(`repo:${E2E_REPO}`, '09:00', '09:15'),
                peerRow(`repo:${E2E_REPO}`, '09:15', '09:30'),
                peerRow(`repo:${E2E_REPO}`, '09:30', '09:45'),
              ],
            },
          },
        ],
      },
      settings: {
        ...defaultSettings(),
        standIns: STAND_INS.map(({ rule: _rule, ...own }) => own),
        attributionRules: STAND_INS.map(({ rule }) => rule),
      },
    });
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('[data-kind="row"]').first()).toBeVisible();

    await expectNoLabelOverLabel(page);
    await expectGapBetweenStackedBoxes(page);
  });
});

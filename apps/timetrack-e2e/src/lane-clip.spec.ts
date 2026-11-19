import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_BRANCH,
  E2E_ISSUE_KEY,
  E2E_REPO,
  FakePairedMachine,
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

const LABELS =
  '[data-label], [data-peer-band] > span, [data-behind] > span, [data-break] > span, [data-carried-behind]';

type Box = { x: number; y: number; width: number; height: number };

const boxOf = async (locator: ReturnType<Page['locator']>) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('no box');

  return box;
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

  test('keeps every label inside its own lane, and the lanes apart', async ({ page }) => {
    const lanes = page.locator('[data-lane]');

    expect(await lanes.count()).toBeGreaterThanOrEqual(3);

    const columns: Box[] = [];

    for (let at = 0; at < (await lanes.count()); at++) columns.push(await boxOf(lanes.nth(at)));

    for (let at = 1; at < columns.length; at++) {
      const before = columns[at - 1] as Box;
      const column = columns[at] as Box;

      expect(column.x).toBeGreaterThanOrEqual(before.x + before.width - 1);
    }

    let checked = 0;

    for (let at = 0; at < columns.length; at++) {
      const labels = lanes.nth(at).locator(LABELS);

      for (let label = 0; label < (await labels.count()); label++) {
        const box = await boxOf(labels.nth(label));

        const column = columns[at] as Box;

        expect(box.x).toBeGreaterThanOrEqual(column.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width + 1);
        checked++;
      }
    }

    expect(checked).toBeGreaterThan(2);
  });

  test('keeps a peer band off the blocks of its lane', async ({ page }) => {
    const peers = page.locator('[data-lane] [data-peer-band]');

    for (let at = 0; at < (await peers.count()); at++) {
      const peer = await boxOf(peers.nth(at));
      const blocks = peers.nth(at).locator('xpath=ancestor::*[@data-lane]').locator('[data-kind="row"]');

      for (let block = 0; block < (await blocks.count()); block++) {
        const box = await boxOf(blocks.nth(block));
        const apart = box.x >= peer.x + peer.width - 1 || peer.x >= box.x + box.width - 1;
        const stacked = box.y >= peer.y + peer.height || peer.y >= box.y + box.height;

        expect(apart || stacked).toBe(true);
      }
    }
  });
});

import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_REPO, FakePairedMachine, defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const MAC_REPO = '/Users/mac/code/fut-frontend';
const SIDE_REPO = '/Users/mac/code/side-project';
const REPO_KEY = 'gitlab.example.com/braune-digital/fut-frontend';

const NAMES_THE_REPO = {
  id: 'rule-fut',
  repoPath: E2E_REPO,
  target: { kind: 'issue' as const, issueKey: 'ABC-4040' },
  author: 'user' as const,
  createdAt: new Date(0),
};

const MACBOOK: FakePairedMachine = {
  machineId: 'mac-1',
  label: 'MacBook',
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: new Date(E2E_NOW).getTime() - 30_000,
  clockOffsetMs: 0,
  pairedAtMs: new Date(E2E_NOW).getTime() - 86_400_000,
  lastPullMs: null,
};

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const focusRun = (options: { from: number; to: number; appId: string; title: string }): CollectedEvent[] =>
  Array.from({ length: (options.to - options.from) / 5 + 1 }, (_, step) => ({
    at: at(options.from + step * 5),
    source: 'window',
    kind: 'window-focus',
    appId: options.appId,
    title: options.title,
  }));

const sessionRun = (from: number, to: number, cwd = MAC_REPO): CollectedEvent[] =>
  Array.from({ length: (to - from) / 5 + 1 }, (_, step) => ({
    at: at(from + step * 5),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: `session-${cwd}`,
    cwd,
    gitBranch: 'next',
  }));

const band = (page: Page, title: string) => page.locator(`[data-kind="row"][title^="${title}"]`);

const seed = (page: Page, options: { received: CollectedEvent[]; private?: boolean }) =>
  seedWorld(page, {
    now: E2E_NOW,
    settings: {
      ...defaultSettings(),
      attributionRules: [NAMES_THE_REPO],
      ...(options.private
        ? { projectLinks: [{ id: 'link-fut', path: E2E_REPO, target: { kind: 'private' }, createdAt: new Date(0) }] }
        : {}),
    },
    events: [],
    peers: {
      paired: [MACBOOK],
      received: options.received.map((event) => ({ machineId: MACBOOK.machineId, event })),
      repoKeys: { [MACBOOK.machineId]: { [MAC_REPO]: REPO_KEY } },
      ownRepoKeys: { [E2E_REPO]: REPO_KEY },
    },
  });

test.describe('a day worked only on the paired MacBook', () => {
  test('shows the MacBook’s work as a band of the local checkout', async ({ page }) => {
    await seed(page, {
      received: [
        ...focusRun({ from: 0, to: 120, appId: 'com.microsoft.VSCode', title: 'main.ts - Visual Studio Code' }),
        ...sessionRun(0, 120),
      ],
    });
    await page.goto('/day');

    await expect(band(page, 'ABC-4040')).toHaveCount(1);
    await expect(band(page, 'Nobody was here')).toHaveCount(0);
    await expect(band(page, 'Worked on MacBook')).toHaveCount(0);
  });

  test('reads the MacBook’s events through this machine’s private link and exclusion rules', async ({ page }) => {
    await seed(page, {
      private: true,
      received: [
        ...focusRun({ from: 0, to: 60, appId: 'com.microsoft.VSCode', title: 'secret-plan.ts - fut-frontend - Code' }),
        ...sessionRun(0, 60),
        ...focusRun({ from: 65, to: 90, appId: 'org.keepassxc.KeePassXC', title: 'Vault - KeePassXC' }),
        ...focusRun({ from: 95, to: 150, appId: 'com.microsoft.VSCode', title: 'notes.md - Visual Studio Code' }),
        ...sessionRun(95, 150, SIDE_REPO),
      ],
    });
    await page.goto('/day');

    await expect(band(page, 'Not yet named')).not.toHaveCount(0);
    await expect(band(page, 'ABC-4040')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('secret-plan');
    await expect(page.locator('body')).not.toContainText('KeePassXC');
    await expect(page.locator('[data-kind="row"][title*="keepass" i]')).toHaveCount(0);
  });
});

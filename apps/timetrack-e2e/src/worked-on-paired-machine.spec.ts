import { CollectedEvent } from '@ethlete/timetrack';
import { FakePairedMachine, defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, openBand, seedWorld, test } from './support';

const SDK = '/Users/e2e/dev/ethlete-sdk';

const NAMES_THE_REPO = {
  id: 'rule-sdk',
  repoPath: SDK,
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
};

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const session = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-sdk',
  cwd: SDK,
  gitBranch: 'next',
  title: 'A run nobody watched here',
});

const focusOnTheMac: CollectedEvent = {
  at: at(30),
  source: 'window',
  kind: 'window-focus',
  appId: 'com.microsoft.VSCode',
  title: 'main.ts - ethlete-sdk - Visual Studio Code',
};

const band = (page: Page, title: string) => page.locator(`[data-kind="row"][title^="${title}"]`);

const seed = (page: Page, received: CollectedEvent[]) =>
  seedWorld(page, {
    now: E2E_NOW,
    git: { extraRepos: [SDK] },
    settings: { ...defaultSettings(), attributionRules: [NAMES_THE_REPO] },
    events: Array.from({ length: 13 }, (_, step) => session(step * 5)),
    peers: { paired: [MACBOOK], received: received.map((event) => ({ machineId: MACBOOK.machineId, event })) },
  });

test.describe('a band nobody was at here, while a person was at the paired MacBook', () => {
  test('reads as worked on the MacBook, books nothing, and raises no unattended check', async ({ page }) => {
    await seed(page, [focusOnTheMac]);
    await page.goto('/day');

    await expect(band(page, 'Worked on MacBook · ABC-4040')).toHaveCount(1);
    await expect(band(page, 'Nobody was here')).toHaveCount(0);
    await expect(page.locator('[data-warning="unattended-time"]')).toHaveCount(0);

    await openBand(page, (await band(page, 'Worked on MacBook').getAttribute('title')) as string);

    await expect(editSurface(page).locator('[data-unattended-waiting]')).toContainText(
      'You were on MacBook for this band, so it books nothing here.',
    );
  });

  test('reads as nobody was here when the MacBook saw nobody either', async ({ page }) => {
    await seed(page, []);
    await page.goto('/day');

    await expect(band(page, 'Nobody was here · ABC-4040')).toHaveCount(1);
    await expect(page.locator('[data-warning="unattended-time"]')).toHaveCount(1);
  });
});

import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO, FakePairedMachine } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const editing = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

const phone = (minutes: number): CollectedEvent[] => [
  {
    at: at(minutes),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: 'phone',
    cwd: E2E_REPO,
    gitBranch: E2E_ISSUE_BRANCH,
  },
  {
    at: at(minutes),
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: 'claude-code',
    sessionId: 'phone',
    promptId: `phone-${minutes}`,
    cwd: E2E_REPO,
    gitBranch: E2E_ISSUE_BRANCH,
    askedBy: 'human',
  },
];

/** A morning at the desk, a stretch away from it steering an agent from the phone, then back. */
const aDaySteeredFromThePhone = (prompts: number[]): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  { at: at(0), source: 'input', kind: 'input-active' },
  ...[0, 15, 30, 45, 60, 75, 90].map(editing),
  { at: at(89), source: 'input', kind: 'input-idle' },
  { at: at(90), source: 'idle', kind: 'idle-start' },
  ...prompts.flatMap(phone),
  { at: at(240), source: 'idle', kind: 'idle-end' },
  { at: at(240), source: 'input', kind: 'input-active' },
  ...[240, 255, 270].map(editing),
];

const titles = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) => elements.map((element) => element.getAttribute('title')).sort());

test.describe('an hour and three quarters steered from the phone without a pause', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDaySteeredFromThePhone([120, 135, 150, 165, 180, 195, 210]) });
    await page.goto('/day');
  });

  test('books every minute the band draws', async ({ page }) => {
    await expect
      .poll(() => titles(page, `[data-kind="row"][title^="${E2E_ISSUE_KEY}"]`))
      .toEqual([`${E2E_ISSUE_KEY} · 1h 30m`, `${E2E_ISSUE_KEY} · 1h 30m`, `${E2E_ISSUE_KEY} · 30m`]);
    await expect(page.locator('[data-unbooked]')).toHaveCount(0);
  });
});

test.describe('phone prompts with a pause of more than a quarter hour between them', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDaySteeredFromThePhone([120, 135, 150, 195, 210, 225]) });
    await page.goto('/day');
  });

  test('draw the pause as a break', async ({ page }) => {
    await expect.poll(() => titles(page, '[data-break]')).toContain('11:30 - 12:15');
  });
});

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

/** A second checkout, which the MacBook has a clone of. */
const SDK = '/Users/e2e/dev/ethlete-sdk';

/** The same stretch spent at the MacBook, typing in that checkout. */
const atTheMac: CollectedEvent[] = [
  { at: at(0), source: 'input', kind: 'input-idle' },
  { at: at(90), source: 'input', kind: 'input-active' },
  ...Array.from({ length: 31 }, (_, step): CollectedEvent => ({
    at: at(90 + step * 5),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'session.ts - ethlete-sdk - Visual Studio Code',
  })),
];

test.describe('prompts typed at the paired MacBook while this machine sat idle', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { extraRepos: [SDK] },
      events: aDaySteeredFromThePhone([120, 135, 150, 165, 180, 195, 210]),
      peers: {
        paired: [MACBOOK],
        received: atTheMac.map((event) => ({ machineId: MACBOOK.machineId, event })),
      },
    });
    await page.goto('/day');
  });

  test('count no phone time against the work done at the MacBook', async ({ page }) => {
    await expect
      .poll(() => titles(page, '[data-kind="row"][title^="Not yet named"]'))
      .toEqual(['Not yet named · 2h 30m']);
    await expect(page.locator('[data-unbooked]')).toHaveCount(0);
  });
});

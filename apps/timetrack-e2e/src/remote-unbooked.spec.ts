import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO } from '@ethlete/timetrack/testing';
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

/** A morning at the desk, two and a half hours away from it steering an agent from the phone, then back. */
const aDaySteeredFromThePhone = (): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  { at: at(0), source: 'input', kind: 'input-active' },
  ...[0, 15, 30, 45, 60, 75, 90].map(editing),
  { at: at(89), source: 'input', kind: 'input-idle' },
  { at: at(90), source: 'idle', kind: 'idle-start' },
  ...[120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220].flatMap(phone),
  { at: at(240), source: 'idle', kind: 'idle-end' },
  { at: at(240), source: 'input', kind: 'input-active' },
  ...[240, 255, 270].map(editing),
];

test.describe('a band that draws remote work past the hour the day books', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDaySteeredFromThePhone() });
    await page.goto('/day');
  });

  test('says quietly how much of it is not booked', async ({ page }) => {
    const band = page.locator(`[data-kind="row"][title^="${E2E_ISSUE_KEY}"][title*="not booked"]`);

    await expect(band).toHaveCount(1);
    await expect(band.locator('[data-unbooked]')).toHaveText('· 1h 0m not booked');
  });
});

import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_PARENT_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

const idle = (clock: string, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
  at: at(clock),
  source: 'idle',
  kind,
});

/**
 * A morning, 1h 21m away from the machine, and an afternoon. The two stretches are on different
 * branches so that nothing merges them into one row, which would leave no gap to draw a break in.
 *
 * The rows snap to 09:00-10:15 and 11:30-13:00, so the gap they leave is 1h 15m. The measured break
 * is 10:22-11:43, and that is what the lane read before the rows decided it.
 */
const aDayWithABreak = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:22', '09:37', '09:52', '10:07', '10:22'].map(editing),
  idle('10:22', 'idle-start'),
  idle('11:43', 'idle-end'),
  { at: at('11:43'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_PARENT_BRANCH },
  ...['11:43', '11:58', '12:13', '12:28', '12:43', '13:00'].map(editing),
];

const session = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-1',
  cwd: E2E_REPO,
  gitBranch: E2E_ISSUE_BRANCH,
});

const prompt = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: 'session-1',
  promptId: `prompt-${clock}`,
  cwd: E2E_REPO,
  gitBranch: E2E_ISSUE_BRANCH,
  askedBy: 'human',
});

/**
 * The same morning and afternoon, on one branch, with an agent the user kept prompting from a phone.
 * The band runs through the break, so the break has no gap to sit in and is drawn over the band.
 */
const aDaySteeredFromAPhone = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:22', '09:37', '09:52', '10:07', '10:22'].map(editing),
  idle('10:22', 'idle-start'),
  ...['10:25', '10:35', '10:45', '10:55', '11:05', '11:15', '11:25', '11:35', '11:43'].map(session),
  ...['10:30', '10:50', '11:10', '11:30'].map(prompt),
  idle('11:43', 'idle-end'),
  ...['11:43', '11:58', '12:13', '12:28', '12:43', '13:00'].map(editing),
];

test.describe('a break an agent ran through', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDaySteeredFromAPhone() });
    await page.goto('/day');
  });

  test('is hatched onto the band that books the time', async ({ page }) => {
    await expect(page.locator('[data-break-overlap]').first()).toBeVisible();
  });

  test('is as long as the notifier measured, because the rows leave it no gap', async ({ page }) => {
    await expect(page.locator('[data-break]').first()).toHaveAttribute('title', '10:15 AM - 11:00 AM');
  });
});

test.describe('the break between two rows', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDayWithABreak() });
    await page.goto('/day');
  });

  test('is as long as the gap the rows leave, not as long as it was measured', async ({ page }) => {
    const band = page.locator('[data-break]').first();

    await expect(band).toBeVisible();
    await expect(band).toHaveAttribute('title', '10:15 AM - 11:30 AM');
  });
});

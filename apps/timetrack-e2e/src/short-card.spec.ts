import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const aShortStretch = (): CollectedEvent[] => [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:00', '09:05', '09:10'].map((clock): CollectedEvent => ({
    at: at(clock),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'invite.ts - fut-frontend - Visual Studio Code',
  })),
  {
    at: at('09:10'),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: E2E_ISSUE_BRANCH,
    sha: 'a1b2c3d',
    subject: 'Validate the invite form',
  },
  { at: at('09:12'), source: 'idle', kind: 'idle-start' },
];

test.describe('a card too short for a second line', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aShortStretch() });
    await page.goto('/day');
  });

  test('shows its description after the title', async ({ page }) => {
    const card = page.locator('[data-lane] [data-kind="row"]').first();

    await expect(card).toHaveAttribute('title', / · 15m$/);
    await expect(card.locator('[data-label]')).toContainText('Validate the invite form');
  });
});

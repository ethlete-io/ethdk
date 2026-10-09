import { AgentApproval, CollectedEvent, TimetrackSettings } from '@ethlete/timetrack';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, askAgent, expect, openStandIns, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const STAND_IN_ID = 'stand-in-click';

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'orders-page.component.ts - fut-frontend - Visual Studio Code',
});

const asking = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-click',
  cwd: E2E_REPO,
  gitBranch: 'main',
  workedIn: E2E_REPO,
  title: '(click)=',
});

const EVENTS: CollectedEvent[] = [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'main' },
  ...['09:00', '09:10', '09:20', '09:30'].map(editing),
  ...['09:05', '09:15', '09:25'].map(asking),
];

/** What auto mode opened and proposed for the work before it skipped notes that do not read as words. */
const settings = (): TimetrackSettings => ({
  ...defaultSettings(),
  reasoning: { ...defaultSettings().reasoning, autoMode: true },
  projectLinks: [
    { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: 'ABC' }, createdAt: new Date(0) },
  ],
  standIns: [
    {
      id: STAND_IN_ID,
      name: '(click)=',
      description: 'What the work says it was:\n\n- (click)=\n\nCovers main.',
      projectKey: 'ABC',
      state: 'open',
      openedFor: E2E_REPO,
      openedForBranch: 'main',
      days: [E2E_DAY_KEY],
      author: 'app',
      createdAt: at('09:30'),
    },
  ],
  attributionRules: [
    {
      id: 'rule-click',
      repoPath: E2E_REPO,
      branch: 'main',
      target: { kind: 'stand-in', standInId: STAND_IN_ID },
      author: 'app',
      createdAt: at('09:30'),
    },
  ],
});

const PROPOSAL: AgentApproval = {
  id: 'auto-click',
  request: {
    op: 'jira.create',
    summary: 'Click-Handler im fut-frontend anpassen',
    description: 'Im fut-frontend ist eine `(click)=`-Bindung im Template anzupassen.',
    projectKey: 'ABC',
  },
  opClass: 'external',
  client: 'auto mode',
  target: `${E2E_DAY_KEY}|stand-in:${STAND_IN_ID}`,
  askedAtMs: at('09:36').getTime(),
  day: E2E_DAY_KEY,
  state: 'queued',
};

test.describe('a stand-in auto mode named and proposed a ticket for after a note that does not read as words', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings(), approvals: [PROPOSAL] });
    await page.goto('/day');
  });

  test('is named after the checkout it worked in rather than the note', async ({ page }) => {
    const list = await openStandIns(page);

    await expect(list.locator('[data-stand-in]')).toHaveCount(1);
    await expect(list.locator('[data-stand-in]')).toContainText('fut-frontend');
    await expect(list.locator('[data-stand-in]')).not.toContainText('(click)=');
  });

  test('no longer offers the ticket auto mode proposed from the note', async ({ page }) => {
    await expect
      .poll(async () => {
        const answer = await askAgent<unknown[]>(page, { op: 'approvals.list' });

        return answer.ok ? answer.value.length : -1;
      })
      .toBe(0);
  });
});

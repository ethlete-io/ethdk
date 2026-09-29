import { CollectedEvent } from '@ethlete/timetrack';
import { FakeJiraIssue, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const SDK = '/Users/e2e/dev/ethlete-sdk';

const XYZ = { key: 'XYZ', name: 'Beta' };

const ISSUES: FakeJiraIssue[] = [
  {
    id: '10400',
    key: 'XYZ-4200',
    summary: 'The shared library',
    issueType: 'Task',
    updated: `${E2E_DAY_KEY}T08:00:00.000Z`,
  },
];

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const session = (options: { sessionId: string; minutes: number; workedIn: string }): CollectedEvent => ({
  at: at(options.minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: options.sessionId,
  cwd: SDK,
  gitBranch: 'next',
  workedIn: `${SDK}/${options.workedIn}`,
});

const prompt = (options: { sessionId: string; minutes: number }): CollectedEvent => ({
  at: at(options.minutes),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: options.sessionId,
  promptId: `${options.sessionId}-${options.minutes}`,
  cwd: SDK,
});

/** Two agent sessions in two directories of one checkout, prompted in turn, both named by one rule. */
const day = (): CollectedEvent[] => [
  ...Array.from({ length: 13 }, (_, step) => step * 5).flatMap((minutes) => [
    session({ sessionId: 'one', minutes, workedIn: 'libs/a/a.ts' }),
    session({ sessionId: 'two', minutes, workedIn: 'libs/b/b.ts' }),
  ]),
  ...[0, 15, 30, 45, 60].map((minutes): CollectedEvent => ({
    at: at(minutes),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'a.ts - ethlete-sdk - Visual Studio Code',
  })),
  prompt({ sessionId: 'one', minutes: 0 }),
  prompt({ sessionId: 'two', minutes: 20 }),
  prompt({ sessionId: 'one', minutes: 40 }),
  { at: at(60), source: 'idle', kind: 'idle-start' },
];

test('draws two parallel sessions on one ticket in one column each, over the whole of their rows', async ({ page }) => {
  await seedWorld(page, {
    now: E2E_NOW,
    events: day(),
    git: { extraRepos: [SDK] },
    jira: { issues: ISSUES, projects: [XYZ] },
    settings: {
      ...defaultSettings(),
      favoriteProjects: [XYZ],
      attributionRules: [
        {
          id: 'rule-sdk',
          repoPath: SDK,
          target: { kind: 'issue' as const, issueKey: 'XYZ-4200' },
          author: 'user' as const,
          createdAt: new Date(0),
        },
      ],
    },
  });
  await page.goto('/day');

  const rows = page.locator('[data-lane] [data-kind="row"][title^="XYZ-4200"]');

  await expect(rows).toHaveCount(2);

  const boxes = await Promise.all([rows.first().boundingBox(), rows.last().boundingBox()]);
  const [left, right] = boxes.map((box) => box ?? { x: 0, width: 0 }).sort((a, b) => a.x - b.x);

  expect(right?.width).toBeCloseTo(left?.width ?? 0, 0);
  expect(right?.x ?? 0).toBeGreaterThanOrEqual((left?.x ?? 0) + (left?.width ?? 0) - 1);
  await expect(rows.first()).toHaveCSS('clip-path', 'none');
  await expect(rows.last()).toHaveCSS('clip-path', 'none');
});

import '@angular/compiler';
import {
  ApplicationRef,
  EnvironmentInjector,
  Injector,
  createEnvironmentInjector,
  provideZonelessChangeDetection,
  runInInjectionContext,
  ɵINJECTOR_SCOPE,
} from '@angular/core';
import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  TIMETRACK_E2E_SEED_KEY,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { createFakePorts } from '../../e2e/fake-ports';
import { HOST_PORTS } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectDayReview } from './day-review';

const NOW = '2026-08-12T18:00:00.000Z';
const SPECS_REPO = '/Users/e2e/dev/specs';
const FREE_CHILD = 'ABC-3011';

const at = (clock: string) => new Date(`2026-08-12T${clock}:00.000Z`);

const editing = (clock: string, title: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title,
});

const linked = (id: string, path: string) => ({
  id,
  path,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
});

const seed = {
  events: [
    { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_KEYLESS_BRANCH },
    { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: SPECS_REPO, branch: 'spec/pdf-export' },
    editing('09:00', 'invite.ts - fut-frontend - Visual Studio Code'),
    editing('09:15', 'invite.ts - fut-frontend - Visual Studio Code'),
    editing('09:30', 'pdf-export.md - specs - Visual Studio Code'),
    editing('09:45', 'pdf-export.md - specs - Visual Studio Code'),
    editing('10:00', 'pdf-export.md - specs - Visual Studio Code'),
  ],
  settings: {
    ...defaultSettings(),
    attributionRules: [
      {
        id: 'rule-frontend',
        repoPath: E2E_REPO,
        branch: E2E_KEYLESS_BRANCH,
        target: { kind: 'issue' as const, issueKey: E2E_ISSUE_KEY },
        author: 'user' as const,
        createdAt: new Date(0),
      },
    ],
    projectLinks: [linked('link-frontend', E2E_REPO), linked('link-specs', SPECS_REPO)],
    nudge: { ...defaultSettings().nudge, enabled: false },
  },
  git: { extraRepos: [SPECS_REPO] },
  jira: {
    issues: [
      { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'PDF export', issueType: 'Epic', updated: NOW },
      {
        id: E2E_ISSUE_ID,
        key: E2E_ISSUE_KEY,
        summary: 'User management',
        issueType: 'Task',
        parentKey: E2E_PARENT_KEY,
        updated: NOW,
      },
      {
        id: '13011',
        key: FREE_CHILD,
        summary: 'Write the export specification',
        issueType: 'Task',
        parentKey: E2E_PARENT_KEY,
        updated: NOW,
      },
    ],
  },
};

describe('the stand-in pass on a checkout the epic rung names', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(NOW) });
    (globalThis as Record<string, unknown>)[TIMETRACK_E2E_SEED_KEY] = JSON.stringify(seed);
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[TIMETRACK_E2E_SEED_KEY];
    vi.useRealTimers();
  });

  it('waits for the rows built with the epic answer, so it opens no placeholder for the checkout', async () => {
    const injector = createEnvironmentInjector(
      [
        { provide: ɵINJECTOR_SCOPE, useValue: 'root' },
        provideZonelessChangeDetection(),
        { provide: HOST_PORTS, useValue: createFakePorts() },
      ],
      Injector.NULL as EnvironmentInjector,
    );
    const app = injector.get(ApplicationRef);
    const { review, settings } = runInInjectionContext(injector, () => ({
      review: injectDayReview(),
      settings: injectTimetrackSettings(),
    }));

    for (let second = 0; second < 10; second++) {
      await vi.advanceTimersByTimeAsync(1_000);
      app.tick();
      review.day();
    }

    expect(settings.settings().attributionRules.filter((rule) => rule.repoPath === SPECS_REPO)).toEqual([]);
    expect(review.rows().some((row) => row.issueKey === FREE_CHILD)).toBe(true);

    injector.destroy();
  });
});

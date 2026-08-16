import { CollectedEvent, DEFAULT_TIMETRACK_SETTINGS, TimetrackRequest, TimetrackSettings } from '@ethlete/timetrack';

export const E2E_JIRA_HOST = 'https://e2e.atlassian.net';
export const E2E_ACCOUNT_ID = 'acc:e2e';
export const E2E_ISSUE_KEY = 'FIP-3010';
export const E2E_ISSUE_ID = '10100';
export const E2E_PARENT_KEY = 'FIP-2000';
export const E2E_REPO = '/Users/e2e/dev/fut-frontend';

/** The day the fixture describes, so a test can drive the view straight to it. */
export const e2eDay = () => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const at = (hour: number, minute = 0) => {
  const day = e2eDay();

  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
};

/** Tempo dates the worklog by local calendar day, so `toISOString` would move it across midnight. */
const localDay = () => {
  const day = e2eDay();

  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

/**
 * One reconstructable morning: two hours on a branch that names an issue, then an hour on a branch
 * that names none. The second stretch is what puts a card under "Not yet named".
 */
export const e2eEvents = (): CollectedEvent[] => [
  {
    at: at(9, 0),
    source: 'git',
    kind: 'git-checkout',
    repoPath: E2E_REPO,
    branch: `feat/${E2E_ISSUE_KEY}-user-management`,
  },
  { at: at(9, 1), source: 'window', kind: 'window-focus', appId: 'com.microsoft.VSCode', title: 'user-management.ts' },
  {
    at: at(10, 30),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: `feat/${E2E_ISSUE_KEY}-user-management`,
    sha: 'a1b2c3d',
    subject: 'feat(users): Invite a member by email',
  },
  { at: at(11, 0), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'spike/pdf-export' },
  { at: at(11, 1), source: 'window', kind: 'window-focus', appId: 'com.microsoft.VSCode', title: 'pdf-export.ts' },
  {
    at: at(11, 40),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: 'spike/pdf-export',
    sha: 'd4e5f6a',
    subject: 'Try pdfkit for the invoice export',
  },
  { at: at(12, 0), source: 'idle', kind: 'idle-start' },
];

export const e2eSettings = (): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  jira: { host: E2E_JIRA_HOST, email: 'e2e@example.com' },
  gitlab: { host: 'https://gitlab.example.com' },
  issueKeyPrefixes: ['FIP'],
  gitScanRoots: [E2E_REPO],
  reasoning: { ...DEFAULT_TIMETRACK_SETTINGS.reasoning, enabled: true },
});

const issue = (options: { key: string; id: string; summary: string; type: string }) => ({
  id: options.id,
  key: options.key,
  fields: { summary: options.summary, issuetype: { name: options.type }, updated: at(8, 0).toISOString() },
});

/** The key a test writes before the app boots, to seed the fixture from outside the page. */
export const E2E_FOREIGN_MINUTES_KEY = 'e2e.foreignMinutes';

/**
 * Time the fake Tempo already holds on {@link E2E_ISSUE_KEY}, in minutes.
 *
 * It comes from `localStorage` rather than the URL because the router runs with `withHashLocation()`,
 * which drops the query string on the first navigation.
 */
const foreignMinutes = () => Number(globalThis.localStorage?.getItem(E2E_FOREIGN_MINUTES_KEY) ?? 0);

const body = (request: TimetrackRequest): unknown => {
  const { url } = request;

  if (url.includes('/rest/api/3/myself')) {
    return { accountId: E2E_ACCOUNT_ID, emailAddress: 'e2e@example.com', displayName: 'E2E' };
  }

  if (url.includes('/rest/api/3/search/jql')) {
    return {
      issues: [
        issue({ key: E2E_ISSUE_KEY, id: E2E_ISSUE_ID, summary: 'User management', type: 'Task' }),
        issue({ key: E2E_PARENT_KEY, id: '10200', summary: 'Member onboarding', type: 'Story' }),
      ],
    };
  }

  if (url.includes('/rest/api/3/issuetype')) {
    return [
      { id: '1', name: 'Story', hierarchyLevel: 0 },
      { id: '2', name: 'Task', hierarchyLevel: 0 },
      { id: '3', name: 'Epic', hierarchyLevel: 1 },
    ];
  }

  if (url.includes('/rest/api/3/issue')) return { id: '10999', key: 'FIP-9999' };

  if (url.includes('/work-attributes')) return { results: [] };

  if (url.includes('/worklogs')) {
    const minutes = foreignMinutes();

    return {
      results: minutes
        ? [
            {
              tempoWorklogId: 'w-foreign-1',
              issue: { id: E2E_ISSUE_ID },
              author: { accountId: E2E_ACCOUNT_ID },
              startDate: localDay(),
              startTime: '09:00:00',
              timeSpentSeconds: minutes * 60,
              billableSeconds: 0,
              description: 'Logged in Tempo by hand',
              attributes: { values: [] },
            },
          ]
        : [],
      metadata: {},
    };
  }

  return {};
};

/** Answers every Jira, Tempo and GitLab call from the fixture, so an e2e run reaches no network. */
export const e2eRespond = (request: TimetrackRequest) => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: body(request),
});

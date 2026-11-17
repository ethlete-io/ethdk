import { CollectedEvent } from '@ethlete/timetrack';
import { TIMETRACK_E2E_SEED_KEY, TimetrackWorldSeed, defaultSettings } from '@ethlete/timetrack/testing';

const SHOP = '/Users/demo/dev/shop-frontend';
const GATEWAY = '/Users/demo/dev/api-gateway';
const CHECKOUT_BRANCH = 'feat/SHOP-142-checkout-address-validation';
const RATE_LIMIT_BRANCH = 'feat/SHOP-157-partner-rate-limit';
const ZOOM = 'us.zoom.xos';
const JIRA_HOST = 'https://demo.atlassian.net';

const at = (clock: string) => {
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  const day = new Date();

  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
};

const dayKey = () => {
  const day = new Date();

  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

const minutesOf = (clock: string) => {
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);

  return hours * 60 + minutes;
};

const clockOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

type Span = { from: string; to: string };

const every = ({ from, to }: Span, stepMinutes: number) => {
  const clocks: string[] = [];

  for (let minute = minutesOf(from); minute <= minutesOf(to); minute += stepMinutes) clocks.push(clockOf(minute));

  return clocks;
};

const editing = (span: Span, { repo, files }: { repo: string; files: string[] }): CollectedEvent[] =>
  every(span, 10).map((clock, index) => ({
    at: at(clock),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: `${files[index % files.length]} - ${repo} - Visual Studio Code`,
  }));

const agent = (span: Span, options: { id: string; cwd: string; branch: string; title: string }) =>
  every(span, 5).map((clock): CollectedEvent => ({
    at: at(clock),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.id,
    cwd: options.cwd,
    gitBranch: options.branch,
    title: options.title,
  }));

const commit = (
  clock: string,
  { repoPath, branch, sha, subject }: { repoPath: string; branch: string; sha: string; subject: string },
): CollectedEvent => ({
  at: at(clock),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch,
  sha,
  subject,
});

const checkout = (clock: string, { repoPath, branch }: { repoPath: string; branch: string }): CollectedEvent => ({
  at: at(clock),
  source: 'git',
  kind: 'git-checkout',
  repoPath,
  branch,
});

const SHOP_FILES = [
  'address-form.component.ts',
  'address.validator.ts',
  'checkout.store.ts',
  'address.validator.spec.ts',
];
const GATEWAY_FILES = ['rate-limit.middleware.ts', 'partner-quota.ts', 'rate-limit.middleware.spec.ts'];

const events = (): CollectedEvent[] => [
  checkout('08:45', { repoPath: SHOP, branch: CHECKOUT_BRANCH }),
  ...editing({ from: '08:46', to: '10:25' }, { repo: 'shop-frontend', files: SHOP_FILES }),
  ...agent(
    { from: '08:55', to: '10:25' },
    {
      id: 'demo-checkout',
      cwd: SHOP,
      branch: CHECKOUT_BRANCH,
      title: 'Adressvalidierung im Checkout',
    },
  ),
  commit('10:20', {
    repoPath: SHOP,
    branch: CHECKOUT_BRANCH,
    sha: 'a41c9e2',
    subject: 'feat(checkout): Validate the postal code per country',
  }),

  checkout('10:30', { repoPath: GATEWAY, branch: RATE_LIMIT_BRANCH }),
  ...editing({ from: '10:31', to: '11:25' }, { repo: 'api-gateway', files: GATEWAY_FILES }),
  ...agent(
    { from: '10:35', to: '11:25' },
    {
      id: 'demo-rate-limit',
      cwd: GATEWAY,
      branch: RATE_LIMIT_BRANCH,
      title: 'Rate-Limit für Partner-Endpunkte',
    },
  ),
  commit('11:20', {
    repoPath: GATEWAY,
    branch: RATE_LIMIT_BRANCH,
    sha: 'c7d03b8',
    subject: 'feat(gateway): Limit partner requests per key',
  }),

  { at: at('11:30'), source: 'window', kind: 'window-focus', appId: ZOOM, title: 'Zoom Meeting' },
  { at: at('11:30'), source: 'call', kind: 'call-start', appId: ZOOM },
  { at: at('12:00'), source: 'call', kind: 'call-end', appId: ZOOM },
  { at: at('12:01'), source: 'idle', kind: 'idle-start' },
  { at: at('12:40'), source: 'idle', kind: 'idle-end' },

  checkout('12:42', { repoPath: SHOP, branch: CHECKOUT_BRANCH }),
  ...editing({ from: '12:43', to: '15:10' }, { repo: 'shop-frontend', files: SHOP_FILES }),
  ...agent(
    { from: '12:50', to: '15:10' },
    {
      id: 'demo-checkout-2',
      cwd: SHOP,
      branch: CHECKOUT_BRANCH,
      title: 'Fehlermeldungen der Adressvalidierung',
    },
  ),
  commit('13:55', {
    repoPath: SHOP,
    branch: CHECKOUT_BRANCH,
    sha: 'b19f4d0',
    subject: 'feat(checkout): Show inline address errors',
  }),
  commit('15:05', {
    repoPath: SHOP,
    branch: CHECKOUT_BRANCH,
    sha: 'e2a8c51',
    subject: 'test(checkout): Cover the address validator',
  }),

  checkout('15:15', { repoPath: GATEWAY, branch: RATE_LIMIT_BRANCH }),
  ...editing({ from: '15:16', to: '17:15' }, { repo: 'api-gateway', files: GATEWAY_FILES }),
  ...agent(
    { from: '15:20', to: '17:15' },
    {
      id: 'demo-rate-limit-2',
      cwd: GATEWAY,
      branch: RATE_LIMIT_BRANCH,
      title: 'Quoten pro Partner konfigurierbar',
    },
  ),
  commit('17:10', {
    repoPath: GATEWAY,
    branch: RATE_LIMIT_BRANCH,
    sha: 'f58e1a7',
    subject: 'feat(gateway): Read partner quotas from config',
  }),
  { at: at('17:20'), source: 'idle', kind: 'idle-start' },
];

const transcript = (clock: string, text: string) => ({
  atMs: at(clock).getTime(),
  callStartedAtMs: at('11:30').getTime(),
  appId: ZOOM,
  model: 'base',
  language: 'de',
  text,
});

const seed = (): TimetrackWorldSeed => {
  const base = defaultSettings();

  return {
    events: events(),
    settings: {
      ...base,
      jira: { host: JIRA_HOST, email: 'demo@example.com' },
      favoriteProjects: [{ key: 'SHOP', name: 'Shop' }],
      gitScanRoots: [SHOP, GATEWAY],
      nudge: { ...base.nudge, enabled: false },
      callRules: { countsAsWork: ['Zoom'], neverCountsAsWork: [] },
      transcribeCalls: true,
    },
    git: {
      repoPath: SHOP,
      extraRepos: [GATEWAY],
      branches: ['main', CHECKOUT_BRANCH, RATE_LIMIT_BRANCH],
      remoteBranches: ['main', CHECKOUT_BRANCH, RATE_LIMIT_BRANCH],
      remoteUrl: 'git@gitlab.example.com:demo/shop-frontend.git',
    },
    gitlab: { projectPath: 'demo/shop-frontend', projectId: 'demo/shop-frontend' },
    jira: {
      self: { accountId: 'acc:demo', emailAddress: 'demo@example.com', displayName: 'Demo' },
      projects: [{ key: 'SHOP', name: 'Shop' }],
      issues: [
        {
          id: '20142',
          key: 'SHOP-142',
          summary: 'Adressvalidierung im Checkout',
          issueType: 'Story',
          updated: at('08:00').toISOString(),
        },
        {
          id: '20157',
          key: 'SHOP-157',
          summary: 'Rate-Limit für Partner-APIs',
          issueType: 'Story',
          updated: at('08:00').toISOString(),
        },
        {
          id: '20100',
          key: 'SHOP-100',
          summary: 'Projekt-Meetings',
          issueType: 'Task',
          updated: at('08:00').toISOString(),
        },
        {
          id: '20150',
          key: 'SHOP-150',
          summary: 'Warenkorb-Rabatte',
          issueType: 'Story',
          updated: at('08:00').toISOString(),
        },
      ],
    },
    reviewOverrides: {
      [dayKey()]: {
        [`unnamed:@${at('11:30').toISOString()}`]: {
          issueKey: 'SHOP-100',
          laneKey: 'lane:call',
          description: 'Daily: Stand Checkout und Partner-Rate-Limit',
          sources: { issue: 'auto', description: 'auto' },
        },
      },
    },
    callSource: { kind: 'macos', detail: null, watchingSinceMs: at('08:00').getTime() },
    transcription: {
      status: { available: true, enabled: true, listening: false, model: 'base' },
      chunks: [
        transcript('11:31', 'Kurzer Stand zum Checkout: die Adressvalidierung für Deutschland und Österreich läuft.'),
        transcript('11:38', 'Beim Rate-Limit für die Partner brauchen wir noch die Quoten pro Schlüssel.'),
        transcript('11:52', 'Review für die Warenkorb-Rabatte mache ich heute Nachmittag.'),
      ],
    },
  };
};

export const installDemoSeed = () => {
  (globalThis as Record<string, unknown>)[TIMETRACK_E2E_SEED_KEY] = JSON.stringify(seed());
};

import { CollectedEvent, DEFAULT_TIMETRACK_SETTINGS, EditorCli, TimetrackSettings } from '@ethlete/timetrack';
import { FakeEditorState, FakeEditors } from './backend/editor-cli';
import { FakeGitHubState } from './backend/gh';
import { FakeGlabState } from './backend/glab';
import {
  FakeBackend,
  FakeFault,
  FakeGitLabState,
  FakeGitState,
  FakeJiraState,
  FakeTempoState,
  FakeTempoWorklog,
} from './backend/types';

export const E2E_JIRA_HOST = 'https://e2e.atlassian.net';
export const E2E_GITLAB_HOST = 'https://gitlab.example.com';
export const E2E_ACCOUNT_ID = 'acc:e2e';
export const E2E_ISSUE_KEY = 'ABC-3010';
export const E2E_ISSUE_ID = '10100';
export const E2E_PARENT_KEY = 'ABC-2000';
export const E2E_PARENT_ID = '10200';
export const E2E_REPO = '/Users/e2e/dev/fut-frontend';
export const E2E_PROJECT_PATH = 'braune-digital/fut-frontend';
/** A branch the grammar can spell but which names no issue — the case branch repair exists for. */
export const E2E_KEYLESS_BRANCH = 'feat/pdf-export';
/** The Story branch a prospectively started Task nests under. */
export const E2E_PARENT_BRANCH = `feat/${E2E_PARENT_KEY}-member-onboarding`;
export const E2E_ISSUE_BRANCH = `feat/${E2E_ISSUE_KEY}-user-management`;

/**
 * One agent session log the fake host serves. `lines` are the log's JSONL lines, as the reader hands
 * them to a parser.
 */
export type FakeAgentLog = {
  id: string;
  path: string;
  /** ISO 8601, because the seed crosses into the page as JSON. */
  modifiedAt: string;
  lines: string[];
};

/**
 * What the host says the focused-window source is doing, in the shape the host wire reports it.
 *
 * A browser watches no window, so the default is a source that is not running. A spec about the
 * capability row declares the platform it wants to read as.
 */
export type FakeWindowSourceStatus = {
  kind: string;
  detail: string | null;
  capabilities: { reads: string; available: boolean; detail: string | null }[];
};

/**
 * The world an e2e spec declares. Every key it leaves out falls back to the default fixture, so a
 * spec that does not care about Tempo states nothing about Tempo.
 */
export type TimetrackWorldSeed = {
  events?: CollectedEvent[];
  settings?: TimetrackSettings;
  /** Claude Code's session logs. Empty by default, so no spec collects an agent it says nothing about. */
  agentLogs?: FakeAgentLog[];
  codexLogs?: FakeAgentLog[];
  jira?: Partial<FakeJiraState>;
  tempo?: Partial<FakeTempoState>;
  gitlab?: Partial<FakeGitLabState>;
  /** What the `glab` binary is on the seeded machine. Installed and logged in by default. */
  glab?: Partial<FakeGlabState>;
  /** What the `gh` binary is, and what its feed holds. Installed, logged in, and reading nothing. */
  gh?: Partial<FakeGitHubState>;
  /** The editor clients on the seeded machine. Only `code`, holding the reporter, by default. */
  editors?: Partial<Record<EditorCli, Partial<FakeEditorState>>>;
  git?: Partial<FakeGitState>;
  windowSource?: Partial<FakeWindowSourceStatus>;
  faults?: FakeFault[];
};

export type FakeWorld = {
  events: CollectedEvent[];
  glab: FakeGlabState;
  gh: FakeGitHubState;
  editors: FakeEditors;
  settings: TimetrackSettings;
  agentLogs: FakeAgentLog[];
  codexLogs: FakeAgentLog[];
  windowSource: FakeWindowSourceStatus;
  backend: FakeBackend;
};

/** Where `seedWorld` leaves the seed, as a JSON string, for `createFakeWorld` to read before boot. */
export const TIMETRACK_E2E_SEED_KEY = '__timetrackE2eSeed';

/** Where the live backend is published, so a spec can read at the wire what a flow wrote. */
export const TIMETRACK_E2E_BACKEND_KEY = '__timetrackE2eBackend';

/** The day the default fixture describes, so a test can drive the view straight to it. */
export const e2eDay = () => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const e2eAt = (hour: number, minute = 0) => {
  const day = e2eDay();

  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Tempo dates a worklog by local calendar day, so `toISOString` would move it across midnight. */
export const e2eLocalDay = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** One worklog somebody logged in Tempo by hand, which the app must read and never touch. */
export const tempoWorklogOn = (options: {
  /** A `YYYY-MM-DD` key, or any instant on the day read in the caller's own zone. */
  day: Date | string;
  minutes: number;
  issueId?: string;
  startTime?: string;
  description?: string;
  id?: string;
}): FakeTempoWorklog => ({
  id: options.id ?? 'w-foreign-1',
  issueId: options.issueId ?? E2E_ISSUE_ID,
  authorAccountId: E2E_ACCOUNT_ID,
  startDate: typeof options.day === 'string' ? options.day : e2eLocalDay(options.day),
  startTime: options.startTime ?? '09:00:00',
  timeSpentSeconds: options.minutes * 60,
  billableSeconds: 0,
  description: options.description ?? 'Logged in Tempo by hand',
  attributes: {},
});

/**
 * One reconstructable morning: two hours on a branch that names an issue, then an hour on a branch
 * that names none. The second stretch is what puts a card under "Not yet named", and its branch is
 * one the grammar can rename, so the same fixture drives branch repair.
 */
export const defaultEvents = (): CollectedEvent[] => [
  { at: e2eAt(9, 0), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  {
    at: e2eAt(9, 1),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: 'user-management.ts',
  },
  // The morning is sampled through, not just at its ends. A block ends at its last sample, so two
  // events 89 minutes apart describe one observed minute rather than the hour and a half between them.
  ...[
    { at: e2eAt(9, 25), title: 'invite.ts - fut-frontend - Visual Studio Code' },
    { at: e2eAt(9, 50), title: 'invite.spec.ts - fut-frontend - Visual Studio Code' },
    { at: e2eAt(10, 15), title: 'member.ts - fut-frontend - Visual Studio Code' },
  ].map((sample): CollectedEvent => ({
    ...sample,
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
  })),
  {
    at: e2eAt(10, 30),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: E2E_ISSUE_BRANCH,
    sha: 'a1b2c3d',
    subject: 'feat(users): Invite a member by email',
  },
  { at: e2eAt(11, 0), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_KEYLESS_BRANCH },
  { at: e2eAt(11, 1), source: 'window', kind: 'window-focus', appId: 'com.microsoft.VSCode', title: 'pdf-export.ts' },
  {
    at: e2eAt(11, 40),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: E2E_KEYLESS_BRANCH,
    sha: 'd4e5f6a',
    subject: 'Try pdfkit for the invoice export',
  },
  { at: e2eAt(12, 0), source: 'idle', kind: 'idle-start' },
];

const defaultGlab = (): FakeGlabState => ({
  installed: true,
  logins: [{ host: 'gitlab.example.com', login: 'e2e' }],
});

/** One editor, as most machines are: `code` installed with the reporter in it, and no fork beside it. */
const defaultEditors = (): FakeEditors => ({
  code: { onPath: true, reporter: true },
  'code-insiders': { onPath: false, reporter: false },
  codium: { onPath: false, reporter: false },
  cursor: { onPath: false, reporter: false },
  windsurf: { onPath: false, reporter: false },
});

const defaultGh = (): FakeGitHubState => ({
  installed: true,
  logins: [{ host: 'github.com', login: 'e2e' }],
  events: [],
  pullRequests: [],
});

export const defaultSettings = (): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  jira: { host: E2E_JIRA_HOST, email: 'e2e@example.com' },
  gitlab: { host: E2E_GITLAB_HOST },
  favoriteProjects: [{ key: 'ABC', name: 'Alpha' }],
  gitScanRoots: [E2E_REPO],
  reasoning: { ...DEFAULT_TIMETRACK_SETTINGS.reasoning, enabled: true },
});

const defaultJira = (): FakeJiraState => ({
  self: { accountId: E2E_ACCOUNT_ID, emailAddress: 'e2e@example.com', displayName: 'E2E' },
  issues: [
    {
      id: E2E_ISSUE_ID,
      key: E2E_ISSUE_KEY,
      summary: 'User management',
      issueType: 'Task',
      updated: e2eAt(8, 0).toISOString(),
    },
    {
      id: E2E_PARENT_ID,
      key: E2E_PARENT_KEY,
      summary: 'Member onboarding',
      issueType: 'Story',
      updated: e2eAt(8, 0).toISOString(),
    },
  ],
  projects: [{ key: 'ABC', name: 'Alpha' }],
  issueTypes: [
    { id: '1', name: 'Story', subtask: false, hierarchyLevel: 0 },
    { id: '2', name: 'Task', subtask: false, hierarchyLevel: 0 },
    { id: '3', name: 'Epic', subtask: false, hierarchyLevel: 1 },
  ],
  fields: [
    { id: 'summary', name: 'Summary', custom: false, type: 'string' },
    { id: 'customfield_10057', name: 'Branch subject', custom: true, type: 'string' },
  ],
  links: [],
  created: [],
});

const defaultTempo = (): FakeTempoState => ({ worklogs: [], workAttributes: [], writes: [] });

const defaultGitLab = (): FakeGitLabState => ({
  projectPath: E2E_PROJECT_PATH,
  projectId: E2E_PROJECT_PATH,
  mergeRequests: [],
  events: [],
  created: [],
  updates: [],
});

const defaultGit = (): FakeGitState => ({
  repoPath: E2E_REPO,
  extraRepos: [],
  clean: true,
  branches: ['next', E2E_KEYLESS_BRANCH, E2E_ISSUE_BRANCH, E2E_PARENT_BRANCH],
  remoteBranches: ['next', E2E_KEYLESS_BRANCH, E2E_PARENT_BRANCH],
  remoteUrl: 'git@gitlab.example.com:braune-digital/fut-frontend.git',
  reflog: {},
  ran: [],
});

const seedEditors = (seed: TimetrackWorldSeed['editors']): FakeEditors => {
  const editors = defaultEditors();

  for (const [cli, state] of Object.entries(seed ?? {})) {
    editors[cli as EditorCli] = { ...editors[cli as EditorCli], ...state };
  }

  return editors;
};

/** Builds the whole fake world for one page load: the collected events, the settings and the backend. */
export const createFakeWorld = (seed: TimetrackWorldSeed = {}): FakeWorld => ({
  events: seed.events ?? defaultEvents(),
  settings: seed.settings ?? defaultSettings(),
  agentLogs: seed.agentLogs ?? [],
  codexLogs: seed.codexLogs ?? [],
  windowSource: { kind: 'none', detail: null, capabilities: [], ...seed.windowSource },
  glab: { ...defaultGlab(), ...seed.glab },
  gh: { ...defaultGh(), ...seed.gh },
  editors: seedEditors(seed.editors),
  backend: {
    jira: { ...defaultJira(), ...seed.jira },
    tempo: { ...defaultTempo(), ...seed.tempo },
    gitlab: { ...defaultGitLab(), ...seed.gitlab },
    git: { ...defaultGit(), ...seed.git },
    faults: seed.faults ?? [],
    requests: [],
    nextId: 11000,
  },
});

/** Revives the seed `seedWorld` left on `window`. Only `event.at` survives JSON as a string. */
export const parseWorldSeed = (raw: string | null | undefined): TimetrackWorldSeed => {
  if (!raw) return {};

  const seed = JSON.parse(raw) as TimetrackWorldSeed & { events?: (CollectedEvent & { at: string | Date })[] };

  return {
    ...seed,
    ...(seed.events ? { events: seed.events.map((event) => ({ ...event, at: new Date(event.at) })) } : {}),
  };
};

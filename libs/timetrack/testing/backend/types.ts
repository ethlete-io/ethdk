import { TimetrackRequestMethod } from '@ethlete/timetrack';

/**
 * One canned failure. `url` matches as a substring of the request URL, so `/worklogs` covers every
 * Tempo write and `/rest/api/3/issue` covers the create call.
 */
export type FakeFault = {
  url: string;
  method?: TimetrackRequestMethod;
  status: number;
  body?: unknown;
  /** How many matching requests it answers. Absent means every one of them. */
  times?: number;
};

export type FakeJiraSelf = {
  accountId: string;
  emailAddress: string;
  displayName: string;
};

export type FakeJiraIssue = {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  parentKey?: string;
  /** ISO 8601. Jira orders the activity feed by it. */
  updated?: string;
  /** Custom fields the create call wrote, by field id. */
  custom?: Record<string, unknown>;
};

export type FakeJiraProject = {
  key: string;
  name: string;
};

export type FakeJiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  hierarchyLevel: number;
};

export type FakeJiraField = {
  id: string;
  name: string;
  custom: boolean;
  type?: string;
};

export type FakeJiraLink = {
  type: string;
  inwardKey: string;
  outwardKey: string;
};

export type FakeJiraState = {
  self: FakeJiraSelf;
  issues: FakeJiraIssue[];
  projects: FakeJiraProject[];
  issueTypes: FakeJiraIssueType[];
  fields: FakeJiraField[];
  links: FakeJiraLink[];
  /** Every issue the app filed, in order. `issues` holds these too. */
  created: FakeJiraIssue[];
};

export type FakeTempoWorklog = {
  id: string;
  issueId: string;
  authorAccountId: string;
  /** `YYYY-MM-DD`, the author's local calendar day. */
  startDate: string;
  /** `HH:MM:SS`, the author's wall clock. */
  startTime: string;
  timeSpentSeconds: number;
  billableSeconds: number;
  description: string;
  attributes: Record<string, string>;
};

export type FakeTempoWorkAttribute = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  values: string[];
};

/** One write Tempo accepted. A second sync of an unchanged day must add nothing here. */
export type FakeTempoWrite =
  | { kind: 'create'; worklogId: string; issueId: string; timeSpentSeconds: number }
  | { kind: 'update'; worklogId: string; timeSpentSeconds: number }
  | { kind: 'delete'; worklogId: string };

export type FakeTempoState = {
  worklogs: FakeTempoWorklog[];
  workAttributes: FakeTempoWorkAttribute[];
  writes: FakeTempoWrite[];
};

export type FakeGitLabMergeRequest = {
  iid: string;
  projectId: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  state: 'opened' | 'merged' | 'closed';
  webUrl: string;
};

export type FakeGitLabEvent = {
  id: string;
  /** ISO 8601. */
  at: string;
  actionName: string;
  projectId: string;
  targetType?: string;
  targetTitle?: string;
  mergeRequestIid?: string;
  branch?: string;
  commitTitle?: string;
};

export type FakeGitLabState = {
  /** The path the fixture's remote points at, such as `braune-digital/fut-frontend`. */
  projectPath: string;
  projectId: string;
  mergeRequests: FakeGitLabMergeRequest[];
  events: FakeGitLabEvent[];
  created: FakeGitLabMergeRequest[];
  updates: { iid: string; title?: string; targetBranch?: string }[];
};

export type FakeGitState = {
  repoPath: string;
  /** `false` puts something in `git status --porcelain`, which every write flow must refuse on. */
  clean: boolean;
  branches: string[];
  remoteBranches: string[];
  remoteUrl: string;
  /** Every mutating git command the app ran, joined as it spelled the arguments. */
  ran: string[];
};

export type FakeRequestLogEntry = {
  method: TimetrackRequestMethod;
  url: string;
  status: number;
};

/**
 * The whole fake backend, as plain state. A spec reads a snapshot of it out of the page, so nothing
 * here may be a function — see `TIMETRACK_E2E_BACKEND_KEY`.
 */
export type FakeBackend = {
  jira: FakeJiraState;
  tempo: FakeTempoState;
  gitlab: FakeGitLabState;
  git: FakeGitState;
  faults: FakeFault[];
  requests: FakeRequestLogEntry[];
  /** Feeds the next generated id, for issues, worklogs and merge requests alike. */
  nextId: number;
};

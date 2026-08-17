import { JiraParenting } from '../jira/hierarchy';

/**
 * The contract between the app and a coding agent's CLI, spoken over the host's loopback endpoint.
 *
 * It exists so that a Jira token lives in one place on a machine. Every repository an agent works in
 * would otherwise need its own copy of the credentials to look up an issue key, and a secret copied
 * per repository is a secret nobody can rotate.
 *
 * The version is the whole contract's, not one operation's: a caller that does not know it refuses
 * rather than guessing what an answer means.
 */
export const AGENT_API_VERSION = 1;

/**
 * What the Jira instance itself is shaped like, read from the instance rather than from settings.
 *
 * It answers the two questions a setup step cannot guess: which levels exist, and which custom field
 * could hold a branch subject. Both differ on every instance, and a wrong answer to either files
 * tickets at the wrong level or writes a subject into a field that means something else.
 */
export type AgentApiInstance = {
  /** The levels this instance defines, highest first, with the type names sitting on each. */
  levels: { hierarchyLevel: number; typeNames: string[] }[];
  /** What those levels imply a parent can be named by. Settings may still override it. */
  suggestedParenting: JiraParenting;
  /** The custom text fields a branch subject could be written to, by name. */
  subjectFieldCandidates: { id: string; name: string }[];
};

/** One issue, as an agent reads it. The subject is resolved against the instance's own field. */
export type AgentApiIssue = {
  key: string;
  id: string;
  summary: string;
  issueType: string;
  /** The Story or Epic it rolls up to, when the instance reports one. */
  parentKey?: string;
  /** The branch subject the instance's subject field holds, when it is configured and set. */
  subject?: string;
};

/** What the app can say about itself, so a caller can report why an operation would fail. */
export type AgentApiStatus = {
  version: number;
  /** Whether a host, an account email and a token are all configured. */
  jiraReady: boolean;
  /** The projects the user picked, which is every picker's scope and the branch grammar's prefixes. */
  projects: { key: string; name: string }[];
  /** The instance's branch-subject field id, or an empty string when none is configured. */
  subjectField: string;
};

/** Which project a repository logs into, as the settings already answer it. */
export type AgentApiRepoProject = {
  repoPath: string;
  /** The project the covering link names, or nothing when nothing covers the path. */
  projectKey?: string;
  /** Whether the link marks the path private — work there is logged nowhere. */
  private: boolean;
  /** Whether the covering link names a directory above the repository rather than the repository. */
  inherited: boolean;
  /** What the path's own name suggests, offered only while no link covers it. */
  suggestedProjectKey?: string;
};

export type AgentApiCreatedIssue = { key: string; id: string };

/** A row an agent wrote onto a day, as the app stored it. */
export type AgentApiWorklog = {
  /** The local day it landed on, as `YYYY-MM-DD`. */
  day: string;
  issueKey: string;
  description: string;
  fromMs: number;
  toMs: number;
  durationMs: number;
};

export type AgentApiRequest =
  | { op: 'status' }
  | { op: 'jira.instance' }
  | { op: 'jira.issue'; key: string }
  | { op: 'jira.search'; text: string; projectKey?: string; assignedToMe: boolean; limit?: number }
  | { op: 'repo.project'; repoPath: string }
  | {
      op: 'jira.create';
      summary: string;
      description: string;
      projectKey?: string;
      issueTypeName?: string;
      parentKey?: string;
      subject?: string;
    }
  | { op: 'worklog.add'; issueKey: string; description: string; fromMs: number; durationMs: number };

export type AgentApiOp = AgentApiRequest['op'];

/**
 * What the endpoint writes back. `ok` is the operation's own verdict rather than the endpoint's: a key
 * Jira does not know is a failed operation over a working endpoint, and the HTTP status stays 200.
 */
export type AgentApiAnswer<T = unknown> = { ok: true; value: T } | { ok: false; message: string };

import { existsSync, readFileSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

/** The Timetrack app's bundle identifier, which is also the name of its data directory. */
const IDENTIFIER = 'io.ethlete.timetrack';

const DISCOVERY_FILENAME = 'agent.json';

/**
 * The contract version this client speaks. The app writes its own into the discovery file, and a
 * mismatch stops here rather than at a field that is missing for a reason nobody can see.
 */
const PROTOCOL_VERSION = 1;

/** A Jira search behind a slow instance is the long case; the app's own deadline is 60 seconds. */
const TIMEOUT_MS = 70_000;

const PATH = '/agent';

export type TimetrackIssue = {
  key: string;
  id: string;
  summary: string;
  issueType: string;
  parentKey?: string;
  subject?: string;
};

export type TimetrackStatus = {
  version: number;
  jiraReady: boolean;
  projects: { key: string; name: string }[];
  subjectField: string;
};

export type TimetrackInstance = {
  levels: { hierarchyLevel: number; typeNames: string[] }[];
  suggestedParenting: 'parent-field' | 'issue-link';
  subjectFieldCandidates: { id: string; name: string }[];
};

export type TimetrackRepoProject = {
  repoPath: string;
  projectKey?: string;
  private: boolean;
  inherited: boolean;
  suggestedProjectKey?: string;
};

export type TimetrackWorklog = {
  day: string;
  issueKey: string;
  description: string;
  fromMs: number;
  toMs: number;
  durationMs: number;
};

type Discovery = { version: number; port: number; token: string };

type Answer<T> = { ok: true; value: T } | { ok: false; message: string };

const NOT_RUNNING = [
  'Timetrack is not running, so no Jira credentials are reachable.',
  'Start the app — it holds the token for every repository on this machine — then try again.',
].join('\n');

/**
 * Where the app writes the port and the token, which is its data directory on each platform.
 *
 * `TIMETRACK_AGENT_DISCOVERY` names the file directly, for a machine whose app data lives somewhere
 * else and for a test.
 */
export const timetrackDiscoveryPath = () => {
  const override = process.env['TIMETRACK_AGENT_DISCOVERY']?.trim();

  if (override) return override;

  const home = homedir();

  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', IDENTIFIER, DISCOVERY_FILENAME);

  if (platform() === 'win32') {
    const appData = process.env['APPDATA']?.trim();

    return join(appData || join(home, 'AppData', 'Roaming'), IDENTIFIER, DISCOVERY_FILENAME);
  }

  const dataHome = process.env['XDG_DATA_HOME']?.trim();

  return join(dataHome || join(home, '.local', 'share'), IDENTIFIER, DISCOVERY_FILENAME);
};

const readDiscovery = (): Discovery => {
  const path = timetrackDiscoveryPath();

  if (!existsSync(path)) throw new Error(NOT_RUNNING);

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${path} is not readable JSON. Restart Timetrack, which rewrites it at every start.`);
  }

  const discovery = parsed as Partial<Discovery>;

  if (typeof discovery.port !== 'number' || typeof discovery.token !== 'string') {
    throw new Error(`${path} names no port and token. Restart Timetrack, which rewrites it at every start.`);
  }

  if (discovery.version !== PROTOCOL_VERSION) {
    throw new Error(
      `Timetrack speaks version ${discovery.version} of the agent contract and this CLI speaks ${PROTOCOL_VERSION}. Update whichever is older.`,
    );
  }

  return { version: discovery.version, port: discovery.port, token: discovery.token };
};

/**
 * Asks the running Timetrack app to carry out one operation.
 *
 * It is the only way this package reaches Jira. The token lives in the app's keychain entry and in no
 * repository, so a checkout an agent works in holds nothing worth stealing and nothing to rotate.
 */
export const askTimetrack = async <T>(request: Record<string, unknown> & { op: string }): Promise<T> => {
  const discovery = readDiscovery();
  let response: Response;

  try {
    response = await fetch(`http://127.0.0.1:${discovery.port}${PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${discovery.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // The file is there and the socket is not, which is what a discovery file left behind by an app
    // that has since stopped looks like.
    throw new Error(NOT_RUNNING);
  }

  if (response.status === 401) {
    throw new Error('Timetrack refused the token. It writes a new one at every start — restart the app.');
  }

  if (!response.ok) throw new Error(`Timetrack answered ${response.status} ${response.statusText}.`);

  const answer = (await response.json()) as Answer<T>;

  if (!answer.ok) throw new Error(answer.message);

  return answer.value;
};

export const timetrackStatus = () => askTimetrack<TimetrackStatus>({ op: 'status' });

export const timetrackInstance = () => askTimetrack<TimetrackInstance>({ op: 'jira.instance' });

export const timetrackIssue = async (key: string) =>
  (await askTimetrack<{ issue: TimetrackIssue }>({ op: 'jira.issue', key })).issue;

export const timetrackSearch = async (options: {
  text?: string;
  projectKey?: string;
  assignedToMe?: boolean;
  limit?: number;
}) => (await askTimetrack<{ issues: TimetrackIssue[] }>({ op: 'jira.search', ...options })).issues;

export const timetrackRepoProject = (repoPath: string) =>
  askTimetrack<TimetrackRepoProject>({ op: 'repo.project', repoPath });

export const timetrackCreateIssue = async (options: {
  summary: string;
  description?: string;
  projectKey?: string;
  issueTypeName?: string;
  parentKey?: string;
  subject?: string;
}) => (await askTimetrack<{ issue: { key: string; id: string } }>({ op: 'jira.create', ...options })).issue;

export const timetrackAddWorklog = async (options: {
  issueKey: string;
  description?: string;
  fromMs: number;
  durationMs: number;
}) => (await askTimetrack<{ worklog: TimetrackWorklog }>({ op: 'worklog.add', ...options })).worklog;

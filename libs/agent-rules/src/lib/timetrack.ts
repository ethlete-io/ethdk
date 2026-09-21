import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
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
const PROTOCOL_VERSION = 2;

/** A Jira search behind a slow instance is the long case; the app's own deadline is 60 seconds. */
const TIMEOUT_MS = 70_000;

const PATH = '/agent';
const PROOF_PATH = '/agent/proof';

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
  tempoReady: boolean;
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

/** One standing statement about what work in a context is logged against. */
export type TimetrackAttributionRule = {
  id: string;
  repoPath?: string;
  branch?: string;
  appId?: string;
  /** The issue the rule names, or nothing when it donates its time or names a stand-in instead. */
  issueKey?: string;
  /** The stand-in the rule names, as an id into what `timetrackStandIns` answers. */
  standInId?: string;
  /** Whether the rule donates its time to the work around it rather than naming an issue. */
  donates: boolean;
  createdAtMs: number;
};

/** One standing statement about a path: whether it is work, and which project it files into. */
export type TimetrackProjectLinkRule = {
  id: string;
  path: string;
  projectKey?: string;
  private: boolean;
  createdAtMs: number;
};

/** The settings that decide what a day's work is named. It holds no host, no account and no token. */
export type TimetrackRules = {
  dayTargetMs: number;
  gapFillMs: number;
  dayStartHour: number;
  attributionRules: TimetrackAttributionRule[];
  projectLinks: TimetrackProjectLinkRule[];
  backgroundProjects: string[];
  noWorkContextApps: string[];
  holdsWorkApps: string[];
};

/**
 * One name the user gave work that Jira does not hold yet.
 *
 * Nothing in this CLI opens or resolves a stand-in, because the name is the user's own word for their
 * work and the app is where they give it. A delete is allowed: it takes a name away rather than
 * putting one on the day.
 */
export type TimetrackStandIn = {
  id: string;
  name: string;
  projectKey?: string;
  state: 'open' | 'resolved';
  /** The issue it resolved to. Absent while it is open. */
  issueKey?: string;
  /** The local day keys that hold bands of it, oldest first. */
  days: string[];
  author: 'user' | 'agent';
  createdAtMs: number;
  /** The checkout the app opened it for. Absent on one the user opened by hand. */
  openedFor?: string;
  /**
   * The branch of that checkout it covers. Absent on a record opened before the grain was the branch,
   * which is why such a record covers the whole checkout and blocks every branch of it.
   */
  openedForBranch?: string;
  /** The directory of that branch it covers, where the branch names no piece of work of its own. */
  openedForWorkPath?: string;
};

/** One commit a split reads a directory out of: the day it counts toward, and its changed files. */
export type TimetrackWorkCommit = { day: string; paths: string[] };

/** One directory a split names, with the days of the record that worked in it. */
export type TimetrackStandInPiece = { workPath: string; days: string[]; commits: number };

/** What a split would do, or did. `candidates` is every directory; `pieces` is what gets written. */
export type TimetrackStandInSplit = {
  candidates: TimetrackStandInPiece[];
  pieces: TimetrackStandInPiece[];
  standIns: TimetrackStandIn[];
};

/**
 * What the checkout-wide naming offer says about one day, offers and refusals alike.
 *
 * A card the day screen never draws is the hardest thing to ask about, because every step that can
 * stop it is invisible from the screen. `declines` names the step that stopped.
 */
export type TimetrackNaming = {
  day: string;
  /** Whether a Tempo token is stored. Without one every checkout declines with `no-history`. */
  tempoReady: boolean;
  /** How far the read of the user's Tempo history got. */
  history: 'loading' | 'no-token' | 'ready' | 'failed';
  /** How many worklogs the span holds, whatever project they are in. */
  historyWorklogs: number;
  /** What the read failed with. Absent unless `history` is `failed`. */
  historyMessage?: string;
  offers: TimetrackNamingOffer[];
  declines: TimetrackNamingDecline[];
};

export type TimetrackNamingOffer = {
  repoPath: string;
  projectKey: string;
  issueKey: string;
  summary: string;
  days: number;
  loggedMs: number;
  /** How much of the project's logged time went to this one issue, from 0 to 1. */
  share: number;
};

export type TimetrackNamingDecline = {
  repoPath: string;
  reason:
    | 'already-named'
    | 'named-by-stand-in'
    | 'no-project-link'
    | 'no-history'
    | 'project-too-small'
    | 'too-few-days'
    | 'share-too-low';
  projectKey?: string;
  issueKey?: string;
  days?: number;
  loggedMs?: number;
  projectMs?: number;
  share?: number;
};

/** One day's evidence, straight out of the app's encrypted store. `events` is opaque here on purpose. */
export type TimetrackDayEvents = {
  day: string;
  fromMs: number;
  toMs: number;
  events: unknown[];
};

/** One row of a day as the app's own review drew it. Every edit names a row by this `id`. */
export type TimetrackRow = {
  id: string;
  issueKey?: string;
  standInId?: string;
  description: string;
  fromMs: number;
  toMs: number;
  durationMs: number;
  observedMs: number;
  laneKey?: string;
  state: string;
  confidence: string;
  edited: boolean;
  hidden: boolean;
};

/** A day as the screen draws it: the rows, the ones taken off the timeline, and its totals. */
export type TimetrackDayRows = {
  day: string;
  rows: TimetrackRow[];
  hidden: TimetrackRow[];
  proposedMs: number;
  loggedMs: number;
  targetMs: number;
  unattributedMs: number;
  warnings: { kind: string; detail: string }[];
};

/** One change to one row, named by the id `timetrackDayRows` answered. */
export type TimetrackRowEdit =
  | { kind: 'range'; rowId: string; fromMs: number; toMs: number }
  | { kind: 'issue'; rowId: string; issueKey: string }
  | { kind: 'description'; rowId: string; description: string }
  | { kind: 'state'; rowId: string; state: 'accepted' | 'rejected' }
  | { kind: 'hidden'; rowId: string; hidden: boolean }
  | { kind: 'reset'; rowId: string };

export type TimetrackEditedDay = TimetrackDayRows & { applied: number };

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

const IMPOSTOR = [
  'Something other than Timetrack answers on the port its discovery file names.',
  'The app writes a new port and a new token at every start — restart Timetrack, then try again.',
].join('\n');

/**
 * Makes the server prove it holds this run's token, before a request body or that token is sent.
 *
 * The port is ephemeral: once the app stops, anything running as this account can bind the port the
 * discovery file still names, be handed the request and answer invented data. So the token is used as
 * an HMAC key over a nonce this caller picks, and nothing is sent until the answer matches.
 */
const proveTheServer = async (discovery: Discovery) => {
  const nonce = randomBytes(16).toString('hex');
  const expected = createHmac('sha256', discovery.token).update(nonce).digest('hex');
  let answered: string | undefined;

  try {
    const response = await fetch(`http://127.0.0.1:${discovery.port}${PROOF_PATH}?nonce=${nonce}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.ok) answered = ((await response.json()) as { value?: { proof?: string } }).value?.proof;
  } catch {
    throw new Error(NOT_RUNNING);
  }

  const offered = Buffer.from(answered ?? '', 'utf8');

  if (offered.length !== expected.length || !timingSafeEqual(offered, Buffer.from(expected, 'utf8'))) {
    throw new Error(IMPOSTOR);
  }
};

/**
 * Asks the running Timetrack app to carry out one operation.
 *
 * It is the only way this package reaches Jira. The token lives in the app's keychain entry and in no
 * repository, so a checkout an agent works in holds nothing worth stealing and nothing to rotate.
 */
export const askTimetrack = async <T>(request: Record<string, unknown> & { op: string }): Promise<T> => {
  const discovery = readDiscovery();

  await proveTheServer(discovery);

  let response: Response;

  try {
    response = await fetch(`http://127.0.0.1:${discovery.port}${PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${discovery.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(request),
      redirect: 'error',
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

export const timetrackNaming = (day: string) => askTimetrack<TimetrackNaming>({ op: 'naming.offers', day });

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

export const timetrackDayEvents = (day: string) => askTimetrack<TimetrackDayEvents>({ op: 'day.events', day });

export const timetrackDayRows = (day: string) => askTimetrack<TimetrackDayRows>({ op: 'day.rows', day });

/**
 * Makes the stated edits to a day's rows and answers the day as it reads afterwards.
 *
 * The app moves its own review to that day, so the user sees what changed. `applied` counts the edits
 * that found their row: a day the collectors keep changing can drop a row a caller read a moment ago.
 */
export const timetrackEditDay = (options: { day: string; edits: readonly TimetrackRowEdit[] }) =>
  askTimetrack<TimetrackEditedDay>({ op: 'day.edits', ...options });

export const timetrackRules = () => askTimetrack<TimetrackRules>({ op: 'settings.rules' });

export const timetrackStandIns = async () =>
  (await askTimetrack<{ standIns: TimetrackStandIn[] }>({ op: 'standIn.list' })).standIns;

/**
 * Deletes one placeholder and answers with the list as it reads afterwards.
 *
 * The rule pointing at it goes with it. A record the app opened for one branch refuses that branch as
 * it goes, so no second one opens for it; a record naming no branch refuses nothing, and the next
 * pass may open one at whatever grain the day reads.
 */
export const timetrackRemoveStandIn = async (id: string) =>
  (await askTimetrack<{ standIns: TimetrackStandIn[] }>({ op: 'standIn.remove', id })).standIns;

/**
 * Cuts one placeholder into one per directory it turned out to cover.
 *
 * Without `apply` it answers the plan and writes nothing. The commits come from the caller: one
 * collected before Timetrack read file paths carries none, so only `git log --name-only` can say.
 * A checkout whose commits name more directories than a grain can hold has no automatic reading,
 * and `paths` is how the user picks which of them are the pieces.
 */
export const timetrackSplitStandIn = (options: {
  id: string;
  branch: string;
  commits: readonly TimetrackWorkCommit[];
  /** The projects the checkout declares, relative to it. They are the grain a piece is cut to. */
  projectRoots: readonly string[];
  /** The directories the user picked as the pieces. Empty lets the automatic reading answer. */
  paths: readonly string[];
  /** The directory that takes every day of the record no commit claims. */
  claim?: string;
  apply: boolean;
}) => askTimetrack<TimetrackStandInSplit>({ op: 'standIn.split', ...options });

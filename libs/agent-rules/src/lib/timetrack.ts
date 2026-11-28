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
const PROTOCOL_VERSION = 3;

/** Covers the app's own deadlines: up to 60 seconds for the user to unlock it, then 60 to answer. */
const TIMEOUT_MS = 130_000;

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
 * The name the approval queue shows for this caller: `TIMETRACK_CLIENT` when set, Claude Code when it
 * runs this, and nothing otherwise.
 */
const timetrackClientName = () =>
  process.env['TIMETRACK_CLIENT']?.trim() || (process.env['CLAUDECODE'] ? 'Claude Code' : undefined);

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
const askTimetrack = async <T>(request: { op: 'jira.issue'; key: string }): Promise<T> => {
  const discovery = readDiscovery();
  const client = timetrackClientName();

  await proveTheServer(discovery);

  let response: Response;

  try {
    response = await fetch(`http://127.0.0.1:${discovery.port}${PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${discovery.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(client ? { ...request, client } : request),
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

export const timetrackIssue = async (key: string) =>
  (await askTimetrack<{ issue: TimetrackIssue }>({ op: 'jira.issue', key })).issue;

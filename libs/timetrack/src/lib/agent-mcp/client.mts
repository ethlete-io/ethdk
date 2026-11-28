import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { env } from 'node:process';
import type { AgentApiAnswer, AgentApiRequest } from '../agent-api/model';

const IDENTIFIER = 'io.ethlete.timetrack';
const PROTOCOL_VERSION = 3;
const TIMEOUT_MS = 130_000;
const NOT_RUNNING = 'Timetrack is not running. Start the Timetrack app and try again.';

type Discovery = { version: number; port: number; token: string };

export const timetrackDiscoveryPath = () => {
  const override = env['TIMETRACK_AGENT_DISCOVERY']?.trim();
  if (override) return override;

  const home = homedir();
  const os = platform();
  if (os === 'darwin') return join(home, 'Library', 'Application Support', IDENTIFIER, 'agent.json');
  if (os === 'win32') return join(env['APPDATA']?.trim() || join(home, 'AppData', 'Roaming'), IDENTIFIER, 'agent.json');

  return join(env['XDG_DATA_HOME']?.trim() || join(home, '.local', 'share'), IDENTIFIER, 'agent.json');
};

const readDiscovery = async (): Promise<Discovery> => {
  const path = timetrackDiscoveryPath();
  let discovery: Partial<Discovery> | null;

  try {
    discovery = JSON.parse(await readFile(path, 'utf8')) as Partial<Discovery> | null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(NOT_RUNNING, { cause: error });

    throw new Error(`Cannot read the Timetrack discovery file at ${path}. Restart Timetrack to recreate it.`, {
      cause: error,
    });
  }

  if (
    typeof discovery?.port !== 'number' ||
    !Number.isInteger(discovery.port) ||
    discovery.port < 1 ||
    discovery.port > 65535 ||
    typeof discovery.token !== 'string' ||
    !discovery.token
  ) {
    throw new Error(`Invalid Timetrack discovery file at ${path}. Restart Timetrack to recreate it.`);
  }

  if (discovery.version !== PROTOCOL_VERSION) {
    const version = typeof discovery.version === 'number' ? discovery.version : 'unknown';
    throw new Error(`Timetrack reports agent contract version ${version} and timetrack-mcp requires version 3.`);
  }

  return { version: discovery.version, port: discovery.port, token: discovery.token };
};

const proveServer = async (baseUrl: string, token: string) => {
  const nonce = randomBytes(16).toString('hex');
  const expected = createHmac('sha256', token).update(nonce).digest('hex');
  let answer: AgentApiAnswer<{ proof: unknown }> | undefined;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/agent/proof?nonce=${nonce}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(NOT_RUNNING);
  }

  if (response.ok) answer = (await response.json().catch(() => undefined)) as typeof answer;
  const proof = answer?.ok ? answer.value?.proof : undefined;

  if (
    typeof proof !== 'string' ||
    Buffer.byteLength(proof) !== expected.length ||
    !timingSafeEqual(Buffer.from(proof), Buffer.from(expected))
  ) {
    throw new Error('Timetrack agent proof did not match. Restart the Timetrack app and try again.');
  }
};

export const askTimetrack = async <TResult,>(request: AgentApiRequest): Promise<TResult> => {
  const { port, token } = await readDiscovery();
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = env['TIMETRACK_CLIENT']?.trim() || (env['CLAUDECODE'] ? 'Claude Code' : undefined);

  // The discovery port can be reused after the app exits. Verify the proof before sending its token.
  await proveServer(baseUrl, token);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/agent`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, client }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(NOT_RUNNING);
  }

  if (response.status === 401) throw new Error('Timetrack refused the token. Restart the Timetrack app and try again.');
  if (!response.ok) throw new Error(`Timetrack answered HTTP ${response.status}.`);

  const answer = (await response.json()) as AgentApiAnswer<TResult>;
  if (answer?.ok === true && 'value' in answer) return answer.value;
  if (answer?.ok === false && typeof answer.message === 'string') throw new Error(answer.message);

  throw new Error('Timetrack returned an invalid agent response.');
};

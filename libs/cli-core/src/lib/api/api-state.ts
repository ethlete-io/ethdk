import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';

/** What `ready` last brought the API into. `dirty` means something changed the data since. */
export type ApiState = {
  profile: string | null;
  fingerprint: string | null;
  dirty: boolean;
  updatedAt: string;
};

const COMPOSE_FILE_NAMES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

const normalizeProjectName = (name: string) => name.toLowerCase().replace(/[^a-z0-9_-]/g, '');

const readText = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

const literal = (value: string | undefined) => (value === undefined || value.includes('$') ? undefined : value);

/**
 * The compose project name the container engine gives this compose directory, resolved the way compose
 * does: `COMPOSE_PROJECT_NAME` from the environment or the directory's `.env`, then the top-level
 * `name:` of the compose file, then the directory name.
 */
export const composeProjectName = (options: { composePath: string; env?: NodeJS.ProcessEnv }) => {
  const { composePath, env = process.env } = options;
  const fromDotEnv = readText(join(composePath, '.env'))?.match(
    /^\s*COMPOSE_PROJECT_NAME\s*=\s*["']?([^"'\s#]+)/m,
  )?.[1];
  const composeFile = COMPOSE_FILE_NAMES.map((name) => join(composePath, name)).find((path) => existsSync(path));
  const fromComposeFile = composeFile ? readText(composeFile)?.match(/^name:\s*["']?([^"'\s#]+)/m)?.[1] : undefined;
  const name = [env['COMPOSE_PROJECT_NAME'], literal(fromDotEnv), literal(fromComposeFile)]
    .map((candidate) => (candidate ? normalizeProjectName(candidate) : ''))
    .find((candidate) => candidate !== '');

  return name ?? normalizeProjectName(basename(composePath));
};

/** Machine-wide directory of one compose project's `state.json` and `lock.json`. */
export const apiStateDirectory = (options: { project: string; env?: NodeJS.ProcessEnv }) => {
  const { project, env = process.env } = options;
  const stateHome = env['XDG_STATE_HOME'] || join(homedir(), '.local/state');

  return join(stateHome, 'ethlete', 'api', project);
};

const statePath = (directory: string) => join(directory, 'state.json');

/** The stored state, or `undefined` when there is none or it cannot be read. */
export const readApiState = (directory: string): ApiState | undefined => {
  try {
    const value = JSON.parse(readFileSync(statePath(directory), 'utf8')) as Partial<ApiState>;

    return {
      profile: typeof value.profile === 'string' ? value.profile : null,
      fingerprint: typeof value.fingerprint === 'string' ? value.fingerprint : null,
      dirty: value.dirty === true,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  } catch {
    return undefined;
  }
};

/** Replaces `state.json` in one rename, so a reader never sees half a file. */
export const writeApiState = (options: { directory: string; state: Omit<ApiState, 'updatedAt'>; now?: Date }) => {
  const { directory, state, now = new Date() } = options;
  const written: ApiState = { ...state, updatedAt: now.toISOString() };
  const temporary = join(directory, `state.json.${randomUUID()}.tmp`);

  mkdirSync(directory, { recursive: true });

  try {
    writeFileSync(temporary, `${JSON.stringify(written, null, 2)}\n`, 'utf8');
    renameSync(temporary, statePath(directory));
  } finally {
    rmSync(temporary, { force: true });
  }

  return written;
};

/** Keeps the stored profile and fingerprint, so `status` can still say what the data was before. */
export const markApiStateDirty = (directory: string, now = new Date()) => {
  const previous = readApiState(directory);

  return writeApiState({
    directory,
    state: { profile: previous?.profile ?? null, fingerprint: previous?.fingerprint ?? null, dirty: true },
    now,
  });
};

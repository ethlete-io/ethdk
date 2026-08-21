import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * The compose file of every API here mounts `$HOME/.composer` into its container, so this is the
 * directory the container's composer reads, whatever `COMPOSER_HOME` says on the host.
 */
export const defaultComposerHome = () => join(homedir(), '.composer');

export const composerAuthPath = (home: string) => join(home, 'auth.json');

const GITLAB_TOKENS = 'gitlab-token';

type ComposerAuth = Record<string, unknown>;

const storedTokens = (auth: ComposerAuth) => auth[GITLAB_TOKENS] as Record<string, string> | undefined;

const readAuth = (path: string): { auth: ComposerAuth } | { unreadable: string } => {
  if (!existsSync(path)) return { auth: {} };

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { unreadable: `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { unreadable: `${path} does not hold a JSON object.` };
  }

  return { auth: parsed as ComposerAuth };
};

export type WriteTokenResult = { ok: true; path: string; replaced: boolean } | { ok: false; problem: string };

/**
 * Adds one host's GitLab token to composer's auth.json, keeping every other credential in the file.
 * A file that cannot be parsed is reported rather than replaced, so nothing already in it is lost.
 */
export const writeGitlabToken = (options: { home: string; host: string; token: string }): WriteTokenResult => {
  const { home, host, token } = options;
  const path = composerAuthPath(home);
  const read = readAuth(path);

  if ('unreadable' in read) {
    return { ok: false, problem: `${read.unreadable}\nFix it or move it aside, so no other credential in it is lost.` };
  }

  const tokens = { ...storedTokens(read.auth) };
  const replaced = tokens[host] !== undefined && tokens[host] !== token;

  tokens[host] = token;

  mkdirSync(home, { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...read.auth, [GITLAB_TOKENS]: tokens }, null, 4)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  // writeFileSync only applies mode when it creates the file, and this one usually already exists.
  chmodSync(path, 0o600);

  return { ok: true, path, replaced };
};

/** The hosts composer already holds a GitLab token for. */
export const gitlabTokenHosts = (home: string) => {
  const read = readAuth(composerAuthPath(home));

  return 'unreadable' in read ? [] : Object.keys(storedTokens(read.auth) ?? {});
};

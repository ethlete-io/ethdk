import { execFileSync, ExecFileSyncOptions, spawnSync, SpawnSyncOptions, SpawnSyncReturns } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** `process.env` plus `extra` without the `GIT_*` variables inherited from a hook, so git in a temp repo never reaches the hook's repo. */
export const gitEnv = (extra: Record<string, string | undefined> = {}) => {
  const merged = { ...process.env, ...extra };
  return Object.fromEntries(
    Object.entries(merged).filter(([key, value]) => !(key.startsWith('GIT_') && process.env[key] === value)),
  ) as NodeJS.ProcessEnv;
};

const withGitEnv = <T extends { env?: NodeJS.ProcessEnv }>(options?: T) => ({
  ...options,
  env: gitEnv(options?.env),
});

/** `execFileSync('git', args, options)` with every inherited `GIT_*` variable stripped. */
export const gitExec = (args: string[], options?: ExecFileSyncOptions) =>
  execFileSync('git', args, withGitEnv(options)) as string & Buffer;

/** `spawnSync('git', args, options)` with every inherited `GIT_*` variable stripped. */
export const gitSpawn = (args: string[], options?: SpawnSyncOptions) =>
  spawnSync('git', args, withGitEnv(options)) as SpawnSyncReturns<string & Buffer>;

/** Runs git in `dir` with `GIT_*` stripped and returns trimmed stdout. */
export const git = (dir: string, ...args: string[]) =>
  gitExec(args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();

/** Makes a temp directory, runs `git init` in it and returns its path. */
export const tempGitRepo = (prefix = 'git-spec-') => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  git(dir, 'init', '-q');
  return dir;
};

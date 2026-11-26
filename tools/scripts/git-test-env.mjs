import { execFileSync, spawnSync } from 'node:child_process';
import { tempDir } from './temp-dir.mjs';

// `git commit` starts a detached `git maintenance run --auto` that can recreate a temp repo after the spec removes it.
const NO_AUTO_MAINTENANCE = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'maintenance.auto',
  GIT_CONFIG_VALUE_0: 'false',
};

/** `process.env` plus `extra` without the `GIT_*` variables inherited from a hook, so git in a temp repo never reaches the hook's repo. */
export const gitEnv = (extra = {}) => {
  const inherited = ([key, value]) => key.startsWith('GIT_') && process.env[key] === value;
  const env = Object.fromEntries(Object.entries({ ...process.env, ...extra }).filter((entry) => !inherited(entry)));

  return 'GIT_CONFIG_COUNT' in env ? env : { ...env, ...NO_AUTO_MAINTENANCE };
};

const withGitEnv = (options = {}) => ({ ...options, env: gitEnv(options.env) });

/** `execFileSync('git', args, options)` with every `GIT_*` variable stripped. */
export const gitExec = (args, options) => execFileSync('git', args, withGitEnv(options));

/** `spawnSync('git', args, options)` with every `GIT_*` variable stripped. */
export const gitSpawn = (args, options) => spawnSync('git', args, withGitEnv(options));

/** Runs git in `dir` with `GIT_*` stripped and returns trimmed stdout. */
export const git = (dir, ...args) => gitExec(args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();

/** Makes a temp directory that is removed when the process exits, runs `git init` in it and returns its path. */
export const tempGitRepo = (prefix = 'git-spec-') => {
  const dir = tempDir(prefix);
  git(dir, 'init', '-q');
  return dir;
};

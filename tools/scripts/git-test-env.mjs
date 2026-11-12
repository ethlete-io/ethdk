import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** `process.env` plus `extra` without the `GIT_*` variables inherited from a hook, so git in a temp repo never reaches the hook's repo. */
export const gitEnv = (extra = {}) => {
  const inherited = ([key, value]) => key.startsWith('GIT_') && process.env[key] === value;
  return Object.fromEntries(Object.entries({ ...process.env, ...extra }).filter((entry) => !inherited(entry)));
};

const withGitEnv = (options = {}) => ({ ...options, env: gitEnv(options.env) });

/** `execFileSync('git', args, options)` with every `GIT_*` variable stripped. */
export const gitExec = (args, options) => execFileSync('git', args, withGitEnv(options));

/** `spawnSync('git', args, options)` with every `GIT_*` variable stripped. */
export const gitSpawn = (args, options) => spawnSync('git', args, withGitEnv(options));

/** Runs git in `dir` with `GIT_*` stripped and returns trimmed stdout. */
export const git = (dir, ...args) => gitExec(args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();

const tempDirs = [];
const removeTempDirs = () => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));

/** Makes a temp directory that is removed when the process exits, and returns its path. */
export const tempDir = (prefix) => {
  if (!tempDirs.length) process.once('exit', removeTempDirs);
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

/** Makes a temp directory that is removed when the process exits, runs `git init` in it and returns its path. */
export const tempGitRepo = (prefix = 'git-spec-') => {
  const dir = tempDir(prefix);
  git(dir, 'init', '-q');
  return dir;
};

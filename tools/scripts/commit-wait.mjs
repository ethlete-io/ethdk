import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { runPathSpecs, TESTED_TREE_ENV } from './precommit-specs.mjs';

const gitDir = (root) =>
  spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).stdout.trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const lockMtime = (lock) => {
  try {
    return statSync(lock).mtime;
  } catch {
    return null;
  }
};

export const waitForLock = async (lock, { intervalMs = 500, reportMs = 15000, log = console.error } = {}) => {
  let lastReport = 0;
  for (let mtime = lockMtime(lock); mtime; mtime = lockMtime(lock)) {
    if (Date.now() - lastReport >= reportMs) {
      log(`waiting for lock held since ${mtime.toISOString()}`);
      lastReport = Date.now();
    }
    await sleep(intervalMs);
  }
};

const holdsLock = (result) => result.status !== 0 && /index\.lock/.test(result.stderr);

const untrackedPaths = (root, paths) =>
  spawnSync('git', ['ls-files', '-z', '--others', '--exclude-standard', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
  })
    .stdout.split('\0')
    .filter(Boolean);

const addUntracked = async (root, lock, paths) => {
  const fresh = untrackedPaths(root, paths);
  if (!fresh.length) return 0;
  for (;;) {
    await waitForLock(lock);
    const added = spawnSync('git', ['add', '--', ...fresh], { cwd: root, encoding: 'utf8' });
    if (holdsLock(added)) continue;
    process.stderr.write(added.stderr);
    return added.status ?? 1;
  }
};

export const commit = async (root, args) => {
  const separator = args.indexOf('--');
  const paths = separator === -1 ? [] : args.slice(separator + 1);
  const env = { ...process.env };
  delete env[TESTED_TREE_ENV];

  if (paths.length) {
    const specs = runPathSpecs(root, paths);
    if (specs.status !== 0) return specs.status;
    env[TESTED_TREE_ENV] = specs.tree;
  }

  const lock = join(gitDir(root), 'index.lock');
  const added = await addUntracked(root, lock, paths);
  if (added !== 0) return added;
  await waitForLock(lock);
  return spawnSync('git', ['commit', ...args], { cwd: root, env, stdio: 'inherit' }).status ?? 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await commit(process.cwd(), process.argv.slice(2)));
}

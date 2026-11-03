import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

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

export const commit = async (root, args) => {
  await waitForLock(join(gitDir(root), 'index.lock'));
  return spawnSync('git', ['commit', ...args], { cwd: root, stdio: 'inherit' }).status ?? 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await commit(process.cwd(), process.argv.slice(2)));
}

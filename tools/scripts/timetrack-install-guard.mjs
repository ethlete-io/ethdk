import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mtimeOf = (file) => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
};

export const installIsStale = (root) => {
  const lock = mtimeOf(join(root, 'yarn.lock'));
  const state = mtimeOf(join(root, 'node_modules', '.yarn-state.yml'));

  if (lock === null) return false;

  return state === null || lock > state;
};

const runYarnInstall = (root) => spawnSync('yarn', ['install'], { cwd: root, stdio: 'inherit' }).status ?? 1;

/** Runs `install` when `yarn.lock` is newer than the install state; returns the exit code to use. */
export const guardInstall = ({ root, install = runYarnInstall, log = console.error }) => {
  if (!installIsStale(root)) return 0;

  log('yarn.lock changed since the last install: running yarn install.');

  const status = install(root);

  if (status !== 0) {
    log(`yarn install failed (exit ${status}) after yarn.lock changed: fix the install, then rerun yarn timetrack.`);

    return 1;
  }

  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(guardInstall({ root: process.cwd() }));
}

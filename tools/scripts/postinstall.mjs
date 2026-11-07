import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Points core.hooksPath at the tracked, relative `.husky` so every worktree runs its own hooks against its own scripts; returns the path set, or `null` outside a git repo. */
export const useTrackedHooksPath = (cwd) => {
  const inside = spawnSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8' });

  if (inside.status !== 0) return null;

  spawnSync('git', ['config', 'core.hooksPath', '.husky'], { cwd });

  return '.husky';
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  spawnSync('husky', { stdio: 'inherit', shell: true });
  useTrackedHooksPath(process.cwd());
}

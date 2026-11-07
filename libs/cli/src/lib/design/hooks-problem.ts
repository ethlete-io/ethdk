import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

const gitOf = (cwd: string, args: string[]) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return run.status === 0 ? run.stdout.trim() : '';
};

/** A line saying the checkout's husky hooks do not run on commit, or `null` when they do or the checkout has none. */
export const hooksProblemOf = (cwd: string) => {
  const top = gitOf(cwd, ['rev-parse', '--show-toplevel']);

  if (!top || !existsSync(join(top, '.husky', 'pre-commit'))) return null;

  const hooksPath = gitOf(cwd, ['config', 'core.hooksPath']);
  const dir = hooksPath ? resolve(top, hooksPath) : join(top, '.husky', '_');

  if (hooksPath && dir === join(top, '.husky') && existsSync(join(dir, 'pre-commit'))) return null;

  return `HOOKS NOT INSTALLED: core.hooksPath is ${hooksPath ? `"${hooksPath}"` : 'unset'} and ${join(dir, 'pre-commit')} is missing, so no commit or push check runs. Run \`git config core.hooksPath .husky\` (relative, so every worktree runs its own hooks).`;
};

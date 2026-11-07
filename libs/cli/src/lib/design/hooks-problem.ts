import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { spawnPlain } from '../plain-output';

const gitOf = (cwd: string, args: string[]) => {
  const run = spawnPlain(['git', ...args], { cwd });

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

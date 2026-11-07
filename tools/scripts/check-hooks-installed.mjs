import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (cwd, args) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return run.status === 0 ? run.stdout.trim() : '';
};

/** The problem line when `git commit` in `cwd` would not run the `.husky` hooks, or `null` when it would. */
export const hooksProblemOf = (cwd) => {
  const top = git(cwd, ['rev-parse', '--show-toplevel']);

  if (!top) return null;

  const hooksPath = git(cwd, ['config', 'core.hooksPath']);
  const dir = hooksPath ? resolve(top, hooksPath) : join(top, '.husky', '_');

  if (hooksPath && dir.endsWith(`${sep}.husky${sep}_`) && existsSync(join(dir, 'pre-commit'))) return null;

  return `Git hooks are not installed here (core.hooksPath is ${hooksPath ? `"${hooksPath}"` : 'unset'}, no pre-commit at ${join(dir, 'pre-commit')}), so commit and push checks never run. Run \`yarn husky\`. In a worktree the config is shared with the main checkout, so set the absolute path instead: git config core.hooksPath <main checkout>/.husky/_`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problem = hooksProblemOf(process.cwd());

  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}

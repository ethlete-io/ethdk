import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (cwd, args) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return run.status === 0 ? run.stdout.trim() : '';
};

/** Points core.hooksPath at the absolute `.husky/_` of the main checkout when agent worktrees exist; returns the path set, or `null`. */
export const useAbsoluteHooksPath = (cwd) => {
  const commonDir = git(cwd, ['rev-parse', '--git-common-dir']);

  if (!commonDir) return null;

  const main = dirname(isAbsolute(commonDir) ? commonDir : resolve(cwd, commonDir));

  if (!existsSync(join(main, '.claude', 'worktrees'))) return null;

  const hooksPath = join(main, '.husky', '_');

  spawnSync('git', ['config', 'core.hooksPath', hooksPath], { cwd });

  return hooksPath;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  spawnSync('husky', { stdio: 'inherit', shell: true });
  useAbsoluteHooksPath(process.cwd());
}

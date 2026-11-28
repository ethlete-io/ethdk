import { git } from './git-reader';
import { resolve } from 'path';

const tops = new Map<string, string>();

/**
 * The top folder of the git work tree that holds `cwd`, spelled through `cwd` itself. `--show-toplevel` answers with
 * the real path, so paths below a symlinked `cwd` would climb out of it when made relative to that. Answered once per
 * `cwd` for the life of the process: a failed lookup throws and is asked again.
 */
export const gitTopOf = (cwd: string) => {
  const known = tops.get(cwd);

  if (known !== undefined) return known;

  const top = resolve(cwd, git(['rev-parse', '--show-cdup'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim());

  tops.set(cwd, top);

  return top;
};

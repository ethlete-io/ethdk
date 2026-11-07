import { execFileSync } from 'child_process';
import { resolve } from 'path';

/**
 * The top folder of the git work tree that holds `cwd`, spelled through `cwd` itself. `--show-toplevel` answers with
 * the real path, so paths below a symlinked `cwd` would climb out of it when made relative to that.
 */
export const gitTopOf = (cwd: string) =>
  resolve(
    cwd,
    execFileSync('git', ['rev-parse', '--show-cdup'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim(),
  );

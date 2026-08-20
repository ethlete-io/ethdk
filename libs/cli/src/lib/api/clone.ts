import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

export const DEFAULT_CHECKOUT_DIR = '.ethlete';

/** True when git would ignore the path, so a cloned checkout cannot be committed by accident. */
export const isGitIgnored = (root: string, path: string) =>
  spawnSync('git', ['check-ignore', '-q', path], { cwd: root }).status === 0;

export type CloneRequest = {
  repoUrl: string;
  /** Absolute path to clone into. */
  into: string;
  /** Branch to check out, from `apiRepoBranches`. */
  branch?: string;
};

/** Clones an API repo into its managed directory. Git's own output and failures are passed through. */
export const cloneApiRepo = ({ repoUrl, into, branch }: CloneRequest) => {
  if (existsSync(into)) {
    console.error(`${into} already exists.`);

    return 1;
  }

  mkdirSync(dirname(into), { recursive: true });

  const args = ['clone', ...(branch ? ['--branch', branch] : []), '--', repoUrl, into];

  return spawnSync('git', args, { stdio: 'inherit' }).status ?? 1;
};

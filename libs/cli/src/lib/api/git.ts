import { spawnSync } from 'child_process';

export type GitResult = { status: number; stdout: string; stderr: string };

const git = (cwd: string, args: string[]): GitResult => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
};

const gitInherit = (cwd: string, args: string[]) => spawnSync('git', args, { cwd, stdio: 'inherit' }).status ?? 1;

export const currentBranch = (cwd: string) => {
  const result = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

  return result.status === 0 ? result.stdout : undefined;
};

export const hasUncommittedChanges = (cwd: string) => git(cwd, ['status', '--porcelain']).stdout.length > 0;

/** Switches the API checkout to the branch configured for it. Git's own refusal is passed through. */
export const checkoutApiBranch = (options: { repoPath: string; branch: string }) => {
  const { repoPath, branch } = options;

  if (currentBranch(repoPath) === branch) {
    console.log(`Already on ${branch}.`);

    return 0;
  }

  return gitInherit(repoPath, ['checkout', branch]);
};

/**
 * Fast-forwards the checked-out branch. `force` throws away local commits and uncommitted tracked
 * changes on it; untracked files such as `vendor/` and `.env` are never touched.
 */
export const pullApiBranch = (options: { repoPath: string; expectedBranch?: string; force: boolean }) => {
  const { repoPath, expectedBranch, force } = options;
  const branch = currentBranch(repoPath);

  if (!branch) {
    console.error(`${repoPath} is not a git checkout.`);

    return 1;
  }

  if (expectedBranch && branch !== expectedBranch) {
    console.warn(`On ${branch}, but apiRepoBranches expects ${expectedBranch}. Pulling ${branch}.\n`);
  }

  if (!force && hasUncommittedChanges(repoPath)) {
    console.error(`${repoPath} has uncommitted changes. Commit or stash them, or pass --force to discard them.`);

    return 1;
  }

  const fetched = gitInherit(repoPath, ['fetch', 'origin', branch]);

  if (fetched !== 0) return fetched;

  if (!force) return gitInherit(repoPath, ['merge', '--ff-only', `origin/${branch}`]);

  console.log(`Discarding local commits and tracked changes on ${branch}.`);

  return gitInherit(repoPath, ['reset', '--hard', `origin/${branch}`]);
};

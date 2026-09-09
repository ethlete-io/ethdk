/** A checkout of one repository, and the branch it holds. A detached head holds none. */
export type GitWorktree = { path: string; branch?: string };

/** The main worktree is always first, which is what makes the first entry the identity of the group. */
export const gitWorktreeArgs = () => ['worktree', 'list', '--porcelain'];

const BRANCH_LINE = /^branch refs\/heads\/(.+)$/;

/**
 * Reads `git worktree list --porcelain`. Every checkout of a repository answers with the same list, so
 * the first entry's path identifies the object store that all of them share.
 */
export const parseGitWorktrees = (output: string): GitWorktree[] => {
  const worktrees: GitWorktree[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    const path = trimmed.startsWith('worktree ') ? trimmed.slice('worktree '.length) : null;

    if (path) {
      worktrees.push({ path });
      continue;
    }

    const branch = BRANCH_LINE.exec(trimmed)?.[1];
    const current = worktrees.at(-1);

    if (branch && current) current.branch = branch;
  }

  return worktrees.filter((worktree) => !!worktree.path);
};

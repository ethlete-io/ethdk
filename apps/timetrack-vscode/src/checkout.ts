import { gitHeadBranch } from '@ethlete/timetrack';

/** The file system this reads, as the two questions it actually asks of it. */
export type CheckoutFs = {
  isDirectory: (path: string) => Promise<boolean>;
  readText: (path: string) => Promise<string | null>;
};

export type Checkout = {
  repoPath: string;
  branch?: string;
};

/** How far up the tree the search for a `.git` goes, so an unusual path cannot walk to the root forever. */
const MAX_DEPTH = 64;

const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/');

  return cut > 0 ? path.slice(0, cut) : null;
};

/**
 * The checkout a file is in, and the branch it has checked out.
 *
 * `.git` is read as a file when the directory is a worktree or a submodule — git writes `gitdir: …`
 * there instead — and that case reports the checkout without a branch rather than not at all: the
 * directory is still the project being worked on, which is what the app attributes by.
 */
export const checkoutOf = async (options: { fs: CheckoutFs; filePath: string }): Promise<Checkout | null> => {
  let directory = parentOf(options.filePath);

  for (let depth = 0; directory && depth < MAX_DEPTH; depth += 1) {
    if (await options.fs.isDirectory(`${directory}/.git`)) {
      const head = await options.fs.readText(`${directory}/.git/HEAD`);

      return { repoPath: directory, branch: head ? gitHeadBranch(head) : undefined };
    }

    if ((await options.fs.readText(`${directory}/.git`)) !== null) {
      return { repoPath: directory };
    }

    directory = parentOf(directory);
  }

  return null;
};

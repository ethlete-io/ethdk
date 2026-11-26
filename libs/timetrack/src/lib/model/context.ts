import { createWorktreeFold } from '../git/worktree';

/**
 * The checkouts discovery found, and each linked worktree mapped to its main checkout
 * (`linkedWorktreesOf`, or a remembered superset of it).
 */
export type CheckoutRoots = { paths: readonly string[]; worktrees: Readonly<Record<string, string>> };

// Keyed by the roots object itself: a caller must not mutate one it has already passed.
const rootsResolved = new WeakMap<
  CheckoutRoots,
  { fold: (path: string) => string; paths: readonly string[]; known: Map<string, string> }
>();

/**
 * The checkout a directory belongs to, or the directory itself when no known root contains it.
 *
 * A path inside a linked worktree is read as the same place in its main checkout first, so a worktree
 * is never a checkout of its own.
 *
 * Longest root wins, so a repository checked out inside another one keeps its own identity. Keeping
 * the directory when nothing matches is deliberate: an agent session run somewhere the discovery never
 * walked is still context, and dropping it would lose the branch it reported with it.
 */
export const repoRootOf = (options: { path: string; roots: CheckoutRoots }) => {
  const resolved = rootsResolved.get(options.roots) ?? {
    fold: createWorktreeFold(options.roots.worktrees),
    paths: [...options.roots.paths, ...Object.values(options.roots.worktrees)],
    known: new Map<string, string>(),
  };
  const cached = resolved.known.get(options.path);

  if (cached !== undefined) return cached;

  const path = resolved.fold(options.path);
  let found: string | undefined;

  for (const root of resolved.paths) {
    if (path !== root && !path.startsWith(`${root}/`)) continue;
    if (found && found.length >= root.length) continue;

    found = root;
  }

  resolved.known.set(options.path, found ?? path);
  rootsResolved.set(options.roots, resolved);

  return found ?? path;
};

/**
 * A branch name, or nothing for a detached checkout.
 *
 * A collector that asks git for the current branch is answered `HEAD` when none is checked out, and
 * git refuses `HEAD` as a branch name, so it never names one. The reader drops it rather than the
 * collectors alone, because events already in the store carry whatever they were written with.
 */
export const branchOf = (branch: string | undefined) => (branch === 'HEAD' ? undefined : branch);

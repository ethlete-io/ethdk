/**
 * The checkout a directory belongs to, or the directory itself when no known root contains it.
 *
 * Longest root wins, so a repository checked out inside another one keeps its own identity. Keeping
 * the directory when nothing matches is deliberate: an agent session run somewhere the discovery never
 * walked is still context, and dropping it would lose the branch it reported with it.
 */
export const repoRootOf = (options: { path: string; roots: readonly string[] }) => {
  let found: string | undefined;

  for (const root of options.roots) {
    if (options.path !== root && !options.path.startsWith(`${root}/`)) continue;
    if (found && found.length >= root.length) continue;

    found = root;
  }

  return found ?? options.path;
};

/**
 * A branch name, or nothing for a detached checkout.
 *
 * A collector that asks git for the current branch is answered `HEAD` when none is checked out, and
 * git refuses `HEAD` as a branch name, so it never names one. The reader drops it rather than the
 * collectors alone, because events already in the store carry whatever they were written with.
 */
export const branchOf = (branch: string | undefined) => (branch === 'HEAD' ? undefined : branch);

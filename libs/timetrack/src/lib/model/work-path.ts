/**
 * How deep a work path may reach. Three segments is `context/tracks/<track>` and `src/app/<feature>`,
 * and a fourth starts naming the parts of one piece of work rather than the piece.
 */
export const DEFAULT_MAX_WORK_PATH_DEPTH = 3;

/**
 * How many work paths one checkout may split into before the split stops meaning anything.
 *
 * A checkout that touches nine directories in a day is not doing nine pieces of work; it is a
 * checkout whose directories are not its grain. Falling back to the whole checkout is the honest
 * answer there, and it is what the app did before work paths existed.
 */
export const DEFAULT_MAX_WORK_PATHS = 4;

const directoryOf = (path: string) => {
  const cut = path.lastIndexOf('/');

  return cut > 0 ? path.slice(0, cut) : '';
};

const truncate = (directory: string, maxDepth: number) => directory.split('/').slice(0, maxDepth).join('/');

/**
 * The directory one commit worked in, or nothing when its files name no directory in common.
 *
 * The deepest directory holding more than half of the changed files wins. A majority rather than all
 * of them is what lets a commit that also touches an index or a manifest at the top of the checkout
 * still count as work on the directory its other files are in - which is most commits that add
 * anything, so requiring a common prefix would answer the checkout root for nearly all of them.
 *
 * The answer is cut to `maxDepth` segments, because below that a directory names a part of a piece of
 * work rather than the piece.
 */
export const workPathOf = (options: { paths: readonly string[]; maxDepth?: number }): string | undefined => {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_WORK_PATH_DEPTH;
  const directories = options.paths.map((path) => truncate(directoryOf(path), maxDepth)).filter(Boolean);

  if (!directories.length) return undefined;

  const held = new Map<string, number>();

  for (const directory of directories) {
    const segments = directory.split('/');

    for (let depth = 1; depth <= segments.length; depth++) {
      const prefix = segments.slice(0, depth).join('/');

      held.set(prefix, (held.get(prefix) ?? 0) + 1);
    }
  }

  const majority = options.paths.length / 2;
  let found: string | undefined;

  for (const [prefix, count] of held) {
    if (count <= majority) continue;
    if (found && found.split('/').length >= prefix.split('/').length) continue;

    found = prefix;
  }

  return found;
};

/**
 * Whether the work paths observed in one checkout are its grain, and may therefore split its work.
 *
 * Two is the smallest set that says anything: one path is the whole checkout under another name, and
 * it must leave the checkout's own grain alone. Above `maxPaths` the directories are structure rather
 * than work, so the checkout stays one piece.
 */
export const workPathsSplit = (options: { paths: readonly (string | undefined)[]; maxPaths?: number }) => {
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_WORK_PATHS;
  const distinct = new Set(options.paths.filter((path): path is string => !!path));

  return distinct.size >= 2 && distinct.size <= maxPaths ? distinct : null;
};

/** One commit of a repair: the local day it counts toward, and the files it changed. */
export type WorkPathCommit = { day: string; paths: readonly string[] };

/** One directory a set of commits worked in, with the days that worked in it. */
export type WorkPathPiece = { workPath: string; days: string[] };

/**
 * Every directory a set of commits worked in, with the days that worked in each.
 *
 * This is the raw reading, with no judgment about whether the directories are a grain. It is what a
 * user picking the pieces of a repair by hand is offered.
 */
export const workPathDays = (options: { commits: readonly WorkPathCommit[]; maxDepth?: number }): WorkPathPiece[] => {
  const days = new Map<string, Set<string>>();

  for (const commit of options.commits) {
    const workPath = workPathOf({ paths: commit.paths, maxDepth: options.maxDepth });

    if (!workPath) continue;

    days.set(workPath, (days.get(workPath) ?? new Set()).add(commit.day));
  }

  return [...days.entries()]
    .map(([workPath, held]) => ({ workPath, days: [...held].sort() }))
    .sort((left, right) => left.workPath.localeCompare(right.workPath));
};

/**
 * The directories a set of commits splits into, or nothing when they are not its grain.
 *
 * This is how a placeholder opened for a whole checkout is re-cut without the user choosing. The
 * store cannot answer it: a commit collected before Timetrack read file paths carries none, so the
 * caller reads them back out of `git log --name-only` and hands them here.
 *
 * A commit counts toward the day it was made on rather than the day before it. The backwards reading
 * `workPathAt` does is about which minutes a commit describes, and a repair asks the coarser
 * question of which directories a day touched at all.
 */
export const workPathPieces = (options: {
  commits: readonly WorkPathCommit[];
  maxDepth?: number;
  maxPaths?: number;
}): WorkPathPiece[] => {
  const held = workPathDays(options);

  return workPathsSplit({ paths: held.map((piece) => piece.workPath), maxPaths: options.maxPaths }) ? held : [];
};

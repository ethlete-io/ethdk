/**
 * How many work paths one checkout may split into before the split stops meaning anything.
 *
 * A checkout that touches nine directories in a day is not doing nine pieces of work; it is a
 * checkout whose directories are not its grain. Falling back to the whole checkout is the honest
 * answer there, and it is what the app did before work paths existed.
 */
export const DEFAULT_MAX_WORK_PATHS = 4;

/**
 * How many commits a directory needs before a repair opens a record for it.
 *
 * Measured over four checkouts: the directories below this floor are an incidental edit to a
 * neighbouring library rather than a piece of work, and one checkout produced fifteen of them. They
 * stay in the candidate list, so the user can still pick one by hand.
 */
export const DEFAULT_MIN_WORK_PATH_COMMITS = 3;

/**
 * The projects each checkout declares, relative to that checkout, keyed by the checkout's own path.
 *
 * The host reads them; the model only applies them. A checkout missing here is not an error - it
 * falls back to the trunk rule, which is what a repository with no project files needs anyway.
 */
export type TimetrackProjectRoots = Readonly<Record<string, readonly string[]>>;

const directoryOf = (path: string) => {
  const cut = path.lastIndexOf('/');

  return cut > 0 ? path.slice(0, cut) : '';
};

const prefixes = (directory: string) => {
  const segments = directory.split('/');

  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
};

const deepest = (left: string | undefined, right: string) =>
  left && left.split('/').length >= right.split('/').length ? left : right;

/** The deepest prefix more than `half` of `directories` sit inside, or nothing. */
const majorityPrefix = (directories: readonly string[], half: number) => {
  const held = new Map<string, number>();

  for (const directory of directories) {
    for (const prefix of prefixes(directory)) held.set(prefix, (held.get(prefix) ?? 0) + 1);
  }

  let found: string | undefined;

  for (const [prefix, count] of held) {
    if (count <= half) continue;

    found = deepest(found, prefix);
  }

  return found;
};

/**
 * The deepest project the checkout declares that holds `directory`, or nothing.
 *
 * A repository states its own boundaries in the directories that carry a `project.json` or a
 * `package.json`, and those beat any depth this code could pick: they keep two sibling libraries
 * apart while folding one library's own subdirectories back together.
 */
const projectRootOf = (directory: string, projectRoots: ReadonlySet<string>) => {
  let found: string | undefined;

  for (const prefix of prefixes(directory)) {
    if (projectRoots.has(prefix)) found = deepest(found, prefix);
  }

  return found;
};

/**
 * The directory one commit worked in, or nothing when its files name no directory in common.
 *
 * The deepest directory holding more than half of the changed files wins. A majority rather than all
 * of them is what lets a commit that also touches an index or a manifest at the top of the checkout
 * still count as work on the directory its other files are in - which is most commits that add
 * anything, so requiring a common prefix would answer the checkout root for nearly all of them.
 *
 * The answer is the raw directory. `workPathsOf` narrows it to the piece of work it belongs to.
 */
export const workPathOf = (options: { paths: readonly string[] }): string | undefined => {
  const directories = options.paths.map(directoryOf).filter(Boolean);

  if (!directories.length) return undefined;

  return majorityPrefix(directories, options.paths.length / 2);
};

/**
 * The piece of work each commit belongs to, in the order the commits were given.
 *
 * Two rules answer this, and the checkout decides which. Where the checkout declares projects, the
 * deepest one holding the commit's directory is the piece - `libs/domain/public/competition` and
 * `libs/domain/public/static` stay apart, while every subdirectory of one library folds into it.
 * Where it declares none, the commits decide between them: the deepest prefix more than half of them
 * sit inside is the trunk, and the pieces are one level below it.
 *
 * The trunk is read across the whole set rather than per commit, so a checkout answers at one grain.
 */
export const workPathsOf = (options: {
  commits: readonly { paths: readonly string[] }[];
  projectRoots?: readonly string[];
}): (string | undefined)[] => {
  const roots = new Set(options.projectRoots ?? []);
  const directories = options.commits.map((commit) => workPathOf({ paths: commit.paths }));
  const named = directories.filter((directory): directory is string => !!directory);
  const trunk = majorityPrefix(named, named.length / 2);
  const depth = trunk ? trunk.split('/').length + 1 : 1;

  return directories.map((directory) => {
    if (!directory) return undefined;

    return projectRootOf(directory, roots) ?? directory.split('/').slice(0, depth).join('/');
  });
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
export type WorkPathPiece = { workPath: string; days: string[]; commits: number };

/**
 * Every directory a set of commits worked in, with the days that worked in each.
 *
 * This is the raw reading, with no judgment about whether a directory holds enough work to be a
 * piece. It is what a user picking the pieces of a repair by hand is offered.
 */
export const workPathDays = (options: {
  commits: readonly WorkPathCommit[];
  projectRoots?: readonly string[];
}): WorkPathPiece[] => {
  const paths = workPathsOf(options);
  const held = new Map<string, { days: Set<string>; commits: number }>();

  options.commits.forEach((commit, index) => {
    const workPath = paths[index];

    if (!workPath) return;

    const piece = held.get(workPath) ?? { days: new Set<string>(), commits: 0 };

    piece.days.add(commit.day);
    piece.commits++;
    held.set(workPath, piece);
  });

  return [...held.entries()]
    .map(([workPath, piece]) => ({ workPath, days: [...piece.days].sort(), commits: piece.commits }))
    .sort((left, right) => left.workPath.localeCompare(right.workPath));
};

/**
 * The directories a set of commits splits into, or nothing when they are not its grain.
 *
 * This is how a placeholder opened for a whole checkout is re-cut without the user choosing. A
 * directory under `minCommits` is left out: it is an edit made in passing, not a piece of work, and a
 * checkout can produce a dozen of them. Two pieces are the least a split can mean.
 *
 * The store cannot answer this: a commit collected before Timetrack read file paths carries none, so
 * the caller reads them back out of `git log --name-only` and hands them here.
 *
 * A commit counts toward the day it was made on rather than the day before it. The backwards reading
 * `workPathAt` does is about which minutes a commit describes, and a repair asks the coarser
 * question of which directories a day touched at all.
 */
export const workPathPieces = (options: {
  commits: readonly WorkPathCommit[];
  projectRoots?: readonly string[];
  minCommits?: number;
}): WorkPathPiece[] => {
  const minCommits = options.minCommits ?? DEFAULT_MIN_WORK_PATH_COMMITS;
  const held = workPathDays(options).filter((piece) => piece.commits >= minCommits);

  return held.length >= 2 ? held : [];
};

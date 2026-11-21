import { CollectedEvent } from '../model/event';

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

/** Each linked worktree of one `git worktree list`, mapped to the main checkout it was added to. */
export const linkedWorktreesOf = (worktrees: readonly GitWorktree[]): Record<string, string> => {
  const [main, ...linked] = worktrees;

  return main ? Object.fromEntries(linked.map((worktree) => [worktree.path, main.path])) : {};
};

const trimmedPath = (path: string) => path.replace(/(?<=.)[\\/]+$/, '');

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rewrites every path inside a linked worktree to the same place in its main checkout, so a worktree
 * is never a repository of its own. `worktrees` is `linkedWorktreesOf`'s map, or a remembered superset of it.
 */
export const createWorktreeFold = (worktrees: Readonly<Record<string, string>>) => {
  const pairs = Object.entries(worktrees)
    .map(([worktree, main]) => [trimmedPath(worktree), trimmedPath(main)] as const)
    .filter(([worktree, main]) => worktree && main && worktree !== main)
    .sort(([a], [b]) => b.length - a.length);
  const mainOf = new Map(pairs);
  const pattern = pairs.length
    ? new RegExp(`(?<=^|repo:)(?:${pairs.map(([worktree]) => escaped(worktree)).join('|')})(?![\\w.-])`, 'g')
    : null;
  const folded = new Map<string, string>();

  return (text: string) => {
    if (!pattern) return text;

    const known = folded.get(text);
    if (known !== undefined) return known;

    const result = text.replace(pattern, (worktree) => mainOf.get(worktree) ?? worktree);
    folded.set(text, result);

    return result;
  };
};

const foldDeep = (value: unknown, fold: (text: string) => string): unknown => {
  if (typeof value === 'string') return fold(value);
  if (Array.isArray(value)) return value.map((item) => foldDeep(item, fold));
  if (value instanceof Date || value === null || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [fold(key), foldDeep(item, fold)]));
};

/** Stored data (a day's review edits, a rule) with every checkout path and lane key in it folded by `createWorktreeFold`. */
export const foldWorktreePaths = <T>(value: T, worktrees: Readonly<Record<string, string>>): T =>
  Object.keys(worktrees).length ? (foldDeep(value, createWorktreeFold(worktrees)) as T) : value;

/**
 * Each checkout a commit in `events` names that is not in `known`, with one of its commits. A deleted
 * worktree is found this way: its directory and its entry in the common dir are gone, but its commits
 * are still objects of the repository it shared them with.
 */
export const unknownCommitCheckoutsOf = (options: {
  events: readonly CollectedEvent[];
  known: ReadonlySet<string>;
}): Map<string, string> => {
  const found = new Map<string, string>();

  for (const event of options.events) {
    if (event.kind !== 'git-commit') continue;

    for (const path of [event.repoPath, event.worktree]) {
      const checkout = path && trimmedPath(path);
      if (checkout && !options.known.has(checkout) && !found.has(checkout)) found.set(checkout, event.sha);
    }
  }

  return found;
};

export const gitHasCommitArgs = (sha: string) => ['cat-file', '-e', `${sha}^{commit}`];

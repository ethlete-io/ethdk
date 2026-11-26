import { CollectedEvent, GitCommitEvent, OriginEvent } from '../model/event';

const copyKeysOf = (commit: GitCommitEvent) => [
  `sha:${commit.sha}`,
  `authored:${commit.at.toISOString()}:${commit.subject}`,
  ...(commit.patchId ? [`patch:${commit.patchId}`] : []),
];

const rankOf = (commit: GitCommitEvent, repoRoots: ReadonlySet<string>) => {
  const original = commit.committedAt && commit.committedAt.getTime() !== commit.at.getTime() ? 1 : 0;
  const elsewhere = repoRoots.size && !repoRoots.has(commit.repoPath) ? 1 : 0;

  return original * 2 + elsewhere;
};

type CopyRanking = { repoRoots?: readonly string[] };

const copyGroupsOf = <T extends CollectedEvent | OriginEvent>(events: readonly T[], ranking: CopyRanking) => {
  const roots = new Set(ranking.repoRoots);
  const commits = events
    .filter((event): event is T & GitCommitEvent => event.kind === 'git-commit' && !event.authoredAt)
    .sort((left, right) => rankOf(left, roots) - rankOf(right, roots) || left.at.getTime() - right.at.getTime());
  const keeperOf = new Map<string, T & GitCommitEvent>();
  const groups = new Map<T & GitCommitEvent, (T & GitCommitEvent)[]>();

  for (const commit of commits) {
    const keys = copyKeysOf(commit);
    const keeperKey = keys.find((key) => keeperOf.has(key));
    const keeper = keeperKey ? keeperOf.get(keeperKey) : undefined;

    if (keeper) groups.get(keeper)?.push(commit);
    else groups.set(commit, [commit]);

    for (const key of keys) if (!keeperOf.has(key)) keeperOf.set(key, keeper ?? commit);
  }

  return [...groups.values()];
};

/**
 * The day's events with each commit counted once. A copy is the same `sha` in another checkout, the same
 * `patchId` under a new `sha` (a cherry-pick), or the same author time and subject (a rebase or amend,
 * which keeps both and may change the patch, and a commit stored without a `patchId`).
 *
 * Of several copies the original stays: the one whose committer time equals its author time, else the one
 * in a checkout of `repoRoots` rather than a worktree, else the earliest.
 *
 * A pulled commit (one with `authoredAt`) is kept as it is: it stands for the pull, not for the work.
 */
export const withoutCherryPicks = <T extends CollectedEvent | OriginEvent>(
  events: readonly T[],
  ranking: CopyRanking = {},
): T[] => {
  const copies = new Set<T>(copyGroupsOf(events, ranking).flatMap((group) => group.slice(1)));

  return copies.size ? events.filter((event) => !copies.has(event)) : [...events];
};

/** Every commit that has copies, as its copies in the order `withoutCherryPicks` ranks them: the kept one first. */
export const cherryPickCopies = <T extends CollectedEvent | OriginEvent>(
  events: readonly T[],
  ranking: CopyRanking = {},
): (T & GitCommitEvent)[][] => copyGroupsOf(events, ranking).filter((group) => group.length > 1);

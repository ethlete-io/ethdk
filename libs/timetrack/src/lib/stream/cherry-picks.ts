import { CollectedEvent, GitCommitEvent, OriginEvent } from '../model/event';

const copyKeysOf = (commit: GitCommitEvent) => [
  `sha:${commit.sha}`,
  `authored:${commit.at.toISOString()}:${commit.subject}`,
  ...(commit.patchId ? [`patch:${commit.patchId}`] : []),
];

/**
 * The day's events with each commit counted once, at its earliest copy. A copy is the same `sha` in
 * another checkout, the same `patchId` under a new `sha` (a cherry-pick), or the same author time and
 * subject (a rebase or amend, which keeps both and may change the patch, and a commit stored without a
 * `patchId`).
 *
 * A pulled commit (one with `authoredAt`) is kept as it is: it stands for the pull, not for the work.
 */
export const withoutCherryPicks = <T extends CollectedEvent | OriginEvent>(events: readonly T[]): T[] => {
  const commits = events
    .filter((event): event is T & GitCommitEvent => event.kind === 'git-commit' && !event.authoredAt)
    .sort((left, right) => left.at.getTime() - right.at.getTime());
  const seen = new Set<string>();
  const copies = new Set<T>();

  for (const commit of commits) {
    const keys = copyKeysOf(commit);

    if (keys.some((key) => seen.has(key))) copies.add(commit);

    for (const key of keys) seen.add(key);
  }

  return copies.size ? events.filter((event) => !copies.has(event)) : [...events];
};

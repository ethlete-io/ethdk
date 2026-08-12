import { CollectedEvent } from '../model/event';

/** A separator none of the parts can contain, so two different events cannot key to the same string. */
const PART_SEPARATOR = '\u001f';

const keyOf = (parts: string[]) => parts.join(PART_SEPARATOR);

/**
 * The identity a re-collected event is recognised by, or `null` for an event only its collector can
 * have observed.
 *
 * A git scan reads a window of history rather than a stream, so overlapping runs — the periodic
 * reconcile, a run the watcher triggered, the wide scan after the app was closed — see the same
 * commits and switches again. The store drops a repeat by this key, which is what lets a scan window
 * be as wide as it needs to be. A focus sample has no such identity: two identical ones a minute
 * apart are two real observations, so they key to `null` and are always appended.
 *
 * A commit keys by its sha alone, so the branch the first scan reported for it is the one that stays.
 * `%S` names whichever ref reached the commit first, and a commit that later also lives on another
 * branch must not turn into a second observation of the same work.
 */
export const dedupeKeyOf = (event: CollectedEvent): string | null => {
  switch (event.kind) {
    case 'git-commit':
      return keyOf([event.kind, event.repoPath, event.sha]);
    case 'git-checkout':
      return keyOf([event.kind, event.repoPath, event.at.toISOString(), event.branch]);
    default:
      return null;
  }
};

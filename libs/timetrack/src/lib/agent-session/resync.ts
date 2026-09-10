import { TimetrackProjectLink, pathIsUnder, projectKeyFor } from '../model/project-link';
import { AgentSessionCursor } from './collect';
import { UnlinkedAgentSessions } from './linked';

/**
 * Rewinds the cursors of the logs run under `paths`, so the next collection reads those logs from the
 * top again. Every other cursor comes back untouched.
 *
 * This is what a new project link needs. A session in a checkout no link covered was never stored, and
 * nothing else brings it back: the cursor moved anyway, because the line was read and re-reading it
 * would only have dropped it a second time.
 *
 * The rewind stays per log rather than wholesale. A dedupe key makes a re-read store nothing twice, but
 * not free: every line of every log is parsed again for the sessions of one checkout. A cursor written
 * before the checkout was recorded has no `cwd`, so no path can match it and it is never rewound.
 */
export const resyncAgentSessionCursors = (options: {
  cursors: readonly AgentSessionCursor[];
  paths: readonly string[];
}): AgentSessionCursor[] =>
  options.cursors.map((cursor) => {
    const cwd = cursor.cwd;

    if (!cwd || !options.paths.some((path) => pathIsUnder(path, cwd))) return cursor;

    return { id: cursor.id, nextLine: 0, cwd };
  });

/**
 * The cursors of one backfill pass, for the logs run under `paths`, cleared so it reads them again.
 *
 * Only the cleared ones come back, because they are the whole write: the backfill hands back a cursor
 * for each log it reaches, and a rewound log it does not reach in the same run has to keep its cleared
 * cursor in the store or the next run would skip it again.
 *
 * Every event a backfill pass stores keys on the provider and the provider's own id, so a re-read of a
 * log it already covered appends nothing. See ADR 0003.
 */
export const rewindAgentBackfillCursors = (options: {
  cursors: readonly AgentSessionCursor[];
  paths: readonly string[];
}): AgentSessionCursor[] =>
  options.cursors.flatMap((cursor) => {
    const cwd = cursor.cwd;

    if (!cwd || !cursor.readThrough || !options.paths.some((path) => pathIsUnder(path, cwd))) return [];

    return [{ id: cursor.id, nextLine: 0, cwd }];
  });

/** A checkout whose skipped sessions a link now files into a project, so a re-read would store them. */
export type AgentSessionResyncOffer = UnlinkedAgentSessions & { projectKey: string };

/**
 * The checkouts worth reading again, out of the ones a run reported as skipped.
 *
 * A link made after the sessions were dropped is the whole reason to offer this, so a checkout still
 * covered by nothing is not offered — there would be nowhere to file it. Neither is one the user marked
 * private: private time is stored nowhere by design, and a re-read would drop it again.
 */
export const agentSessionResyncOffers = (options: {
  unlinked: readonly UnlinkedAgentSessions[];
  links: readonly TimetrackProjectLink[];
}): AgentSessionResyncOffer[] =>
  options.unlinked.flatMap((entry) => {
    const projectKey = projectKeyFor({ context: { repoPath: entry.cwd }, links: options.links });

    return projectKey ? [{ ...entry, projectKey }] : [];
  });

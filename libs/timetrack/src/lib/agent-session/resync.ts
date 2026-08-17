import { TimetrackProjectLink, pathIsUnder, projectKeyFor } from '../correlate/project-link';
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
 * Which is also why the rewind is per log rather than wholesale. An agent session has no dedupe key, so
 * a log that is read again without cause appends a second copy of every sample in it. A cursor written
 * before the checkout was recorded has no `cwd`, and is never rewound for the same reason.
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

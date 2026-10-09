import { TimetrackProjectLink, pathIsUnder, projectKeyFor } from '../model/project-link';
import { AgentSessionEvent } from '../model/event';
import { AgentSessionCollection, AgentSessionCursor } from './collect';
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

/** The stretch of one session a re-read produced samples for, from its first sample to its last. */
export type AgentSessionSpan = { sessionId: string; from: Date; to: Date };

/**
 * Per session with a sample under `paths`, the stretch from its first to its last sample in `events`.
 * A replacing resync deletes the samples the store holds inside it before writing the re-read ones.
 *
 * `events` must hold every log of the session read from the top: a subagent's log shares its parent's
 * session id, and a span taken from the parent alone would delete the subagent's samples.
 */
export const agentSessionSpansUnder = (options: {
  events: readonly AgentSessionEvent[];
  paths: readonly string[];
}): AgentSessionSpan[] => {
  const replaced = new Set(
    options.events
      .filter((event) => options.paths.some((path) => pathIsUnder(path, event.cwd)))
      .map((event) => event.sessionId),
  );
  const spans = new Map<string, AgentSessionSpan>();

  for (const event of options.events) {
    if (!replaced.has(event.sessionId)) continue;

    const span = spans.get(event.sessionId);

    if (!span) spans.set(event.sessionId, { sessionId: event.sessionId, from: event.at, to: event.at });
    else if (event.at < span.from) span.from = event.at;
    else if (event.at > span.to) span.to = event.at;
  }

  return [...spans.values()];
};

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

const parserVersionOf = (cursor: AgentSessionCursor) => cursor.parserVersion ?? 1;

/**
 * The next logs to read again from the top because older parse rules read them, rewound: the logs of
 * the `limit` log groups whose stale cursor sampled most recently, among the logs the host still lists.
 *
 * A group is read whole, stale or not. A subagent's log shares its parent's session id, so a replacing
 * write built from the parent alone would delete the subagent's samples and write none back.
 */
export const agentSessionReparseBatch = (options: {
  cursors: readonly AgentSessionCursor[];
  listed: readonly string[];
  version: number;
  limit: number;
  /** The log group of a log id. Every log is its own group by default. */
  groupOf?: (logId: string) => string;
}): AgentSessionCursor[] => {
  const groupOf = options.groupOf ?? ((logId: string) => logId);
  const listed = new Set(options.listed);
  const cursors = new Map(options.cursors.map((cursor) => [cursor.id, cursor]));
  const latestStale = new Map<string, number>();

  for (const cursor of options.cursors) {
    if (!listed.has(cursor.id) || !cursor.nextLine || parserVersionOf(cursor) >= options.version) continue;

    const group = groupOf(cursor.id);
    const at = cursor.after?.getTime() ?? 0;

    latestStale.set(group, Math.max(latestStale.get(group) ?? 0, at));
  }

  const groups = new Set(
    [...latestStale]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, options.limit)
      .map(([group]) => group),
  );

  return options.listed
    .filter((logId) => groups.has(groupOf(logId)))
    .map((logId) => {
      const cwd = cursors.get(logId)?.cwd;

      return { id: logId, nextLine: 0, ...(cwd ? { cwd } : {}) };
    });
};

/**
 * What a re-read under newer parse rules writes: its events less every one dated on a frozen day, and
 * the span per session and day the store replaces with them. A finished day this app booked keeps the
 * rows it was booked with (ADR 0038), so the store keeps that day's samples as they are.
 */
export const reparsedAgentSessionWrite = (options: {
  collection: Pick<AgentSessionCollection, 'events' | 'usage' | 'prompts'>;
  dayOf: (at: Date) => string;
  frozenDays: ReadonlySet<string>;
}): Pick<AgentSessionCollection, 'events' | 'usage' | 'prompts'> & { replacing: AgentSessionSpan[] } => {
  const open = <T extends { at: Date }>(events: readonly T[]) =>
    events.filter((event) => !options.frozenDays.has(options.dayOf(event.at)));
  const events = open(options.collection.events);
  const spans = new Map<string, AgentSessionSpan>();

  for (const event of events) {
    const key = `${event.sessionId}\u0000${options.dayOf(event.at)}`;
    const span = spans.get(key);

    if (!span) spans.set(key, { sessionId: event.sessionId, from: event.at, to: event.at });
    else if (event.at < span.from) span.from = event.at;
    else if (event.at > span.to) span.to = event.at;
  }

  return {
    events,
    usage: open(options.collection.usage),
    prompts: open(options.collection.prompts),
    replacing: [...spans.values()],
  };
};

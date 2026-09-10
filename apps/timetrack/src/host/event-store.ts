import {
  AgentLogPass,
  AgentLogSessionState,
  AgentSessionCursor,
  CollectedEvent,
  StoredTitle,
  TimetrackEventStore,
  TimetrackTitleRepairStore,
  dedupeKeyOf,
} from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredEvent = {
  atMs: number;
  source: string;
  kind: string;
  payload: Record<string, unknown>;
  dedupeKey?: string | null;
};

/**
 * What one collector has in the store. The count and the newest instant together are what say a
 * source is alive: a caught-up collector stores nothing on most runs, but its newest event still moves.
 */
export type SourceTally = {
  source: CollectedEvent['source'];
  count: number;
  latestAt: Date | null;
};

type StoredTally = { source: string; count: number; latestAtMs: number | null };

type StoredCursor = {
  id: string;
  kind: AgentLogPass;
  nextLine: number;
  afterMs: number | null;
  title: string | null;
  cwd: string | null;
  readThroughMs: number | null;
  sessionJson: string | null;
};

const stringField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * The parser's session state as the store holds it — JSON the host wrote back untouched.
 *
 * Read field by field rather than cast: the row was written by an older version of this app, so a
 * field it never wrote is missing and a field this one dropped is still there.
 */
const reviveSessionState = (json: string): AgentLogSessionState | undefined => {
  try {
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;

    const record = parsed as Record<string, unknown>;

    return { sessionId: stringField(record, 'sessionId'), model: stringField(record, 'model') };
  } catch {
    return undefined;
  }
};

const toStored = (event: CollectedEvent): StoredEvent => ({
  atMs: event.at.getTime(),
  source: event.source,
  kind: event.kind,
  payload: { ...event } as unknown as Record<string, unknown>,
  dedupeKey: dedupeKeyOf(event),
});

const reviveEvent = (stored: StoredEvent): CollectedEvent => {
  const { at, until, ...rest } = stored.payload;
  const revived = { ...rest, at: new Date(at as string) };

  return (typeof until === 'string' ? { ...revived, until: new Date(until) } : revived) as CollectedEvent;
};

const toStoredCursor = (cursor: AgentSessionCursor, kind: AgentLogPass): StoredCursor => ({
  id: cursor.id,
  kind,
  nextLine: cursor.nextLine,
  afterMs: cursor.after ? cursor.after.getTime() : null,
  title: cursor.title ?? null,
  cwd: cursor.cwd ?? null,
  readThroughMs: cursor.readThrough ? cursor.readThrough.getTime() : null,
  sessionJson: cursor.session ? JSON.stringify(cursor.session) : null,
});

const reviveCursor = (stored: StoredCursor): AgentSessionCursor => ({
  id: stored.id,
  nextLine: stored.nextLine,
  ...(stored.afterMs === null ? {} : { after: new Date(stored.afterMs) }),
  ...(stored.title === null ? {} : { title: stored.title }),
  ...(stored.cwd === null ? {} : { cwd: stored.cwd }),
  ...(stored.readThroughMs === null ? {} : { readThrough: new Date(stored.readThroughMs) }),
  ...(stored.sessionJson === null ? {} : { session: reviveSessionState(stored.sessionJson) }),
});

/**
 * The encrypted store, plus the one thing the port cannot express: appending a collector's events
 * and moving its cursors in a single transaction. A cursor that moves without the events it covers
 * takes the next read past samples nothing stored, so the agent-session collector must use
 * `appendWithCursors$` and never `append$`.
 */
export type TauriEventStore = TimetrackEventStore &
  TimetrackTitleRepairStore & {
    /** Resolves with the rows that were new — an event the store already holds under its dedupe key is skipped. */
    appendCounted$(events: CollectedEvent[]): Observable<number>;
    /** The same, and moves the cursors of one pass over the agent logs in the same transaction. */
    appendWithCursors$(options: {
      events: CollectedEvent[];
      cursors: AgentSessionCursor[];
      pass: AgentLogPass;
    }): Observable<number>;
    bySource$(): Observable<SourceTally[]>;
    cursors$(pass: AgentLogPass): Observable<AgentSessionCursor[]>;
    compactedThrough$(): Observable<Date | null>;
    setCompactedThrough$(through: Date | null): Observable<void>;
  };

export const createTauriEventStore = (): TauriEventStore => {
  const appendWithCursors$ = (options: {
    events: CollectedEvent[];
    cursors: AgentSessionCursor[];
    pass: AgentLogPass;
  }) =>
    invokeHost$<number>('events_append', {
      events: options.events.map(toStored),
      cursors: options.cursors.map((cursor) => toStoredCursor(cursor, options.pass)),
    });

  const appendCounted$ = (events: CollectedEvent[]) =>
    invokeHost$<number>('events_append', { events: events.map(toStored), cursors: [] });

  return {
    appendCounted$,
    appendWithCursors$,
    append$: (events) => appendCounted$(events).pipe(map(() => undefined)),
    eventsBetween$: (from, to) =>
      invokeHost$<StoredEvent[]>('events_between', { fromMs: from.getTime(), toMs: to.getTime() }).pipe(
        map((stored) => stored.map(reviveEvent)),
      ),
    deleteEventsBefore$: (before) => invokeHost$<number>('events_delete_before', { beforeMs: before.getTime() }),
    oldestEventAt$: () =>
      invokeHost$<number | null>('events_oldest_at').pipe(map((atMs) => (atMs === null ? null : new Date(atMs)))),
    bySource$: () =>
      invokeHost$<StoredTally[]>('events_by_source').pipe(
        map((rows) =>
          rows.map((row): SourceTally => ({
            source: row.source as CollectedEvent['source'],
            count: row.count,
            latestAt: row.latestAtMs === null ? null : new Date(row.latestAtMs),
          })),
        ),
      ),
    cursors$: (pass) =>
      invokeHost$<StoredCursor[]>('agent_session_cursors', { kind: pass }).pipe(map((rows) => rows.map(reviveCursor))),
    compactedThrough$: () =>
      invokeHost$<number | null>('compacted_through').pipe(map((atMs) => (atMs === null ? null : new Date(atMs)))),
    setCompactedThrough$: (through) =>
      invokeHost$<void>('set_compacted_through', { throughMs: through === null ? null : through.getTime() }),
    titlesAfterId$: (afterId, limit) => invokeHost$<StoredTitle[]>('events_titles_after', { afterId, limit }),
    setTitles$: (rows) => invokeHost$<number>('events_set_titles', { rows: [...rows] }),
  };
};

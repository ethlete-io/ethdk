import { AgentSessionCursor, CollectedEvent, TimetrackEventStore, dedupeKeyOf } from '@ethlete/timetrack';
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
  nextLine: number;
  afterMs: number | null;
  title: string | null;
  cwd: string | null;
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

const toStoredCursor = (cursor: AgentSessionCursor): StoredCursor => ({
  id: cursor.id,
  nextLine: cursor.nextLine,
  afterMs: cursor.after ? cursor.after.getTime() : null,
  title: cursor.title ?? null,
  cwd: cursor.cwd ?? null,
});

const reviveCursor = (stored: StoredCursor): AgentSessionCursor => ({
  id: stored.id,
  nextLine: stored.nextLine,
  ...(stored.afterMs === null ? {} : { after: new Date(stored.afterMs) }),
  ...(stored.title === null ? {} : { title: stored.title }),
  ...(stored.cwd === null ? {} : { cwd: stored.cwd }),
});

/**
 * The encrypted store, plus the one thing the port cannot express: appending a collector's events
 * and moving its cursors in a single transaction. A cursor that is lost re-reads its whole log and
 * appends every sample in it a second time, so the agent-session collector must use
 * `appendWithCursors$` and never `append$`.
 */
export type TauriEventStore = TimetrackEventStore & {
  /** Resolves with the rows that were new — an event the store already holds under its dedupe key is skipped. */
  appendWithCursors$(events: CollectedEvent[], cursors: AgentSessionCursor[]): Observable<number>;
  bySource$(): Observable<SourceTally[]>;
  cursors$(): Observable<AgentSessionCursor[]>;
  compactedThrough$(): Observable<Date | null>;
  setCompactedThrough$(through: Date | null): Observable<void>;
};

export const createTauriEventStore = (): TauriEventStore => {
  const appendWithCursors$ = (events: CollectedEvent[], cursors: AgentSessionCursor[]) =>
    invokeHost$<number>('events_append', {
      events: events.map(toStored),
      cursors: cursors.map(toStoredCursor),
    });

  return {
    appendWithCursors$,
    append$: (events) => appendWithCursors$(events, []).pipe(map(() => undefined)),
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
    cursors$: () => invokeHost$<StoredCursor[]>('agent_session_cursors').pipe(map((rows) => rows.map(reviveCursor))),
    compactedThrough$: () =>
      invokeHost$<number | null>('compacted_through').pipe(map((atMs) => (atMs === null ? null : new Date(atMs)))),
    setCompactedThrough$: (through) =>
      invokeHost$<void>('set_compacted_through', { throughMs: through === null ? null : through.getTime() }),
  };
};

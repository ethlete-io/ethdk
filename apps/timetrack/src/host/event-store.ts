import { AgentSessionCursor, CollectedEvent, TimetrackEventStore } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredEvent = {
  atMs: number;
  source: string;
  kind: string;
  payload: Record<string, unknown>;
};

type StoredCursor = {
  id: string;
  nextLine: number;
  afterMs: number | null;
  title: string | null;
};

const toStored = (event: CollectedEvent): StoredEvent => ({
  atMs: event.at.getTime(),
  source: event.source,
  kind: event.kind,
  payload: { ...event } as unknown as Record<string, unknown>,
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
});

const reviveCursor = (stored: StoredCursor): AgentSessionCursor => ({
  id: stored.id,
  nextLine: stored.nextLine,
  ...(stored.afterMs === null ? {} : { after: new Date(stored.afterMs) }),
  ...(stored.title === null ? {} : { title: stored.title }),
});

/**
 * The encrypted store, plus the one thing the port cannot express: appending a collector's events
 * and moving its cursors in a single transaction. A cursor that is lost re-reads its whole log and
 * appends every sample in it a second time, so the agent-session collector must use
 * `appendWithCursors$` and never `append$`.
 */
export type TauriEventStore = TimetrackEventStore & {
  appendWithCursors$(events: CollectedEvent[], cursors: AgentSessionCursor[]): Observable<void>;
  cursors$(): Observable<AgentSessionCursor[]>;
  compactedThrough$(): Observable<Date | null>;
  setCompactedThrough$(through: Date | null): Observable<void>;
};

export const createTauriEventStore = (): TauriEventStore => {
  const appendWithCursors$ = (events: CollectedEvent[], cursors: AgentSessionCursor[]) =>
    invokeHost$<void>('events_append', {
      events: events.map(toStored),
      cursors: cursors.map(toStoredCursor),
    });

  return {
    appendWithCursors$,
    append$: (events) => appendWithCursors$(events, []),
    eventsBetween$: (from, to) =>
      invokeHost$<StoredEvent[]>('events_between', { fromMs: from.getTime(), toMs: to.getTime() }).pipe(
        map((stored) => stored.map(reviveEvent)),
      ),
    deleteEventsBefore$: (before) => invokeHost$<number>('events_delete_before', { beforeMs: before.getTime() }),
    oldestEventAt$: () =>
      invokeHost$<number | null>('events_oldest_at').pipe(map((atMs) => (atMs === null ? null : new Date(atMs)))),
    cursors$: () => invokeHost$<StoredCursor[]>('agent_session_cursors').pipe(map((rows) => rows.map(reviveCursor))),
    compactedThrough$: () =>
      invokeHost$<number | null>('compacted_through').pipe(map((atMs) => (atMs === null ? null : new Date(atMs)))),
    setCompactedThrough$: (through) =>
      invokeHost$<void>('set_compacted_through', { throughMs: through === null ? null : through.getTime() }),
  };
};

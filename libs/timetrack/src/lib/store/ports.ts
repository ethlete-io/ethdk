import { Observable } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { SyncedWorklog } from '../model/proposal';

/**
 * Raw observations, append-only. The host owns the encrypted database; the core only ever asks for a
 * range, appends what a collector produced, or tells it what retention has released.
 */
export type TimetrackEventStore = {
  eventsBetween$(from: Date, to: Date): Observable<CollectedEvent[]>;
  append$(events: CollectedEvent[]): Observable<void>;
  /** Drops raw events older than `before`, and reports how many rows went. */
  deleteEventsBefore$(before: Date): Observable<number>;
  /** The oldest raw event still stored, or `null` when the store is empty. */
  oldestEventAt$(): Observable<Date | null>;
};

/**
 * The record of which Tempo worklogs this app owns. Ownership is read from here and nowhere else, so
 * an entry this store loses orphans the worklog it pointed at — `recoverLedgerFromMarkers` is the way
 * back, and only when the worklogs carry a marker.
 */
export type TimetrackLedgerStore = {
  entriesFor$(proposalIds: string[]): Observable<SyncedWorklog[]>;
  upsert$(entries: SyncedWorklog[]): Observable<void>;
  remove$(proposalIds: string[]): Observable<void>;
};

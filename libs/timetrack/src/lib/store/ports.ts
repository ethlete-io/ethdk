import { Observable } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { SyncedWorklog } from '../model/proposal';
import { TimerRun } from '../model/timer';
import { DayReviewEdits } from '../review/model';

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

/**
 * What a reviewer changed about a day, keyed by its local calendar day (`YYYY-MM-DD`). Only the edits
 * are stored — the engine's own rows are re-derived from the events on every read, so a day whose
 * evidence grew still reflects it, and a day nobody touched costs nothing.
 */
export type TimetrackReviewStore = {
  editsFor$(day: string): Observable<DayReviewEdits | null>;
  save$(day: string, edits: DayReviewEdits): Observable<void>;
  clear$(day: string): Observable<void>;
};

/**
 * The runs the user timed by hand. At most one is open, and the store is what enforces it: starting a
 * run closes whichever one was still going, so a forgotten timer cannot silently overlap its successor.
 */
export type TimetrackTimerStore = {
  /** Runs overlapping the range, open ones included. */
  runsBetween$(from: Date, to: Date): Observable<TimerRun[]>;
  /** The open run, or `null` when no timer is going. */
  running$(): Observable<TimerRun | null>;
  start$(at: Date): Observable<TimerRun>;
  /** The run that was closed, or `null` when nothing was going. */
  stop$(at: Date): Observable<TimerRun | null>;
  /** Names what a run was for, after the fact. An empty string clears the field. */
  label$(id: string, label: { issueKey: string; note: string }): Observable<void>;
};

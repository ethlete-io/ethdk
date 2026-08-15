import { DayNudgeRecord } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredNudgeRecord = {
  day: string;
  lastNudgedAtMs: number | null;
  silencedUntilMs: number | null;
};

/**
 * What each day has already been reminded about, and the one line the reminder puts on screen.
 *
 * The record is host state for the same reason a `Date` crosses as epoch milliseconds everywhere else
 * here: the store holds numbers, and the window is the only side that knows they are instants.
 */
export type TauriNudge = {
  recordFor$(day: string): Observable<DayNudgeRecord | null>;
  save$(record: DayNudgeRecord): Observable<void>;
  notify$(options: { title: string; body: string }): Observable<void>;
};

const toStored = (record: DayNudgeRecord): StoredNudgeRecord => ({
  day: record.day,
  lastNudgedAtMs: record.lastNudgedAt?.getTime() ?? null,
  silencedUntilMs: record.silencedUntil?.getTime() ?? null,
});

const revive = (stored: StoredNudgeRecord): DayNudgeRecord => ({
  day: stored.day,
  lastNudgedAt: stored.lastNudgedAtMs === null ? null : new Date(stored.lastNudgedAtMs),
  silencedUntil: stored.silencedUntilMs === null ? null : new Date(stored.silencedUntilMs),
});

export const createTauriNudge = (): TauriNudge => ({
  recordFor$: (day) =>
    invokeHost$<StoredNudgeRecord | null>('day_nudge_record', { day }).pipe(
      map((stored) => (stored === null ? null : revive(stored))),
    ),
  save$: (record) => invokeHost$<void>('set_day_nudge_record', { record: toStored(record) }),
  notify$: ({ title, body }) => invokeHost$<void>('notify', { title, body }),
});

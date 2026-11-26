import { Observable, of, tap } from 'rxjs';

export const DAY_READ_MAX_AGE_MS = 60 * 60_000;

export type DayReadMoment = { day: string; nowMs: number; standInIds: readonly string[] };

type Entry<T> = { at: DayReadMoment; value: T };

export const dayReadIsFresh = (options: { at: DayReadMoment; now: DayReadMoment }) => {
  const { at, now } = options;
  const held = new Set(at.standInIds);

  return (
    at.day === now.day &&
    now.nowMs - at.nowMs < DAY_READ_MAX_AGE_MS &&
    now.nowMs >= at.nowMs &&
    now.standInIds.every((id) => held.has(id))
  );
};

export const createDayReadCache = <T>() => {
  const entries = new Map<string, Entry<T>>();

  return (options: { key: string; now: DayReadMoment; read$: () => Observable<T> }): Observable<T> => {
    const held = entries.get(options.key);

    if (held && dayReadIsFresh({ at: held.at, now: options.now })) return of(held.value);

    return options.read$().pipe(tap((value) => entries.set(options.key, { at: options.now, value })));
  };
};

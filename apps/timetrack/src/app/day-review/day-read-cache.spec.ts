import { Observable, of, throwError } from 'rxjs';
import { DAY_READ_MAX_AGE_MS, DayReadMoment, createDayReadCache } from './day-read-cache';

const AT: DayReadMoment = { day: '2026-10-09', nowMs: Date.UTC(2026, 9, 9, 9), standInIds: ['s1'] };

const counted = () => {
  let reads = 0;

  return {
    reads: () => reads,
    read$: (): Observable<string[]> => {
      reads += 1;

      return of([`read ${reads}`]);
    },
  };
};

const valueOf = <T>(source: Observable<T>) => {
  let value: T | undefined;

  source.subscribe((next) => (value = next));

  return value;
};

describe('createDayReadCache', () => {
  it('reads Jira once per key within the hour', () => {
    const cache = createDayReadCache<string[]>();
    const jira = counted();

    valueOf(cache({ key: 'FIFAGG|FIFAGG-12601', now: AT, read$: jira.read$ }));

    expect(
      valueOf(cache({ key: 'FIFAGG|FIFAGG-12601', now: { ...AT, nowMs: AT.nowMs + 59 * 60_000 }, read$: jira.read$ })),
    ).toEqual(['read 1']);
    expect(jira.reads()).toBe(1);

    valueOf(cache({ key: 'FIFAGG|FIFAGG-1', now: AT, read$: jira.read$ }));

    expect(jira.reads()).toBe(2);
  });

  it('reads again after an hour, on the next day, and once a stand-in opened', () => {
    const cache = createDayReadCache<string[]>();
    const jira = counted();
    const ask = (now: DayReadMoment) => valueOf(cache({ key: 'k', now, read$: jira.read$ }));

    ask(AT);
    ask({ ...AT, nowMs: AT.nowMs + DAY_READ_MAX_AGE_MS });
    ask({ ...AT, nowMs: AT.nowMs + DAY_READ_MAX_AGE_MS, day: '2026-10-10' });
    ask({ ...AT, nowMs: AT.nowMs + DAY_READ_MAX_AGE_MS, day: '2026-10-10', standInIds: ['s1', 's2'] });

    expect(jira.reads()).toBe(4);
  });

  it('keeps nothing from a failed read', () => {
    const cache = createDayReadCache<string[]>();
    const jira = counted();

    cache({ key: 'k', now: AT, read$: () => throwError(() => new Error('offline')) }).subscribe({
      error: () => undefined,
    });

    expect(valueOf(cache({ key: 'k', now: AT, read$: jira.read$ }))).toEqual(['read 1']);
  });
});

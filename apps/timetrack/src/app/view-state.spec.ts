import { dayKeyOfDate, readViewState, rememberTimelineScroll, rememberViewState } from './view-state';

const STORAGE_KEY = 'ethlete.timetrack.view-state';

const memoryStorage = () => {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
  };
};

const store = (value: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

describe('view state', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('reads nothing from an empty or unparsable store', () => {
    expect(readViewState()).toEqual({});

    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readViewState()).toEqual({});

    store(['day']);
    expect(readViewState()).toEqual({});
  });

  it('drops a view path and day keys that do not read as what they claim', () => {
    store({ view: '../settings', day: '2026-1-5', weekStart: 20260105 });

    expect(readViewState()).toEqual({ view: undefined, day: undefined, weekStart: undefined });
  });

  it('drops a day key that is shaped right but is not a calendar day', () => {
    store({ day: '2026-02-30', weekStart: '2026-13-01' });

    const state = readViewState();

    expect(state.day).toBeUndefined();
    expect(state.weekStart).toBeUndefined();
  });

  it('keeps a leap day and a year end', () => {
    store({ day: '2028-02-29', weekStart: '2026-12-28' });

    expect(readViewState()).toMatchObject({ day: '2028-02-29', weekStart: '2026-12-28' });
  });

  it('drops a scroll offset that is negative, missing or not finite', () => {
    store({
      timelineScroll: {
        '2026-03-01': { top: 10, left: 0 },
        '2026-03-02': { top: -1, left: 0 },
        '2026-03-03': { top: 5 },
        'not-a-day': { top: 1, left: 1 },
      },
    });

    expect(readViewState().timelineScroll).toEqual({ '2026-03-01': { top: 10, left: 0 } });
  });

  it('keeps only the most recent sixty days of scroll offsets', () => {
    const start = new Date(2026, 0, 1);

    for (let index = 0; index < 70; index++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);

      rememberTimelineScroll(dayKeyOfDate(day), { top: index, left: 0 });
    }

    const days = Object.keys(readViewState().timelineScroll ?? {}).sort();

    expect(days).toHaveLength(60);
    expect(days[0]).toBe('2026-01-11');
    expect(days.at(-1)).toBe('2026-03-11');
  });

  it('merges a remembered field into what is already stored', () => {
    rememberViewState({ view: 'week', day: '2026-03-29' });
    rememberViewState({ weekStart: '2026-03-23' });

    expect(readViewState()).toMatchObject({ view: 'week', day: '2026-03-29', weekStart: '2026-03-23' });
  });

  it('survives a store that refuses the write', () => {
    vi.stubGlobal('localStorage', {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });

    expect(() => rememberViewState({ view: 'day' })).not.toThrow();
  });

  it('names the local calendar day of an instant across a DST change and a month end', () => {
    expect(dayKeyOfDate(new Date(2026, 2, 29, 2, 30))).toBe('2026-03-29');
    expect(dayKeyOfDate(new Date(2026, 9, 25, 23, 59))).toBe('2026-10-25');
    expect(dayKeyOfDate(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(dayKeyOfDate(new Date(2026, 1, 1, 0, 0))).toBe('2026-02-01');
  });
});

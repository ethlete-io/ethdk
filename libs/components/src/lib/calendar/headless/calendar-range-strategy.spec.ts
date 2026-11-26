import {
  CalendarRange,
  CalendarRangeSelectionContext,
  CalendarRangeSelectionStrategy,
  createFixedLengthRangeStrategy,
  createWeekRangeStrategy,
  DEFAULT_CALENDAR_RANGE_STRATEGY,
} from './calendar-range-strategy';

const EMPTY = { start: null, end: null };
const MONDAY_ROWS: CalendarRangeSelectionContext = { weekStartsOn: 1 };

const withContext = (strategy: CalendarRangeSelectionStrategy, context = MONDAY_ROWS) => ({
  select: (date: Date, current: CalendarRange) => strategy.select(date, current, context),
  preview: strategy.preview
    ? (date: Date, current: CalendarRange) => strategy.preview?.(date, current, context) ?? null
    : undefined,
});

describe('DEFAULT_CALENDAR_RANGE_STRATEGY', () => {
  const { select, preview } = withContext(DEFAULT_CALENDAR_RANGE_STRATEGY);

  it('opens the range on the first pick', () => {
    expect(select(new Date(2026, 6, 10), EMPTY)).toEqual({ start: new Date(2026, 6, 10), end: null });
  });

  it('closes it on a later-or-equal pick', () => {
    const open = { start: new Date(2026, 6, 10), end: null };

    expect(select(new Date(2026, 6, 14), open)).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 14) });
    expect(select(new Date(2026, 6, 10), open)).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 10) });
  });

  it('starts over on an earlier pick, or once the range is closed', () => {
    expect(select(new Date(2026, 6, 5), { start: new Date(2026, 6, 10), end: null })).toEqual({
      start: new Date(2026, 6, 5),
      end: null,
    });
    expect(select(new Date(2026, 6, 20), { start: new Date(2026, 6, 10), end: new Date(2026, 6, 14) })).toEqual({
      start: new Date(2026, 6, 20),
      end: null,
    });
  });

  it('previews what a pick would produce: the span to a later day, a restart at an earlier one', () => {
    const open = { start: new Date(2026, 6, 10), end: null };

    expect(preview?.(new Date(2026, 6, 14), open)).toEqual({
      start: new Date(2026, 6, 10),
      end: new Date(2026, 6, 14),
    });
    expect(preview?.(new Date(2026, 6, 5), open)).toEqual(select(new Date(2026, 6, 5), open));
    expect(preview?.(new Date(2026, 6, 5), open)).toEqual({ start: new Date(2026, 6, 5), end: null });
  });

  it('previews nothing with no open range', () => {
    expect(preview?.(new Date(2026, 6, 14), EMPTY)).toBeNull();
    expect(preview?.(new Date(2026, 6, 14), { start: new Date(2026, 6, 1), end: new Date(2026, 6, 3) })).toBeNull();
  });
});

describe('createWeekRangeStrategy', () => {
  const { select, preview } = withContext(createWeekRangeStrategy({ weekStartsOn: 1 }));

  it('opens the range at the start of the week a first pick lands in', () => {
    expect(select(new Date(2026, 6, 16), EMPTY)).toEqual({ start: new Date(2026, 6, 13), end: null });
  });

  it('closes it at the end of the second pick’s week', () => {
    const open = { start: new Date(2026, 6, 13), end: null };

    expect(select(new Date(2026, 6, 22), open)).toEqual({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 26) });
    expect(select(new Date(2026, 6, 16), open)).toEqual({ start: new Date(2026, 6, 13), end: new Date(2026, 6, 19) });
  });

  it('starts over from an earlier week, or once the range is closed', () => {
    expect(select(new Date(2026, 6, 6), { start: new Date(2026, 6, 13), end: null })).toEqual({
      start: new Date(2026, 6, 6),
      end: null,
    });
    expect(select(new Date(2026, 6, 22), { start: new Date(2026, 6, 6), end: new Date(2026, 6, 12) })).toEqual({
      start: new Date(2026, 6, 20),
      end: null,
    });
  });

  it('bands whole weeks from the first hover, so the snap shows before it happens', () => {
    expect(preview?.(new Date(2026, 6, 16), EMPTY)).toEqual({
      start: new Date(2026, 6, 13),
      end: new Date(2026, 6, 19),
    });
    expect(preview?.(new Date(2026, 6, 22), { start: new Date(2026, 6, 13), end: null })).toEqual({
      start: new Date(2026, 6, 13),
      end: new Date(2026, 6, 26),
    });
    expect(preview?.(new Date(2026, 6, 22), { start: new Date(2026, 6, 13), end: new Date(2026, 6, 19) })).toBeNull();
  });

  it('honors the week start it was given', () => {
    const sundays = withContext(createWeekRangeStrategy({ weekStartsOn: 0 }));

    expect(sundays.select(new Date(2026, 6, 16), EMPTY).start).toEqual(new Date(2026, 6, 12));
  });

  it('snaps to the calendar rows when no week start is given', () => {
    const strategy = createWeekRangeStrategy();

    expect(strategy.select(new Date(2026, 6, 16), EMPTY, { weekStartsOn: 0 }).start).toEqual(new Date(2026, 6, 12));
    expect(strategy.select(new Date(2026, 6, 16), EMPTY, { weekStartsOn: 1 }).start).toEqual(new Date(2026, 6, 13));
    expect(strategy.preview?.(new Date(2026, 6, 16), EMPTY, { weekStartsOn: 0 })).toEqual({
      start: new Date(2026, 6, 12),
      end: new Date(2026, 6, 18),
    });
  });
});

describe('createFixedLengthRangeStrategy', () => {
  it('takes the picked day plus the days after it', () => {
    const { select } = withContext(createFixedLengthRangeStrategy({ days: 7 }));

    expect(select(new Date(2026, 6, 10), EMPTY)).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 16) });
  });

  it('always produces a closed range, whatever is already selected', () => {
    const { select } = withContext(createFixedLengthRangeStrategy({ days: 3 }));
    const closed = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 3) };

    expect(select(new Date(2026, 6, 20), closed)).toEqual({ start: new Date(2026, 6, 20), end: new Date(2026, 6, 22) });
  });

  it('never goes below a single day', () => {
    const { select } = withContext(createFixedLengthRangeStrategy({ days: 0 }));

    expect(select(new Date(2026, 6, 10), EMPTY)).toEqual({ start: new Date(2026, 6, 10), end: new Date(2026, 6, 10) });
  });
});

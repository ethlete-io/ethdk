import {
  CALENDAR_MULTI_YEAR_PAGE_SIZE,
  generateMultiYearGrid,
  generateYearGrid,
  hasSelectableDayIn,
  isInMultiYearPage,
  multiYearPageInterval,
  multiYearPageStart,
} from './calendar-view';

describe('generateYearGrid', () => {
  it('lays the 12 months out in rows of four, each at its 1st', () => {
    const rows = generateYearGrid(new Date(2026, 6, 16));

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.length === 4)).toBe(true);
    expect(rows[0]?.[0]).toEqual(new Date(2026, 0, 1));
    expect(rows[2]?.[3]).toEqual(new Date(2026, 11, 1));
  });
});

describe('generateMultiYearGrid', () => {
  it('lays a page of years out in rows of four, each at its January 1st', () => {
    const rows = generateMultiYearGrid(new Date(2016, 0, 1));

    expect(rows).toHaveLength(CALENDAR_MULTI_YEAR_PAGE_SIZE / 4);
    expect(rows[0]?.[0]).toEqual(new Date(2016, 0, 1));
    expect(rows[5]?.[3]).toEqual(new Date(2039, 0, 1));
  });
});

describe('multiYearPageStart', () => {
  it('tiles pages from the anchor year', () => {
    expect(multiYearPageStart(new Date(2026, 6, 16), 0)).toEqual(new Date(2016, 0, 1));
    expect(multiYearPageStart(new Date(2016, 0, 1), 0)).toEqual(new Date(2016, 0, 1));
    expect(multiYearPageStart(new Date(2015, 11, 31), 0)).toEqual(new Date(1992, 0, 1));
  });

  it('opens a page on the anchor year itself', () => {
    expect(multiYearPageStart(new Date(2026, 6, 16), 2020)).toEqual(new Date(2020, 0, 1));
    expect(multiYearPageStart(new Date(2044, 0, 1), 2020)).toEqual(new Date(2044, 0, 1));
  });
});

describe('multiYearPageInterval', () => {
  it('spans the first day of the page to its last', () => {
    expect(multiYearPageInterval(new Date(2016, 0, 1))).toEqual({
      start: new Date(2016, 0, 1),
      end: new Date(2039, 11, 31),
    });
  });
});

describe('isInMultiYearPage', () => {
  it('covers the years of the page and nothing outside it', () => {
    const pageStart = new Date(2016, 0, 1);

    expect(isInMultiYearPage(new Date(2016, 0, 1), pageStart)).toBe(true);
    expect(isInMultiYearPage(new Date(2039, 11, 31), pageStart)).toBe(true);
    expect(isInMultiYearPage(new Date(2040, 0, 1), pageStart)).toBe(false);
    expect(isInMultiYearPage(new Date(2015, 11, 31), pageStart)).toBe(false);
  });
});

describe('hasSelectableDayIn', () => {
  const july = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) };

  it('is true as soon as one day passes', () => {
    expect(hasSelectableDayIn(july, { min: null, max: null, isDateSelectable: () => true })).toBe(true);
  });

  it('is false when the filter rejects every day of the interval', () => {
    expect(hasSelectableDayIn(july, { min: null, max: null, isDateSelectable: () => false })).toBe(false);
  });

  it('scans only the part of the interval the bounds leave open', () => {
    const seen: Date[] = [];
    const availability = {
      min: new Date(2026, 6, 20),
      max: new Date(2026, 6, 22),
      isDateSelectable: (date: Date) => {
        seen.push(date);

        return false;
      },
    };

    expect(hasSelectableDayIn(july, availability)).toBe(false);
    expect(seen).toEqual([new Date(2026, 6, 20), new Date(2026, 6, 21), new Date(2026, 6, 22)]);
  });

  it('is false when the bounds leave nothing of the interval', () => {
    const availability = { min: new Date(2026, 7, 1), max: null, isDateSelectable: () => true };

    expect(hasSelectableDayIn(july, availability)).toBe(false);
  });

  it('finds the one open day inside a mostly filtered interval', () => {
    const availability = {
      min: null,
      max: null,
      isDateSelectable: (date: Date) => date.getDate() === 31,
    };

    expect(hasSelectableDayIn(july, availability)).toBe(true);
  });
});

import { generateMonthGrid } from './calendar-month';

describe('generateMonthGrid', () => {
  it('covers July 2026 with full weeks starting Monday', () => {
    const weeks = generateMonthGrid(new Date(2026, 6, 1), 1);

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // July 1st 2026 is a Wednesday - the grid starts Monday June 29th
    expect(weeks[0]?.[0]).toEqual(new Date(2026, 5, 29));
    expect(weeks[4]?.[6]).toEqual(new Date(2026, 7, 2));
  });

  it('respects the week start day', () => {
    const weeks = generateMonthGrid(new Date(2026, 6, 1), 0);

    // with Sunday start the grid begins June 28th
    expect(weeks[0]?.[0]).toEqual(new Date(2026, 5, 28));
  });

  it('produces six weeks when the month spills into them', () => {
    // August 2026 starts on a Saturday and has 31 days -> 6 Monday-based weeks
    const weeks = generateMonthGrid(new Date(2026, 7, 1), 1);

    expect(weeks).toHaveLength(6);
  });

  it('produces four weeks for a February starting on the week start', () => {
    // February 2027 starts on a Monday and has 28 days
    const weeks = generateMonthGrid(new Date(2027, 1, 1), 1);

    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toEqual(new Date(2027, 1, 1));
    expect(weeks[3]?.[6]).toEqual(new Date(2027, 1, 28));
  });
});

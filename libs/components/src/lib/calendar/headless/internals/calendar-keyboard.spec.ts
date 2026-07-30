import { resolveCalendarKeyboardDate } from './calendar-keyboard';
import { CalendarWeekStartsOn } from './calendar-month';

const FOCUSED = new Date(2026, 6, 16); // Thursday

const resolve = (key: string, shiftKey = false, weekStartsOn: CalendarWeekStartsOn = 1) =>
  resolveCalendarKeyboardDate(key, { shiftKey, focusedDate: FOCUSED, weekStartsOn });

describe('resolveCalendarKeyboardDate', () => {
  it('moves by single days horizontally', () => {
    expect(resolve('ArrowLeft')).toEqual(new Date(2026, 6, 15));
    expect(resolve('ArrowRight')).toEqual(new Date(2026, 6, 17));
  });

  it('moves by weeks vertically', () => {
    expect(resolve('ArrowUp')).toEqual(new Date(2026, 6, 9));
    expect(resolve('ArrowDown')).toEqual(new Date(2026, 6, 23));
  });

  it('moves by months with PageUp/PageDown', () => {
    expect(resolve('PageUp')).toEqual(new Date(2026, 5, 16));
    expect(resolve('PageDown')).toEqual(new Date(2026, 7, 16));
  });

  it('moves by years with Shift+PageUp/PageDown', () => {
    expect(resolve('PageUp', true)).toEqual(new Date(2025, 6, 16));
    expect(resolve('PageDown', true)).toEqual(new Date(2027, 6, 16));
  });

  it('jumps to the week bounds with Home/End honoring the week start', () => {
    expect(resolve('Home')).toEqual(new Date(2026, 6, 13));
    expect(resolve('End')).toEqual(new Date(2026, 6, 19));
    expect(resolve('Home', false, 0)).toEqual(new Date(2026, 6, 12));
    expect(resolve('End', false, 0)).toEqual(new Date(2026, 6, 18));
  });

  it('ignores keys outside the grid model', () => {
    expect(resolve('Enter')).toBeNull();
    expect(resolve('a')).toBeNull();
  });

  describe('in the month grid', () => {
    const resolveInYear = (key: string, shiftKey = false) =>
      resolveCalendarKeyboardDate(key, { shiftKey, focusedDate: FOCUSED, weekStartsOn: 1, view: 'year' });

    it('moves by one month horizontally and by a row of four vertically', () => {
      expect(resolveInYear('ArrowLeft')).toEqual(new Date(2026, 5, 16));
      expect(resolveInYear('ArrowRight')).toEqual(new Date(2026, 7, 16));
      expect(resolveInYear('ArrowUp')).toEqual(new Date(2026, 2, 16));
      expect(resolveInYear('ArrowDown')).toEqual(new Date(2026, 10, 16));
    });

    it('pages by a year, ten with Shift', () => {
      expect(resolveInYear('PageUp')).toEqual(new Date(2025, 6, 16));
      expect(resolveInYear('PageDown')).toEqual(new Date(2027, 6, 16));
      expect(resolveInYear('PageDown', true)).toEqual(new Date(2036, 6, 16));
    });

    it('jumps to the first and last month of the year with Home/End', () => {
      expect(resolveInYear('Home')).toEqual(new Date(2026, 0, 16));
      expect(resolveInYear('End')).toEqual(new Date(2026, 11, 16));
    });
  });

  describe('in the year grid', () => {
    const pageStart = new Date(2016, 0, 1);
    const resolveInMultiYear = (key: string, shiftKey = false) =>
      resolveCalendarKeyboardDate(key, {
        shiftKey,
        focusedDate: FOCUSED,
        weekStartsOn: 1,
        view: 'multiYear',
        multiYearPageStart: pageStart,
      });

    it('moves by one year horizontally and by a row of four vertically', () => {
      expect(resolveInMultiYear('ArrowLeft')).toEqual(new Date(2025, 6, 16));
      expect(resolveInMultiYear('ArrowRight')).toEqual(new Date(2027, 6, 16));
      expect(resolveInMultiYear('ArrowUp')).toEqual(new Date(2022, 6, 16));
      expect(resolveInMultiYear('ArrowDown')).toEqual(new Date(2030, 6, 16));
    });

    it('pages by 24 years, ten pages with Shift', () => {
      expect(resolveInMultiYear('PageUp')).toEqual(new Date(2002, 6, 16));
      expect(resolveInMultiYear('PageDown')).toEqual(new Date(2050, 6, 16));
      expect(resolveInMultiYear('PageDown', true)).toEqual(new Date(2266, 6, 16));
    });

    it('jumps to the bounds of the visible page with Home/End', () => {
      expect(resolveInMultiYear('Home')).toEqual(new Date(2016, 6, 16));
      expect(resolveInMultiYear('End')).toEqual(new Date(2039, 6, 16));
    });

    it('has nowhere to send Home/End without a page', () => {
      const options = { shiftKey: false, focusedDate: FOCUSED, weekStartsOn: 1, view: 'multiYear' } as const;

      expect(resolveCalendarKeyboardDate('Home', options)).toBeNull();
    });
  });
});

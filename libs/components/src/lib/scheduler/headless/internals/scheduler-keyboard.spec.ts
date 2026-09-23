import {
  resolveSchedulerCellItemFocus,
  resolveSchedulerMonthKeyboardDate,
  resolveSchedulerTimeGridKeyboardCell,
  schedulerCellItemOffset,
} from './scheduler-keyboard';

const FOCUSED = new Date(2026, 6, 15);

describe('resolveSchedulerMonthKeyboardDate', () => {
  const resolve = (key: string, weekStartsOn: 0 | 1 = 1) =>
    resolveSchedulerMonthKeyboardDate(key, { focusedDate: FOCUSED, weekStartsOn });

  it('moves by days horizontally and by weeks vertically', () => {
    expect(resolve('ArrowLeft')).toEqual(new Date(2026, 6, 14));
    expect(resolve('ArrowRight')).toEqual(new Date(2026, 6, 16));
    expect(resolve('ArrowUp')).toEqual(new Date(2026, 6, 8));
    expect(resolve('ArrowDown')).toEqual(new Date(2026, 6, 22));
  });

  it('jumps to the week bounds honoring the week start', () => {
    expect(resolve('Home')).toEqual(new Date(2026, 6, 13));
    expect(resolve('End')).toEqual(new Date(2026, 6, 19));
    expect(resolve('Home', 0)).toEqual(new Date(2026, 6, 12));
    expect(resolve('End', 0)).toEqual(new Date(2026, 6, 18));
  });

  it('pages by one month, never by a year', () => {
    expect(resolve('PageUp')).toEqual(new Date(2026, 5, 15));
    expect(resolve('PageDown')).toEqual(new Date(2026, 7, 15));
  });

  it('ignores keys outside the grid model', () => {
    expect(resolve('Enter')).toBeNull();
    expect(resolve(' ')).toBeNull();
  });
});

describe('resolveSchedulerTimeGridKeyboardCell', () => {
  const resolve = (key: string, row: number, options: { view?: 'week' | 'day'; hasAllDayRow?: boolean } = {}) =>
    resolveSchedulerTimeGridKeyboardCell(key, {
      focused: { day: FOCUSED, row },
      weekStartsOn: 1,
      view: options.view ?? 'week',
      hasAllDayRow: options.hasAllDayRow ?? true,
    });

  it('moves by one slot vertically and one day horizontally', () => {
    expect(resolve('ArrowDown', 10)).toEqual({ day: FOCUSED, row: 11 });
    expect(resolve('ArrowUp', 10)).toEqual({ day: FOCUSED, row: 9 });
    expect(resolve('ArrowLeft', 10)).toEqual({ day: new Date(2026, 6, 14), row: 10 });
    expect(resolve('ArrowRight', 10)).toEqual({ day: new Date(2026, 6, 16), row: 10 });
  });

  it('steps from the first slot up into the all-day row and back down', () => {
    expect(resolve('ArrowUp', 1)).toEqual({ day: FOCUSED, row: 0 });
    expect(resolve('ArrowDown', 0)).toEqual({ day: FOCUSED, row: 1 });
    expect(resolve('ArrowUp', 0)).toEqual({ day: FOCUSED, row: 0 });
  });

  it('stays on the first slot when there is no all-day row', () => {
    expect(resolve('ArrowUp', 1, { hasAllDayRow: false })).toEqual({ day: FOCUSED, row: 1 });
  });

  it('stays on the last slot at the end of the day', () => {
    expect(resolve('ArrowDown', 24)).toEqual({ day: FOCUSED, row: 24 });
  });

  it('jumps to the week bounds and keeps the row', () => {
    expect(resolve('Home', 5)).toEqual({ day: new Date(2026, 6, 13), row: 5 });
    expect(resolve('End', 5)).toEqual({ day: new Date(2026, 6, 19), row: 5 });
  });

  it('pages by the period of the view', () => {
    expect(resolve('PageDown', 5)).toEqual({ day: new Date(2026, 6, 22), row: 5 });
    expect(resolve('PageUp', 5)).toEqual({ day: new Date(2026, 6, 8), row: 5 });
    expect(resolve('PageDown', 5, { view: 'day' })).toEqual({ day: new Date(2026, 6, 16), row: 5 });
    expect(resolve('PageUp', 5, { view: 'day' })).toEqual({ day: new Date(2026, 6, 14), row: 5 });
  });

  it('ignores keys outside the grid model', () => {
    expect(resolve('Enter', 5)).toBeNull();
    expect(resolve('Escape', 5)).toBeNull();
  });
});

describe('resolveSchedulerCellItemFocus', () => {
  const counts = [2, 0, 3];

  it('steps between the items of one cell and clamps at its ends', () => {
    expect(resolveSchedulerCellItemFocus('ArrowDown', { itemCounts: counts, flatIndex: 0 })).toEqual({
      kind: 'item',
      index: 1,
    });
    expect(resolveSchedulerCellItemFocus('ArrowDown', { itemCounts: counts, flatIndex: 1 })).toEqual({
      kind: 'item',
      index: 1,
    });
    expect(resolveSchedulerCellItemFocus('ArrowUp', { itemCounts: counts, flatIndex: 2 })).toEqual({
      kind: 'item',
      index: 2,
    });
    expect(resolveSchedulerCellItemFocus('ArrowRight', { itemCounts: counts, flatIndex: 3 })).toEqual({
      kind: 'item',
      index: 4,
    });
    expect(resolveSchedulerCellItemFocus('ArrowLeft', { itemCounts: counts, flatIndex: 3 })).toEqual({
      kind: 'item',
      index: 2,
    });
  });

  it('sends Escape back to the cell the item belongs to', () => {
    expect(resolveSchedulerCellItemFocus('Escape', { itemCounts: counts, flatIndex: 1 })).toEqual({
      kind: 'cell',
      index: 0,
    });
    expect(resolveSchedulerCellItemFocus('Escape', { itemCounts: counts, flatIndex: 4 })).toEqual({
      kind: 'cell',
      index: 2,
    });
  });

  it('leaves activation keys and unknown items alone', () => {
    expect(resolveSchedulerCellItemFocus('Enter', { itemCounts: counts, flatIndex: 0 })).toBeNull();
    expect(resolveSchedulerCellItemFocus(' ', { itemCounts: counts, flatIndex: 0 })).toBeNull();
    expect(resolveSchedulerCellItemFocus('Escape', { itemCounts: counts, flatIndex: 5 })).toBeNull();
  });

  it('offsets a cell by the items of every cell before it', () => {
    expect(schedulerCellItemOffset(counts, 0)).toBe(0);
    expect(schedulerCellItemOffset(counts, 2)).toBe(2);
  });
});

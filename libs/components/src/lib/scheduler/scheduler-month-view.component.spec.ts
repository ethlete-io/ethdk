import { TestBed } from '@angular/core/testing';
import { addDays, differenceInCalendarDays, isSameDay, startOfWeek } from 'date-fns';
import '../../test-helpers';
import { injectOverlayManager } from '../overlay';
import { pressKey } from '../testing/driver-core';
import { schedulerTestDriver, testAppointment } from './testing/scheduler-driver';

describe('SchedulerMonthViewComponent keyboard', () => {
  let driver: ReturnType<typeof schedulerTestDriver>;

  const cells = () => driver.queryAll('.et-scheduler-month-view-cell');
  const cellOf = (date: Date) =>
    cells()[differenceInCalendarDays(date, driver.scheduler().headless.visibleRange().start)] ?? null;
  const tabStops = () => cells().filter((cell) => cell.getAttribute('tabindex') === '0');
  const active = () => document.activeElement as HTMLElement;
  const focusedDate = () => driver.scheduler().headless.focusedDate();
  const weekStartsOn = () => driver.scheduler().headless.effectiveFirstDayOfWeek();

  const focusCell = (date: Date) => {
    cellOf(date)?.focus();
    driver.detectChanges();
  };

  beforeEach(() => {
    driver = schedulerTestDriver({
      appointments: [testAppointment('a'), testAppointment('b')],
      focusedDate: new Date(2026, 6, 15),
    });
  });

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    driver.fixture.destroy();
  });

  it('gives the grid one tab stop, on the focused date, and takes appointments out of the tab order', () => {
    expect(tabStops()).toEqual([cellOf(new Date(2026, 6, 15))]);

    for (const button of driver.queryAll('et-scheduler-month-view button')) {
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('moves by a day with Left/Right and by a week with Up/Down, carrying DOM focus along', () => {
    focusCell(new Date(2026, 6, 15));

    pressKey(active(), 'ArrowRight');
    expect(active()).toBe(cellOf(new Date(2026, 6, 16)));

    pressKey(active(), 'ArrowDown');
    expect(active()).toBe(cellOf(new Date(2026, 6, 23)));

    pressKey(active(), 'ArrowLeft');
    pressKey(active(), 'ArrowUp');
    expect(active()).toBe(cellOf(new Date(2026, 6, 15)));
    expect(tabStops()).toEqual([active()]);
  });

  it('goes to the week bounds with Home/End', () => {
    const weekStart = startOfWeek(new Date(2026, 6, 15), { weekStartsOn: weekStartsOn() });

    focusCell(new Date(2026, 6, 15));

    pressKey(active(), 'Home');
    expect(active()).toBe(cellOf(weekStart));

    pressKey(active(), 'End');
    expect(active()).toBe(cellOf(addDays(weekStart, 6)));
  });

  it('pages by a month, moving the visible range with the focus', () => {
    focusCell(new Date(2026, 6, 15));

    pressKey(active(), 'PageDown');

    expect(isSameDay(focusedDate(), new Date(2026, 7, 15))).toBe(true);
    expect(active()).toBe(cellOf(new Date(2026, 7, 15)));
    expect(active().hasAttribute('data-outside-month')).toBe(false);

    pressKey(active(), 'PageUp');

    expect(isSameDay(focusedDate(), new Date(2026, 6, 15))).toBe(true);
  });

  it('keeps the range while focus stays on a rendered day, and follows focus once it leaves', () => {
    focusCell(new Date(2026, 6, 31));

    pressKey(active(), 'ArrowRight');

    expect(active()).toBe(cellOf(new Date(2026, 7, 1)));
    expect(active().hasAttribute('data-outside-month')).toBe(true);
    expect(isSameDay(focusedDate(), new Date(2026, 6, 15))).toBe(true);

    pressKey(active(), 'ArrowDown');

    expect(isSameDay(focusedDate(), new Date(2026, 7, 8))).toBe(true);
    expect(active()).toBe(cellOf(new Date(2026, 7, 8)));
  });

  it('moves into the cell appointments with Enter, between them with arrows, and back out with Escape', () => {
    const day = cellOf(new Date(2026, 6, 15));

    focusCell(new Date(2026, 6, 15));

    pressKey(active(), 'Enter');
    expect(active().getAttribute('title')).toBe('a');

    pressKey(active(), 'ArrowDown');
    expect(active().getAttribute('title')).toBe('b');

    pressKey(active(), 'ArrowDown');
    expect(active().getAttribute('title')).toBe('b');

    pressKey(active(), 'ArrowUp');
    expect(active().getAttribute('title')).toBe('a');

    pressKey(active(), 'Escape');
    expect(active()).toBe(day);
    expect(driver.scheduler().headless.draftRange()).toBeNull();
  });

  it('starts a new all-day appointment with Enter on an empty cell', () => {
    focusCell(new Date(2026, 6, 16));

    pressKey(active(), 'Enter');

    const draft = driver.scheduler().headless.draftRange();

    expect(draft?.phase).toBe('committed');
    expect(draft?.allDay).toBe(true);
    expect(isSameDay(draft?.start ?? new Date(0), new Date(2026, 6, 16))).toBe(true);
  });

  it('starts a new appointment with Space even on a cell that has appointments', () => {
    focusCell(new Date(2026, 6, 15));

    const event = pressKey(active(), ' ');

    expect(event.defaultPrevented).toBe(true);
    expect(driver.scheduler().headless.draftRange()?.phase).toBe('committed');
    expect(isSameDay(driver.scheduler().headless.draftRange()?.start ?? new Date(0), new Date(2026, 6, 15))).toBe(true);
  });
});

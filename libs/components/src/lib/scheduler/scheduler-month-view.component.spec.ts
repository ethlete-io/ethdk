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

describe('SchedulerMonthViewComponent after a drag', () => {
  let driver: ReturnType<typeof schedulerTestDriver>;

  const badge = (id: string) => driver.query(`.et-scheduler-appointment[title="${id}"]`);

  const drag = (element: HTMLElement | null) => {
    element?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 40, clientY: 40 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 40, clientY: 40 }));
    driver.detectChanges();
  };

  const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 700, 600));

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
    vi.restoreAllMocks();
  });

  it('swallows only the click that ends the drag', async () => {
    drag(badge('a'));
    driver.clickAppointment('a');

    expect(driver.editSurface()).toHaveLength(0);

    await nextTask();
    driver.clickAppointment('b');

    expect(driver.editSurface()).toHaveLength(1);
  });
});

describe('SchedulerMonthViewComponent in a right-to-left layout', () => {
  let driver: ReturnType<typeof schedulerTestDriver>;

  const CELL_WIDTH = 100;
  const ROW_HEIGHT = 80;

  const mirroredRect = (element: Element) => {
    const row = element.closest('.et-scheduler-month-view-week');
    const rows = Array.from(element.closest('.et-scheduler-month-view-weeks')?.children ?? []).filter((child) =>
      child.classList.contains('et-scheduler-month-view-week'),
    );
    const rowIndex = row ? rows.indexOf(row) : 0;

    if (element.classList.contains('et-scheduler-month-view-cell')) {
      const column = Array.from(row?.children ?? []).indexOf(element);

      return new DOMRect((6 - column) * CELL_WIDTH, rowIndex * ROW_HEIGHT, CELL_WIDTH, ROW_HEIGHT);
    }

    if (element === row) return new DOMRect(0, rowIndex * ROW_HEIGHT, 7 * CELL_WIDTH, ROW_HEIGHT);

    return new DOMRect(0, 0, 7 * CELL_WIDTH, rows.length * ROW_HEIGHT);
  };

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return mirroredRect(this);
    });

    driver = schedulerTestDriver({ appointments: [], focusedDate: new Date(2026, 6, 15) });
  });

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    driver.fixture.destroy();
    vi.restoreAllMocks();
  });

  it('creates on the day under the pointer, not on its mirror', () => {
    const weeks = driver.query('.et-scheduler-month-view-weeks');
    const at = { bubbles: true, pointerId: 1, button: 0, clientX: 7 * CELL_WIDTH - 10, clientY: ROW_HEIGHT + 10 };

    weeks?.dispatchEvent(new PointerEvent('pointerdown', at));
    document.dispatchEvent(new PointerEvent('pointerup', at));
    driver.detectChanges();

    const secondWeekStart = driver.scheduler().headless.visibleRange().start;
    const draft = driver.scheduler().headless.draftRange();

    expect(isSameDay(draft?.start ?? new Date(0), addDays(secondWeekStart, 7))).toBe(true);
  });
});

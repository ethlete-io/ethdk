import { TestBed } from '@angular/core/testing';
import { addDays, differenceInCalendarDays, isSameDay, startOfWeek } from 'date-fns';
import '../../test-helpers';
import { injectOverlayManager } from '../overlay';
import { pressKey } from '../testing/driver-core';
import { schedulerTestDriver, testAppointment } from './testing/scheduler-driver';
import { Appointment, SchedulerView } from './scheduler.types';

const WEDNESDAY = new Date(2026, 6, 15);

const allDayAppointment = testAppointment('holiday', {
  allDay: true,
  start: new Date(2026, 6, 15),
  end: new Date(2026, 6, 15, 23, 59),
});

describe('SchedulerTimeGridViewComponent keyboard', () => {
  let driver: ReturnType<typeof schedulerTestDriver>;

  const mount = (options: { view?: SchedulerView; appointments?: readonly Appointment[] } = {}) => {
    driver = schedulerTestDriver({
      view: options.view ?? 'week',
      appointments: options.appointments ?? [testAppointment('a'), testAppointment('b')],
      focusedDate: WEDNESDAY,
    });
  };

  const headless = () => driver.scheduler().headless;
  const dayIndex = (date: Date) => differenceInCalendarDays(date, headless().visibleRange().start);
  const slots = () => driver.queryAll('.et-scheduler-time-grid-slot');
  const slotOf = (date: Date, hour: number) => slots()[dayIndex(date) * 24 + hour] ?? null;
  const allDayCellOf = (date: Date) => driver.queryAll('.et-scheduler-time-grid-all-day-cell')[dayIndex(date)] ?? null;
  const tabStops = () =>
    driver.queryAll('et-scheduler-time-grid-view [tabindex]').filter((cell) => cell.getAttribute('tabindex') === '0');
  const active = () => document.activeElement as HTMLElement;

  const focus = (element: HTMLElement | null) => {
    element?.focus();
    driver.detectChanges();
  };

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    driver.fixture.destroy();
  });

  it('gives the grid one tab stop, on the hour it opens scrolled to, and takes blocks out of the tab order', () => {
    mount();

    expect(tabStops()).toEqual([slotOf(WEDNESDAY, 8)]);

    for (const block of driver.queryAll('.et-scheduler-time-grid-block')) {
      expect(block.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('names each slot after its day and hour', () => {
    mount();

    expect(slotOf(WEDNESDAY, 9)?.getAttribute('aria-label')).toBe('Wednesday, July 15th, 2026, 09:00');
  });

  it('moves by a slot with Up/Down and by a day with Left/Right', () => {
    mount();
    focus(slotOf(WEDNESDAY, 8));

    pressKey(active(), 'ArrowDown');
    expect(active()).toBe(slotOf(WEDNESDAY, 9));

    pressKey(active(), 'ArrowRight');
    expect(active()).toBe(slotOf(addDays(WEDNESDAY, 1), 9));

    pressKey(active(), 'ArrowUp');
    pressKey(active(), 'ArrowLeft');
    expect(active()).toBe(slotOf(WEDNESDAY, 8));
    expect(tabStops()).toEqual([active()]);
  });

  it('goes to the week bounds with Home/End, keeping the hour', () => {
    mount();

    const weekStart = startOfWeek(WEDNESDAY, { weekStartsOn: headless().effectiveFirstDayOfWeek() });

    focus(slotOf(WEDNESDAY, 12));

    pressKey(active(), 'Home');
    expect(active()).toBe(slotOf(weekStart, 12));

    pressKey(active(), 'End');
    expect(active()).toBe(slotOf(addDays(weekStart, 6), 12));
  });

  it('pages by a week, and follows focus off the edge of the visible week', () => {
    mount();
    focus(slotOf(WEDNESDAY, 12));

    pressKey(active(), 'PageDown');

    expect(isSameDay(headless().focusedDate(), addDays(WEDNESDAY, 7))).toBe(true);
    expect(active()).toBe(slotOf(addDays(WEDNESDAY, 7), 12));

    pressKey(active(), 'End');
    pressKey(active(), 'ArrowRight');

    expect(dayIndex(headless().focusedDate())).toBe(0);
    expect(active()).toBe(slotOf(headless().focusedDate(), 12));
  });

  it('pages by a day in the day view', () => {
    mount({ view: 'day' });
    focus(slotOf(WEDNESDAY, 12));

    pressKey(active(), 'PageUp');

    expect(isSameDay(headless().focusedDate(), addDays(WEDNESDAY, -1))).toBe(true);
    expect(active()).toBe(slotOf(addDays(WEDNESDAY, -1), 12));
  });

  it('treats the all-day strip as the row above the first slot', () => {
    mount({ appointments: [allDayAppointment] });
    focus(slotOf(WEDNESDAY, 0));

    pressKey(active(), 'ArrowUp');
    expect(active()).toBe(allDayCellOf(WEDNESDAY));
    expect(active().getAttribute('aria-label')).toBe('Wednesday, July 15th, 2026, All day');

    pressKey(active(), 'ArrowRight');
    expect(active()).toBe(allDayCellOf(addDays(WEDNESDAY, 1)));

    pressKey(active(), 'ArrowDown');
    expect(active()).toBe(slotOf(addDays(WEDNESDAY, 1), 0));
  });

  it('stays on the first slot when no all-day strip is rendered', () => {
    mount();
    focus(slotOf(WEDNESDAY, 0));

    const event = pressKey(active(), 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(active()).toBe(slotOf(WEDNESDAY, 0));
  });

  it('moves into the slot appointments with Enter, between them with arrows, and back out with Escape', () => {
    mount();
    focus(slotOf(WEDNESDAY, 9));

    pressKey(active(), 'Enter');
    expect(active().getAttribute('title')).toBe('a');

    pressKey(active(), 'ArrowDown');
    expect(active().getAttribute('title')).toBe('b');

    pressKey(active(), 'Escape');
    expect(active()).toBe(slotOf(WEDNESDAY, 9));
    expect(headless().draftRange()).toBeNull();
  });

  it('moves into an all-day cell entry with Enter', () => {
    mount({ appointments: [allDayAppointment] });
    focus(allDayCellOf(WEDNESDAY));

    pressKey(active(), 'Enter');

    expect(active().getAttribute('title')).toBe('holiday');
  });

  it('starts an hour-long appointment at the slot with Enter on an empty slot', () => {
    mount();
    focus(slotOf(WEDNESDAY, 14));

    pressKey(active(), 'Enter');

    const draft = headless().draftRange();

    expect(draft?.phase).toBe('committed');
    expect(draft?.start).toEqual(new Date(2026, 6, 15, 14));
    expect(draft?.end).toEqual(new Date(2026, 6, 15, 15));
  });

  it('starts an appointment with Space even on a slot that has appointments', () => {
    mount();
    focus(slotOf(WEDNESDAY, 9));

    pressKey(active(), ' ');

    expect(headless().draftRange()?.start).toEqual(new Date(2026, 6, 15, 9));
  });
});

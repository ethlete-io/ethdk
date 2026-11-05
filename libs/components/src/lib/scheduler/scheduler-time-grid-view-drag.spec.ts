import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { injectOverlayManager } from '../overlay';
import { schedulerTestDriver, testAppointment } from './testing/scheduler-driver';
import { Appointment, SchedulerAppointmentReschedule, SchedulerView } from './scheduler.types';

const WEDNESDAY = new Date(2026, 6, 15);
const COLUMN_HEIGHT = 2400;
const yAt = (hours: number) => (hours / 24) * COLUMN_HEIGHT;

describe('SchedulerTimeGridViewComponent dragging an appointment', { timeout: 15_000 }, () => {
  let driver: ReturnType<typeof schedulerTestDriver>;
  let reschedules: SchedulerAppointmentReschedule[];

  const mount = (appointments: readonly Appointment[], view: SchedulerView = 'day') => {
    driver = schedulerTestDriver({ view, appointments, focusedDate: WEDNESDAY });
    reschedules = [];
    driver.scheduler().headless.appointmentReschedule.subscribe((event) => reschedules.push(event));
  };

  const drag = (selector: string, fromY: number, toY: number) => {
    const target = driver.query(selector);
    const point = (clientY: number) => ({ bubbles: true, pointerId: 1, button: 0, clientX: 50, clientY });

    target?.dispatchEvent(new PointerEvent('pointerdown', point(fromY)));
    document.dispatchEvent(new PointerEvent('pointermove', point(toY)));
    driver.detectChanges();
    document.dispatchEvent(new PointerEvent('pointerup', point(toY)));
    driver.detectChanges();
  };

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, COLUMN_HEIGHT));
  });

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    driver.fixture.destroy();
    vi.restoreAllMocks();
  });

  it('stops a move dragged above the column at midnight instead of carrying it into the previous day', () => {
    mount([testAppointment('early', { start: new Date(2026, 6, 15, 1), end: new Date(2026, 6, 15, 2) })]);

    drag('.et-scheduler-time-grid-block[title="early"]', yAt(1.5), -500);

    expect(reschedules.map(({ appointment }) => [appointment.start, appointment.end])).toEqual([
      [new Date(2026, 6, 15, 0), new Date(2026, 6, 15, 1)],
    ]);
  });

  it('keeps a move dragged below the column starting on the same day', () => {
    mount([testAppointment('late', { start: new Date(2026, 6, 15, 22), end: new Date(2026, 6, 15, 23) })]);

    drag('.et-scheduler-time-grid-block[title="late"]', yAt(22 + 5 / 60), COLUMN_HEIGHT + 500);

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 6, 15, 23, 45));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 6, 16, 0, 45));
  });

  it('keeps the duration of a zero-length appointment while moving it', () => {
    mount([testAppointment('marker', { start: new Date(2026, 6, 15, 9), end: new Date(2026, 6, 15, 9) })]);

    drag('.et-scheduler-time-grid-block[title="marker"]', yAt(9), yAt(11));

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 6, 15, 11));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 6, 15, 11));
  });

  it('moves the continuation of a midnight-spanning appointment by the dragged distance', () => {
    mount([testAppointment('night', { start: new Date(2026, 6, 14, 22), end: new Date(2026, 6, 15, 2) })]);

    drag('.et-scheduler-time-grid-block[title="night"]', yAt(1), yAt(3));

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 6, 15, 0));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 6, 15, 4));
  });

  it('clamps a resize of the end past the column bottom to midnight', () => {
    mount([testAppointment('a', { start: new Date(2026, 6, 15, 20), end: new Date(2026, 6, 15, 21) })]);

    drag('.et-scheduler-time-grid-block[title="a"] [data-edge="end"]', yAt(21), COLUMN_HEIGHT + 500);

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 6, 15, 20));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 6, 16, 0));
  });

  it('keeps a slot of duration when the start is resized past the end', () => {
    mount([testAppointment('a', { start: new Date(2026, 6, 15, 9), end: new Date(2026, 6, 15, 10) })]);

    drag('.et-scheduler-time-grid-block[title="a"] [data-edge="start"]', yAt(9), yAt(14));

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 6, 15, 9, 45));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 6, 15, 10));
  });

  it('moves an appointment by wall-clock time on the spring-forward day', () => {
    driver = schedulerTestDriver({
      view: 'day',
      focusedDate: new Date(2026, 2, 29),
      appointments: [testAppointment('dst', { start: new Date(2026, 2, 29, 9), end: new Date(2026, 2, 29, 10) })],
    });
    reschedules = [];
    driver.scheduler().headless.appointmentReschedule.subscribe((event) => reschedules.push(event));

    drag('.et-scheduler-time-grid-block[title="dst"]', yAt(9), yAt(12));

    expect(reschedules[0]?.appointment.start).toEqual(new Date(2026, 2, 29, 12));
    expect(reschedules[0]?.appointment.end).toEqual(new Date(2026, 2, 29, 13));
  });
});

describe('SchedulerComponent switching views', { timeout: 15_000 }, () => {
  it.each<SchedulerView>(['month', 'week', 'agenda'])('keeps the focused date when going from %s to day', (from) => {
    const focusedDate = new Date(2026, 6, 30, 14, 30);
    const driver = schedulerTestDriver({ view: from, focusedDate, appointments: [] });
    const headless = () => driver.scheduler().headless;

    driver.host.view.set('day');
    driver.detectChanges();

    expect(headless().focusedDate()).toEqual(focusedDate);
    expect(headless().visibleRange()).toEqual({
      start: new Date(2026, 6, 30),
      end: new Date(2026, 6, 30, 23, 59, 59, 999),
    });

    driver.fixture.destroy();
  });
});

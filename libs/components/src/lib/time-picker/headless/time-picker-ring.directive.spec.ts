import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { pointerEvent, pressKey, query, tick } from '../../testing/driver-core';
import { angleToPoint, minuteToAngle } from './internals/time-ring';
import { TimePickerRingHandleDirective } from './time-picker-ring-handle.directive';
import { TimePickerRingDirective } from './time-picker-ring.directive';
import {
  TimePickerDirective,
  TimePickerMode,
  TimePickerTimeFilterFn,
  TimeRange,
  TimeRangePick,
  TimeRangeSide,
} from './time-picker.directive';

@Component({
  template: `
    <div
      [(value)]="value"
      [(rangeValue)]="rangeValue"
      [(activeSide)]="activeSide"
      [mode]="mode()"
      [minuteStep]="15"
      [min]="min()"
      [max]="max()"
      [timeFilter]="timeFilter()"
      (timeSelect)="picks.push($event)"
      etTimePicker
      format="HH:mm"
    >
      <div #ring="etTimePickerRing" class="ring" etTimePickerRing>
        <span class="start" etTimePickerRingHandle side="start"></span>
        @if (mode() === 'range') {
          <span class="end" etTimePickerRingHandle side="end"></span>
        }
      </div>
    </div>
  `,
  imports: [TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective],
})
class TimePickerRingTestHost {
  mode = signal<TimePickerMode>('single');
  value = signal<Date | null>(null);
  rangeValue = signal<TimeRange>({ start: null, end: null });
  activeSide = signal<TimeRangeSide>('start');
  min = signal<Date | null>(null);
  max = signal<Date | null>(null);
  timeFilter = signal<TimePickerTimeFilterFn | null>(null);
  picks: TimeRangePick[] = [];
}

const DAY = new Date(2026, 6, 8);
const at = (hours: number, minutes = 0) => new Date(2026, 6, 8, hours, minutes);
const minuteOf = (hours: number, minutes = 0) => hours * 60 + minutes;
const timeOf = (date: Date | null) =>
  date === null
    ? null
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

describe('TimePickerRingDirective', () => {
  let fixture: ComponentFixture<TimePickerRingTestHost>;
  let host: TimePickerRingTestHost;
  let ringElement: HTMLElement;

  const ring = () =>
    fixture.debugElement.query((el) => el.nativeElement === ringElement).injector.get(TimePickerRingDirective);
  const handle = (side: TimeRangeSide) => query(fixture, `.${side}`);
  const pointAt = (hours: number, minutes = 0) => {
    const point = angleToPoint(minuteToAngle(minuteOf(hours, minutes)), { radius: 112, x: 140, y: 140 });

    return { clientX: point.x, clientY: point.y, pointerId: 1, button: 0 };
  };
  const press = (hours: number, minutes = 0) => pointerEvent(ringElement, 'pointerdown', pointAt(hours, minutes));
  const move = (hours: number, minutes = 0) => pointerEvent(ringElement, 'pointermove', pointAt(hours, minutes));
  const release = (hours: number, minutes = 0) => pointerEvent(ringElement, 'pointerup', pointAt(hours, minutes));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(10, 7));

    TestBed.configureTestingModule({ imports: [TimePickerRingTestHost] });
    fixture = TestBed.createComponent(TimePickerRingTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();

    ringElement = query(fixture, '.ring') as HTMLElement;
    ringElement.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 280, height: 280 });
  });

  afterEach(() => vi.useRealTimers());

  describe('single time', () => {
    it('sets hour and minute from a press, snapped to the minute step, on the current day', () => {
      press(9, 20);
      release(9, 20);

      expect(timeOf(host.value())).toBe('09:15:00');
      expect(host.value()?.getDate()).toBe(DAY.getDate());
    });

    it('follows a drag', () => {
      press(9);
      move(11, 30);

      expect(timeOf(host.value())).toBe('11:30:00');
      expect(ring().draggingSide()).toBe('start');

      release(11, 30);

      expect(ring().draggingSide()).toBeNull();
    });

    it('ignores a press in the centre', () => {
      pointerEvent(ringElement, 'pointerdown', { clientX: 150, clientY: 140, pointerId: 1, button: 0 });

      expect(host.value()).toBeNull();
    });

    it('stops a drag at the edge of a blocked span', () => {
      host.min.set(at(8));
      host.max.set(at(18));
      tick();

      press(17);
      move(17, 45);
      move(18, 30);
      move(19, 30);

      expect(timeOf(host.value())).toBe('18:00:00');
    });

    it('keeps a drag at the blocked edge while the pointer goes on round the ring, until it comes back', () => {
      host.min.set(at(8));
      host.max.set(at(18));
      tick();

      press(17);

      for (const hours of [19, 21, 23, 1, 3, 5, 7]) move(hours);

      expect(timeOf(host.value())).toBe('18:00:00');

      for (const hours of [5, 3, 1, 23, 21, 19]) move(hours);
      move(17, 30);

      expect(timeOf(host.value())).toBe('17:30:00');
    });

    it('writes nothing for a press on blocked time', () => {
      host.min.set(at(8));
      tick();

      press(6);

      expect(host.value()).toBeNull();
    });

    it('keeps the day of a value that has one', () => {
      host.value.set(new Date(2026, 6, 20, 9, 0, 30));
      tick();

      press(14);

      expect(host.value()?.getDate()).toBe(20);
      expect(timeOf(host.value())).toBe('14:00:00');
    });

    it('announces the handle as a slider with the formatted time', () => {
      host.value.set(at(9, 30));
      tick();

      const element = handle('start');

      expect(element?.getAttribute('role')).toBe('slider');
      expect(element?.getAttribute('aria-valuenow')).toBe(String(minuteOf(9, 30)));
      expect(element?.getAttribute('aria-valuetext')).toBe('09:30');
      expect(element?.getAttribute('aria-label')).toBe('Time');
    });
  });

  describe('keyboard', () => {
    const key = (name: string) => pressKey(handle('start') as HTMLElement, name);

    beforeEach(() => {
      host.value.set(at(9));
      tick();
    });

    it('moves one minute step with the arrows and one hour with the page keys', () => {
      key('ArrowRight');
      expect(timeOf(host.value())).toBe('09:15:00');

      key('ArrowDown');
      key('ArrowDown');
      expect(timeOf(host.value())).toBe('08:45:00');

      key('PageUp');
      expect(timeOf(host.value())).toBe('09:45:00');

      key('PageDown');
      key('PageDown');
      expect(timeOf(host.value())).toBe('07:45:00');
    });

    it('goes to the first and the last open time with Home and End', () => {
      host.min.set(at(8));
      host.max.set(at(18));
      tick();

      key('End');
      expect(timeOf(host.value())).toBe('18:00:00');

      key('Home');
      expect(timeOf(host.value())).toBe('08:00:00');
    });

    it('skips a blocked span', () => {
      host.timeFilter.set((date) => date.getHours() !== 10);
      host.value.set(at(9, 45));
      tick();

      key('ArrowUp');

      expect(timeOf(host.value())).toBe('11:00:00');
    });

    it('starts an empty value from now', () => {
      host.value.set(null);
      tick();

      key('ArrowRight');

      expect(timeOf(host.value())).toBe('10:15:00');
    });
  });

  describe('range', () => {
    beforeEach(() => {
      host.mode.set('range');
      tick();
    });

    it('places the start on the first press and hands the active side on to the end', () => {
      press(9);
      release(9);

      expect(timeOf(host.rangeValue().start)).toBe('09:00:00');
      expect(host.activeSide()).toBe('end');

      press(17, 30);
      release(17, 30);

      expect(timeOf(host.rangeValue().end)).toBe('17:30:00');
      expect(host.picks.map((pick) => pick.side)).toEqual(['start', 'end']);
      expect(ring().arc()).toEqual({ start: minuteOf(9), end: minuteOf(17, 30) });
    });

    it('moves the handle nearest to the press', () => {
      host.rangeValue.set({ start: at(9), end: at(17) });
      tick();

      press(16);
      release(16);

      expect(timeOf(host.rangeValue().end)).toBe('16:00:00');
      expect(timeOf(host.rangeValue().start)).toBe('09:00:00');
      expect(host.activeSide()).toBe('end');
    });

    it('keeps an arc past midnight as one arc', () => {
      host.rangeValue.set({ start: at(22), end: at(6) });
      tick();

      expect(ring().arc()).toEqual({ start: minuteOf(22), end: minuteOf(6) });
    });

    it('reads the blocked spans of the active end', () => {
      host.timeFilter.set((date, side) => side === 'start' || date.getHours() >= 12);
      tick();

      expect(ring().spans().blocked).toEqual([]);

      host.activeSide.set('end');
      tick();

      expect(ring().spans().blocked).toEqual([{ start: 0, end: minuteOf(11, 45) }]);
    });

    it('makes the end of a focused handle the active side', () => {
      host.rangeValue.set({ start: at(9), end: at(17) });
      tick();

      (handle('end') as HTMLElement).focus();
      tick();

      expect(host.activeSide()).toBe('end');
      expect(handle('end')?.getAttribute('aria-label')).toBe('End time');
    });
  });
});

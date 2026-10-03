import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { pressKey, query, tick } from '../../testing/driver-core';
import { minuteOfDay, tapRing } from '../testing/time-picker-driver';
import { TimePickerRingHandleDirective } from './time-picker-ring-handle.directive';
import { TimePickerRingDirective } from './time-picker-ring.directive';
import { TimePickerDirective } from './time-picker.directive';

@Component({
  template: `
    <div
      #picker="etTimePicker"
      [(value)]="value"
      [format]="format()"
      [minuteStep]="minuteStep()"
      [min]="min()"
      [max]="max()"
      [timeFilter]="timeFilter()"
      etTimePicker
    >
      <div class="ring" etTimePickerRing>
        <span class="handle" etTimePickerRingHandle></span>
      </div>
    </div>
  `,
  imports: [TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective],
})
class TimePickerTestHost {
  value = signal<Date | null>(null);
  format = signal('HH:mm');
  minuteStep = signal(5);
  min = signal<Date | null>(null);
  max = signal<Date | null>(null);
  timeFilter = signal<((date: Date) => boolean) | null>(null);
}

const at = (hours: number, minutes = 0, seconds = 0) => new Date(2026, 6, 17, hours, minutes, seconds);

const timeOf = (date: Date | null) =>
  date === null
    ? null
    : [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');

describe('TimePickerDirective', () => {
  let fixture: ComponentFixture<TimePickerTestHost>;
  let host: TimePickerTestHost;

  const picker = () => fixture.debugElement.children[0]!.injector.get(TimePickerDirective);
  const ring = () => query(fixture, '.ring') as HTMLElement;
  const handle = () => query(fixture, '.handle') as HTMLElement;
  const key = (name: string) => pressKey(handle(), name);
  const tap = (hours: number, minutes = 0) => {
    tapRing(ring(), minuteOfDay(hours, minutes));
    tick();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(10, 7, 42));

    TestBed.configureTestingModule({ imports: [TimePickerTestHost] });
    fixture = TestBed.createComponent(TimePickerTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('commits a whole time from one pick, on the current day, with second 0', () => {
    tap(9, 30);

    expect(timeOf(host.value())).toBe('09:30:00');
    expect(host.value()?.getDate()).toBe(17);
    expect(host.value()?.getMilliseconds()).toBe(0);
  });

  it('edits the time of a value and keeps its day', () => {
    host.value.set(new Date(2026, 6, 20, 9, 30, 15, 250));
    tick();

    key('ArrowUp');

    expect(host.value()?.getDate()).toBe(20);
    expect(timeOf(host.value())).toBe('09:35:00');
    expect(host.value()?.getMilliseconds()).toBe(0);
  });

  it('keeps an off-step value as it is, and snaps it onto the steps on the next pick', () => {
    host.value.set(at(9, 32));
    tick();

    expect(handle().getAttribute('aria-valuenow')).toBe(String(minuteOfDay(9, 32)));
    expect(handle().getAttribute('aria-valuetext')).toBe('09:32');

    key('ArrowUp');

    expect(timeOf(host.value())).toBe('09:35:00');
  });

  it('formats the value by the format, with seconds and a 12-hour cycle', () => {
    host.value.set(at(14, 5, 30));
    tick();

    expect(handle().getAttribute('aria-valuetext')).toBe('14:05');

    host.format.set('h:mm:ss a');
    tick();

    expect(picker().formatSpec()).toEqual({ hourCycle: 12, showSeconds: true });
    expect(handle().getAttribute('aria-valuetext')).toBe('2:05:30 PM');
  });

  it('anchors an empty ring to now, snapped to the minute step with seconds at 0', () => {
    expect(timeOf(picker().anchorTime())).toBe('10:05:00');

    host.format.set('HH:mm:ss');
    tick();

    expect(timeOf(picker().anchorTime())).toBe('10:05:00');

    host.value.set(at(8, 12, 3));
    tick();

    expect(timeOf(picker().anchorTime())).toBe('08:12:03');
  });

  it('anchors an empty ring to a stop when the minute step does not divide an hour', () => {
    host.minuteStep.set(90);
    tick();

    expect(timeOf(picker().anchorTime())).toBe('09:00:00');

    key('ArrowUp');

    expect(timeOf(host.value())).toBe('10:30:00');
  });

  it('steps an empty ring from now to the next stop past midnight', () => {
    vi.setSystemTime(at(23, 58, 10));
    handle().dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: null }));
    host.minuteStep.set(15);
    tick();

    expect(timeOf(picker().anchorTime())).toBe('23:45:00');

    key('ArrowUp');

    expect(timeOf(host.value())).toBe('00:00:00');
  });

  it('filters against the current day once focus enters a picker that stayed mounted past midnight', () => {
    vi.setSystemTime(new Date(2026, 6, 17, 23, 58));

    const days = new Set<number>();
    const mounted = TestBed.createComponent(TimePickerTestHost);

    mounted.componentInstance.timeFilter.set((date) => {
      days.add(date.getDate());

      return true;
    });
    mounted.detectChanges();

    const mountedPicker = mounted.debugElement.children[0]!.injector.get(TimePickerDirective);

    mountedPicker.ringStops();
    vi.setSystemTime(new Date(2026, 6, 18, 0, 3));
    days.clear();

    mounted.nativeElement
      .querySelector('[etTimePickerRingHandle]')
      .dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: null }));
    mounted.detectChanges();
    mountedPicker.ringStops();

    expect([...days]).toEqual([18]);
  });

  it('clamps a zero, negative or fractional minuteStep to one minute instead of hanging', () => {
    host.value.set(at(9, 0));

    for (const step of [0, -5, 0.5, Number.NaN]) {
      host.minuteStep.set(step);
      tick();

      key('ArrowUp');
    }

    expect(timeOf(host.value())).toBe('09:04:00');
  });

  describe('bounds and filter', () => {
    it('leaves every time selectable without bounds or a filter', () => {
      expect(picker().ringStops().start.open.every(Boolean)).toBe(true);
    });

    it('writes nothing outside min and max, and stops the keyboard at them', () => {
      host.value.set(at(12));
      host.min.set(at(9, 30));
      host.max.set(at(17));
      tick();

      tap(8);

      expect(timeOf(host.value())).toBe('12:00:00');

      key('End');
      expect(timeOf(host.value())).toBe('17:00:00');

      key('ArrowUp');
      expect(timeOf(host.value())).toBe('09:30:00');

      key('Home');
      expect(timeOf(host.value())).toBe('09:30:00');
    });

    it('treats a min later than max as a window that wraps past midnight', () => {
      host.value.set(at(23));
      host.min.set(at(22));
      host.max.set(at(6));
      tick();

      tap(12);

      expect(timeOf(host.value())).toBe('23:00:00');

      key('PageUp');
      expect(timeOf(host.value())).toBe('00:00:00');

      key('End');
      expect(timeOf(host.value())).toBe('23:55:00');
    });

    it('keeps the whole minute of a bound with seconds open', () => {
      host.value.set(at(16, 55));
      host.max.set(new Date(2026, 6, 17, 17, 0, 30, 250));
      tick();

      key('ArrowUp');

      expect(timeOf(host.value())).toBe('17:00:00');
    });

    it('asks the filter with the full candidate timestamp', () => {
      const seen: Date[] = [];

      host.timeFilter.set((date) => {
        seen.push(date);

        return date.getHours() % 2 === 0;
      });
      host.value.set(at(12));
      tick();

      tap(13, 30);
      expect(timeOf(host.value())).toBe('12:00:00');

      key('PageUp');
      expect(timeOf(host.value())).toBe('14:00:00');

      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((date) => date.getDate() === 17)).toBe(true);
    });

    it('asks the filter about the day of the value', () => {
      host.timeFilter.set((date) => date.getDate() === 20);
      tick();

      tap(9);
      expect(host.value()).toBeNull();

      host.value.set(new Date(2026, 6, 20, 9));
      tick();

      tap(11);
      expect(timeOf(host.value())).toBe('11:00:00');
    });
  });
});

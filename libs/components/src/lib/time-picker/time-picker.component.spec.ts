import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TimeRange, TimeRangeSide } from './headless';
import { minuteOfDay, ringHandle, ringNote, ringReadout, tapRing, timeRing } from './testing/time-picker-driver';
import { TimePickerComponent } from './time-picker.component';

@Component({
  template: `
    <et-time-picker
      [(value)]="value"
      [(rangeValue)]="rangeValue"
      [(activeSide)]="activeSide"
      [day]="day()"
      [rangeDays]="rangeDays()"
      [mode]="mode()"
      [format]="format()"
      [min]="min()"
      [max]="max()"
      [minuteStep]="15"
    />
  `,
  imports: [TimePickerComponent],
})
class TimePickerHost {
  mode = signal<'single' | 'range'>('single');
  value = signal<Date | null>(null);
  rangeValue = signal<TimeRange>({ start: new Date(2026, 6, 8, 9, 0), end: null });
  activeSide = signal<TimeRangeSide>('start');
  day = signal<Date | null>(null);
  rangeDays = signal<TimeRange | null>(null);
  format = signal('HH:mm');
  min = signal<Date | null>(null);
  max = signal<Date | null>(null);
}

const at = (hours: number, minutes = 0) => new Date(2026, 6, 8, hours, minutes);

describe('TimePickerComponent', () => {
  const setup = (init: (host: TimePickerHost) => void = () => undefined) => {
    TestBed.configureTestingModule({ imports: [TimePickerHost] });

    const fixture = TestBed.createComponent(TimePickerHost);
    const root = fixture.nativeElement as HTMLElement;

    init(fixture.componentInstance);
    fixture.detectChanges();

    const tick = () => TestBed.inject(ApplicationRef).tick();
    const handles = () => Array.from(root.querySelectorAll<HTMLElement>('[etTimePickerRingHandle]'));
    const labels = () =>
      Array.from(root.querySelectorAll('.et-time-picker-labels text')).map((label) => label.textContent?.trim());

    return { fixture, root, host: fixture.componentInstance, tick, handles, labels };
  };

  describe('single time', () => {
    it('renders one empty handle and an empty readout with a hint, and no columns or side switch', () => {
      const { root, handles } = setup();

      expect(handles()).toHaveLength(1);
      expect(handles()[0]?.getAttribute('role')).toBe('slider');
      expect(handles()[0]?.getAttribute('aria-label')).toBe('Time');
      expect(handles()[0]?.hasAttribute('data-empty')).toBe(true);
      expect(ringReadout(root)).toBe('--:--');
      expect(ringNote(root)).toBe('Tap the ring');
      expect(root.querySelector('.et-time-picker-arc')).toBeNull();
      expect(root.querySelector('.et-time-picker-side')).toBeNull();
      expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('sets the time from a press on the ring and shows it live in the centre', () => {
      const { root, host, tick } = setup();

      tapRing(timeRing(root), minuteOfDay(14, 35));
      tick();

      expect(host.value()?.getHours()).toBe(14);
      expect(host.value()?.getMinutes()).toBe(30);
      expect(ringReadout(root)).toBe('14:30');
      expect(ringNote(root)).toBeNull();
      expect(ringHandle('start', root).hasAttribute('data-empty')).toBe(false);
    });

    it('renders the time as a bare time even when the format is a combined one', () => {
      const { root } = setup((host) => {
        host.value.set(at(9, 0));
        host.format.set('dd.MM.yyyy HH:mm');
      });

      expect(ringReadout(root)).toBe('09:00');
    });

    it('shows the day under the time when one is passed', () => {
      const { root } = setup((host) => {
        host.value.set(at(8, 45));
        host.day.set(new Date(2026, 6, 20));
      });

      expect(ringReadout(root)).toBe('08:45');
      expect(ringNote(root)).toBe('Mon 20 Jul');
    });

    it('labels the hours on a 24h ring every three hours', () => {
      const { root, labels } = setup();

      expect(labels()).toEqual(['00', '03', '06', '09', '12', '15', '18', '21']);
      expect(root.querySelectorAll('.et-time-picker-ticks line')).toHaveLength(24);
      expect(root.querySelector('.et-time-picker-mark')).toBeNull();
    });

    it('keeps the 24h ring on a 12h clock, with AM and PM labels and the moon and sun marks', () => {
      const { root, labels } = setup((host) => {
        host.value.set(at(14, 30));
        host.format.set('h:mm a');
      });

      expect(labels()).toEqual(['12 AM', '3', '6 AM', '9', '12 PM', '3', '6 PM', '9']);
      expect(root.querySelectorAll('.et-time-picker-mark')).toHaveLength(2);
      expect(ringReadout(root)).toBe('2:30 PM');
    });

    it('steps the readout down a size for a 12h time with seconds, so it clears the side hour labels', () => {
      const { root, fixture, host } = setup((host) => {
        host.value.set(at(14, 30));
        host.format.set('h:mm a');
      });
      const readout = () => root.querySelector('.et-time-picker-readout');

      expect(readout()?.hasAttribute('data-long')).toBe(true);
      expect(readout()?.hasAttribute('data-longer')).toBe(false);

      host.format.set('h:mm:ss a');
      fixture.detectChanges();

      expect(ringReadout(root)).toBe('2:30:00 PM');
      expect(readout()?.hasAttribute('data-longer')).toBe(true);
    });

    it('draws the track only where a time can be picked and the blocked span as a dotted line', () => {
      const { root, host, tick } = setup();

      expect(root.querySelectorAll('circle.et-time-picker-track')).toHaveLength(1);
      expect(root.querySelector('.et-time-picker-blocked')).toBeNull();

      host.min.set(at(8));
      host.max.set(at(20));
      tick();

      expect(root.querySelector('circle.et-time-picker-track')).toBeNull();
      expect(root.querySelectorAll('path.et-time-picker-track')).toHaveLength(1);
      expect(root.querySelectorAll('path.et-time-picker-blocked')).toHaveLength(1);
    });
  });

  describe('range', () => {
    it('renders a handle per end, named after it, and shows the time of the active end while the other is empty', () => {
      const { root, host, handles, tick } = setup((host) => host.mode.set('range'));

      expect(handles().map((handle) => handle.getAttribute('aria-label'))).toEqual(['Start time', 'End time']);
      expect(ringReadout(root)).toBe('09:00');
      expect(ringNote(root)).toBe('Start time');
      expect(ringHandle('end', root).hasAttribute('data-empty')).toBe(true);

      tapRing(timeRing(root), minuteOfDay(17, 30));
      tick();

      expect(host.rangeValue().start?.getHours()).toBe(17);
      expect(root.querySelector('.et-time-picker-side')).toBeNull();
    });

    it('shows the duration of the arc in the centre', () => {
      const { root } = setup((host) => {
        host.mode.set('range');
        host.rangeValue.set({ start: at(9), end: at(17, 30) });
      });

      expect(ringReadout(root)).toBe('8 h 30 min');
      expect(ringNote(root)).toBeNull();
      expect(root.querySelector('.et-time-picker-arc')?.getAttribute('d')).toMatch(/^M .+ A 112 112 0 0 1 /);
    });

    it('draws the arc past midnight and says the range ends the next day', () => {
      const { root, tick, host } = setup((host) => {
        host.mode.set('range');
        host.rangeValue.set({ start: at(22), end: at(6, 30) });
      });

      expect(ringReadout(root)).toBe('8 h 30 min');
      expect(ringNote(root)).toBe('ends next day');

      host.rangeValue.set({ start: at(6), end: at(20) });
      tick();

      expect(ringReadout(root)).toBe('14 h');
      expect(root.querySelector('.et-time-picker-arc')?.getAttribute('d')).toMatch(/ A 112 112 0 1 1 /);
    });

    it('reads the next day from the days of the ends where they differ', () => {
      const { root, tick, host } = setup((host) => {
        host.mode.set('range');
        host.rangeValue.set({ start: new Date(2026, 6, 6, 9), end: new Date(2026, 6, 7, 17) });
      });

      expect(ringReadout(root)).toBe('8 h');
      expect(ringNote(root)).toBe('ends next day');

      host.rangeValue.set({ start: new Date(2026, 6, 3, 22), end: new Date(2026, 6, 5, 6, 30) });
      tick();

      expect(ringNote(root)).toBeNull();
    });

    it('shows the time and the day of the active end instead of the duration next to a calendar', () => {
      const { root, tick, host } = setup((host) => {
        host.mode.set('range');
        host.rangeValue.set({ start: at(22), end: at(6, 30) });
        host.rangeDays.set({ start: new Date(2026, 9, 2), end: new Date(2026, 9, 16) });
        host.activeSide.set('end');
      });

      expect(ringReadout(root)).toBe('06:30');
      expect(ringNote(root)).toBe('Fri 16 Oct');

      host.activeSide.set('start');
      tick();

      expect(ringReadout(root)).toBe('22:00');
      expect(ringNote(root)).toBe('Fri 2 Oct');

      host.rangeDays.set({ start: null, end: null });
      tick();

      expect(ringNote(root)).toBe('Start time');
    });

    it('shows an empty range as an empty ring', () => {
      const { root, handles } = setup((host) => {
        host.mode.set('range');
        host.rangeValue.set({ start: null, end: null });
      });

      expect(handles().every((handle) => handle.hasAttribute('data-empty'))).toBe(true);
      expect(ringReadout(root)).toBe('--:--');
      expect(root.querySelector('.et-time-picker-arc')).toBeNull();
    });
  });
});

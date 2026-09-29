import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { pressKey, query, tick } from '../../testing/driver-core';
import { minuteOfDay, tapRing } from '../testing/time-picker-driver';
import { TimePickerRingHandleDirective } from './time-picker-ring-handle.directive';
import { TimePickerRingDirective } from './time-picker-ring.directive';
import {
  TimePickerDirective,
  TimePickerTimeFilterFn,
  TimeRange,
  TimeRangePick,
  TimeRangeSide,
} from './time-picker.directive';

@Component({
  template: `
    <div
      [(rangeValue)]="rangeValue"
      [(activeSide)]="activeSide"
      [timeFilter]="timeFilter()"
      [startLabel]="startLabel()"
      [endLabel]="endLabel()"
      (timeSelect)="picks.push($event)"
      (rangeHandOff)="handOffs.push($event)"
      etTimePicker
      format="HH:mm"
      mode="range"
    >
      <div class="ring" etTimePickerRing>
        <span class="start" etTimePickerRingHandle side="start"></span>
        <span class="end" etTimePickerRingHandle side="end"></span>
      </div>
    </div>
  `,
  imports: [TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective],
})
class TimePickerRangeTestHost {
  rangeValue = signal<TimeRange>({ start: null, end: null });
  activeSide = signal<TimeRangeSide>('start');
  timeFilter = signal<TimePickerTimeFilterFn | null>(null);
  startLabel = signal<string | null>(null);
  endLabel = signal<string | null>(null);
  picks: TimeRangePick[] = [];
  handOffs: TimeRangeSide[] = [];
}

const at = (hours: number, minutes = 0) => new Date(2026, 6, 8, hours, minutes);

const hhmm = (date: Date | null) =>
  date === null ? null : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

describe('TimePickerDirective - range mode', () => {
  let fixture: ComponentFixture<TimePickerRangeTestHost>;
  let host: TimePickerRangeTestHost;

  const picker = () => fixture.debugElement.children[0]!.injector.get(TimePickerDirective);
  const handle = (side: TimeRangeSide) => query(fixture, `.${side}`) as HTMLElement;
  const tap = (hours: number, minutes = 0) => {
    tapRing(query(fixture, '.ring') as HTMLElement, minuteOfDay(hours, minutes));
    tick();
  };
  const range = () => [hhmm(host.rangeValue().start), hhmm(host.rangeValue().end)];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(10, 7));

    TestBed.configureTestingModule({ imports: [TimePickerRangeTestHost] });
    fixture = TestBed.createComponent(TimePickerRangeTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the active end as the active value', () => {
    host.rangeValue.set({ start: at(9), end: at(17, 30) });
    tick();

    expect(hhmm(picker().activeValue())).toBe('09:00');

    host.activeSide.set('end');
    tick();

    expect(hhmm(picker().activeValue())).toBe('17:30');
  });

  it('writes only the end it edits and reports which one it was', () => {
    host.activeSide.set('end');
    tick();

    tap(17, 30);

    expect(range()).toEqual([null, '17:30']);
    expect(host.picks.map((pick) => [pick.side, hhmm(pick.time)])).toEqual([['end', '17:30']]);

    handle('start').focus();
    pressKey(handle('start'), 'PageUp');

    expect(range()).toEqual(['11:05', '17:30']);
    expect(host.activeSide()).toBe('start');
    expect(host.picks.map((pick) => pick.side)).toEqual(['end', 'start']);
  });

  it('hands on to the end after the first start of an empty range, and only then', () => {
    tap(9);

    expect(range()).toEqual(['09:00', null]);
    expect(host.activeSide()).toBe('end');
    expect(host.handOffs).toEqual(['end']);

    tap(17);

    expect(range()).toEqual(['09:00', '17:00']);
    expect(host.activeSide()).toBe('end');

    handle('start').focus();
    tick();
    tap(8);

    expect(range()).toEqual(['08:00', '17:00']);
    expect(host.activeSide()).toBe('start');
    expect(host.handOffs).toEqual(['end']);
  });

  it('keeps the day of each end', () => {
    host.rangeValue.set({ start: new Date(2026, 6, 20, 22), end: new Date(2026, 6, 21, 6) });
    tick();

    pressKey(handle('start'), 'PageUp');
    pressKey(handle('end'), 'PageDown');

    expect(host.rangeValue().start?.getDate()).toBe(20);
    expect(host.rangeValue().end?.getDate()).toBe(21);
    expect(range()).toEqual(['23:00', '05:00']);
  });

  it('passes each end to the filter, so one end can be bounded by the other', () => {
    host.rangeValue.set({ start: at(9), end: null });
    host.timeFilter.set((candidate, side) => side === 'start' || candidate.getHours() > 9);
    tick();

    pressKey(handle('start'), 'Home');
    pressKey(handle('end'), 'Home');

    expect(range()).toEqual(['00:00', '10:00']);
  });

  it('asks the filter about the day of each end', () => {
    host.rangeValue.set({ start: new Date(2026, 6, 20, 9), end: new Date(2026, 6, 21, 17) });
    host.timeFilter.set((candidate, side) =>
      side === 'start' ? candidate.getDate() === 20 : candidate.getDay() === 2,
    );
    tick();

    pressKey(handle('start'), 'PageUp');
    pressKey(handle('end'), 'PageUp');

    expect(range()).toEqual(['10:00', '18:00']);
  });

  it('makes a focused handle the active end', () => {
    handle('end').focus();
    tick();

    expect(host.activeSide()).toBe('end');

    host.activeSide.set('start');
    tick();

    expect(host.activeSide()).toBe('start');
    expect(handle('start').hasAttribute('data-active')).toBe(true);
    expect(handle('end').hasAttribute('data-active')).toBe(false);
  });

  it('names each handle by its end, and lets the labels override the names', () => {
    expect([handle('start').getAttribute('aria-label'), handle('end').getAttribute('aria-label')]).toEqual([
      'Start time',
      'End time',
    ]);

    host.startLabel.set('Doors open');
    host.endLabel.set('Doors close');
    tick();

    expect([handle('start').getAttribute('aria-label'), handle('end').getAttribute('aria-label')]).toEqual([
      'Doors open',
      'Doors close',
    ]);
  });
});

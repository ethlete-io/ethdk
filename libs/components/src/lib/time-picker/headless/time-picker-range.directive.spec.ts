import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { tick } from '../../testing/driver-core';
import { column, columns, option, press } from '../testing/time-picker-driver';
import { TimePickerColumnDirective } from './time-picker-column.directive';
import { TimePickerOptionDirective } from './time-picker-option.directive';
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
      #picker="etTimePicker"
      [(rangeValue)]="rangeValue"
      [(activeSide)]="activeSide"
      [format]="format()"
      [timeFilter]="timeFilter()"
      (timeSelect)="picks.push($event)"
      etTimePicker
      mode="range"
    >
      @for (column of picker.columns(); track column.unit) {
        <div [column]="column" [attr.data-unit]="column.unit" etTimePickerColumn>
          @for (option of column.options; track option.value) {
            <button [option]="option" [attr.data-value]="option.value" etTimePickerOption>{{ option.label }}</button>
          }
        </div>
      }
    </div>
  `,
  imports: [TimePickerDirective, TimePickerColumnDirective, TimePickerOptionDirective],
})
class TimePickerRangeTestHost {
  rangeValue = signal<TimeRange>({ start: null, end: null });
  activeSide = signal<TimeRangeSide>('start');
  format = signal('HH:mm');
  timeFilter = signal<TimePickerTimeFilterFn | null>(null);
  picks: TimeRangePick[] = [];
}

const at = (hours: number, minutes: number) => new Date(2026, 6, 8, hours, minutes);

describe('TimePickerDirective - range mode', () => {
  let fixture: ComponentFixture<TimePickerRangeTestHost>;
  let host: TimePickerRangeTestHost;

  const labelsWith = (unit: string, attribute: string) =>
    Array.from(column(fixture, unit)?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).map((el) =>
      el.textContent?.trim(),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TimePickerRangeTestHost] });
    fixture = TestBed.createComponent(TimePickerRangeTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders one set of columns, showing the active end', () => {
    host.rangeValue.set({ start: at(9, 0), end: at(17, 30) });
    tick();

    expect(columns(fixture)).toHaveLength(2);
    expect(column(fixture, 'hour')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('09');

    host.activeSide.set('end');
    tick();

    expect(column(fixture, 'hour')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('17');
    expect(column(fixture, 'minute')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('30');
  });

  it('writes only the active end and reports which one it was', () => {
    host.activeSide.set('end');
    tick();

    option(fixture, 'hour', 17)?.click();
    option(fixture, 'minute', 30)?.click();
    tick();

    expect(host.rangeValue().start).toBeNull();
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end']);

    host.activeSide.set('start');
    tick();

    option(fixture, 'hour', 9)?.click();
    option(fixture, 'minute', 0)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(9);
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end', 'start']);
  });

  it('hops to the end once the start is committed, and only once', () => {
    option(fixture, 'hour', 9)?.click();
    tick();

    expect(host.rangeValue().start).toBeNull();
    expect(host.activeSide()).toBe('start');

    option(fixture, 'minute', 0)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(9);
    expect(host.activeSide()).toBe('end');

    option(fixture, 'hour', 17)?.click();
    option(fixture, 'minute', 0)?.click();
    tick();

    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.activeSide()).toBe('end');

    host.activeSide.set('start');
    tick();

    option(fixture, 'hour', 10)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(10);
    expect(host.activeSide()).toBe('start');
  });

  it('does not hop while the keyboard browses a column', () => {
    press(fixture, 'hour', 'ArrowDown');
    press(fixture, 'minute', 'ArrowDown');
    tick();

    expect(host.rangeValue().start).not.toBeNull();
    expect(host.activeSide()).toBe('start');
  });

  it('bands the hours whose time falls inside the range, and marks the end it is not editing', () => {
    host.rangeValue.set({ start: at(9, 0), end: at(17, 30) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', "data-band='start'")).toEqual(['09']);
    expect(labelsWith('hour', "data-band='end'")).toEqual(['17']);
    expect(labelsWith('hour', "data-band='middle'")).toEqual(['10', '11', '12', '13', '14', '15', '16']);
    expect(labelsWith('hour', 'data-range-start')).toEqual(['09']);
    expect(labelsWith('hour', 'data-range-end')).toEqual(['17']);
  });

  it('bands the minutes that keep the hour in play inside the range', () => {
    host.rangeValue.set({ start: at(9, 15), end: at(17, 45) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('minute', "data-band='start'")).toEqual(['00']);
    expect(labelsWith('minute', "data-band='end'")).toEqual(['45']);
    expect(labelsWith('minute', "data-band='middle'")).toEqual(['05', '10', '15', '20', '25', '30', '35', '40']);
    expect(labelsWith('minute', 'data-range-start')).toEqual(['15']);
    expect(labelsWith('minute', 'data-range-end')).toEqual(['45']);
  });

  it('bands the twelve-hour columns by the time the half-day in play makes of them', () => {
    host.format.set('h:mm a');
    host.rangeValue.set({ start: at(0, 0), end: at(15, 40) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', "data-band='start'")).toEqual(['12']);
    expect(labelsWith('hour', "data-band='end'")).toEqual(['3']);
    expect(labelsWith('hour', "data-band='middle'")).toEqual(['1', '2']);
    expect(labelsWith('minute', "data-band='start'")).toEqual(['00']);
    expect(labelsWith('minute', "data-band='end'")).toEqual(['40']);
    expect(labelsWith('period', "data-band='start'")).toEqual(['AM']);
    expect(labelsWith('period', "data-band='end'")).toEqual(['PM']);
  });

  it('bands the whole hours column when every one of its times is inside the range', () => {
    host.format.set('h:mm a');
    host.rangeValue.set({ start: at(7, 50), end: at(23, 50) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', "data-band='start'")).toEqual(['12']);
    expect(labelsWith('hour', "data-band='end'")).toEqual(['11']);
    expect(labelsWith('hour', 'data-band').length).toBe(12);
    expect(labelsWith('minute', "data-band='end'")).toEqual(['50']);
    expect(labelsWith('minute', 'data-band')).not.toContain('55');
    expect(labelsWith('period', "data-band='start'")).toEqual(['AM']);
    expect(labelsWith('period', "data-band='end'")).toEqual(['PM']);
  });

  it('bands a lone in-range option as a whole pill', () => {
    host.rangeValue.set({ start: at(17, 8), end: at(17, 10) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', "data-band='single'")).toEqual(['17']);
    expect(labelsWith('minute', "data-band='single'")).toEqual(['10']);
  });

  it('bands between the two ends even when the end precedes the start', () => {
    host.rangeValue.set({ start: at(17, 0), end: at(9, 0) });
    tick();

    expect(labelsWith('hour', "data-band='start'")).toEqual(['09']);
    expect(labelsWith('hour', "data-band='end'")).toEqual(['17']);
  });

  it('bands nothing while only one end is set', () => {
    host.rangeValue.set({ start: at(9, 0), end: null });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', 'data-band')).toEqual([]);
    expect(labelsWith('hour', 'data-range-start')).toEqual(['09']);
  });

  it('passes the active end to the filter, so one end can be bounded by the other', () => {
    host.rangeValue.set({ start: at(9, 0), end: null });
    host.timeFilter.set((candidate, side) => side === 'start' || candidate.getHours() > 9);
    tick();

    const disabled = () => labelsWith('hour', "aria-disabled='true'");

    expect(disabled()).toEqual([]);

    host.activeSide.set('end');
    tick();

    expect(disabled()).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09']);
  });
});

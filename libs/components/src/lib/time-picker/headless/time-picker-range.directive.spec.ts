import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
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

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const column = (unit: string) => fixture.nativeElement.querySelector<HTMLElement>(`[data-unit='${unit}']`);
  const optionButton = (unit: string, value: number) =>
    column(unit)?.querySelector<HTMLButtonElement>(`[data-value='${value}']`) ?? null;
  const labelsWith = (unit: string, attribute: string) =>
    Array.from(column(unit)?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).map((option) =>
      option.textContent?.trim(),
    );

  const keydown = (unit: string, key: string) =>
    column(unit)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TimePickerRangeTestHost] });
    fixture = TestBed.createComponent(TimePickerRangeTestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders one set of columns, showing the active end', () => {
    host.rangeValue.set({ start: at(9, 0), end: at(17, 30) });
    tick();

    expect(Array.from(fixture.nativeElement.querySelectorAll('[data-unit]')).length).toBe(2);
    expect(column('hour')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('09');

    host.activeSide.set('end');
    tick();

    expect(column('hour')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('17');
    expect(column('minute')?.querySelector('[data-selected]')?.textContent?.trim()).toBe('30');
  });

  it('writes only the active end and reports which one it was', () => {
    host.activeSide.set('end');
    tick();

    optionButton('hour', 17)?.click();
    tick();

    expect(host.rangeValue().start).toBeNull();
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end']);

    host.activeSide.set('start');
    tick();

    optionButton('hour', 9)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(9);
    // the end must survive a pick on the other side
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end', 'start']);
  });

  it('hops to the end once the start is committed, and only once', () => {
    optionButton('hour', 9)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(9);
    expect(host.activeSide()).toBe('end');

    optionButton('hour', 17)?.click();
    tick();

    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.activeSide()).toBe('end');

    // back on the start deliberately: refining it must not yank the columns away again
    host.activeSide.set('start');
    tick();

    optionButton('hour', 10)?.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(10);
    expect(host.activeSide()).toBe('start');
  });

  it('does not hop while the keyboard browses a column', () => {
    keydown('hour', 'ArrowDown');
    tick();

    expect(host.rangeValue().start).not.toBeNull();
    expect(host.activeSide()).toBe('start');
  });

  it('bands the hours the range traverses, and marks the end it is not editing', () => {
    host.rangeValue.set({ start: at(9, 0), end: at(17, 30) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('hour', "data-band='start'")).toEqual(['09']);
    expect(labelsWith('hour', "data-band='end'")).toEqual(['17']);
    expect(labelsWith('hour', "data-band='middle'")).toEqual(['10', '11', '12', '13', '14', '15', '16']);
    // the start's option is the one that still needs drawing - the end is the selection
    expect(labelsWith('hour', 'data-range-start')).toEqual(['09']);
    expect(labelsWith('hour', 'data-range-end')).toEqual(['17']);
  });

  it('leaves the minutes column plain while the two ends sit in different hours', () => {
    host.rangeValue.set({ start: at(9, 15), end: at(17, 45) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('minute', 'data-band')).toEqual([]);
    expect(labelsWith('minute', 'data-range-start')).toEqual([]);
    expect(labelsWith('minute', 'data-range-end')).toEqual(['45']);
  });

  it('bands the minutes once both ends share the hour', () => {
    host.rangeValue.set({ start: at(9, 15), end: at(9, 45) });
    host.activeSide.set('end');
    tick();

    expect(labelsWith('minute', "data-band='start'")).toEqual(['15']);
    expect(labelsWith('minute', "data-band='end'")).toEqual(['45']);
    expect(labelsWith('minute', "data-band='middle'")).toEqual(['20', '25', '30', '35', '40']);
    expect(labelsWith('hour', 'data-band')).toEqual([]);
  });

  it('bands a 12-hour cycle by half-day rather than across it', () => {
    host.format.set('h:mm a');
    host.rangeValue.set({ start: at(9, 0), end: at(17, 30) });
    host.activeSide.set('end');
    tick();

    // 9 AM to 5 PM: the hours column is only chronological inside one half-day, so it stays plain
    expect(labelsWith('hour', 'data-band')).toEqual([]);
    // the AM/PM column is where the crossing shows
    expect(labelsWith('period', "data-band='start'")).toEqual(['AM']);
    expect(labelsWith('period', "data-band='end'")).toEqual(['PM']);
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
    // the committed start still shows where it sits
    expect(labelsWith('hour', 'data-range-start')).toEqual(['09']);
  });

  it('passes the active end to the filter, so one end can be bounded by the other', () => {
    host.rangeValue.set({ start: at(9, 0), end: null });
    // only the end is gated: nothing at or before the committed start
    host.timeFilter.set((candidate, side) => side === 'start' || candidate.getHours() > 9);
    tick();

    const disabled = () => labelsWith('hour', "aria-disabled='true'");

    expect(disabled()).toEqual([]);

    host.activeSide.set('end');
    tick();

    expect(disabled()).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09']);
  });
});

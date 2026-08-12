import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TimeRange, TimeRangeFilterFn, TimeRangePick, TimeRangePickerComponent } from './time-range-picker.component';

@Component({
  template: `
    <et-time-range-picker
      [(rangeValue)]="rangeValue"
      [timeFilter]="timeFilter()"
      (timeSelect)="picks.push($event)"
      format="HH:mm"
    />
  `,
  imports: [TimeRangePickerComponent],
})
class TimeRangePickerTestHost {
  rangeValue = signal<TimeRange>({ start: null, end: null });
  timeFilter = signal<TimeRangeFilterFn | null>(null);
  picks: TimeRangePick[] = [];
}

describe('TimeRangePickerComponent', () => {
  const setup = () => {
    TestBed.configureTestingModule({ imports: [TimeRangePickerTestHost] });

    const fixture = TestBed.createComponent(TimeRangePickerTestHost);

    fixture.detectChanges();

    const sides = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('.et-time-range-picker-side'));
    const optionsOf = (side: 'start' | 'end', columnIndex: number) =>
      Array.from(
        sides
          .find((element) => element.dataset['side'] === side)!
          .querySelectorAll<HTMLElement>('.et-time-picker-column')
          [columnIndex]!.querySelectorAll<HTMLButtonElement>('.et-time-picker-option'),
      );

    return {
      fixture,
      host: fixture.componentInstance,
      sides,
      optionsOf,
      tick: () => TestBed.inject(ApplicationRef).tick(),
    };
  };

  it('renders one labelled column group per side', () => {
    const { sides, optionsOf } = setup();

    expect(sides.map((element) => element.dataset['side'])).toEqual(['start', 'end']);
    expect(sides.map((element) => element.getAttribute('role'))).toEqual(['group', 'group']);
    expect(sides.map((element) => element.getAttribute('aria-label'))).toEqual(['Start time', 'End time']);
    expect(sides.map((element) => element.querySelector('.et-time-range-picker-caption')?.textContent?.trim())).toEqual(
      ['Start time', 'End time'],
    );
    // HH:mm - hours and minutes on each side, no period column
    expect(optionsOf('start', 0).length).toBe(24);
  });

  it('writes only the picked side and reports which one it was', () => {
    const { host, optionsOf, tick } = setup();

    optionsOf('end', 0)[17]!.click();
    tick();

    expect(host.rangeValue().start).toBeNull();
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end']);

    optionsOf('start', 0)[9]!.click();
    tick();

    expect(host.rangeValue().start?.getHours()).toBe(9);
    // the end must survive a pick on the other side
    expect(host.rangeValue().end?.getHours()).toBe(17);
    expect(host.picks.map((pick) => pick.side)).toEqual(['end', 'start']);
  });

  it('passes the side to the filter, so one end can be bounded by the other', () => {
    const { host, optionsOf, tick } = setup();

    host.rangeValue.set({ start: new Date(2026, 6, 8, 9, 0), end: null });
    // only the end is gated: nothing at or before the committed start
    host.timeFilter.set((candidate, side) => side === 'start' || candidate.getHours() > 9);
    tick();

    const disabledOn = (side: 'start' | 'end') =>
      optionsOf(side, 0)
        .filter((option) => option.getAttribute('aria-disabled') === 'true')
        .map((option) => option.textContent?.trim());

    expect(disabledOn('start')).toEqual([]);
    expect(disabledOn('end')).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09']);
  });
});

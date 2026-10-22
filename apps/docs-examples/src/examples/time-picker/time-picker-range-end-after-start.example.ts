import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS, TimeRange, TimeRangeSide } from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

const atTime = (hours: number, minutes: number) => setMinutes(setHours(startOfDay(new Date()), hours), minutes);

const endAfterStart = (getStart: () => Date | null) => (candidate: Date, side: TimeRangeSide) => {
  const start = getStart();

  return side === 'start' || start === null || candidate > start;
};

@Component({
  selector: 'app-time-picker-range-end-after-start-example',
  template: `
    <et-time-picker [(rangeValue)]="slot" [timeFilter]="END_AFTER_START" mode="range" />

    <p>Start: {{ slot().start?.toTimeString() ?? 'null' }} · End: {{ slot().end?.toTimeString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerRangeEndAfterStartExampleComponent {
  protected slot = signal<TimeRange>({ start: atTime(9, 0), end: null });

  protected readonly END_AFTER_START = endAfterStart(() => this.slot().start);
}

import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS, TimeRange } from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

const atTime = (hours: number, minutes: number) => setMinutes(setHours(startOfDay(new Date()), hours), minutes);

@Component({
  selector: 'app-time-picker-range-example',
  template: `
    <et-time-picker [(rangeValue)]="slot" mode="range" />

    <p>Start: {{ slot().start?.toTimeString() ?? 'null' }} · End: {{ slot().end?.toTimeString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerRangeExampleComponent {
  protected slot = signal<TimeRange>({ start: atTime(9, 0), end: atTime(17, 30) });
}

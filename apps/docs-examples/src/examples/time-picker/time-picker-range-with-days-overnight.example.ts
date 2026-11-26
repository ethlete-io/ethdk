import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS, TimeRange } from '@ethlete/components';
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

const today = startOfDay(new Date());

const atTime = (hours: number, minutes: number) => setMinutes(setHours(today, hours), minutes);

@Component({
  selector: 'app-time-picker-range-with-days-overnight-example',
  template: `<et-time-picker [(rangeValue)]="slot" [rangeDays]="days" mode="range" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerRangeWithDaysOvernightExampleComponent {
  protected slot = signal<TimeRange>({ start: atTime(22, 0), end: atTime(6, 30) });

  protected days: TimeRange = { start: today, end: addDays(today, 1) };
}

import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS } from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

@Component({
  selector: 'app-time-picker-twelve-hour-example',
  template: `
    <et-time-picker [(value)]="time" format="h:mm a" />

    <p>Value: {{ time()?.toTimeString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerTwelveHourExampleComponent {
  protected time = signal<Date | null>(setMinutes(setHours(startOfDay(new Date()), 14), 30));
}

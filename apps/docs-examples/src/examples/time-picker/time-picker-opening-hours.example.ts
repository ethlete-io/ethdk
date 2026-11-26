import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS } from '@ethlete/components';
import { setHours, setMinutes, startOfDay } from 'date-fns';

const atTime = (hours: number, minutes: number) => setMinutes(setHours(startOfDay(new Date()), hours), minutes);

const notDuringLunch = (candidate: Date) => candidate.getHours() !== 12;

@Component({
  selector: 'app-time-picker-opening-hours-example',
  template: `
    <et-time-picker [(value)]="slot" [min]="OPENING" [max]="CLOSING" [timeFilter]="NOT_DURING_LUNCH" />

    <p>Value: {{ slot()?.toTimeString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerOpeningHoursExampleComponent {
  protected readonly OPENING = atTime(8, 0);
  protected readonly CLOSING = atTime(20, 0);
  protected readonly NOT_DURING_LUNCH = notDuringLunch;

  protected slot = signal<Date | null>(atTime(10, 30));
}

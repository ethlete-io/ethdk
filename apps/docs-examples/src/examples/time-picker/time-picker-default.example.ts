import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TIME_PICKER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-time-picker-default-example',
  template: `
    <et-time-picker [(value)]="time" />

    <p>Value: {{ time()?.toTimeString() ?? 'null' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
})
export class TimePickerDefaultExampleComponent {
  protected time = signal<Date | null>(null);
}

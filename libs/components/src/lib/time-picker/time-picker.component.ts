import { Component, ViewEncapsulation, inject } from '@angular/core';
import { TimePickerColumnDirective, TimePickerDirective, TimePickerOptionDirective } from './headless';

@Component({
  selector: 'et-time-picker',
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerColumnDirective, TimePickerOptionDirective],
  hostDirectives: [
    {
      directive: TimePickerDirective,
      inputs: [
        'format',
        'locale',
        'minuteStep',
        'secondStep',
        'hoursLabel',
        'minutesLabel',
        'secondsLabel',
        'periodLabel',
        'value',
      ],
      outputs: ['valueChange'],
    },
  ],
  host: {
    class: 'et-time-picker',
  },
})
export class TimePickerComponent {
  protected timePicker = inject(TimePickerDirective);
}

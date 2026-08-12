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
        'mode',
        'format',
        'locale',
        'minuteStep',
        'secondStep',
        'min',
        'max',
        'timeFilter',
        'hoursLabel',
        'minutesLabel',
        'secondsLabel',
        'periodLabel',
        'startLabel',
        'endLabel',
        'value',
        'rangeValue',
        'activeSide',
      ],
      outputs: ['valueChange', 'rangeValueChange', 'activeSideChange', 'timeSelect'],
    },
  ],
  host: {
    class: 'et-time-picker',
    '[attr.data-mode]': 'timePicker.mode()',
  },
})
export class TimePickerComponent {
  protected timePicker = inject(TimePickerDirective);
}

import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { CLOCK_ICON, IconDirective, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { TimeInputDirective, TimeInputFieldDirective } from './headless';

@Component({
  selector: 'et-time-input',
  templateUrl: './time-input.component.html',
  styleUrl: './time-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...TIME_PICKER_IMPORTS,
    TimeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    IconDirective,
  ],
  providers: [provideIcons(CLOCK_ICON)],
  hostDirectives: [
    {
      directive: TimeInputDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'valueFormat',
        'displayFormat',
        'locale',
        'pickerOpen',
      ],
      outputs: ['valueChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-time-input',
  },
})
export class TimeInputComponent {
  protected timeInput = inject(TimeInputDirective);

  public pickerTriggerLabel = input('Open time picker');
  public minuteStep = input(5);
  public secondStep = input(1);
}

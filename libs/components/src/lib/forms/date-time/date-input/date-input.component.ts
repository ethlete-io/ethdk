import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { CALENDAR_ICON, IconDirective, provideIcons } from '../../../icon';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateInputDirective, DateInputFieldDirective } from './headless';

@Component({
  selector: 'et-date-input',
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...CALENDAR_IMPORTS,
    DateInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    IconDirective,
  ],
  providers: [provideIcons(CALENDAR_ICON)],
  hostDirectives: [
    {
      directive: DateInputDirective,
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
        'parseErrorMessage',
        'valueFormat',
        'displayFormat',
        'locale',
        'minDate',
        'maxDate',
        'dateFilter',
        'pickerOpen',
      ],
      outputs: ['valueChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-input',
  },
})
export class DateInputComponent {
  protected dateInput = inject(DateInputDirective);

  public pickerTriggerLabel = input('Open calendar');
}

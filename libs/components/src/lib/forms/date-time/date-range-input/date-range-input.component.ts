import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, provideIcons } from '../../../icon';
import { InputMaskDirective } from '../../masked-input/headless';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateRangeInputDirective, DateRangeInputFieldDirective } from './headless';

@Component({
  selector: 'et-date-range-input',
  templateUrl: './date-range-input.component.html',
  styleUrl: './date-range-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...CALENDAR_IMPORTS,
    DateRangeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    IconDirective,
    InputMaskDirective,
  ],
  providers: [provideIcons(CALENDAR_ICON)],
  hostDirectives: [
    {
      directive: DateRangeInputDirective,
      inputs: [
        'value',
        'mixed',
        'mixedLabel',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'startPlaceholder',
        'endPlaceholder',
        'parseErrorMessage',
        'valueFormat',
        'displayFormat',
        'locale',
        'mask',
        'minDate',
        'maxDate',
        'dateFilter',
        'pickerOpen',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-range-input',
    role: 'group',
    '[attr.aria-labelledby]': 'rangeInput.labelId()',
  },
})
export class DateRangeInputComponent {
  protected rangeInput = inject(DateRangeInputDirective);

  public startAriaLabel = input('Start date');
  public endAriaLabel = input('End date');
  public pickerTriggerLabel = input('Open calendar');
}

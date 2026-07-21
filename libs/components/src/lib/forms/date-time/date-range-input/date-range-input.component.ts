import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
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
  providers: [provideIcons(CALENDAR_ICON, TIMES_ICON)],
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

  /** Shows a clear (×) control while a value is set and the field is in use. */
  public clearable = input(true);
  public clearLabel = input('Clear');

  // only while the field is in use — mirrors the single date input's clear affordance
  protected showClear = computed(
    () => this.clearable() && this.rangeInput.hasValue() && this.rangeInput.focused() && this.rangeInput.interactive(),
  );

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.rangeInput.clearRange();
  }
}

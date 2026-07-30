import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { InputMaskDirective } from '../../masked-input/headless';
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
    InputMaskDirective,
  ],
  providers: [provideIcons(CALENDAR_ICON, TIMES_ICON)],
  hostDirectives: [
    {
      directive: DateInputDirective,
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
        'placeholder',
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
    class: 'et-date-input',
  },
})
export class DateInputComponent {
  protected dateInput = inject(DateInputDirective);

  public pickerTriggerLabel = input('Open calendar');
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input('Clear');

  // only while the field is in use — mirrors the select's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.dateInput.hasValue() &&
      (this.dateInput.focused() || this.dateInput.pickerOpen()) &&
      this.dateInput.interactive(),
  );

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.dateInput.clearValue();
  }
}

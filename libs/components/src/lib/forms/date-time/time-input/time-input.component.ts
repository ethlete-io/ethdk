import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { CLOCK_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { InputMaskDirective } from '../../masked-input/headless';
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
    InputMaskDirective,
  ],
  providers: [provideIcons(CLOCK_ICON, TIMES_ICON)],
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
        'parseErrorMessage',
        'valueFormat',
        'displayFormat',
        'locale',
        'mask',
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
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true);
  public clearLabel = input('Clear');

  // only while the field is in use — mirrors the select's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.timeInput.hasValue() &&
      (this.timeInput.focused() || this.timeInput.pickerOpen()) &&
      this.timeInput.interactive(),
  );

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.timeInput.clearValue();
  }
}

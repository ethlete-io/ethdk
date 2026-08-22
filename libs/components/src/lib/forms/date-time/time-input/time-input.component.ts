import {
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { CLOCK_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { InputMaskDirective } from '../../masked-input/headless';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { TimeInputDirective, TimeInputFieldDirective } from './headless';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';
import { ControlSuffixDirective } from '../../form-field/partials';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

@Component({
  selector: 'et-time-input',
  templateUrl: './time-input.component.html',
  styleUrl: './time-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
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
        'minTime',
        'maxTime',
        'timeFilter',
        'pickerOpen',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-time-input',
  },
})
export class TimeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected timeInput = inject(TimeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: numberAttribute });
  public secondStep = input(1, { transform: numberAttribute });
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openTimePicker,
  );

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseTime);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the select's clear affordance
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

  public focus(options?: FocusOptions) {
    this.timeInput.focus(options);
  }
}

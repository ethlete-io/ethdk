import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { positiveIntegerAttribute } from '../../../internals/number-attributes';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { CLOCK_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { ControlSuffixDirective } from '../../form-field/partials';
import { InputMaskDirective } from '../../masked-input/headless';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { TimeRangeInputDirective, TimeRangeInputFieldDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

@Component({
  selector: 'et-time-range-input',
  templateUrl: './time-range-input.component.html',
  styleUrls: ['../range-input-shell.css', './time-range-input.component.css'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
    ...TIME_PICKER_IMPORTS,
    TimeRangeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    IconDirective,
    InputMaskDirective,
  ],
  providers: [provideIcons(CLOCK_ICON, TIMES_ICON)],
  hostDirectives: [
    {
      directive: TimeRangeInputDirective,
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
        'minTime',
        'maxTime',
        'timeFilter',
        'pickerOpen',
        'startAriaLabel',
        'endAriaLabel',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-time-range-input',
    role: 'group',
    '[attr.aria-label]': 'rangeInput.ariaLabel() || null',
    '[attr.aria-labelledby]': 'rangeInput.labelId()',
  },
})
export class TimeRangeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected rangeInput = inject(TimeRangeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: positiveIntegerAttribute });
  public secondStep = input(1, { transform: positiveIntegerAttribute });
  /** The time picker's two ends, on the control that switches between them. */
  public startTimeLabel = input<string | null>(null);
  public endTimeLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `startAriaLabel`, else the domain's label set. */
  protected resolvedStartAriaLabel = computed(
    () => this.rangeInput.startAriaLabel() ?? this.dateTimeLabels().startTime,
  );

  /** The string in effect: this instance's `endAriaLabel`, else the domain's label set. */
  protected resolvedEndAriaLabel = computed(() => this.rangeInput.endAriaLabel() ?? this.dateTimeLabels().endTime);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openTimePicker,
  );

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseTimeRange);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the date & time range input's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.rangeInput.hasValue() &&
      (this.rangeInput.focused() || this.rangeInput.pickerOpen()) &&
      this.rangeInput.interactive(),
  );

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.rangeInput.clearRange();
  }

  public focus(options?: FocusOptions) {
    this.rangeInput.focus(options);
  }
}

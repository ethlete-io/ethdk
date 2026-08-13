import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { InputMaskDirective } from '../../masked-input/headless';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateInputDirective, DateInputFieldDirective } from './headless';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';
import { ControlSuffixDirective } from '../../form-field/partials';

@Component({
  selector: 'et-date-input',
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
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
        'startAt',
        'precision',
        'startView',
        'dateClass',
        'weekNumbers',
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
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected dateInput = inject(DateInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openCalendar,
  );

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDate);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the select's clear affordance
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

  public focus(options?: FocusOptions) {
    this.dateInput.focus(options);
  }
}

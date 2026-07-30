import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { InputMaskDirective } from '../../masked-input/headless';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateRangeInputDirective, DateRangeInputFieldDirective } from './headless';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';

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
        'startAt',
        'startView',
        'dateClass',
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
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected rangeInput = inject(DateRangeInputDirective);

  public startAriaLabel = input<string | null>(null);
  public endAriaLabel = input<string | null>(null);
  public pickerTriggerLabel = input<string | null>(null);

  /** Shows a clear (×) control while a value is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `startAriaLabel`, else the domain's label set. */
  protected resolvedStartAriaLabel = computed(() => this.startAriaLabel() ?? this.dateTimeLabels().startDate);

  /** The string in effect: this instance's `endAriaLabel`, else the domain's label set. */
  protected resolvedEndAriaLabel = computed(() => this.endAriaLabel() ?? this.dateTimeLabels().endDate);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openCalendar,
  );

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

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

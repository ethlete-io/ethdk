import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { positiveIntegerAttribute } from '../../../internals/number-attributes';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { ControlSuffixDirective } from '../../form-field/partials';
import { InputMaskDirective } from '../../masked-input/headless';
import { SegmentedButtonComponent, SegmentedButtonGroupComponent } from '../../selection-list/segmented-button-group';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DateRangePresetsComponent } from '../date-range-presets.component';
import { DateTimePickerPanesDirective } from '../internals/date-time-panes.directive';
import { createPickerPanes } from '../internals/picker-pane-state';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimeRangeInputDirective, DateTimeRangeInputFieldDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';
import { FIELD_STATE_INPUTS } from '../../form-field/headless/field-state-control.directive';
import { mountRangeInputShellStyles } from '../range-input-shell-styles.component';

@Component({
  selector: 'et-date-time-range-input',
  templateUrl: './date-time-range-input.component.html',
  styleUrl: './date-time-range-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
    ...CALENDAR_IMPORTS,
    ...TIME_PICKER_IMPORTS,
    DateTimeRangeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    DateRangePresetsComponent,
    DateTimePickerPanesDirective,
    SegmentedButtonGroupComponent,
    SegmentedButtonComponent,
    IconDirective,
    InputMaskDirective,
  ],
  providers: [provideIcons(CALENDAR_ICON, TIMES_ICON)],
  hostDirectives: [
    {
      directive: DateTimeRangeInputDirective,
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
        'timeZone',
        'timeZoneLabel',
        'locale',
        'mask',
        'minDate',
        'maxDate',
        'dateFilter',
        'startAt',
        'startView',
        'dateClass',
        'weekNumbers',
        'firstDayOfWeek',
        'presets',
        'minTime',
        'maxTime',
        'timeFilter',
        'pickerOpen',
        'startAriaLabel',
        'endAriaLabel',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-time-range-input',
    role: 'group',
    '[attr.aria-label]': 'rangeInput.ariaLabel() || null',
    '[attr.aria-labelledby]': 'rangeInput.labelId()',
  },
})
export class DateTimeRangeInputComponent {
  protected dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected rangeInput = inject(DateTimeRangeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: positiveIntegerAttribute });
  /** The bottom sheet's two tab labels. */
  public datesTabLabel = input<string | null>(null);
  public timesTabLabel = input<string | null>(null);
  /** Accessible names of the time picker's two ring handles. */
  public startTimeLabel = input<string | null>(null);
  public endTimeLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  protected resolvedStartAriaLabel = computed(
    () => this.rangeInput.startAriaLabel() ?? this.dateTimeLabels().startDateTime,
  );

  protected resolvedEndAriaLabel = computed(() => this.rangeInput.endAriaLabel() ?? this.dateTimeLabels().endDateTime);

  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openDateTimePicker,
  );

  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDateTimeRange);

  protected resolvedDatesTabLabel = computed(() => this.datesTabLabel() ?? this.dateTimeLabels().datesTab);

  protected resolvedTimesTabLabel = computed(() => this.timesTabLabel() ?? this.dateTimeLabels().timesTab);

  /**
   * The second reading shown under the fields: the zone they are in, and the same moments in the
   * reader's own zone. `null` whenever the two agree.
   */
  protected localReadingText = computed(() => {
    const timeZone = this.rangeInput.resolvedTimeZoneLabel();
    const start = this.rangeInput.localReading('start');
    const end = this.rangeInput.localReading('end');

    if (timeZone === null || (start === null && end === null)) {
      return null;
    }

    const reading = start !== null && end !== null ? `${start} – ${end}` : ((start ?? end) as string);

    return this.dateTimeLabels().timeZoneReading(timeZone, reading);
  });

  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.rangeInput.hasValue() &&
      (this.rangeInput.focused() || this.rangeInput.pickerOpen()) &&
      this.rangeInput.interactive(),
  );

  protected panes = createPickerPanes(['dates', 'times'], this.rangeInput.pickerOpen);

  constructor() {
    mountRangeInputShellStyles();
  }

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.rangeInput.clearRange();
  }

  /**
   * Completing the two days carries the tabs on to the times pane. Once only: after that the tabs
   * stay where they are put.
   */
  protected handleRangeSelect(range: { start: Date | null; end: Date | null }) {
    this.rangeInput.selectCalendarRange(range);

    if (range.start !== null && range.end !== null) {
      this.panes.advance();
    }
  }

  public focus(options?: FocusOptions) {
    this.rangeInput.focus(options);
  }
}

import { Component, ViewEncapsulation, booleanAttribute, computed, effect, inject, input, signal } from '@angular/core';
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
import { DateTimePickerPanesDirective } from '../internals/date-time-panes.directive';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimeRangeInputDirective, DateTimeRangeInputFieldDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

/** Which pane the bottom-sheet tabs show; the desktop panel renders both side by side. */
type DateTimeRangePane = 'dates' | 'times';

const PANE_ORDER: readonly DateTimeRangePane[] = ['dates', 'times'];

@Component({
  selector: 'et-date-time-range-input',
  templateUrl: './date-time-range-input.component.html',
  styleUrls: ['../range-input-shell.css', './date-time-range-input.component.css'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
    ...CALENDAR_IMPORTS,
    ...TIME_PICKER_IMPORTS,
    DateTimeRangeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
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
    class: 'et-date-time-range-input',
    role: 'group',
    '[attr.aria-label]': 'rangeInput.ariaLabel() || null',
    '[attr.aria-labelledby]': 'rangeInput.labelId()',
  },
})
export class DateTimeRangeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected rangeInput = inject(DateTimeRangeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: positiveIntegerAttribute });
  public secondStep = input(1, { transform: positiveIntegerAttribute });
  /** The bottom sheet's two tab labels. */
  public datesTabLabel = input<string | null>(null);
  public timesTabLabel = input<string | null>(null);
  /** The time picker's two ends, on the control that switches between them. */
  public startTimeLabel = input<string | null>(null);
  public endTimeLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `startAriaLabel`, else the domain's label set. */
  protected resolvedStartAriaLabel = computed(
    () => this.rangeInput.startAriaLabel() ?? this.dateTimeLabels().startDateTime,
  );

  /** The string in effect: this instance's `endAriaLabel`, else the domain's label set. */
  protected resolvedEndAriaLabel = computed(() => this.rangeInput.endAriaLabel() ?? this.dateTimeLabels().endDateTime);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openDateTimePicker,
  );

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDateTimeRange);

  /** The strings in effect: this instance's tab labels, else the domain's label set. */
  protected resolvedDatesTabLabel = computed(() => this.datesTabLabel() ?? this.dateTimeLabels().datesTab);

  protected resolvedTimesTabLabel = computed(() => this.timesTabLabel() ?? this.dateTimeLabels().timesTab);

  /**
   * The second reading shown under the fields: the zone they are in, and the same moments in the
   * reader's own zone. `null` whenever the two agree - one clock is better than two that match.
   */
  protected localReadingText = computed(() => {
    const timeZone = this.rangeInput.resolvedTimeZoneLabel();
    const start = this.rangeInput.localReading('start');
    const end = this.rangeInput.localReading('end');

    if (timeZone === null || (start === null && end === null)) {
      return null;
    }

    // the same en dash the two fields are separated by, so the second reading lines up with them
    const reading = start !== null && end !== null ? `${start} – ${end}` : ((start ?? end) as string);

    return this.dateTimeLabels().timeZoneReading(timeZone, reading);
  });

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the date-time input's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.rangeInput.hasValue() &&
      (this.rangeInput.focused() || this.rangeInput.pickerOpen()) &&
      this.rangeInput.interactive(),
  );

  protected activePane = signal<DateTimeRangePane>('dates');

  /**
   * Direction of the last pane switch - the incoming pane slides in from the
   * travel direction, like the calendar's month navigation. `null` while
   * untouched, so opening the picker does not animate.
   */
  protected paneNav = signal<'forward' | 'backward' | null>(null);

  private paneAdvanceSpent = signal(false);

  constructor() {
    // every picker open starts back on the calendar pane, without a slide
    effect(() => {
      if (this.rangeInput.pickerOpen()) {
        this.activePane.set('dates');
        this.paneNav.set(null);
        this.paneAdvanceSpent.set(false);
      }
    });
  }

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.rangeInput.clearRange();
  }

  /**
   * Two days are only half of a date & time range, so completing them carries the tabs on to the
   * times pane - the bottom sheet's version of the desktop panel showing both at once. Once only:
   * after that the tabs stay where they are put, so going back to correct the days is never
   * interrupted.
   */
  protected handleRangeSelect(range: { start: Date | null; end: Date | null }) {
    this.rangeInput.selectCalendarRange(range);

    if (range.start === null || range.end === null || this.paneAdvanceSpent()) {
      return;
    }

    this.paneAdvanceSpent.set(true);
    this.showPane('times');
  }

  protected setActivePane(pane: unknown) {
    this.paneAdvanceSpent.set(true);
    this.showPane(PANE_ORDER.find((candidate) => candidate === pane) ?? 'dates');
  }

  public focus(options?: FocusOptions) {
    this.rangeInput.focus(options);
  }

  private showPane(next: DateTimeRangePane) {
    const current = this.activePane();

    if (next === current) {
      return;
    }

    this.paneNav.set(PANE_ORDER.indexOf(next) > PANE_ORDER.indexOf(current) ? 'forward' : 'backward');
    this.activePane.set(next);
  }
}

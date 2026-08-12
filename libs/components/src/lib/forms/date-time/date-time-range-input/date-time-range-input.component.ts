import {
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { injectTimePickerLabels } from '../../../time-picker/time-picker-labels';
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

/** Which pane the bottom-sheet tabs show; the desktop panel renders all three side by side. */
type DateTimeRangePane = 'dates' | 'start' | 'end';

const PANE_ORDER: readonly DateTimeRangePane[] = ['dates', 'start', 'end'];

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
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-time-range-input',
    role: 'group',
    '[attr.aria-labelledby]': 'rangeInput.labelId()',
  },
})
export class DateTimeRangeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private timePickerLabels = injectTimePickerLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected rangeInput = inject(DateTimeRangeInputDirective);

  public startAriaLabel = input<string | null>(null);
  public endAriaLabel = input<string | null>(null);
  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: numberAttribute });
  public secondStep = input(1, { transform: numberAttribute });
  /** Headings of the two time panes, and their tab labels in the bottom sheet. */
  public datesTabLabel = input<string | null>(null);
  public startTimeLabel = input<string | null>(null);
  public endTimeLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `startAriaLabel`, else the domain's label set. */
  protected resolvedStartAriaLabel = computed(() => this.startAriaLabel() ?? this.dateTimeLabels().startDateTime);

  /** The string in effect: this instance's `endAriaLabel`, else the domain's label set. */
  protected resolvedEndAriaLabel = computed(() => this.endAriaLabel() ?? this.dateTimeLabels().endDateTime);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openDateTimePicker,
  );

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDateTimeRange);

  /** The string in effect: this instance's `datesTabLabel`, else the domain's label set. */
  protected resolvedDatesTabLabel = computed(() => this.datesTabLabel() ?? this.dateTimeLabels().datesTab);

  /**
   * The tab strings in effect. The two time headings belong to the time range picker, so their
   * fallbacks come from `TIME_PICKER_LABELS` - the tabs name the same two panes it renders.
   */
  protected resolvedStartTimeLabel = computed(() => this.startTimeLabel() ?? this.timePickerLabels().startTime);

  protected resolvedEndTimeLabel = computed(() => this.endTimeLabel() ?? this.timePickerLabels().endTime);

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

  constructor() {
    // every picker open starts back on the calendar pane, without a slide
    effect(() => {
      if (this.rangeInput.pickerOpen()) {
        this.activePane.set('dates');
        this.paneNav.set(null);
      }
    });
  }

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.rangeInput.clearRange();
  }

  protected setActivePane(pane: unknown) {
    const next = PANE_ORDER.find((candidate) => candidate === pane) ?? 'dates';
    const current = this.activePane();

    if (next === current) {
      return;
    }

    this.paneNav.set(PANE_ORDER.indexOf(next) > PANE_ORDER.indexOf(current) ? 'forward' : 'backward');
    this.activePane.set(next);
  }
}

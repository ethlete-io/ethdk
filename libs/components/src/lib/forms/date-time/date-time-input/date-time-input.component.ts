import { Component, ViewEncapsulation, booleanAttribute, computed, effect, inject, input, signal } from '@angular/core';
import { positiveIntegerAttribute } from '../../../internals/number-attributes';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS } from '../../../time-picker';
import { InputMaskDirective } from '../../masked-input/headless';
import { SegmentedButtonComponent, SegmentedButtonGroupComponent } from '../../selection-list/segmented-button-group';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimePickerPanesDirective } from '../internals/date-time-panes.directive';
import { DateTimeInputDirective, DateTimeInputFieldDirective } from './headless';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../forms/date-time/date-time-labels';
import { ControlSuffixDirective } from '../../form-field/partials';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

@Component({
  selector: 'et-date-time-input',
  templateUrl: './date-time-input.component.html',
  styleUrl: './date-time-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ControlSuffixDirective,
    ...CALENDAR_IMPORTS,
    ...TIME_PICKER_IMPORTS,
    DateTimeInputFieldDirective,
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
      directive: DateTimeInputDirective,
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
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-time-input',
  },
})
export class DateTimeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected dateTimeInput = inject(DateTimeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: positiveIntegerAttribute });
  public secondStep = input(1, { transform: positiveIntegerAttribute });
  /** Labels of the pane tabs shown when the picker mounts as a bottom sheet. */
  public dateTabLabel = input<string | null>(null);
  public timeTabLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openDateTimePicker,
  );

  protected resolvedDateTabLabel = computed(() => this.dateTabLabel() ?? this.dateTimeLabels().dateTab);

  protected resolvedTimeTabLabel = computed(() => this.timeTabLabel() ?? this.dateTimeLabels().timeTab);

  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDateTime);

  /**
   * The second reading shown under the field: the zone the field is in, and the same moment in the
   * reader's own zone. `null` whenever the two agree.
   */
  protected localReadingText = computed(() => {
    const reading = this.dateTimeInput.localReading();
    const timeZone = this.dateTimeInput.resolvedTimeZoneLabel();

    if (reading === null || timeZone === null) {
      return null;
    }

    return this.dateTimeLabels().timeZoneReading(timeZone, reading);
  });

  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.dateTimeInput.hasValue() &&
      (this.dateTimeInput.focused() || this.dateTimeInput.pickerOpen()) &&
      this.dateTimeInput.interactive(),
  );

  protected activePane = signal<'date' | 'time'>('date');

  /**
   * Direction of the last pane switch. `null` while untouched, so opening the picker does not
   * animate.
   */
  protected paneNav = signal<'forward' | 'backward' | null>(null);

  private paneAdvanceSpent = signal(false);

  constructor() {
    effect(() => {
      if (this.dateTimeInput.pickerOpen()) {
        this.activePane.set('date');
        this.paneNav.set(null);
        this.paneAdvanceSpent.set(false);
      }
    });
  }

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.dateTimeInput.clearValue();
  }

  /**
   * The first day picked carries the tabs on to the time pane. Once only: after that the tabs stay
   * where they are put.
   */
  protected handleDateSelect(date: Date | null) {
    this.dateTimeInput.selectDate(date);

    if (date === null || this.paneAdvanceSpent()) {
      return;
    }

    this.paneAdvanceSpent.set(true);
    this.showPane('time');
  }

  protected setActivePane(pane: unknown) {
    this.paneAdvanceSpent.set(true);
    this.showPane(pane === 'time' ? 'time' : 'date');
  }

  public focus(options?: FocusOptions) {
    this.dateTimeInput.focus(options);
  }

  private showPane(next: 'date' | 'time') {
    if (next === this.activePane()) {
      return;
    }

    this.paneNav.set(next === 'time' ? 'forward' : 'backward');
    this.activePane.set(next);
  }
}

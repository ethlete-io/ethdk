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
    class: 'et-date-time-input',
  },
})
export class DateTimeInputComponent {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected dateTimeInput = inject(DateTimeInputDirective);

  public pickerTriggerLabel = input<string | null>(null);
  public dialogLabel = input<string | null>(null);
  public minuteStep = input(5, { transform: numberAttribute });
  public secondStep = input(1, { transform: numberAttribute });
  /** Labels of the pane tabs shown when the picker mounts as a bottom sheet. */
  public dateTabLabel = input<string | null>(null);
  public timeTabLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `pickerTriggerLabel`, else the domain's label set. */
  protected resolvedPickerTriggerLabel = computed(
    () => this.pickerTriggerLabel() ?? this.dateTimeLabels().openDateTimePicker,
  );

  /** The string in effect: this instance's `dateTabLabel`, else the domain's label set. */
  protected resolvedDateTabLabel = computed(() => this.dateTabLabel() ?? this.dateTimeLabels().dateTab);

  /** The string in effect: this instance's `timeTabLabel`, else the domain's label set. */
  protected resolvedTimeTabLabel = computed(() => this.timeTabLabel() ?? this.dateTimeLabels().timeTab);

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDateTime);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the select's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.dateTimeInput.hasValue() &&
      (this.dateTimeInput.focused() || this.dateTimeInput.pickerOpen()) &&
      this.dateTimeInput.interactive(),
  );

  /** Which pane the bottom-sheet tabs show (both panes render side by side on desktop). */
  protected activePane = signal<'date' | 'time'>('date');

  /**
   * Direction of the last pane switch - the incoming pane slides in from the
   * travel direction, like the calendar's month navigation. `null` while
   * untouched, so opening the picker does not animate.
   */
  protected paneNav = signal<'forward' | 'backward' | null>(null);

  constructor() {
    // every picker open starts back on the calendar pane, without a slide
    effect(() => {
      if (this.dateTimeInput.pickerOpen()) {
        this.activePane.set('date');
        this.paneNav.set(null);
      }
    });
  }

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.dateTimeInput.clearValue();
  }

  protected setActivePane(pane: unknown) {
    const next = pane === 'time' ? 'time' : 'date';

    if (next === this.activePane()) {
      return;
    }

    this.paneNav.set(next === 'time' ? 'forward' : 'backward');
    this.activePane.set(next);
  }
}

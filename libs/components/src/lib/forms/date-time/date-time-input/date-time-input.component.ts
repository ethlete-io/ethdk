import { Component, ViewEncapsulation, effect, inject, input, signal } from '@angular/core';
import { setHours, setMinutes, setSeconds } from 'date-fns';
import { CALENDAR_IMPORTS } from '../../../calendar';
import { CALENDAR_ICON, IconDirective, provideIcons } from '../../../icon';
import { TIME_PICKER_IMPORTS, TimePickerDirective } from '../../../time-picker';
import { SegmentedButtonComponent, SegmentedButtonGroupComponent } from '../../selection-list/segmented-button-group';
import { DatePickerPanelComponent } from '../date-picker-panel.component';
import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimeInputPanesDirective } from './date-time-input-panes.directive';
import { DateTimeInputDirective, DateTimeInputFieldDirective } from './headless';

@Component({
  selector: 'et-date-time-input',
  templateUrl: './date-time-input.component.html',
  styleUrl: './date-time-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...CALENDAR_IMPORTS,
    ...TIME_PICKER_IMPORTS,
    DateTimeInputFieldDirective,
    DatePickerSurfaceDirective,
    DatePickerTriggerDirective,
    DatePickerPanelComponent,
    DateTimeInputPanesDirective,
    SegmentedButtonGroupComponent,
    SegmentedButtonComponent,
    IconDirective,
  ],
  providers: [provideIcons(CALENDAR_ICON)],
  hostDirectives: [
    {
      directive: DateTimeInputDirective,
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
        'valueFormat',
        'displayFormat',
        'locale',
        'minDate',
        'maxDate',
        'dateFilter',
        'pickerOpen',
      ],
      outputs: ['valueChange', 'touchedChange', 'pickerOpenChange'],
    },
  ],
  host: {
    class: 'et-date-time-input',
  },
})
export class DateTimeInputComponent {
  protected dateTimeInput = inject(DateTimeInputDirective);

  public pickerTriggerLabel = input('Open date & time picker');
  public minuteStep = input(5);
  public secondStep = input(1);
  /** Labels of the pane tabs shown when the picker mounts as a bottom sheet. */
  public dateTabLabel = input('Date');
  public timeTabLabel = input('Time');

  /** Which pane the bottom-sheet tabs show (both panes render side by side on desktop). */
  protected activePane = signal<'date' | 'time'>('date');

  /**
   * Direction of the last pane switch — the incoming pane slides in from the
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

  protected setActivePane(pane: unknown) {
    const next = pane === 'time' ? 'time' : 'date';

    if (next === this.activePane()) {
      return;
    }

    this.paneNav.set(next === 'time' ? 'forward' : 'backward');
    this.activePane.set(next);
  }

  /**
   * A first pick completes the day with the time the picker's columns visibly
   * anchor to (now, snapped to the steps) instead of the headless midnight
   * default — the columns must not jump away from what they were showing.
   */
  protected completeDatePick(day: Date | null, timePicker: TimePickerDirective) {
    if (day === null || this.dateTimeInput.dateTime() !== null) {
      this.dateTimeInput.selectDate(day);

      return;
    }

    const anchor = timePicker.anchorTime();

    this.dateTimeInput.selectTime(
      setSeconds(setMinutes(setHours(day, anchor.getHours()), anchor.getMinutes()), anchor.getSeconds()),
    );
  }
}

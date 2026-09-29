import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { de } from 'date-fns/locale';
import {
  DATE_FORMAT,
  DATE_INPUT_ERROR_CODES,
  DATE_INPUT_IMPORTS,
  DATE_LOCALE,
  DATE_PICKER_HOST,
  DATE_TIME_INPUT_ERROR_CODES,
  DATE_TIME_INPUT_IMPORTS,
  DATE_TIME_LABELS,
  DateInputComponent,
  DateInputDirective,
  DateInputFieldDirective,
  DatePickerPanelComponent,
  DatePickerSurfaceDirective,
  DatePickerTriggerDirective,
  DateTimeInputComponent,
  DateTimeInputDirective,
  DateTimeInputFieldDirective,
  DEFAULT_DATE_TIME_LABELS,
  DURATION_INPUT_ERROR_CODES,
  DURATION_INPUT_IMPORTS,
  DurationInputComponent,
  DurationInputDirective,
  DurationInputFieldDirective,
  deriveDurationFormatSpec,
  FORM_FIELD_IMPORTS,
  formatDuration,
  injectDateFormat,
  injectDateLocale,
  injectDateTimeLabels,
  injectTimeFormat,
  parseDuration,
  provideDateFormat,
  provideDateLocale,
  provideDateTimeLabels,
  provideOverlay,
  provideTimeFormat,
  TIME_FORMAT,
  TIME_INPUT_ERROR_CODES,
  TIME_INPUT_IMPORTS,
  TimeInputComponent,
  TimeInputDirective,
  TimeInputFieldDirective,
  UNIT_MS,
} from '../index';
import { minuteOfDay, tapRing, timeRing } from '../lib/time-picker/testing/time-picker-driver';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

@Component({
  selector: 'et-scenario-booking',
  imports: [DATE_INPUT_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>Arrival</et-label>
      <et-date-input
        [formField]="booking.arrival"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [startAt]="startAt"
        [clearable]="clearable()"
        valueFormat="yyyy-MM-dd"
        displayFormat="dd.MM.yyyy"
        parseErrorMessage="Use dd.mm.yyyy"
        pickerTriggerLabel="Pick arrival"
        dialogLabel="Arrival calendar"
      />
    </et-form-field>
  `,
})
class BookingComponent {
  model = signal<{ arrival: string | null }>({ arrival: null });
  booking = form(this.model, (path) => required(path.arrival, { message: 'Pick an arrival day' }));
  minDate = signal<Date | null>(null);
  maxDate = signal<Date | null>(null);
  clearable = signal(true);
  startAt = new Date(2026, 6, 1);
  input = viewChild.required(DateInputComponent);
}

@Component({
  selector: 'et-scenario-month-list',
  template: `
    @for (month of months; track month) {
      <button (click)="pick(month)" class="month-option" type="button">{{ month }}</button>
    }
    <button (click)="host.closePicker()" class="month-cancel" type="button">Cancel</button>
  `,
})
class MonthListComponent {
  host = inject(DATE_PICKER_HOST);
  input = inject(DateInputDirective);
  months = [1, 2, 3];

  pick(month: number) {
    this.input.selectDate(new Date(2027, month - 1, 15));
  }
}

@Component({
  selector: 'et-scenario-billing-month',
  imports: [
    DateInputDirective,
    DateInputFieldDirective,
    DatePickerTriggerDirective,
    DatePickerSurfaceDirective,
    DatePickerPanelComponent,
    MonthListComponent,
  ],
  template: `
    <div [(value)]="month" [disabled]="disabled()" etDateInput precision="month" valueFormat="yyyy-MM-dd">
      <input class="month-field" etDateInputField />
      <button class="month-trigger" etDatePickerTrigger>open</button>
      <ng-template etDatePickerSurface let-close="close">
        <et-date-picker-panel dialogLabel="Billing month">
          <et-scenario-month-list />
          <button (click)="close()" class="month-close" type="button">Close</button>
        </et-date-picker-panel>
      </ng-template>
    </div>
  `,
})
class BillingMonthComponent {
  month = signal<string | null>(null);
  disabled = signal(false);
  control = viewChild.required(DateInputDirective);
  field = viewChild.required(DateInputFieldDirective);
  trigger = viewChild.required(DatePickerTriggerDirective);
  surface = viewChild.required(DatePickerSurfaceDirective);
}

@Component({
  selector: 'et-scenario-alarm',
  imports: [TIME_INPUT_IMPORTS],
  template: `
    <et-time-input
      [(value)]="alarm"
      [minTime]="minTime"
      [readonly]="readonly()"
      aria-label="Alarm"
      displayFormat="HH:mm"
    />
  `,
})
class AlarmComponent {
  alarm = signal<string | null>(null);
  readonly = signal(false);
  minTime = new Date(2000, 0, 1, 6, 0);
  input = viewChild.required(TimeInputComponent);
  control = viewChild.required(TimeInputDirective);
}

@Component({
  selector: 'et-scenario-headless-alarm',
  imports: [TimeInputDirective, TimeInputFieldDirective],
  template: `
    <div [(value)]="alarm" etTimeInput displayFormat="HH:mm">
      <input class="alarm-field" etTimeInputField />
    </div>
  `,
})
class HeadlessAlarmComponent {
  alarm = signal<string | null>('07:15');
  field = viewChild.required(TimeInputFieldDirective);
}

@Component({
  selector: 'et-scenario-meeting',
  imports: [DATE_TIME_INPUT_IMPORTS],
  template: `
    <et-date-time-input
      [(value)]="startsAt"
      [startAt]="startAt"
      [timeZone]="timeZone()"
      aria-label="Starts at"
      valueFormat="yyyy-MM-dd'T'HH:mm"
      displayFormat="dd.MM.yyyy HH:mm"
    />
  `,
})
class MeetingComponent {
  startsAt = signal<string | null>(null);
  timeZone = signal<string | null>(null);
  startAt = new Date(2026, 6, 1);
  input = viewChild.required(DateTimeInputComponent);
  control = viewChild.required(DateTimeInputDirective);
}

@Component({
  selector: 'et-scenario-headless-meeting',
  imports: [DateTimeInputDirective, DateTimeInputFieldDirective],
  template: `
    <div [(value)]="startsAt" etDateTimeInput displayFormat="dd.MM.yyyy HH:mm" valueFormat="yyyy-MM-dd'T'HH:mm">
      <input class="meeting-field" etDateTimeInputField />
    </div>
  `,
})
class HeadlessMeetingComponent {
  startsAt = signal<string | null>(null);
  field = viewChild.required(DateTimeInputFieldDirective);
}

@Component({
  selector: 'et-scenario-lap',
  imports: [DURATION_INPUT_IMPORTS, DurationInputDirective, DurationInputFieldDirective],
  template: `
    <et-duration-input [(value)]="lap" aria-label="Lap time" durationFormat="mm:ss" />
    <div [(value)]="plank" etDurationInput durationFormat="h:mm:ss">
      <input class="plank-field" etDurationInputField />
    </div>
  `,
})
class LapComponent {
  lap = signal<number | null>(null);
  plank = signal<number | null>(90 * UNIT_MS.m);
  input = viewChild.required(DurationInputComponent);
  field = viewChild.required(DurationInputFieldDirective);
}

@Component({
  selector: 'et-scenario-stray-date-field',
  imports: [DateInputFieldDirective],
  template: '<input etDateInputField />',
})
class StrayDateFieldComponent {}

@Component({
  selector: 'et-scenario-stray-trigger',
  imports: [DatePickerTriggerDirective],
  template: '<button etDatePickerTrigger>open</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-surface',
  imports: [DatePickerSurfaceDirective],
  template: '<ng-template etDatePickerSurface>panel</ng-template>',
})
class StraySurfaceComponent {}

@Component({
  selector: 'et-scenario-stray-time-field',
  imports: [TimeInputFieldDirective],
  template: '<input etTimeInputField />',
})
class StrayTimeFieldComponent {}

@Component({
  selector: 'et-scenario-stray-date-time-field',
  imports: [DateTimeInputFieldDirective],
  template: '<input etDateTimeInputField />',
})
class StrayDateTimeFieldComponent {}

@Component({
  selector: 'et-scenario-stray-duration-field',
  imports: [DurationInputFieldDirective],
  template: '<input etDurationInputField />',
})
class StrayDurationFieldComponent {}

@Component({
  selector: 'et-scenario-localized-booking',
  imports: [DATE_INPUT_IMPORTS, TIME_INPUT_IMPORTS],
  template: `
    <et-date-input [(value)]="day" [startAt]="startAt" aria-label="Tag" />
    <et-time-input [(value)]="time" aria-label="Uhrzeit" />
  `,
})
class LocalizedBookingComponent {
  day = signal<string | null>(null);
  time = signal<string | null>(null);
  startAt = new Date(2026, 6, 1);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const type = (s: Scenario, field: HTMLInputElement, text: string) => {
  field.focus();
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const typeAndBlur = (s: Scenario, field: HTMLInputElement, text: string) => {
  type(s, field, text);
  field.blur();
  s.tick();
};

const dayCell = (label: string) => {
  const cell = Array.from(document.querySelectorAll<HTMLButtonElement>('.et-calendar-cell')).find(
    (candidate) => candidate.textContent?.trim() === label && !candidate.hasAttribute('data-outside-month'),
  );

  if (!cell) throw new Error(`no day ${label}`);

  return cell;
};

const takeErrorPayload = (s: Scenario) => {
  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  expect(index).not.toBe(-1);

  return s.errors.splice(index, 1)[0]?.error as { element: Node };
};

describe('forms date-time scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('parses typed dates into a string form value, reformats on Enter and reports unparseable text', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BookingComponent);
    const host = fixture.nativeElement as HTMLElement;
    const booking = fixture.componentInstance.booking;

    s.flush();

    const field = query<HTMLInputElement>('input', host);

    expect(booking.arrival().invalid()).toBe(true);
    expect(field.getAttribute('aria-required')).toBe('true');

    typeAndBlur(s, field, '16.07.2026');
    expect(fixture.componentInstance.model().arrival).toBe('2026-07-16');
    expect(booking.arrival().valid()).toBe(true);
    expect(field.value).toBe('16.07.2026');

    type(s, field, '1.8.2026');
    s.keydown('Enter', field);
    expect(fixture.componentInstance.model().arrival).toBe('2026-08-01');
    expect(field.value).toBe('01.08.2026');
    field.blur();
    s.tick();

    typeAndBlur(s, field, '31.02.2026');
    s.flush();
    expect(fixture.componentInstance.model().arrival).toBeNull();
    expect(field.value).toBe('31.02.2026');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.componentInstance.input()).toBeInstanceOf(DateInputComponent);
    expect(query('et-form-error', host).textContent).toContain('Use dd.mm.yyyy');
    expect(query('et-form-error', host).textContent).not.toContain('Pick an arrival day');

    typeAndBlur(s, field, '');
    s.flush();
    expect(query('et-form-error', host).textContent).toContain('Pick an arrival day');
    expect(fixture.componentInstance.model().arrival).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(true);
  });

  it('marks the bound signal-form field touched when the user leaves the field', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BookingComponent);

    s.flush();

    typeAndBlur(s, query<HTMLInputElement>('input', fixture.nativeElement as HTMLElement), '16.07.2026');

    expect(fixture.componentInstance.booking.arrival().touched()).toBe(true);
  });

  it('shows a value written into the form model in the display format', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BookingComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.model.set({ arrival: '2026-12-24' });
    s.flush();

    expect(query<HTMLInputElement>('input', host).value).toBe('24.12.2026');

    fixture.componentInstance.model.set({ arrival: null });
    s.flush();
    expect(query<HTMLInputElement>('input', host).value).toBe('');
  });

  it('opens the calendar from the trigger, blocks days outside min and max, and commits a picked day', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BookingComponent);
    const host = fixture.nativeElement as HTMLElement;
    const booking = fixture.componentInstance;

    booking.minDate.set(new Date(2026, 6, 10));
    booking.maxDate.set(new Date(2026, 6, 20));
    s.flush();

    const trigger = query<HTMLButtonElement>('.et-input-picker-trigger', host);

    expect(trigger.getAttribute('aria-label')).toBe('Pick arrival');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    s.flush();

    const panel = query('et-date-picker-panel');

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Arrival calendar');
    expect(dayCell('9').getAttribute('aria-disabled')).toBe('true');
    expect(dayCell('21').getAttribute('aria-disabled')).toBe('true');
    expect(dayCell('15').hasAttribute('aria-disabled')).toBe(false);

    dayCell('9').click();
    s.flush();
    expect(booking.model().arrival).toBeNull();

    dayCell('15').click();
    s.flush();

    expect(booking.model().arrival).toBe('2026-07-15');
    expect(query<HTMLInputElement>('input', host).value).toBe('15.07.2026');
    expect(document.querySelector('et-date-picker-panel')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the calendar with Alt+ArrowDown, closes it on Escape, and clears through the clear button', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BookingComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.model.set({ arrival: '2026-07-16' });
    s.flush();

    const field = query<HTMLInputElement>('input', host);

    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    s.flush();
    expect(fixture.componentInstance.input()).toBeInstanceOf(DateInputComponent);
    expect(document.querySelector('et-date-picker-panel')).not.toBeNull();
    expect(dayCell('16').getAttribute('aria-selected')).toBe('true');

    s.keydown('Escape');
    s.flush();
    expect(document.querySelector('et-date-picker-panel')).toBeNull();

    field.focus();
    s.tick();

    const clear = query<HTMLButtonElement>('.et-input-clear', host);

    expect(clear.getAttribute('aria-label')).toBeTruthy();
    clear.click();
    s.flush();

    expect(fixture.componentInstance.model().arrival).toBeNull();
    expect(field.value).toBe('');

    fixture.componentInstance.clearable.set(false);
    typeAndBlur(s, field, '16.07.2026');
    field.focus();
    s.flush();
    expect(host.querySelector('.et-input-clear')).toBeNull();
    field.blur();
    s.tick();
  });

  it('composes a headless month picker from the trigger, surface and panel with a custom list', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BillingMonthComponent);
    const host = fixture.nativeElement as HTMLElement;
    const billing = fixture.componentInstance;

    s.flush();

    expect(billing.control().effectiveDisplayFormat()).toBe('MM/yyyy');
    expect(billing.field().elementRef.nativeElement).toBe(query('.month-field', host));
    expect(billing.trigger().elementRef.nativeElement).toBe(query('.month-trigger', host));
    expect(billing.surface().templateRef).toBeTruthy();

    typeAndBlur(s, query<HTMLInputElement>('.month-field', host), '03/2026');
    expect(billing.month()).toBe('2026-03-01');

    query('.month-trigger', host).click();
    s.flush();
    expect(query('et-date-picker-panel').getAttribute('aria-label')).toBe('Billing month');

    query('.month-cancel').click();
    s.flush();
    expect(billing.control().pickerOpen()).toBe(false);

    query('.month-trigger', host).click();
    s.flush();
    query('.month-close').click();
    s.flush();
    expect(document.querySelector('et-date-picker-panel')).toBeNull();

    query('.month-trigger', host).click();
    s.flush();
    query<HTMLButtonElement>('.month-option:nth-of-type(2)').click();
    s.flush();

    expect(billing.month()).toBe('2027-02-01');
    expect(query<HTMLInputElement>('.month-field', host).value).toBe('02/2027');
    expect(document.querySelector('et-date-picker-panel')).toBeNull();

    billing.disabled.set(true);
    s.tick();
    expect(query<HTMLButtonElement>('.month-trigger', host).disabled).toBe(true);
    billing.control().openPicker();
    s.flush();
    expect(document.querySelector('et-date-picker-panel')).toBeNull();
  });

  it('takes a typed time leniently and picks a time above the minimum from the ring', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AlarmComponent);
    const host = fixture.nativeElement as HTMLElement;
    const alarm = fixture.componentInstance;

    s.flush();

    const field = query<HTMLInputElement>('input', host);

    typeAndBlur(s, field, '7:05');
    expect(alarm.alarm()).toBe('07:05');
    expect(field.value).toBe('07:05');

    typeAndBlur(s, field, '25:99');
    expect(alarm.alarm()).toBeNull();
    expect(alarm.control().parseError()).toBe(true);
    expect(alarm.control().resolvedParseErrorMessage()).toBe(DEFAULT_DATE_TIME_LABELS.invalidTime);

    query('.et-input-picker-trigger', host).click();
    s.flush();

    expect(alarm.input()).toBeInstanceOf(TimeInputComponent);
    expect(document.querySelectorAll('path.et-time-picker-blocked')).toHaveLength(1);

    tapRing(timeRing(), minuteOfDay(5));
    s.flush();
    expect(alarm.alarm()).toBeNull();

    tapRing(timeRing(), minuteOfDay(9, 30));
    s.flush();

    expect(alarm.alarm()).toBe('09:30');
    expect(document.querySelector('et-date-picker-panel')).not.toBeNull();

    alarm.control().closePicker();
    s.flush();
    expect(field.value).toBe('09:30');

    alarm.readonly.set(true);
    typeAndBlur(s, field, '10:00');
    expect(alarm.alarm()).toBe('09:30');
  });

  it('shows and commits a time through the bare headless field', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessAlarmComponent);
    const field = query<HTMLInputElement>('.alarm-field', fixture.nativeElement as HTMLElement);

    s.flush();

    expect(field.value).toBe('07:15');
    expect(fixture.componentInstance.field().elementRef.nativeElement).toBe(field);

    typeAndBlur(s, field, '18:45');
    expect(fixture.componentInstance.alarm()).toBe('18:45');
  });

  it('builds a date-time value from a typed entry and from a day then time picked in the panes', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MeetingComponent);
    const host = fixture.nativeElement as HTMLElement;
    const meeting = fixture.componentInstance;

    s.flush();

    const field = query<HTMLInputElement>('input', host);

    typeAndBlur(s, field, '16.07.2026 14:30');
    expect(meeting.startsAt()).toBe('2026-07-16T14:30');

    meeting.control().clearValue();
    s.flush();
    expect(meeting.startsAt()).toBeNull();

    query('.et-input-picker-trigger', host).click();
    s.flush();

    expect(meeting.input()).toBeInstanceOf(DateTimeInputComponent);
    expect(query('.et-date-time-input-panel-panes').dataset['activePane']).toBe('date');

    dayCell('20').click();
    s.flush();

    expect(meeting.startsAt()).toBeNull();
    expect(query('.et-date-time-input-panel-panes').dataset['activePane']).toBe('time');

    tapRing(timeRing(), minuteOfDay(8, 45));
    s.flush();
    expect(meeting.startsAt()).toBe('2026-07-20T08:45');

    meeting.control().closePicker();
    s.flush();
    expect(field.value).toBe('20.07.2026 08:45');
  });

  it('tears down cleanly when destroyed with the picker open', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MeetingComponent);

    s.flush();
    fixture.componentInstance.control().openPicker();
    s.flush();

    expect(document.querySelector('et-date-picker-panel')).not.toBeNull();
    fixture.destroy();
  });

  it('commits a date-time through the bare headless field', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessMeetingComponent);
    const field = query<HTMLInputElement>('.meeting-field', fixture.nativeElement as HTMLElement);

    s.flush();

    expect(fixture.componentInstance.field().elementRef.nativeElement).toBe(field);
    typeAndBlur(s, field, '01.02.2027 09:00');
    expect(fixture.componentInstance.startsAt()).toBe('2027-02-01T09:00');
  });

  it('parses durations leniently into milliseconds and formats them in the segment layout', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LapComponent);
    const host = fixture.nativeElement as HTMLElement;
    const lap = fixture.componentInstance;

    s.flush();

    const lapField = query<HTMLInputElement>('et-duration-input input', host);
    const plankField = query<HTMLInputElement>('.plank-field', host);

    expect(plankField.value).toBe('1:30:00');
    expect(lap.field().elementRef.nativeElement).toBe(plankField);

    typeAndBlur(s, lapField, '130');
    expect(lap.lap()).toBe(UNIT_MS.m + 30 * UNIT_MS.s);
    expect(lapField.value).toBe('01:30');

    type(s, lapField, '2:05');
    s.keydown('Enter', lapField);
    expect(lap.lap()).toBe(2 * UNIT_MS.m + 5 * UNIT_MS.s);
    expect(lapField.value).toBe('02:05');
    lapField.blur();
    s.tick();

    typeAndBlur(s, lapField, 'soon');
    expect(lap.lap()).toBeNull();
    expect(lapField.value).toBe('soon');
    expect(lapField.getAttribute('aria-invalid')).toBe('true');

    typeAndBlur(s, plankField, '45:00');
    expect(lap.plank()).toBe(45 * UNIT_MS.m);

    lapField.focus();
    s.tick();
    lap.lap.set(UNIT_MS.m);
    s.tick();
    query<HTMLButtonElement>('.et-duration-input-clear', host).click();
    s.flush();
    expect(lap.lap()).toBeNull();
    expect(lap.input()).toBeInstanceOf(DurationInputComponent);
  });

  it('formats and parses durations outside a control with a derived spec', () => {
    scenario();

    const spec = deriveDurationFormatSpec('hh:mm:ss.SSS');

    expect(spec.segments.map((segment) => segment.unit)).toEqual(['h', 'm', 's', 'ms']);
    expect(formatDuration(UNIT_MS.h + 2 * UNIT_MS.m + 3 * UNIT_MS.s + 4, spec)).toBe('01:02:03.004');
    expect(formatDuration(null, spec)).toBe('');
    expect(parseDuration('01:02:03.004', spec)).toBe(3_723_004);
    expect(parseDuration('abc', spec)).toBeNull();
  });

  it.each([
    [StrayDateFieldComponent, DATE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_INPUT, 'INPUT'],
    [StrayTriggerComponent, DATE_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_DATE_INPUT, 'BUTTON'],
    [StrayTimeFieldComponent, TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_TIME_INPUT, 'INPUT'],
    [StrayDateTimeFieldComponent, DATE_TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_TIME_INPUT, 'INPUT'],
    [StrayDurationFieldComponent, DURATION_INPUT_ERROR_CODES.FIELD_OUTSIDE_DURATION_INPUT, 'INPUT'],
  ])('throws ET%# when a picker part is placed outside its input', (component, code, tagName) => {
    const s = scenario();

    expect(() => TestBed.createComponent(component)).toThrow(`ET${code}`);
    s.flush();
    expect((takeErrorPayload(s).element as HTMLElement).tagName).toBe(tagName);
  });

  it('throws when a picker surface is placed outside a date input', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(StraySurfaceComponent)).toThrow(
      `ET${DATE_INPUT_ERROR_CODES.SURFACE_OUTSIDE_DATE_INPUT}`,
    );
    s.flush();
    expect(takeErrorPayload(s).element.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('reads the default formats, locale and labels', () => {
    const s = scenario();

    expect(s.run(injectDateFormat)).toBe(TestBed.inject(DATE_FORMAT));
    expect(s.run(injectTimeFormat)).toBe('HH:mm');
    expect(s.run(injectDateLocale)).toBeNull();
    expect(s.run(injectDateTimeLabels)().openCalendar).toBe(DEFAULT_DATE_TIME_LABELS.openCalendar);
  });
});

describe('forms date-time scenarios with app-wide formats, locale and labels', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideDateFormat('dd.MM.yyyy'),
      provideTimeFormat('HH:mm:ss'),
      provideDateLocale(de),
      provideDateTimeLabels({ openCalendar: 'Kalender öffnen', openTimePicker: 'Uhrzeit wählen' }),
    ],
  });

  it('writes both controls in the provided wire formats and renders them in the provided locale', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedBookingComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    expect(TestBed.inject(DATE_FORMAT)).toBe('dd.MM.yyyy');
    expect(TestBed.inject(TIME_FORMAT)).toBe('HH:mm:ss');
    expect(TestBed.inject(DATE_LOCALE)).toBe(de);
    expect(TestBed.inject(DATE_TIME_LABELS)).toEqual({
      openCalendar: 'Kalender öffnen',
      openTimePicker: 'Uhrzeit wählen',
    });
    expect(s.run(injectDateTimeLabels)().chooseDate).toBe(DEFAULT_DATE_TIME_LABELS.chooseDate);

    const [dayField, timeField] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));

    typeAndBlur(s, dayField!, '16.07.2026');
    expect(fixture.componentInstance.day()).toBe('16.07.2026');

    typeAndBlur(s, timeField!, '21:15');
    expect(fixture.componentInstance.time()).toBe('21:15:00');

    const triggers = host.querySelectorAll('.et-input-picker-trigger');

    expect(triggers[0]?.getAttribute('aria-label')).toBe('Kalender öffnen');
    expect(triggers[1]?.getAttribute('aria-label')).toBe('Uhrzeit wählen');

    (triggers[0] as HTMLButtonElement).click();
    s.flush();
    expect(query('.et-calendar').textContent).toContain('Juli');

    s.keydown('Escape');
    s.flush();
  });
});

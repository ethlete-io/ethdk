import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { de } from 'date-fns/locale';
import {
  minuteOfDay,
  ringHandle,
  ringNote,
  ringReadout,
  tapRing,
  timeRing,
} from '../lib/time-picker/testing/time-picker-driver';
import '../test-helpers';
import {
  DATE_RANGE_INPUT_ERROR_CODES,
  DATE_RANGE_INPUT_IMPORTS,
  DATE_TIME_RANGE_INPUT_ERROR_CODES,
  DATE_TIME_RANGE_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  dateRangeBounds,
  dateRangeOrder,
  DateRangeInputComponent,
  DateRangeInputDirective,
  DateRangeInputFieldDirective,
  DateRangeValue,
  dateTimeRangeBounds,
  DateTimeRangeInputComponent,
  DateTimeRangeInputDirective,
  DateTimeRangeInputFieldDirective,
  lastDaysPreset,
  lastMonthPreset,
  lastWeekPreset,
  nextDaysPreset,
  provideOverlay,
  thisMonthPreset,
  thisWeekPreset,
  thisYearPreset,
  TIME_RANGE_INPUT_ERROR_CODES,
  TIME_RANGE_INPUT_IMPORTS,
  timeRangeOrder,
  TimeRangeInputComponent,
  TimeRangeInputDirective,
  TimeRangeInputFieldDirective,
  todayPreset,
  yesterdayPreset,
} from '../index';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const PRESETS = [
  todayPreset(),
  yesterdayPreset(),
  lastDaysPreset(7),
  nextDaysPreset(3, { label: 'Coming days' }),
  thisWeekPreset(),
  lastWeekPreset(),
  thisMonthPreset(),
  lastMonthPreset(),
  thisYearPreset(),
];

@Component({
  selector: 'et-scenario-stay',
  imports: [DATE_RANGE_INPUT_IMPORTS, FormField],
  template: `
    <et-date-range-input
      [formField]="stayForm.stay"
      [presets]="presets"
      [locale]="locale()"
      [minDate]="minDate"
      [startAt]="startAt"
      aria-label="Stay"
      displayFormat="dd.MM.yyyy"
    />
  `,
})
class StayComponent {
  model = signal<{ stay: DateRangeValue }>({ stay: { start: null, end: null } });
  minDate = new Date(2026, 6, 5);
  stayForm = form(this.model, (path) => {
    dateRangeOrder(path.stay, { message: 'Check out after check in' });
    dateRangeBounds(path.stay, { min: this.minDate });
  });
  presets = PRESETS;
  locale = signal<typeof de | null>(null);
  startAt = new Date(2026, 6, 1);
  input = viewChild.required(DateRangeInputComponent);
  control = viewChild.required(DateRangeInputDirective);
}

@Component({
  selector: 'et-scenario-headless-stay',
  imports: [DateRangeInputDirective, DateRangeInputFieldDirective],
  template: `
    <div [(value)]="stay" etDateRangeInput displayFormat="dd.MM.yyyy">
      <input class="stay-start" etDateRangeInputField side="start" />
      <input class="stay-end" etDateRangeInputField side="end" />
    </div>
  `,
})
class HeadlessStayComponent {
  stay = signal<DateRangeValue>({ start: '2026-07-01', end: '2026-07-04' });
  fields = viewChild.required(DateRangeInputFieldDirective);
}

@Component({
  selector: 'et-scenario-shift',
  imports: [TIME_RANGE_INPUT_IMPORTS, FormField],
  template: `
    <et-time-range-input [formField]="shiftForm.shift" aria-label="Shift" displayFormat="HH:mm" />
    <div #breakRange="etTimeRangeInput" [(value)]="breakTime" etTimeRangeInput displayFormat="HH:mm">
      <input class="break-start" etTimeRangeInputField side="start" />
      <input class="break-end" etTimeRangeInputField side="end" />
    </div>
  `,
})
class ShiftComponent {
  model = signal<{ shift: DateRangeValue }>({ shift: { start: null, end: null } });
  shiftForm = form(this.model, (path) => timeRangeOrder(path.shift, { strict: true }));
  breakTime = signal<DateRangeValue>({ start: null, end: null });
  input = viewChild.required(TimeRangeInputComponent);
  breakControl = viewChild.required<TimeRangeInputDirective>('breakRange');
  breakField = viewChild.required(TimeRangeInputFieldDirective);
}

@Component({
  selector: 'et-scenario-event-window',
  imports: [DATE_TIME_RANGE_INPUT_IMPORTS, FormField],
  template: `
    <et-date-time-range-input
      [formField]="windowForm.window"
      [presets]="presets"
      [startAt]="startAt"
      aria-label="Event window"
      valueFormat="yyyy-MM-dd'T'HH:mm"
      displayFormat="dd.MM.yyyy HH:mm"
    />
    <div [(value)]="setup" etDateTimeRangeInput displayFormat="dd.MM.yyyy HH:mm" valueFormat="yyyy-MM-dd'T'HH:mm">
      <input class="setup-start" etDateTimeRangeInputField side="start" />
      <input class="setup-end" etDateTimeRangeInputField side="end" />
    </div>
  `,
})
class EventWindowComponent {
  model = signal<{ window: DateRangeValue }>({ window: { start: null, end: null } });
  windowForm = form(this.model, (path) =>
    dateTimeRangeBounds(path.window, {
      max: new Date(2026, 6, 31, 18, 0),
      valueFormat: "yyyy-MM-dd'T'HH:mm",
      message: 'Ends before the venue closes',
    }),
  );
  presets = [todayPreset()];
  setup = signal<DateRangeValue>({ start: null, end: null });
  startAt = new Date(2026, 6, 1);
  input = viewChild.required(DateTimeRangeInputComponent);
  control = viewChild.required(DateTimeRangeInputDirective);
  setupField = viewChild.required(DateTimeRangeInputFieldDirective);
}

@Component({
  selector: 'et-scenario-rota',
  imports: [FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS, DATE_TIME_RANGE_INPUT_IMPORTS],
  template: `
    <et-form-field class="rota-shift">
      <et-label>Shift</et-label>
      <et-time-range-input [(value)]="shift" displayFormat="HH:mm" />
    </et-form-field>
    <et-form-field class="rota-trip">
      <et-label>Trip</et-label>
      <et-date-time-range-input
        [(value)]="trip"
        [startAt]="startAt"
        valueFormat="yyyy-MM-dd'T'HH:mm"
        displayFormat="dd.MM.yyyy HH:mm"
      />
    </et-form-field>
  `,
})
class RotaComponent {
  shift = signal<DateRangeValue>({ start: null, end: null });
  trip = signal<DateRangeValue>({ start: null, end: null });
  startAt = new Date(2026, 6, 1);
}

@Component({
  selector: 'et-scenario-stray-date-range-field',
  imports: [DateRangeInputFieldDirective],
  template: '<input etDateRangeInputField side="start" />',
})
class StrayDateRangeFieldComponent {}

@Component({
  selector: 'et-scenario-stray-time-range-field',
  imports: [TimeRangeInputFieldDirective],
  template: '<input etTimeRangeInputField side="start" />',
})
class StrayTimeRangeFieldComponent {}

@Component({
  selector: 'et-scenario-stray-date-time-range-field',
  imports: [DateTimeRangeInputFieldDirective],
  template: '<input etDateTimeRangeInputField side="start" />',
})
class StrayDateTimeRangeFieldComponent {}

@Component({
  selector: 'et-scenario-duplicate-date-range-field',
  imports: [DateRangeInputDirective, DateRangeInputFieldDirective],
  template: `
    <div etDateRangeInput>
      <input etDateRangeInputField side="start" />
      <input etDateRangeInputField side="start" />
    </div>
  `,
})
class DuplicateDateRangeFieldComponent {}

@Component({
  selector: 'et-scenario-duplicate-time-range-field',
  imports: [TimeRangeInputDirective, TimeRangeInputFieldDirective],
  template: `
    <div etTimeRangeInput>
      <input etTimeRangeInputField side="end" />
      <input etTimeRangeInputField side="end" />
    </div>
  `,
})
class DuplicateTimeRangeFieldComponent {}

@Component({
  selector: 'et-scenario-duplicate-date-time-range-field',
  imports: [DateTimeRangeInputDirective, DateTimeRangeInputFieldDirective],
  template: `
    <div etDateTimeRangeInput>
      <input etDateTimeRangeInputField side="start" />
      <input etDateTimeRangeInputField side="start" />
    </div>
  `,
})
class DuplicateDateTimeRangeFieldComponent {}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const typeAndBlur = (s: Scenario, field: HTMLInputElement, text: string) => {
  field.focus();
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
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

const presetButton = (label: string) => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.et-date-range-preset')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!button) throw new Error(`no preset ${label}`);

  return button;
};

const useDesktopViewport = () => {
  const original = window.matchMedia;

  window.matchMedia = (media: string) => ({
    ...original(media),
    matches: media.includes('min-width') && !media.includes('max-width'),
  });
  onTestFinished(() => {
    window.matchMedia = original;
  });
};

const takeErrorPayload = (s: Scenario) => {
  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  expect(index).not.toBe(-1);

  return s.errors.splice(index, 1)[0]?.error as { element: HTMLElement };
};

describe('forms date-time range scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemesWithTailwind4(COLOR_THEMES)] });

  beforeEach(() => vi.setSystemTime(new Date(2026, 6, 15, 10, 30)));

  it('commits typed sides into the form value and validates order and the lower bound', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StayComponent);
    const host = fixture.nativeElement as HTMLElement;
    const stay = fixture.componentInstance;

    s.flush();

    const [start, end] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));

    typeAndBlur(s, start!, '20.07.2026');
    typeAndBlur(s, end!, '24.07.2026');

    expect(stay.model().stay).toEqual({ start: '2026-07-20', end: '2026-07-24' });
    expect(stay.stayForm.stay().valid()).toBe(true);

    typeAndBlur(s, end!, '18.07.2026');
    expect(
      stay.stayForm
        .stay()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Check out after check in']);

    typeAndBlur(s, start!, '01.07.2026');
    expect(
      stay.stayForm
        .stay()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['rangeMin']);

    typeAndBlur(s, start!, 'someday');
    expect(stay.model().stay).toEqual({ start: null, end: '2026-07-18' });
    expect(stay.control().parseError()).toBe(true);
    expect(start!.value).toBe('someday');
  });

  it('selects a range in the calendar and closes once both ends are picked', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StayComponent);
    const host = fixture.nativeElement as HTMLElement;
    const stay = fixture.componentInstance;

    s.flush();

    query('.et-input-picker-trigger', host).click();
    s.flush();

    expect(stay.input()).toBeInstanceOf(DateRangeInputComponent);
    expect(dayCell('4').getAttribute('aria-disabled')).toBe('true');

    dayCell('20').click();
    s.flush();
    expect(document.querySelector('et-date-picker-panel')).not.toBeNull();

    dayCell('24').click();
    s.flush();

    expect(stay.model().stay).toEqual({ start: '2026-07-20', end: '2026-07-24' });
    expect(document.querySelector('et-date-picker-panel')).toBeNull();

    const [start, end] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));

    expect(start!.value).toBe('20.07.2026');
    expect(end!.value).toBe('24.07.2026');
  });

  it.each([
    ['Today', { start: '2026-07-15', end: '2026-07-15' }],
    ['Yesterday', { start: '2026-07-14', end: '2026-07-14' }],
    ['Last 7 days', { start: '2026-07-09', end: '2026-07-15' }],
    ['Coming days', { start: '2026-07-16', end: '2026-07-18' }],
    ['This week', { start: '2026-07-12', end: '2026-07-18' }],
    ['Last week', { start: '2026-07-05', end: '2026-07-11' }],
    ['This month', { start: '2026-07-01', end: '2026-07-31' }],
    ['Last month', { start: '2026-06-01', end: '2026-06-30' }],
    ['This year', { start: '2026-01-01', end: '2026-12-31' }],
  ])('applies the %s preset relative to the current day and marks it pressed', (label, expected) => {
    const s = scenario();
    const fixture = TestBed.createComponent(StayComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    query('.et-input-picker-trigger', host).click();
    s.flush();

    expect(query('et-date-range-presets').getAttribute('role')).toBe('group');

    presetButton(label).click();
    s.flush();

    expect(fixture.componentInstance.model().stay).toEqual(expected);
    expect(document.querySelector('et-date-picker-panel')).toBeNull();

    query('.et-input-picker-trigger', host).click();
    s.flush();
    expect(presetButton(label).getAttribute('aria-pressed')).toBe('true');

    s.keydown('Escape');
    s.flush();
  });

  it('starts the week preset on the locale week start', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StayComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.locale.set(de);
    s.flush();

    query('.et-input-picker-trigger', host).click();
    s.flush();
    presetButton('This week').click();
    s.flush();

    expect(fixture.componentInstance.model().stay).toEqual({ start: '2026-07-13', end: '2026-07-19' });
  });

  it('shows and edits a range through the bare headless fields', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessStayComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const start = query<HTMLInputElement>('.stay-start', host);

    expect(fixture.componentInstance.fields().elementRef.nativeElement).toBe(start);
    expect(start.value).toBe('01.07.2026');
    expect(query<HTMLInputElement>('.stay-end', host).value).toBe('04.07.2026');

    typeAndBlur(s, query<HTMLInputElement>('.stay-end', host), '10.07.2026');
    expect(fixture.componentInstance.stay()).toEqual({ start: '2026-07-01', end: '2026-07-10' });
  });

  it('picks a time range from the ring and rejects an empty span with a strict order check', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShiftComponent);
    const host = fixture.nativeElement as HTMLElement;
    const shift = fixture.componentInstance;

    s.flush();

    query('et-time-range-input .et-input-picker-trigger', host).click();
    s.flush();

    expect(shift.input()).toBeInstanceOf(TimeRangeInputComponent);

    tapRing(timeRing(), minuteOfDay(9));
    s.flush();
    expect(shift.model().shift).toEqual({ start: '09:00', end: null });

    tapRing(timeRing(), minuteOfDay(17, 30));
    s.flush();
    expect(shift.model().shift).toEqual({ start: '09:00', end: '17:30' });
    expect(shift.shiftForm.shift().valid()).toBe(true);

    s.keydown('Escape');
    s.flush();

    const [, end] = Array.from(host.querySelectorAll<HTMLInputElement>('et-time-range-input input'));

    typeAndBlur(s, end!, '09:00');
    expect(
      shift.shiftForm
        .shift()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['rangeOrder']);

    typeAndBlur(s, query<HTMLInputElement>('.break-start', host), '12:00');
    typeAndBlur(s, query<HTMLInputElement>('.break-end', host), '12:45');
    expect(shift.breakTime()).toEqual({ start: '12:00', end: '12:45' });
    expect(shift.breakField().elementRef.nativeElement).toBe(query('.break-start', host));
    expect(shift.breakControl().value()).toEqual({ start: '12:00', end: '12:45' });
  });

  it('merges a calendar range with times picked per side and checks the upper bound', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EventWindowComponent);
    const host = fixture.nativeElement as HTMLElement;
    const event = fixture.componentInstance;

    s.flush();

    query('et-date-time-range-input .et-input-picker-trigger', host).click();
    s.flush();

    expect(event.input()).toBeInstanceOf(DateTimeRangeInputComponent);

    dayCell('20').click();
    s.flush();
    dayCell('24').click();
    s.flush();

    expect(event.model().window).toEqual({ start: null, end: null });
    expect(query('.et-date-time-range-input-panel-panes').dataset['activePane']).toBe('times');

    tapRing(timeRing(), minuteOfDay(9));
    s.flush();
    tapRing(timeRing(), minuteOfDay(17, 30));
    s.flush();

    expect(event.model().window).toEqual({ start: '2026-07-20T09:00', end: '2026-07-24T17:30' });
    expect(event.windowForm.window().valid()).toBe(true);

    presetButton('Today').click();
    s.flush();
    expect(event.model().window).toEqual({ start: '2026-07-15T00:00', end: '2026-07-15T23:59' });

    event.control().closePicker();
    s.flush();

    const [, end] = Array.from(host.querySelectorAll<HTMLInputElement>('et-date-time-range-input input'));

    typeAndBlur(s, end!, '31.07.2026 19:00');
    expect(
      event.windowForm
        .window()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Ends before the venue closes']);

    typeAndBlur(s, query<HTMLInputElement>('.setup-start', host), '14.07.2026 08:00');
    expect(event.setup()).toEqual({ start: '2026-07-14T08:00', end: null });
    expect(event.setupField().elementRef.nativeElement).toBe(query('.setup-start', host));
  });

  it('lets the focused field pick the active handle and moves focus to the end after the first tap', () => {
    useDesktopViewport();

    const s = scenario();
    const fixture = TestBed.createComponent(RotaComponent);
    const host = fixture.nativeElement as HTMLElement;
    const rota = fixture.componentInstance;

    s.flush();

    const [start, end] = Array.from(host.querySelectorAll<HTMLInputElement>('.rota-shift input'));

    end?.focus();
    query('.rota-shift .et-input-picker-trigger', host).click();
    s.flush();

    expect(ringHandle('end').hasAttribute('data-active')).toBe(true);
    expect(document.activeElement).toBe(end);

    start?.focus();
    s.flush();

    expect(ringHandle('start').hasAttribute('data-active')).toBe(true);

    tapRing(timeRing(), minuteOfDay(9));
    s.flush();

    expect(rota.shift()).toEqual({ start: '09:00', end: null });
    expect(document.activeElement).toBe(end);
    expect(ringHandle('end').hasAttribute('data-active')).toBe(true);

    tapRing(timeRing(), minuteOfDay(17, 30));
    s.flush();

    expect(rota.shift()).toEqual({ start: '09:00', end: '17:30' });
    expect(ringReadout()).toBe('8 h 30 min');

    s.keydown('Escape');
    s.flush();
    end?.focus();
    query('.rota-shift .et-input-picker-trigger', host).click();
    s.flush();

    expect(document.activeElement).toBe(ringHandle('end'));
  });

  it('writes a tap into the field that keeps focus, so its blur commits nothing stale', () => {
    useDesktopViewport();

    const s = scenario();
    const fixture = TestBed.createComponent(RotaComponent);
    const host = fixture.nativeElement as HTMLElement;
    const rota = fixture.componentInstance;

    s.flush();

    const [start, end] = Array.from(host.querySelectorAll<HTMLInputElement>('.rota-shift input'));

    start?.focus();
    query('.rota-shift .et-input-picker-trigger', host).click();
    s.flush();

    // an empty handle is display: none in a browser, so a press cannot focus it and the field keeps focus
    for (const side of ['start', 'end'] as const) {
      ringHandle(side).removeAttribute('tabindex');
    }

    start?.focus();
    tapRing(timeRing(), minuteOfDay(9));
    s.flush();

    expect(document.activeElement).toBe(end);
    expect(start?.value).toBe('09:00');

    tapRing(timeRing(), minuteOfDay(17, 30));
    s.flush();

    expect(end?.value).toBe('17:30');

    end?.blur();
    s.flush();

    expect(rota.shift()).toEqual({ start: '09:00', end: '17:30' });
  });

  it('shows the time and the day of the active end in the ring next to the calendar', async () => {
    useDesktopViewport();

    const s = scenario();
    const fixture = TestBed.createComponent(RotaComponent);
    const host = fixture.nativeElement as HTMLElement;
    const rota = fixture.componentInstance;

    s.flush();

    const [start, end] = Array.from(host.querySelectorAll<HTMLInputElement>('.rota-trip input'));

    start?.focus();
    query('.rota-trip .et-input-picker-trigger', host).click();
    s.flush();

    for (const day of ['20', '24']) {
      dayCell(day).focus();
      dayCell(day).click();
      s.flush();
    }

    tapRing(timeRing(), minuteOfDay(9));
    // the calendar grid gives up its focus claim in a microtask, which a browser runs before the next render
    await Promise.resolve();
    s.flush();

    expect(document.activeElement).toBe(end);
    expect(ringReadout()).toBe('--:--');

    tapRing(timeRing(), minuteOfDay(17, 30));
    s.flush();

    expect(rota.trip()).toEqual({ start: '2026-07-20T09:00', end: '2026-07-24T17:30' });
    expect(ringReadout()).toBe('17:30');
    expect(ringNote()).toBe('Fri 24 Jul');

    start?.focus();
    s.flush();

    expect(ringReadout()).toBe('09:00');
    expect(ringNote()).toBe('Mon 20 Jul');
  });

  it('keeps focus in the bottom sheet after the first tap', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RotaComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    query('.rota-shift .et-input-picker-trigger', host).click();
    s.flush();

    expect(query('.et-overlay--bottom-sheet')).toBeTruthy();

    tapRing(timeRing(), minuteOfDay(9));
    s.flush();

    expect(fixture.componentInstance.shift()).toEqual({ start: '09:00', end: null });
    expect(document.activeElement).toBe(ringHandle('start'));
    expect(ringHandle('end').hasAttribute('data-active')).toBe(true);
  });

  it.each([
    [StrayDateRangeFieldComponent, DATE_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_RANGE_INPUT],
    [StrayTimeRangeFieldComponent, TIME_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_TIME_RANGE_INPUT],
    [StrayDateTimeRangeFieldComponent, DATE_TIME_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_TIME_RANGE_INPUT],
  ])('throws ET%# for a range field outside its input', (component, code) => {
    const s = scenario();

    expect(() => TestBed.createComponent(component)).toThrow(`ET${code}`);
    s.flush();
    expect(takeErrorPayload(s).element.tagName).toBe('INPUT');
  });

  it.each([
    [DuplicateDateRangeFieldComponent, DATE_RANGE_INPUT_ERROR_CODES.DUPLICATE_FIELD],
    [DuplicateTimeRangeFieldComponent, TIME_RANGE_INPUT_ERROR_CODES.DUPLICATE_FIELD],
    [DuplicateDateTimeRangeFieldComponent, DATE_TIME_RANGE_INPUT_ERROR_CODES.DUPLICATE_FIELD],
  ])('reports ET%# for a second field on the same side', (component, code) => {
    const s = scenario();

    TestBed.createComponent(component);

    expect(() => s.flush()).toThrow(`ET${code}`);
    s.flush();
    expect(takeErrorPayload(s).element.tagName).toBe('INPUT');
  });
});

import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_TIME_PICKER_LABELS,
  injectTimePickerLabels,
  provideTimePickerLabels,
  TIME_PICKER_ERROR_CODES,
  TIME_PICKER_IMPORTS,
  TIME_PICKER_LABELS,
  TimePickerColumnDirective,
  TimePickerComponent,
  TimePickerDirective,
  TimePickerOptionDirective,
  TimeRange,
  TimeRangePick,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const columns = () => Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]'));

const options = (column: Element) => Array.from(column.querySelectorAll<HTMLButtonElement>('[role="option"]'));

const option = (column: Element, label: string) => {
  const match = options(column).find((candidate) => text(candidate) === label);

  if (!match) throw new Error(`No option ${label}`);

  return match;
};

const selected = (column: Element) =>
  options(column)
    .filter((candidate) => candidate.getAttribute('aria-selected') === 'true')
    .map((candidate) => text(candidate));

const disabledLabels = (column: Element) =>
  options(column)
    .filter((candidate) => candidate.getAttribute('aria-disabled') === 'true')
    .map((candidate) => text(candidate));

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
};

const hhmm = (date: Date | null | undefined) =>
  date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : null;

@Component({
  selector: 'et-scenario-kickoff-time',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerComponent],
  template: `<et-time-picker [(value)]="kickoff" [minuteStep]="15" [format]="format()" />`,
})
class KickoffTimeComponent {
  kickoff = signal<Date | null>(null);
  format = signal('HH:mm');
}

@Component({
  selector: 'et-scenario-opening-hours',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerComponent],
  template: `
    <et-time-picker
      [(value)]="slot"
      [min]="opens"
      [max]="closes"
      [timeFilter]="noLunch"
      [minuteStep]="30"
      format="h:mm a"
      hoursLabel="Hour"
    />
  `,
})
class OpeningHoursComponent {
  slot = signal<Date | null>(new Date(2026, 8, 27, 9, 30));
  opens = new Date(2026, 8, 27, 9, 0);
  closes = new Date(2026, 8, 27, 17, 0);
  noLunch = (date: Date) => date.getHours() !== 12;
}

@Component({
  selector: 'et-scenario-training-slot',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TIME_PICKER_IMPORTS],
  template: `
    <et-time-picker
      [(rangeValue)]="range"
      [(activeSide)]="side"
      [minuteStep]="30"
      (timeSelect)="picks.push($event)"
      mode="range"
    />
  `,
})
class TrainingSlotComponent {
  range = signal<TimeRange>({ start: null, end: null });
  side = signal<'start' | 'end'>('start');
  picks: TimeRangePick[] = [];
}

@Component({
  selector: 'et-scenario-compact-time',
  imports: [TimePickerDirective, TimePickerColumnDirective, TimePickerOptionDirective],
  template: `
    <div #picker="etTimePicker" [(value)]="time" [minuteStep]="20" class="compact" etTimePicker>
      @for (column of picker.columns(); track column.unit) {
        <div [column]="column" [attr.data-unit]="column.unit" etTimePickerColumn>
          @for (entry of column.options; track entry.value) {
            <button [option]="entry" class="compact-option" etTimePickerOption>{{ entry.label }}</button>
          }
        </div>
      }
    </div>
  `,
})
class CompactTimeComponent {
  time = signal<Date | null>(new Date(2026, 8, 27, 8, 40));
}

@Component({
  selector: 'et-scenario-time-label-probe',
  template: `{{ labels().hours }}|{{ labels().minutes }}|{{ labels().endTime }}`,
})
class TimeLabelProbeComponent {
  labels = injectTimePickerLabels();
}

@Component({
  selector: 'et-scenario-german-time',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerComponent, TimeLabelProbeComponent],
  providers: [provideTimePickerLabels({ hours: 'Stunden', minutes: 'Minuten', startTime: 'Beginn' })],
  template: `
    <et-time-picker mode="range" />
    <et-scenario-time-label-probe />
  `,
})
class GermanTimeComponent {
  source = inject(TIME_PICKER_LABELS);
}

@Component({
  selector: 'et-scenario-stray-column',
  imports: [TimePickerColumnDirective],
  template: `<div [column]="{ unit: 'hour', label: 'Hours', options: [] }" etTimePickerColumn></div>`,
})
class StrayColumnComponent {}

@Component({
  selector: 'et-scenario-stray-option',
  imports: [TimePickerDirective, TimePickerOptionDirective],
  template: `
    <div #picker="etTimePicker" etTimePicker>
      <button [option]="picker.columns()[0]!.options[0]!" etTimePickerOption>00</button>
    </div>
  `,
})
class StrayOptionComponent {}

describe('time-picker scenarios', () => {
  const scenario = useScenario();

  beforeEach(() => vi.setSystemTime(new Date(2026, 8, 27, 14, 7)));

  it('holds the hour until the minute completes a kickoff time, then edits it directly', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);
    const page = fixture.componentInstance;

    settle(s);

    const [hours, minutes] = columns();

    expect(columns()).toHaveLength(2);
    expect(hours!.getAttribute('aria-label')).toBe(DEFAULT_TIME_PICKER_LABELS.hours);
    expect(hours!.getAttribute('aria-orientation')).toBe('vertical');
    expect(minutes!.getAttribute('aria-label')).toBe(DEFAULT_TIME_PICKER_LABELS.minutes);
    expect(options(hours!)).toHaveLength(24);
    expect(options(minutes!).map((entry) => text(entry))).toEqual(['00', '15', '30', '45']);
    expect(
      options(hours!)
        .filter((entry) => entry.getAttribute('tabindex') === '0')
        .map((e) => text(e)),
    ).toEqual(['14']);
    expect(selected(hours!)).toEqual([]);

    option(hours!, '18').click();
    settle(s);

    expect(page.kickoff()).toBeNull();
    expect(option(hours!, '18').getAttribute('tabindex')).toBe('0');

    option(minutes!, '30').click();
    settle(s);

    expect(hhmm(page.kickoff())).toBe('18:30');
    expect(selected(hours!)).toEqual(['18']);
    expect(selected(minutes!)).toEqual(['30']);
    expect(option(minutes!, '30').hasAttribute('data-selected')).toBe(true);

    option(hours!, '20').click();
    settle(s);
    expect(hhmm(page.kickoff())).toBe('20:30');
  });

  it('drives the columns by keyboard: arrows wrap, Home and End jump, typeahead and column hops', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);
    const page = fixture.componentInstance;

    page.kickoff.set(new Date(2026, 8, 27, 23, 45));
    settle(s);

    const [hours, minutes] = columns();

    option(hours!, '23').focus();
    settle(s);

    s.keydown('ArrowDown');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('00:45');
    expect(document.activeElement).toBe(option(hours!, '00'));

    s.keydown('ArrowUp');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('23:45');

    s.keydown('Home');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('00:45');

    s.keydown('1');
    s.keydown('7');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('17:45');

    s.keydown('ArrowRight');
    settle(s);
    await Promise.resolve();
    expect(document.activeElement).toBe(option(minutes!, '45'));

    s.keydown('End');
    s.keydown('ArrowDown');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('17:00');

    s.keydown('ArrowRight');
    settle(s);
    expect(document.activeElement).toBe(option(minutes!, '00'));

    s.keydown('ArrowLeft');
    settle(s);
    expect(document.activeElement).toBe(option(hours!, '17'));
    s.tick(1000);
  });

  it('adds a seconds column from the format and keeps an off-step value selectable', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);

    fixture.componentInstance.kickoff.set(new Date(2026, 8, 27, 9, 7, 30));
    fixture.componentInstance.format.set('HH:mm:ss');
    settle(s);

    const [, minutes, seconds] = columns();

    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual(['Hours', 'Minutes', 'Seconds']);
    expect(options(minutes!).map((entry) => text(entry))).toEqual(['00', '07', '15', '30', '45']);
    expect(selected(minutes!)).toEqual(['07']);
    expect(options(seconds!)).toHaveLength(60);
    expect(selected(seconds!)).toEqual(['30']);
  });

  it('offers only opening hours on a 12-hour clock and skips closed times', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OpeningHoursComponent);
    const page = fixture.componentInstance;

    settle(s);

    const [hours, minutes, period] = columns();

    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual([
      'Hour',
      DEFAULT_TIME_PICKER_LABELS.minutes,
      DEFAULT_TIME_PICKER_LABELS.period,
    ]);
    expect(options(period!).map((entry) => text(entry))).toEqual(['AM', 'PM']);
    expect(selected(period!)).toEqual(['AM']);
    expect(selected(hours!)).toEqual(['9']);
    expect(disabledLabels(hours!)).toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8']);

    option(hours!, '8').click();
    settle(s);
    expect(hhmm(page.slot())).toBe('09:30');

    option(hours!, '11').focus();
    settle(s);
    s.keydown('ArrowDown');
    settle(s);
    expect(hhmm(page.slot())).toBe('10:30');

    s.keydown('End');
    settle(s);
    expect(hhmm(page.slot())).toBe('11:30');

    s.keydown('ArrowDown');
    settle(s);
    expect(hhmm(page.slot())).toBe('09:30');

    page.slot.set(new Date(2026, 8, 27, 11, 30));
    settle(s);
    option(period!, 'PM').click();
    settle(s);

    expect(hhmm(page.slot())).toBe('17:00');
    expect(disabledLabels(hours!)).toEqual(['12', '6', '7', '8', '9', '10', '11']);
    expect(selected(period!)).toEqual(['PM']);
    expect(options(minutes!).map((entry) => text(entry))).toEqual(['00', '30']);
  });

  it('picks a training slot as a range, hopping to the end once and banding the options between', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TrainingSlotComponent);
    const page = fixture.componentInstance;

    settle(s);

    const sideButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.et-time-picker-side'));

    expect(document.querySelector('et-time-picker')?.getAttribute('data-mode')).toBe('range');
    expect(sideButtons().map((button) => text(button))).toEqual(['Start time—', 'End time—']);
    expect(sideButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    const [hours, minutes] = columns();

    option(hours!, '17').click();
    option(minutes!, '00').click();
    settle(s);

    expect(hhmm(page.range().start)).toBe('17:00');
    expect(page.side()).toBe('end');
    expect(page.picks.map((pick) => [pick.side, hhmm(pick.time)])).toEqual([['start', '17:00']]);
    expect(sideButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);

    option(hours!, '19').click();
    option(minutes!, '30').click();
    settle(s);

    expect(hhmm(page.range().end)).toBe('19:30');
    expect(page.side()).toBe('end');
    expect(sideButtons().map((button) => text(button))).toEqual(['Start time17:00', 'End time19:30']);
    expect(option(hours!, '17').hasAttribute('data-range-start')).toBe(true);
    expect(option(hours!, '19').hasAttribute('data-range-end')).toBe(true);
    expect(['17', '18', '19'].map((hour) => option(hours!, hour).getAttribute('data-band'))).toEqual([
      'start',
      'middle',
      'end',
    ]);
    expect(option(hours!, '16').hasAttribute('data-band')).toBe(false);

    sideButtons()[0]!.click();
    settle(s);
    expect(page.side()).toBe('start');

    option(hours!, '18').click();
    settle(s);

    expect(hhmm(page.range().start)).toBe('18:00');
    expect(page.side()).toBe('start');
    expect(page.picks).toHaveLength(3);
  });

  it('builds a compact picker from the headless directives', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CompactTimeComponent);

    settle(s);

    const minutes = document.querySelector<HTMLElement>('[data-unit="minute"]')!;

    expect(minutes.getAttribute('role')).toBe('listbox');
    expect(options(minutes).map((entry) => text(entry))).toEqual(['00', '20', '40']);
    expect(option(minutes, '40').getAttribute('type')).toBe('button');
    expect(selected(minutes)).toEqual(['40']);

    option(minutes, '20').click();
    settle(s);
    expect(hhmm(fixture.componentInstance.time())).toBe('08:20');
  });

  it('localizes the column and side labels for a subtree', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GermanTimeComponent);

    settle(s);

    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual(['Stunden', 'Minuten']);
    expect(text(document.querySelector('.et-time-picker-side[data-side="start"] .et-time-picker-side-label'))).toBe(
      'Beginn',
    );
    expect(text(document.querySelector('et-scenario-time-label-probe'))).toBe(
      `Stunden|Minuten|${DEFAULT_TIME_PICKER_LABELS.endTime}`,
    );
    expect(fixture.componentInstance.source).toEqual({ hours: 'Stunden', minutes: 'Minuten', startTime: 'Beginn' });
  });

  it('reports a column outside a picker and an option outside a column', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(StrayColumnComponent)).toThrow(
      code(TIME_PICKER_ERROR_CODES.COLUMN_OUTSIDE_TIME_PICKER),
    );
    expect(() => TestBed.createComponent(StrayOptionComponent)).toThrow(
      code(TIME_PICKER_ERROR_CODES.OPTION_OUTSIDE_COLUMN),
    );

    s.tick(1);

    const contexts = s.errors.splice(0).map((entry) => (entry.error as { element?: HTMLElement }).element?.tagName);

    expect(contexts).toEqual(['DIV', 'BUTTON']);
  });
});

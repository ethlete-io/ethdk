import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_TIME_PICKER_LABELS,
  injectTimePickerLabels,
  provideTimePickerLabels,
  TIME_PICKER_ERROR_CODES,
  TIME_PICKER_IMPORTS,
  TIME_PICKER_LABELS,
  TimePickerComponent,
  TimePickerDirective,
  TimePickerRingDirective,
  TimePickerRingHandleDirective,
  TimeRange,
  TimeRangePick,
} from '../index';
import {
  minuteOfDay,
  ringHandle,
  ringNote,
  ringReadout,
  tapRing,
  timeRing,
} from '../lib/time-picker/testing/time-picker-driver';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
};

const hhmm = (date: Date | null | undefined) =>
  date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : null;

@Component({
  selector: 'et-scenario-kickoff-time',
  imports: [TimePickerComponent],
  template: `<et-time-picker [(value)]="kickoff" [minuteStep]="15" [format]="format()" />`,
})
class KickoffTimeComponent {
  kickoff = signal<Date | null>(null);
  format = signal('HH:mm');
}

@Component({
  selector: 'et-scenario-opening-hours',
  imports: [TimePickerComponent],
  template: `
    <et-time-picker
      [(value)]="slot"
      [min]="opens"
      [max]="closes"
      [timeFilter]="noLunch"
      [minuteStep]="30"
      format="h:mm a"
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
  imports: [TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective],
  template: `
    <div [(value)]="time" [minuteStep]="20" class="compact" etTimePicker>
      <div class="compact-ring" etTimePickerRing>
        <span #handle="etTimePickerRingHandle" [style.rotate]="handle.angle() + 'deg'" etTimePickerRingHandle></span>
      </div>
    </div>
  `,
})
class CompactTimeComponent {
  time = signal<Date | null>(new Date(2026, 8, 27, 8, 40));
}

@Component({
  selector: 'et-scenario-time-label-probe',
  template: `{{ labels().time }}|{{ labels().startTime }}|{{ labels().endTime }}`,
})
class TimeLabelProbeComponent {
  labels = injectTimePickerLabels();
}

@Component({
  selector: 'et-scenario-german-time',
  imports: [TimePickerComponent, TimeLabelProbeComponent],
  providers: [provideTimePickerLabels({ time: 'Uhrzeit', startTime: 'Beginn', emptyHint: 'Ring antippen' })],
  template: `
    <et-time-picker mode="range" />
    <et-scenario-time-label-probe />
  `,
})
class GermanTimeComponent {
  source = inject(TIME_PICKER_LABELS);
}

@Component({
  selector: 'et-scenario-stray-ring',
  imports: [TimePickerRingDirective],
  template: `<div etTimePickerRing></div>`,
})
class StrayRingComponent {}

@Component({
  selector: 'et-scenario-stray-handle',
  imports: [TimePickerDirective, TimePickerRingHandleDirective],
  template: `
    <div etTimePicker>
      <span etTimePickerRingHandle></span>
    </div>
  `,
})
class StrayHandleComponent {}

describe('time-picker scenarios', () => {
  const scenario = useScenario();

  beforeEach(() => vi.setSystemTime(new Date(2026, 8, 27, 14, 7)));

  it('picks a kickoff time on the ring in one press, shows it live, and edits it by a drag', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);
    const page = fixture.componentInstance;

    settle(s);

    const handle = ringHandle();

    expect(document.querySelectorAll('[etTimePickerRingHandle]')).toHaveLength(1);
    expect(handle.getAttribute('role')).toBe('slider');
    expect(handle.getAttribute('aria-label')).toBe(DEFAULT_TIME_PICKER_LABELS.time);
    expect(handle.hasAttribute('data-empty')).toBe(true);
    expect(ringReadout()).toBe('--:--');
    expect(ringNote()).toBe(DEFAULT_TIME_PICKER_LABELS.emptyHint);

    tapRing(timeRing(), minuteOfDay(18, 35));
    settle(s);

    expect(hhmm(page.kickoff())).toBe('18:30');
    expect(page.kickoff()?.getDate()).toBe(27);
    expect(handle.getAttribute('aria-valuetext')).toBe('18:30');
    expect(handle.hasAttribute('data-empty')).toBe(false);
    expect(ringReadout()).toBe('18:30');

    tapRing(timeRing(), minuteOfDay(20, 30));
    settle(s);
    expect(hhmm(page.kickoff())).toBe('20:30');
    expect(ringReadout()).toBe('20:30');
  });

  it('drives the handle by keyboard: arrows wrap past midnight, PageUp moves an hour, Home and End jump', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);
    const page = fixture.componentInstance;

    page.kickoff.set(new Date(2026, 8, 27, 23, 45));
    settle(s);

    ringHandle().focus();
    settle(s);

    s.keydown('ArrowUp');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('00:00');

    s.keydown('ArrowDown');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('23:45');

    s.keydown('PageUp');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('00:45');

    s.keydown('PageDown');
    s.keydown('PageDown');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('22:45');

    s.keydown('Home');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('00:00');

    s.keydown('End');
    settle(s);
    expect(hhmm(page.kickoff())).toBe('23:45');
    expect(ringReadout()).toBe('23:45');
  });

  it('keeps an off-step value with seconds on the ring and writes second 0 on a pick', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(KickoffTimeComponent);
    const page = fixture.componentInstance;

    page.kickoff.set(new Date(2026, 8, 27, 9, 7, 30));
    page.format.set('HH:mm:ss');
    settle(s);

    expect(ringHandle().getAttribute('aria-valuenow')).toBe(String(minuteOfDay(9, 7)));
    expect(ringReadout()).toBe('09:07:30');

    tapRing(timeRing(), minuteOfDay(10, 15));
    settle(s);

    expect(page.kickoff()?.getSeconds()).toBe(0);
    expect(ringReadout()).toBe('10:15:00');
  });

  it('offers only opening hours on a 12-hour ring and skips closed times', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OpeningHoursComponent);
    const page = fixture.componentInstance;

    settle(s);

    expect(Array.from(document.querySelectorAll('.et-time-picker-labels text')).map((label) => text(label))).toEqual([
      '12 AM',
      '3',
      '6 AM',
      '9',
      '12 PM',
      '3',
      '6 PM',
      '9',
    ]);
    expect(document.querySelectorAll('.et-time-picker-mark')).toHaveLength(2);
    expect(ringReadout()).toBe('9:30 AM');
    expect(document.querySelectorAll('path.et-time-picker-track')).toHaveLength(2);
    expect(document.querySelectorAll('path.et-time-picker-blocked')).toHaveLength(2);

    tapRing(timeRing(), minuteOfDay(8));
    settle(s);
    expect(hhmm(page.slot())).toBe('09:30');

    tapRing(timeRing(), minuteOfDay(12, 30));
    settle(s);
    expect(hhmm(page.slot())).toBe('09:30');

    page.slot.set(new Date(2026, 8, 27, 11, 30));
    settle(s);
    ringHandle().focus();
    s.keydown('ArrowUp');
    settle(s);
    expect(hhmm(page.slot())).toBe('13:00');

    s.keydown('End');
    settle(s);
    expect(hhmm(page.slot())).toBe('17:00');
    expect(ringReadout()).toBe('5:00 PM');

    s.keydown('Home');
    settle(s);
    expect(hhmm(page.slot())).toBe('09:00');
  });

  it('picks a training slot as a range: the start hands on to the end, and the centre shows the length', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TrainingSlotComponent);
    const page = fixture.componentInstance;

    settle(s);

    expect(document.querySelector('et-time-picker')?.getAttribute('data-mode')).toBe('range');
    expect(document.querySelector('.et-time-picker-side')).toBeNull();
    expect(
      Array.from(document.querySelectorAll('[etTimePickerRingHandle]')).map((handle) =>
        handle.getAttribute('aria-label'),
      ),
    ).toEqual([DEFAULT_TIME_PICKER_LABELS.startTime, DEFAULT_TIME_PICKER_LABELS.endTime]);
    expect(ringReadout()).toBe('--:--');

    tapRing(timeRing(), minuteOfDay(17));
    settle(s);

    expect(hhmm(page.range().start)).toBe('17:00');
    expect(page.side()).toBe('end');
    expect(page.picks.map((pick) => [pick.side, hhmm(pick.time)])).toEqual([['start', '17:00']]);
    expect(ringHandle('end').hasAttribute('data-active')).toBe(true);

    tapRing(timeRing(), minuteOfDay(19, 30));
    settle(s);

    expect(hhmm(page.range().end)).toBe('19:30');
    expect(page.side()).toBe('end');
    expect(ringReadout()).toBe('2 h 30 min');
    expect(ringNote()).toBeNull();
    expect(document.querySelector('.et-time-picker-arc')).not.toBeNull();

    tapRing(timeRing(), minuteOfDay(6));
    settle(s);

    expect(hhmm(page.range().end)).toBe('06:00');
    expect(ringReadout()).toBe('13 h');
    expect(ringNote()).toBe(DEFAULT_TIME_PICKER_LABELS.endsNextDay);

    ringHandle('start').focus();
    settle(s);
    expect(page.side()).toBe('start');

    s.keydown('PageUp');
    settle(s);

    expect(hhmm(page.range().start)).toBe('18:00');
    expect(page.side()).toBe('start');
    expect(page.picks).toHaveLength(4);
  });

  it('builds a compact picker from the headless directives', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CompactTimeComponent);

    settle(s);

    const handle = ringHandle();

    expect(handle.getAttribute('role')).toBe('slider');
    expect(handle.getAttribute('aria-valuetext')).toBe('08:40');
    expect(parseFloat(handle.style.rotate)).toBeCloseTo(130);

    handle.focus();
    s.keydown('ArrowUp');
    settle(s);
    expect(hhmm(fixture.componentInstance.time())).toBe('09:00');

    tapRing(timeRing(), minuteOfDay(12, 25));
    settle(s);
    expect(hhmm(fixture.componentInstance.time())).toBe('12:20');
    expect(parseFloat(handle.style.rotate)).toBeCloseTo(185);
  });

  it('localizes the ring labels for a subtree', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GermanTimeComponent);

    settle(s);

    expect(ringHandle('start').getAttribute('aria-label')).toBe('Beginn');
    expect(ringHandle('end').getAttribute('aria-label')).toBe(DEFAULT_TIME_PICKER_LABELS.endTime);
    expect(ringNote()).toBe('Ring antippen');
    expect(text(document.querySelector('et-scenario-time-label-probe'))).toBe(
      `Uhrzeit|Beginn|${DEFAULT_TIME_PICKER_LABELS.endTime}`,
    );
    expect(fixture.componentInstance.source).toEqual({
      time: 'Uhrzeit',
      startTime: 'Beginn',
      emptyHint: 'Ring antippen',
    });
  });

  it('reports a ring outside a picker and a handle outside a ring', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(StrayRingComponent)).toThrow(
      code(TIME_PICKER_ERROR_CODES.RING_OUTSIDE_TIME_PICKER),
    );
    expect(() => TestBed.createComponent(StrayHandleComponent)).toThrow(
      code(TIME_PICKER_ERROR_CODES.RING_HANDLE_OUTSIDE_RING),
    );

    s.tick(1);

    const contexts = s.errors.splice(0).map((entry) => (entry.error as { element?: HTMLElement }).element?.tagName);

    expect(contexts).toEqual(['DIV', 'SPAN']);
  });
});

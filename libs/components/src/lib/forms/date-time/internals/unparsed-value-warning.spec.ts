import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountControl } from '../../../testing/control-driver';
import { DateInputComponent } from '../date-input/date-input.component';
import { TimeRangeInputComponent } from '../time-range-input/time-range-input.component';
import { DateRangeValue } from './date-range-picker-input.directive';

@Component({
  template: `<et-date-input [(value)]="value" [(mixed)]="mixed" aria-label="Birthday" />`,
  imports: [DateInputComponent],
})
class DateInputHost {
  value = signal<string | null>(null);
  mixed = signal(false);
}

@Component({
  template: `<et-time-range-input [(value)]="value" aria-label="Shift" />`,
  imports: [TimeRangeInputComponent],
})
class TimeRangeInputHost {
  value = signal<DateRangeValue>({ start: '09:30', end: '09:30:00' });
}

describe('unparsed wire value warning', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };

  const warnings = () =>
    warn.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('valueFormat'));

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('names the value, the valueFormat and a matching value, once per control', () => {
    const fixture = mountControl(DateInputHost);

    fixture.componentInstance.value.set('2026-07-30T00:00:00+00:00');
    fixture.detectChanges();
    fixture.componentInstance.value.set('30.07.2026');
    fixture.detectChanges();

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain('[et-date-input]');
    expect(warnings()[0]).toContain('"2026-07-30T00:00:00+00:00"');
    expect(warnings()[0]).toContain('"yyyy-MM-dd"');
    expect(warnings()[0]).toContain('"2026-07-16"');
    expect(warnings()[0]).toContain('provideDateFormat()');
  });

  it('stays quiet for a matching, empty or mixed value', () => {
    const fixture = mountControl(DateInputHost);

    fixture.componentInstance.value.set('2026-07-30');
    fixture.detectChanges();
    fixture.componentInstance.value.set('');
    fixture.detectChanges();
    fixture.componentInstance.mixed.set(true);
    fixture.componentInstance.value.set('nope');
    fixture.detectChanges();

    expect(warnings()).toEqual([]);
  });

  it('checks each side of a range', () => {
    mountControl(TimeRangeInputHost);

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain('[et-time-range-input]');
    expect(warnings()[0]).toContain('"09:30:00"');
    expect(warnings()[0]).toContain('"HH:mm"');
    expect(warnings()[0]).toContain('"21:30"');
    expect(warnings()[0]).toContain('provideTimeFormat()');
  });
});

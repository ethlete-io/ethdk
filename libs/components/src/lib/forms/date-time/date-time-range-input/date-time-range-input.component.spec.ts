import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { DateTimeRangeInputComponent } from './date-time-range-input.component';
import { DateTimeRangeInputDirective, DateTimeRangeValue } from './headless';

@Component({
  template: `
    <et-date-time-range-input
      [(value)]="value"
      [startAt]="startAt"
      aria-label="Stay"
      displayFormat="MM/dd/yyyy, HH:mm"
    />
  `,
  imports: [DateTimeRangeInputComponent],
})
class DateTimeRangeInputHost {
  value = signal<DateTimeRangeValue>({ start: null, end: null });
  startAt = new Date(2026, 6, 1);
}

describe('DateTimeRangeInputComponent - picker panes', () => {
  let driver: DatePickerDriver<DateTimeRangeInputHost, DateTimeRangeInputDirective>;

  const activePane = () => driver.paneEl('.et-date-time-range-input-panel-panes')?.dataset['activePane'] ?? null;
  const clickTab = (label: string) =>
    driver.click(driver.paneEls('et-segmented-button').find((button) => button.textContent?.trim() === label)!);

  beforeEach(() => {
    driver = mountDatePicker(DateTimeRangeInputHost, DateTimeRangeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('names the date/time tab switch, so its form field raises no ET2201', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await driver.open();

    const loggedErrors = consoleError.mock.calls.map((call) => String(call[0]));

    consoleError.mockRestore();

    expect(driver.paneEl('.et-date-time-range-input-panel-tabs [role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Picker view',
    );
    expect(loggedErrors.filter((message) => message.includes('ET2201'))).toEqual([]);
  });

  it('holds the dates pane until both days are picked, then carries on to the times', async () => {
    await driver.open();

    expect(activePane()).toBe('dates');

    driver.clickDayCell('16');

    expect(activePane()).toBe('dates');

    driver.clickDayCell('18');

    expect(activePane()).toBe('times');
  });

  it('advances once only, so going back to correct the days is not interrupted', async () => {
    await driver.open();
    driver.clickDayCell('16');
    driver.clickDayCell('18');

    clickTab('Dates');

    expect(activePane()).toBe('dates');

    driver.clickDayCell('20');
    driver.clickDayCell('22');

    expect(activePane()).toBe('dates');
  });
});

@Component({
  template: `
    <et-date-time-range-input
      [(value)]="value"
      [startAt]="startAt"
      [maxDate]="maxDate"
      aria-label="Stay"
      displayFormat="MM/dd/yyyy, HH:mm"
      timeZone="Asia/Tokyo"
    />
  `,
  imports: [DateTimeRangeInputComponent],
})
class ZonedBoundsDateTimeRangeInputHost {
  value = signal<DateTimeRangeValue>({ start: null, end: null });
  startAt = new Date(2026, 7, 1);
  /** 22:00 on 18 Aug in Berlin, already 19 Aug in Tokyo. */
  maxDate = new Date('2026-08-18T20:00:00Z');
}

describe('DateTimeRangeInputComponent - zoned bounds', () => {
  let driver: DatePickerDriver<ZonedBoundsDateTimeRangeInputHost, DateTimeRangeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(ZonedBoundsDateTimeRangeInputHost, DateTimeRangeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('reads maxDate on the calendar of the zone', async () => {
    await driver.open();

    expect(driver.dayCell('19')?.getAttribute('aria-disabled')).toBeNull();
    expect(driver.dayCell('20')?.getAttribute('aria-disabled')).toBe('true');
  });
});

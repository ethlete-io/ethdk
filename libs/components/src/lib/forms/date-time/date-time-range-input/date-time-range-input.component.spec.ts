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

  it('holds the dates pane until both days are picked, then carries on to the times', async () => {
    await driver.open();

    expect(activePane()).toBe('dates');

    driver.clickDayCell('16');

    // one day is not a range yet - the second is still to come on this pane
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

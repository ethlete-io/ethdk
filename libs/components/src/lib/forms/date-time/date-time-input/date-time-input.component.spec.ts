import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { DateTimeInputComponent } from './date-time-input.component';
import { DateTimeInputDirective } from './headless';

@Component({
  template: `
    <et-date-time-input
      [(value)]="value"
      [startAt]="startAt"
      aria-label="Appointment"
      displayFormat="MM/dd/yyyy, HH:mm"
    />
  `,
  imports: [DateTimeInputComponent],
})
class DateTimeInputHost {
  value = signal<string | null>(null);
  startAt = new Date(2026, 6, 1);
}

describe('DateTimeInputComponent - picker panes', () => {
  let driver: DatePickerDriver<DateTimeInputHost, DateTimeInputDirective>;

  const activePane = () => driver.paneEl('.et-date-time-input-panel-panes')?.dataset['activePane'] ?? null;
  const clickTab = (label: string) =>
    driver.click(driver.paneEls('et-segmented-button').find((button) => button.textContent?.trim() === label)!);

  beforeEach(() => {
    driver = mountDatePicker(DateTimeInputHost, DateTimeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('opens on the date pane and carries the first day pick on to the time pane', async () => {
    await driver.open();

    expect(activePane()).toBe('date');

    driver.clickDayCell('16');

    expect(activePane()).toBe('time');
  });

  it('advances once only, so going back to correct the day is not interrupted', async () => {
    await driver.open();

    driver.clickDayCell('16');

    expect(activePane()).toBe('time');

    clickTab('Date');

    expect(activePane()).toBe('date');

    driver.clickDayCell('17');

    expect(activePane()).toBe('date');
  });

  it('starts a fresh open back on the date pane, ready to advance again', async () => {
    await driver.open();
    driver.clickDayCell('16');

    expect(activePane()).toBe('time');

    driver.closeAndRemovePanes();
    await driver.settle();
    await driver.open();

    expect(activePane()).toBe('date');

    driver.clickDayCell('17');

    expect(activePane()).toBe('time');
  });
});

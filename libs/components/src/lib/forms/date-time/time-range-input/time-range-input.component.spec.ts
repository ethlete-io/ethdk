import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { TimeRangeInputComponent } from './time-range-input.component';
import { TimeRangeInputDirective, TimeRangeValue } from './headless';

@Component({
  template: `<et-time-range-input [(value)]="value" aria-label="Field" />`,
  imports: [TimeRangeInputComponent],
})
class Host {
  value = signal<TimeRangeValue>({ start: '09:30', end: '10:30' });
}

describe('TimeRangeInputComponent - clear button', () => {
  let driver: DatePickerDriver<Host, TimeRangeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(Host, TimeRangeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('shows on an unfocused field that holds a value', () => {
    expect(driver.query('.et-input-clear')).not.toBeNull();
  });
});

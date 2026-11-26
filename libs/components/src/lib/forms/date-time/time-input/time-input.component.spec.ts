import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { TimeInputComponent } from './time-input.component';
import { TimeInputDirective } from './headless';

@Component({
  template: `<et-time-input [(value)]="value" aria-label="Field" />`,
  imports: [TimeInputComponent],
})
class Host {
  value = signal<string | null>('09:30');
}

describe('TimeInputComponent - clear button', () => {
  let driver: DatePickerDriver<Host, TimeInputDirective>;

  beforeEach(() => {
    driver = mountDatePicker(Host, TimeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('shows on an unfocused field that holds a value', () => {
    expect(driver.query('.et-input-clear')).not.toBeNull();
  });
});

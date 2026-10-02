import { Component, signal } from '@angular/core';
import { format } from 'date-fns';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { todayPreset } from '../date-range-presets';
import { DateRangeValue } from '../internals/date-range-picker-input.directive';
import { DateRangeInputComponent } from './date-range-input.component';
import { DateRangeInputDirective } from './headless';

@Component({
  template: `
    <et-date-range-input
      [(value)]="value"
      [(pickerOpen)]="pickerOpen"
      [presets]="presets"
      aria-label="Stay"
      displayFormat="dd.MM.yyyy"
      valueFormat="yyyy-MM-dd"
    />
  `,
  imports: [DateRangeInputComponent],
})
class DateRangeInputHost {
  value = signal<DateRangeValue>({ start: null, end: null });
  pickerOpen = signal(false);
  presets = [todayPreset()];
}

describe('DateRangeInputComponent', () => {
  let driver: DatePickerDriver<DateRangeInputHost, DateRangeInputDirective>;

  const clearButton = () => driver.query<HTMLButtonElement>('.et-input-clear');

  beforeEach(() => {
    driver = mountDatePicker(DateRangeInputHost, DateRangeInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('commits a picked preset and closes the picker', async () => {
    await driver.open();

    expect(driver.host.pickerOpen()).toBe(true);

    driver.clickInPane('.et-date-range-preset');

    const today = format(new Date(), 'yyyy-MM-dd');

    expect(driver.host.value()).toEqual({ start: today, end: today });
    expect(driver.host.pickerOpen()).toBe(false);
  });

  it('shows the clear button only while focused with a value, and clears both ends', () => {
    driver.focusField();
    driver.detectChanges();

    expect(clearButton()).toBeNull();

    driver.host.value.set({ start: '2026-07-13', end: '2026-07-19' });
    driver.detectChanges();

    expect(clearButton()).not.toBeNull();

    clearButton()!.click();
    driver.detectChanges();

    expect(driver.host.value()).toEqual({ start: null, end: null });
  });
});

import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { DatePickerDriver, mountDatePicker } from '../../testing/date-picker-driver';
import { DateInputComponent } from './date-input.component';
import { DateInputDirective } from './headless';

@Component({
  template: `
    <et-date-input
      [(value)]="value"
      [readonly]="readonly()"
      aria-label="Birthday"
      displayFormat="dd.MM.yyyy"
      valueFormat="yyyy-MM-dd"
    />
  `,
  imports: [DateInputComponent],
})
class DateInputHost {
  value = signal<string | null>('2026-07-16');
  readonly = signal(false);
}

describe('DateInputComponent - clear button', () => {
  let driver: DatePickerDriver<DateInputHost, DateInputDirective>;

  const clearButton = () => driver.query<HTMLButtonElement>('.et-input-clear');

  beforeEach(() => {
    driver = mountDatePicker(DateInputHost, DateInputDirective);
  });

  afterEach(async () => {
    driver.closeAndRemovePanes();
    await driver.settle();
  });

  it('shows only while the field is focused and holds a value', () => {
    expect(clearButton()).toBeNull();

    driver.focusField();
    driver.detectChanges();

    expect(clearButton()).not.toBeNull();

    driver.host.value.set(null);
    driver.detectChanges();

    expect(clearButton()).toBeNull();
  });

  it('shows while the picker is open', async () => {
    await driver.open();

    expect(clearButton()).not.toBeNull();
  });

  it('stays hidden on a readonly control', () => {
    driver.host.readonly.set(true);
    driver.focusField();
    driver.detectChanges();

    expect(clearButton()).toBeNull();
  });

  it('clears the value', () => {
    driver.focusField();
    driver.detectChanges();
    clearButton()!.click();
    driver.detectChanges();

    expect(driver.host.value()).toBeNull();
    expect(driver.field().value).toBe('');
  });
});

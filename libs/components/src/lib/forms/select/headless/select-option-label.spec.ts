import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { SelectDriver, mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select [value]="value()" placeholder="Pick a user">
      <et-select-option value="ada">{{ adaName() }}</et-select-option>
      <et-select-option value="bob">Bob</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class DynamicLabelTestHost {
  value = signal<string | null>('ada');
  adaName = signal('Ada');
}

describe('SelectOptionDirective text label', () => {
  let driver: SelectDriver<DynamicLabelTestHost>;

  beforeEach(() => {
    driver = mountSelect(DynamicLabelTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('follows projected text that changes after the first paint', async () => {
    expect(driver.select.displayValue()).toBe('Ada');

    driver.host.adaName.set('Ada Lovelace');
    driver.tick();
    await Promise.resolve();
    driver.tick();

    expect(driver.select.displayValue()).toBe('Ada Lovelace');
  });
});

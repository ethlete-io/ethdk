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

@Component({
  template: `
    <et-select [value]="value()">
      <et-select-option [value]="50" label="50 children" />
      <et-select-option [value]="100" label="100 children" />
      <et-select-option [value]="200" label="200 children">Two hundred</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class LabelInputTestHost {
  value = signal<number | null>(100);
}

describe('SelectOptionComponent label input', () => {
  let driver: SelectDriver<LabelInputTestHost>;

  beforeEach(() => {
    driver = mountSelect(LabelInputTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders the label in the panel when no content is projected', async () => {
    await driver.open();

    expect(driver.optionLabels()).toEqual(['50 children', '100 children', 'Two hundred']);
  });
});

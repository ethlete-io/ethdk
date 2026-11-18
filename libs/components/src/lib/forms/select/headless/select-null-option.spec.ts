import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { SelectDriver, mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select [(value)]="value" placeholder="Pick a team">
      <et-select-option [value]="null">No team</et-select-option>
      <et-select-option value="red">Red</et-select-option>
      <et-select-option value="blue">Blue</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class NullOptionTestHost {
  value = signal<string | null>(null);
}

@Component({
  template: `
    <et-select [(value)]="value" placeholder="Pick a team">
      <et-select-option value="red">Red</et-select-option>
      <et-select-option value="blue">Blue</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class NoNullOptionTestHost {
  value = signal<string | null>(null);
}

describe('SelectDirective null option', () => {
  let driver: SelectDriver<NullOptionTestHost>;

  beforeEach(() => {
    driver = mountSelect(NullOptionTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('shows the null option label for a null value instead of the placeholder', () => {
    expect(driver.valueText()).toBe('No team');
    expect(driver.valueEl()?.hasAttribute('data-placeholder')).toBe(false);
  });

  it('marks the null option selected and active when the panel opens', async () => {
    await driver.open();

    expect(driver.optionByLabel('No team')?.getAttribute('aria-selected')).toBe('true');
    expect(driver.activeLabel()).toBe('No team');
  });

  it('switches between the null option and another option', async () => {
    driver.host.value.set('red');
    driver.tick();

    expect(driver.valueText()).toBe('Red');

    await driver.open();
    driver.clickOptionByLabel('No team');

    expect(driver.host.value()).toBeNull();
    expect(driver.valueText()).toBe('No team');

    await driver.open();
    driver.clickOptionByLabel('Blue');

    expect(driver.host.value()).toBe('blue');
    expect(driver.valueText()).toBe('Blue');
  });
});

describe('SelectDirective null value without a null option', () => {
  let driver: SelectDriver<NoNullOptionTestHost>;

  beforeEach(() => {
    driver = mountSelect(NoNullOptionTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('shows the placeholder', () => {
    expect(driver.valueText()).toBe('Pick a team');
    expect(driver.valueEl()?.hasAttribute('data-placeholder')).toBe(true);
  });
});

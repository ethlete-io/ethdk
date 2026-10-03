import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { SelectDriver, mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select [value]="value()" (valueChange)="value.set($event)" placeholder="Pick a city">
      <et-select-option value="berlin">Berlin</et-select-option>
      <et-select-option value="bern">Bern</et-select-option>
      <et-select-option value="boston">Boston</et-select-option>
      <et-select-option value="new-delhi">New Delhi</et-select-option>
      <et-select-option value="new-york">New York</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class TypeaheadTestHost {
  value = signal<unknown>(null);
}

describe('SelectDirective typeahead', () => {
  let driver: SelectDriver<TypeaheadTestHost>;

  beforeEach(() => {
    driver = mountSelect(TypeaheadTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('cycles through options on a repeated character', async () => {
    await driver.open();

    expect(driver.activeLabel()).toBe('Berlin');

    driver.press('b');
    expect(driver.activeLabel()).toBe('Bern');

    driver.press('b');
    expect(driver.activeLabel()).toBe('Boston');

    driver.press('b');
    expect(driver.activeLabel()).toBe('Berlin');
  });

  it('cycles the closed value on a repeated character', () => {
    driver.press('b');
    driver.press('b');

    expect(driver.host.value()).toBe('bern');
    expect(driver.select.open()).toBe(false);
  });

  it('appends a space to a running typeahead instead of committing', async () => {
    await driver.open();

    for (const key of 'new y') {
      driver.press(key);
    }

    expect(driver.activeLabel()).toBe('New York');
    expect(driver.host.value()).toBeNull();
    expect(driver.select.open()).toBe(true);
  });

  it('appends a space to a running closed typeahead instead of opening', () => {
    for (const key of 'new y') {
      driver.press(key);
    }

    expect(driver.host.value()).toBe('new-york');
    expect(driver.select.open()).toBe(false);
  });

  it('commits the active option on a space outside a typeahead run', async () => {
    await driver.open();

    driver.press(' ');
    await driver.settle();

    expect(driver.host.value()).toBe('berlin');
  });
});

@Component({
  template: `
    <et-select [value]="value()" (valueChange)="value.set($event)" placeholder="Pick a city">
      <et-select-option value="berlin">Berlin</et-select-option>
      <et-select-option [disabled]="true" value="bern">Bern</et-select-option>
      <et-select-option value="boston">Boston</et-select-option>
      <et-select-option [disabled]="true" value="cairo">Cairo</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class DisabledTypeaheadTestHost {
  value = signal<unknown>(null);
}

describe('SelectDirective typeahead with disabled options', () => {
  let driver: SelectDriver<DisabledTypeaheadTestHost>;

  beforeEach(() => {
    driver = mountSelect(DisabledTypeaheadTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('skips disabled options while cycling the closed value', () => {
    driver.press('b');
    expect(driver.host.value()).toBe('berlin');

    driver.press('b');
    expect(driver.host.value()).toBe('boston');

    driver.press('b');
    expect(driver.host.value()).toBe('berlin');
  });

  it('never commits a disabled option that is the only match', () => {
    driver.press('c');

    expect(driver.host.value()).toBeNull();
    expect(driver.select.open()).toBe(false);
  });

  it('matches regardless of the case of the typed key', () => {
    driver.press('B');
    driver.press('O');

    expect(driver.host.value()).toBe('boston');
  });

  it('skips disabled options with the arrow keys', async () => {
    await driver.open();

    expect(driver.activeLabel()).toBe('Berlin');

    driver.press('ArrowDown');
    expect(driver.activeLabel()).toBe('Boston');

    driver.press('ArrowDown');
    expect(driver.activeLabel()).toBe('Boston');
  });
});

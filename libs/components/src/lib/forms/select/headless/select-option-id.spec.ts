import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { SelectDriver, mountSelect } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select placeholder="Pick a fruit">
      <et-select-option id="static-apple" value="apple">Apple</et-select-option>
      <et-select-option [id]="bananaId()" value="banana">Banana</et-select-option>
      <et-select-option value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class OptionIdTestHost {
  bananaId = signal('bound-banana');
}

describe('SelectOptionDirective id', () => {
  let driver: SelectDriver<OptionIdTestHost>;

  const activeDescendant = () => {
    const id = driver.trigger().getAttribute('aria-activedescendant');

    return id ? driver.pane()?.querySelector(`[id="${id}"]`) : null;
  };

  beforeEach(() => {
    driver = mountSelect(OptionIdTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('points aria-activedescendant at an option with a static id', async () => {
    await driver.open();

    expect(driver.activeLabel()).toBe('Apple');
    expect(activeDescendant()).toBe(driver.activeOption());
    expect(driver.activeOption()?.id).toBe('static-apple');
  });

  it('points aria-activedescendant at an option with a bound id', async () => {
    await driver.open();

    driver.press('ArrowDown');

    expect(driver.activeLabel()).toBe('Banana');
    expect(activeDescendant()).toBe(driver.activeOption());
    expect(driver.activeOption()?.id).toBe('bound-banana');
  });

  it('keeps a generated id on an option without one', async () => {
    await driver.open();

    driver.press('ArrowDown');
    driver.press('ArrowDown');

    expect(driver.activeLabel()).toBe('Cherry');
    expect(driver.activeOption()?.id).toMatch(/^et-select-option/);
    expect(activeDescendant()).toBe(driver.activeOption());
  });
});

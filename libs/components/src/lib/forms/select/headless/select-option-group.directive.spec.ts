import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelect, SelectDriver } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-select
      [value]="value()"
      [filterMode]="filterMode()"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a player"
    >
      <input etSelectSearch placeholder="Search" />
      <et-select-option-group label="Forwards">
        <et-select-option value="mbappe">Mbappé</et-select-option>
        <et-select-option value="haaland">Haaland</et-select-option>
      </et-select-option-group>
      <et-select-option-group label="Midfielders">
        <et-select-option value="bellingham">Bellingham</et-select-option>
      </et-select-option-group>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class GroupedSelectTestHost {
  value = signal<unknown>(null);
  filterMode = signal<'none' | 'internal' | 'external'>('internal');
}

describe('SelectOptionGroupDirective', () => {
  let driver: SelectDriver<GroupedSelectTestHost>;

  beforeEach(() => {
    driver = mountSelect(GroupedSelectTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders labelled groups wrapping their options', async () => {
    await driver.open();

    expect(driver.optionGroups().length).toBe(2);
    // aria-labelledby points at the visible header
    expect(driver.groupLabel(0)).toBe('Forwards');
    expect(driver.groupOptionCounts()).toEqual([2, 1]);
  });

  it('keeps keyboard navigation flat across groups', async () => {
    await driver.open();

    // three options total, registered flat in DOM order regardless of grouping
    expect(driver.select.visibleItems().map((item) => item.value())).toEqual(['mbappe', 'haaland', 'bellingham']);
    expect(driver.options().length).toBe(3);
  });

  it('hides a group once all its options are filtered out', async () => {
    await driver.open();
    driver.type('bell');
    await driver.settle();

    // "Forwards" has no match → hidden; "Midfielders" keeps Bellingham
    expect(driver.groupsHidden()).toEqual([true, false]);
  });

  it('shows all groups again when the query clears', async () => {
    await driver.open();
    driver.type('bell');
    await driver.settle();
    driver.type('');
    await driver.settle();

    expect(driver.groupsHidden()).toEqual([false, false]);
  });
});

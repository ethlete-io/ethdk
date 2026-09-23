import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelect, SelectDriver } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectCompareWith, SelectOptionData } from './select.tokens';

type Fruit = { id: number; name: string };

const fruit = (id: number, name: string): Fruit => ({ id, name });
const byId: SelectCompareWith<Fruit> = (a, b) => a.id === b.id;

@Component({
  template: `
    <et-select
      [value]="value()"
      [multiple]="multiple()"
      [selectAll]="selectAll()"
      [pickOnly]="pickOnly()"
      [maxSelection]="maxSelection()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      class="select"
      placeholder="Pick fruit"
    >
      <input etSelectSearch />
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="apricot">Apricot</et-select-option>
      <et-select-option [disabled]="true" value="banana">Banana</et-select-option>
      <et-select-option value="cherry">Cherry</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class ProjectedSelectAllTestHost {
  value = signal<unknown>([]);
  multiple = signal(true);
  selectAll = signal(true);
  pickOnly = signal(false);
  maxSelection = signal<number | undefined>(undefined);
  mixed = signal(false);
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [options]="options"
      [compareWith]="compareWith"
      (valueChange)="value.set($event)"
      class="select"
      multiple
      selectAll
      placeholder="Pick fruit"
    />
  `,
  imports: [SELECT_IMPORTS],
})
class DataSelectAllTestHost {
  value = signal<unknown>([]);
  options: SelectOptionData<Fruit>[] = [
    { value: fruit(1, 'Apple'), label: 'Apple' },
    { value: fruit(2, 'Banana'), label: 'Banana' },
    { value: fruit(3, 'Cherry'), label: 'Cherry' },
  ];
  compareWith = byId;
}

describe('SelectDirective (selectAll)', () => {
  let driver: SelectDriver<ProjectedSelectAllTestHost>;

  const selectAllRow = () => driver.paneEl('.et-select-all-option');

  beforeEach(() => {
    driver = mountSelect(ProjectedSelectAllTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders a tri-state row as the first option of a multi select', async () => {
    await driver.open();

    expect(driver.options()[0]).toBe(selectAllRow());
    expect(selectAllRow()?.textContent?.trim()).toBe('Select all');
    expect(selectAllRow()?.getAttribute('aria-checked')).toBe('false');

    driver.host.value.set(['apple']);
    driver.tick();

    expect(selectAllRow()?.getAttribute('aria-checked')).toBe('mixed');
    expect(selectAllRow()?.querySelector('.et-select-all-option-dash')).not.toBeNull();
    expect(selectAllRow()?.querySelector('.et-icon')).toBeNull();

    driver.host.value.set(['apple', 'apricot', 'cherry']);
    driver.tick();

    expect(selectAllRow()?.getAttribute('aria-checked')).toBe('true');
    expect(selectAllRow()?.querySelector('.et-select-all-option-dash')).toBeNull();
  });

  it('selects every enabled option and leaves a disabled one alone', async () => {
    await driver.open();

    selectAllRow()?.click();
    driver.tick();

    expect(driver.host.value()).toEqual(['apple', 'apricot', 'cherry']);
    expect(driver.select.selectAllState()).toBe('all');
  });

  it('deselects the enabled options once all of them are selected, keeping other values', async () => {
    driver.host.value.set(['banana', 'custom', 'apple', 'apricot', 'cherry']);
    driver.tick();
    await driver.open();

    selectAllRow()?.click();
    driver.tick();

    expect(driver.host.value()).toEqual(['banana', 'custom']);
  });

  it('acts on the options the search leaves visible', async () => {
    await driver.open();
    driver.type('ap');
    driver.tick();

    selectAllRow()?.click();
    driver.tick();

    expect(driver.host.value()).toEqual(['apple', 'apricot']);
  });

  it('stops adding at maxSelection', async () => {
    driver.host.maxSelection.set(2);
    driver.tick();
    await driver.open();

    selectAllRow()?.click();
    driver.tick();

    expect(driver.host.value()).toEqual(['apple', 'apricot']);
  });

  it('replaces a mixed value with every enabled option', async () => {
    driver.host.value.set(['cherry']);
    driver.host.mixed.set(true);
    driver.tick();
    await driver.open();

    selectAllRow()?.click();
    driver.tick();

    expect(driver.host.value()).toEqual(['apple', 'apricot', 'cherry']);
    expect(driver.host.mixed()).toBe(false);
  });

  it('is reachable with the keyboard as the first row', async () => {
    await driver.open();

    expect(driver.activeLabel()).toBe('Apple');

    driver.pressInSearch('ArrowUp');
    driver.tick();

    expect(driver.activeOption()).toBe(selectAllRow());
    expect(driver.searchInput().getAttribute('aria-activedescendant')).toBe(selectAllRow()?.id);

    driver.pressInSearch('Enter');
    driver.tick();

    expect(driver.host.value()).toEqual(['apple', 'apricot', 'cherry']);

    driver.pressInSearch('ArrowDown');
    driver.tick();

    expect(driver.activeLabel()).toBe('Apple');
  });

  it('does not render without selectAll, for a single select, or in pickOnly mode', async () => {
    driver.host.selectAll.set(false);
    driver.tick();
    await driver.open();

    expect(selectAllRow()).toBeNull();

    driver.host.selectAll.set(true);
    driver.host.pickOnly.set(true);
    driver.tick();

    expect(selectAllRow()).toBeNull();

    driver.host.pickOnly.set(false);
    driver.host.multiple.set(false);
    driver.host.value.set(null);
    driver.tick();

    expect(selectAllRow()).toBeNull();
  });
});

describe('SelectDirective (selectAll, data-driven with compareWith)', () => {
  let driver: SelectDriver<DataSelectAllTestHost>;

  beforeEach(() => {
    driver = mountSelect(DataSelectAllTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('matches equal objects instead of adding duplicates', async () => {
    driver.host.value.set([fruit(2, 'Banana')]);
    driver.tick();
    await driver.open();

    expect(driver.paneEl('.et-select-all-option')?.getAttribute('aria-checked')).toBe('mixed');

    driver.paneEl('.et-select-all-option')?.click();
    driver.tick();

    expect((driver.host.value() as Fruit[]).map((value) => value.id)).toEqual([2, 1, 3]);

    driver.paneEl('.et-select-all-option')?.click();
    driver.tick();

    expect(driver.host.value()).toEqual([]);
  });
});

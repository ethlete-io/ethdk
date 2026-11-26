import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelect, SelectDriver } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectCompareWith, SelectOptionData, SelectValueKey } from './select.tokens';

type Fruit = { id: number; name: string };

const OPTION_COUNT = 2_000;

const makeOptions = (count = OPTION_COUNT): SelectOptionData<Fruit>[] =>
  Array.from({ length: count }, (_, index) => ({
    value: { id: index, name: `Fruit ${index}` },
    label: `Fruit ${index}`,
  }));

let keyCalls = 0;
let compareCalls = 0;

const countedKey: SelectValueKey<Fruit> = (fruit) => {
  keyCalls++;

  return fruit.id;
};

const countedCompare: SelectCompareWith<Fruit> = (a, b) => {
  compareCalls++;

  return a.id === b.id;
};

const expectSameItems = (items: readonly unknown[], before: readonly unknown[]) => {
  expect(items.length).toBe(before.length);
  expect(items.every((item, index) => item === before[index])).toBe(true);
};

@Component({
  template: `
    <et-select
      [value]="value()"
      [options]="options()"
      [multiple]="multiple()"
      [compareWith]="compareWith"
      [valueKey]="valueKey()"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a fruit"
    />
  `,
  imports: [SELECT_IMPORTS],
})
class ValueKeyTestHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  options = signal<SelectOptionData[]>(makeOptions());
  compareWith = countedCompare;
  valueKey = signal<SelectValueKey<Fruit> | null>(countedKey);
}

describe('SelectDirective (valueKey)', () => {
  let driver: SelectDriver<ValueKeyTestHost>;

  beforeEach(() => {
    keyCalls = 0;
    compareCalls = 0;
    driver = mountSelect(ValueKeyTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('attaches the element of a windowed row', async () => {
    await driver.open();

    expect(driver.options().length).toBeLessThan(OPTION_COUNT);
    expect(driver.select.selection.items()[0]!.element()).toBe(driver.options()[0]);
  });

  it('syncs a refetched list of fresh instances in linear time and reuses every row', () => {
    const itemsBefore = driver.select.selection.items();

    keyCalls = 0;
    driver.host.options.set(makeOptions());
    driver.tick();

    expect(keyCalls).toBeLessThanOrEqual(2 * OPTION_COUNT);
    expect(compareCalls).toBe(0);
    expectSameItems(driver.select.selection.items(), itemsBefore);
  });

  it('matches a model value by key and keeps the active option across a refetch', async () => {
    driver.host.options.set(makeOptions(3));
    driver.host.value.set({ id: 1, name: 'A copy' });
    driver.tick();

    expect(driver.select.displayValue()).toBe('Fruit 1');

    await driver.open();

    const active = driver.select.activeItem();

    expect(active?.label()).toBe('Fruit 1');

    driver.host.options.set(makeOptions(3));
    driver.tick();

    expect(driver.select.activeItem()).toBe(active);
    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(compareCalls).toBe(0);
  });

  it('skips options whose keys repeat', () => {
    driver.host.options.set([...makeOptions(2), { value: { id: 0, name: 'Again' }, label: 'Again' }]);
    driver.tick();

    expect(driver.select.selection.items().map((item) => item.label())).toEqual(['Fruit 0', 'Fruit 1']);
  });

  it('falls back to compareWith when the key is removed', () => {
    driver.host.options.set(makeOptions(3));
    driver.tick();

    const itemsBefore = driver.select.selection.items();

    driver.host.valueKey.set(null);
    driver.host.options.set(makeOptions(3));
    driver.host.value.set({ id: 2, name: 'A copy' });
    driver.tick();

    expectSameItems(driver.select.selection.items(), itemsBefore);
    expect(driver.select.displayValue()).toBe('Fruit 2');
    expect(compareCalls).toBeGreaterThan(0);
  });
});

import { Component, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import '../../../../test-helpers';
import { mountSelect, SelectDriver } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectCompareWith, SelectOptionData } from './select.tokens';

type Fruit = { id: number; name: string };

const fruit = (id: number, name: string): Fruit => ({ id, name });
const byId: SelectCompareWith<Fruit> = (a, b) => a.id === b.id;

const makeOptions = (): SelectOptionData<Fruit>[] => [
  { value: fruit(1, 'Apple'), label: 'Apple' },
  { value: fruit(2, 'Banana'), label: 'Banana' },
  { value: fruit(3, 'Cherry'), label: 'Cherry' },
];

@Component({
  template: `
    <et-select
      [value]="value()"
      [multiple]="multiple()"
      [compareWith]="compareWith()"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a fruit"
    >
      @for (option of options; track option.id) {
        <et-select-option [value]="option">{{ option.name }}</et-select-option>
      }
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class ProjectedCompareWithTestHost {
  options = [fruit(1, 'Apple'), fruit(2, 'Banana'), fruit(3, 'Cherry')];
  value = signal<unknown>(null);
  multiple = signal(false);
  compareWith = signal<SelectCompareWith<Fruit>>(byId);
}

@Component({
  template: `
    <et-select
      [value]="value()"
      [options]="options()"
      [multiple]="multiple()"
      [compareWith]="compareWith"
      (valueChange)="value.set($event)"
      class="select"
      placeholder="Pick a fruit"
    />
  `,
  imports: [SELECT_IMPORTS],
})
class DataCompareWithTestHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  options = signal<SelectOptionData[]>(makeOptions());
  compareWith = byId;
}

@Component({
  template: `
    <et-select [formField]="demoForm.fruit" [compareWith]="compareWith" placeholder="Pick a fruit">
      <et-select-option [value]="apple">Apple</et-select-option>
      <et-select-option [value]="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [FormField, SELECT_IMPORTS],
})
class FormCompareWithTestHost {
  apple = fruit(1, 'Apple');
  banana = fruit(2, 'Banana');
  model = signal<{ fruit: Fruit | null }>({ fruit: fruit(2, 'Banana') });
  demoForm = form(this.model);
  compareWith = byId;
}

describe('SelectDirective (compareWith, projected options)', () => {
  let driver: SelectDriver<ProjectedCompareWithTestHost>;

  beforeEach(() => {
    driver = mountSelect(ProjectedCompareWithTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('matches an equal object that is not the option instance', async () => {
    driver.host.value.set(fruit(2, 'Banana'));
    driver.tick();

    expect(driver.select.displayValue()).toBe('Banana');
    expect(driver.select.selectedItems().map((item) => item.label())).toEqual(['Banana']);

    await driver.open();

    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(driver.activeLabel()).toBe('Banana');
  });

  it('falls back to reference equality without a comparator', () => {
    driver.host.compareWith.set((a, b) => a === b);
    driver.host.value.set(fruit(2, 'Banana'));
    driver.tick();

    expect(driver.select.selectedItems()).toEqual([]);
    expect(driver.select.selectedEntries()[0]?.item).toBeNull();
  });

  it('toggles an equal object off instead of adding a duplicate (multiple)', async () => {
    driver.host.multiple.set(true);
    driver.host.value.set([fruit(1, 'Apple')]);
    driver.tick();

    expect(driver.chipLabels()).toEqual(['Apple']);

    await driver.open();

    driver.clickOption(0);

    expect(driver.host.value()).toEqual([]);

    driver.clickOption(2);

    expect(driver.host.value()).toEqual([fruit(3, 'Cherry')]);
  });

  it('removes an equal object through its chip', () => {
    driver.host.multiple.set(true);
    driver.host.value.set([fruit(1, 'Apple'), fruit(3, 'Cherry')]);
    driver.tick();

    driver.select.deselectValue(fruit(1, 'Apple'));
    driver.tick();

    expect(driver.host.value()).toEqual([fruit(3, 'Cherry')]);
  });
});

describe('SelectDirective (compareWith, data-driven options)', () => {
  let driver: SelectDriver<DataCompareWithTestHost>;

  beforeEach(() => {
    driver = mountSelect(DataCompareWithTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('keeps the selection and the active option when the options arrive as fresh instances', async () => {
    driver.host.value.set(fruit(2, 'Banana'));
    driver.tick();

    await driver.open();

    const active = driver.select.activeItem();

    expect(active?.label()).toBe('Banana');

    driver.host.options.set(makeOptions());
    driver.tick();

    expect(driver.select.selection.items().length).toBe(3);
    expect(driver.select.activeItem()).toBe(active);
    expect(driver.select.displayValue()).toBe('Banana');
    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('skips options whose values the comparator treats as duplicates', () => {
    driver.host.options.set([...makeOptions(), { value: fruit(1, 'Apple again'), label: 'Apple again' }]);
    driver.tick();

    expect(driver.select.selection.items().map((item) => item.label())).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('keeps the label of an equal value once its option is gone', () => {
    driver.host.value.set(fruit(3, 'Cherry'));
    driver.tick();

    driver.host.options.set(makeOptions().slice(0, 1));
    driver.tick();
    driver.host.value.set(fruit(3, 'Cherry'));
    driver.tick();

    expect(driver.select.displayValue()).toBe('Cherry');
  });
});

describe('SelectDirective (compareWith, signal forms)', () => {
  it('selects the option equal to the form value', async () => {
    const driver = mountSelect(FormCompareWithTestHost);

    expect(driver.select.displayValue()).toBe('Banana');

    driver.host.model.set({ fruit: fruit(1, 'Apple') });
    driver.tick();

    await driver.open();

    expect(driver.options().map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false']);

    await driver.close();
  });
});

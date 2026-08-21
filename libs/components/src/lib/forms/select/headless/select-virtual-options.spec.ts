import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelect, SelectDriver } from '../../testing/select-driver';
import { SELECT_IMPORTS } from '../select.imports';
import { SelectOptionData } from './select.tokens';

// Deliberately not template literals: an interpolated one above the inline templates below breaks
// Angular language service completions there. See `ethlete/no-template-literal-before-inline-template`.
const makeOptions = (count: number): SelectOptionData[] =>
  Array.from({ length: count }, (_, index) => ({
    value: 'item-' + (index + 1),
    label: 'Item ' + (index + 1),
  }));

@Component({
  template: `
    <et-select
      [value]="value()"
      [options]="options()"
      [multiple]="multiple()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      class="select"
      placeholder="Pick an item"
    >
      <input etSelectSearch placeholder="Search" />
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class VirtualSelectTestHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  mixed = signal(false);
  options = signal<SelectOptionData[]>(makeOptions(200));
}

@Component({
  template: `
    <et-select [value]="value()" [options]="options()" (valueChange)="value.set($event)" class="select">
      <ng-template etSelectOptionTemplate let-option>
        <span class="custom-row">{{ option.label }} ({{ option.tag }})</span>
      </ng-template>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class OptionTemplateTestHost {
  value = signal<unknown>(null);
  options = signal<(SelectOptionData & { tag: string })[]>([
    { value: 'a', label: 'Alpha', tag: 'first' },
    { value: 'b', label: 'Beta', tag: 'second' },
  ]);
}

describe('SelectDirective (data-driven options)', () => {
  let driver: SelectDriver<VirtualSelectTestHost>;

  beforeEach(() => {
    driver = mountSelect(VirtualSelectTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('registers every option from data and resolves labels without rendering anything', () => {
    expect(driver.select.selection.items().length).toBe(200);
    expect(driver.options().length).toBe(0);

    driver.host.value.set('item-150');
    driver.tick();

    expect(driver.select.displayValue()).toBe('Item 150');
  });

  it('renders only a window of rows, with paddings standing in for the rest', async () => {
    await driver.open();

    const rendered = driver.options();

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(50);
    expect(rendered[0]!.textContent).toContain('Item 1');

    expect(driver.virtualPadding().start).toBe(0);
    expect(driver.virtualPadding().end).toBeGreaterThan(0);
  });

  it('leaves a short list unwindowed: every row rendered, no paddings', async () => {
    driver.host.options.set(makeOptions(8));
    driver.tick();

    await driver.open();

    expect(driver.select.windowsOptions()).toBe(false);
    expect(driver.options().length).toBe(8);
    expect(driver.virtualPadding()).toEqual({ start: 0, end: 0 });
  });

  it('keyboard-navigates the full data set, not just the rendered window', async () => {
    await driver.open();

    // dispatched through the trigger handler: with an inline search input, End/Home stay
    // native caret editing on the input, but search-less selects reach this path directly
    driver.select.handleTriggerKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    driver.tick();

    const active = driver.select.activeItem();

    expect(active?.value()).toBe('item-200');
    expect(driver.searchInput().getAttribute('aria-activedescendant')).toBe(active?.id());

    driver.select.handleTriggerKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    driver.tick();

    expect(driver.host.value()).toBe('item-200');
  });

  it('commits a clicked rendered row and reflects the selection on it', async () => {
    await driver.open();

    driver.clickOption(2);
    await driver.settle();

    expect(driver.host.value()).toBe('item-3');

    await driver.open();

    const reopened = driver.options()[2]!;

    expect(reopened.getAttribute('aria-selected')).toBe('true');
    expect(reopened.hasAttribute('data-selected')).toBe(true);
  });

  it('masks a data-driven raw value, clears virtual option selection, and resolves on commit', async () => {
    driver.host.value.set('item-150');
    driver.host.mixed.set(true);
    driver.tick();

    expect(driver.select.value()).toBe('item-150');
    expect(driver.select.displayValue()).toBe('Mixed');

    await driver.open();

    const rendered = driver.options();

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.every((row) => row.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(driver.select.activeItem()?.value()).toBe('item-1');

    driver.clickOption(2);
    await driver.settle();

    expect(driver.host.value()).toBe('item-3');
    expect(driver.host.mixed()).toBe(false);
  });

  it('filters data options with the internal filter mode', async () => {
    await driver.open();
    driver.type('item 19');

    // "Item 19" and "Item 190"–"Item 199"
    expect(driver.select.visibleItems().length).toBe(11);
    expect(driver.options().length).toBe(11);

    driver.type('no such item');

    expect(driver.options().length).toBe(0);
    expect(driver.paneText()).toContain('No results');
  });

  it('updates items in place when the options data changes and keeps selected labels of removed entries', () => {
    driver.host.value.set('item-2');
    driver.tick();

    expect(driver.select.displayValue()).toBe('Item 2');

    driver.host.options.set([{ value: 'item-1', label: 'First (renamed)' }]);
    driver.tick();

    expect(driver.select.selection.items().length).toBe(1);
    expect(driver.select.selection.items()[0]!.label()).toBe('First (renamed)');
    // the selected value's option is gone - its label survives via the label cache
    expect(driver.select.displayValue()).toBe('Item 2');
  });

  it('toggles values in multi mode from data rows', async () => {
    driver.host.multiple.set(true);
    driver.host.value.set([]);
    driver.tick();

    await driver.open();

    driver.clickOption(0);

    expect(driver.host.value()).toEqual(['item-1']);

    driver.clickOption(1);

    expect(driver.host.value()).toEqual(['item-1', 'item-2']);
  });
});

describe('SelectDirective (option template)', () => {
  it('renders data rows through etSelectOptionTemplate with the source entry as context', async () => {
    const driver = mountSelect(OptionTemplateTestHost);

    await driver.open();

    expect(driver.paneEls('.custom-row').map((row) => row.textContent?.trim())).toEqual([
      'Alpha (first)',
      'Beta (second)',
    ]);

    await driver.close();
  });
});

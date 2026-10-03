import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

type Fruit = { value: string; disabled?: boolean };

@Component({
  template: `
    <div [value]="value()" [multiple]="multiple()" (valueChange)="value.set($event)" etSelectionList>
      @for (option of options(); track option.value) {
        <div [value]="option.value" [disabled]="option.disabled ?? false" etSelectionOption>
          {{ option.value }}
        </div>
      }
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class EdgeCaseHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  options = signal<Fruit[]>([{ value: 'apple' }, { value: 'banana' }, { value: 'cherry' }]);
}

describe('SelectionListDirective (edge cases)', () => {
  let driver: SelectionListDriver<EdgeCaseHost>;

  const focused = () => driver.optionEls().indexOf(document.activeElement as HTMLElement);

  const settle = async () => {
    driver.detectChanges();
    await Promise.resolve();
    driver.detectChanges();
  };

  beforeEach(() => {
    driver = mountSelectionList(EdgeCaseHost);
  });

  it('starts a multi selection from a null value', () => {
    driver.host.multiple.set(true);
    driver.detectChanges();

    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);

    driver.selectOption(1);

    expect(driver.host.value()).toEqual(['banana']);
  });

  it('checks nothing and keeps the first option as tab stop for a value no option has', () => {
    driver.host.value.set('kiwi');
    driver.detectChanges();

    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'false', 'false']);
    expect(driver.optionAttrs('tabindex')).toEqual(['0', '-1', '-1']);
  });

  it('renders an empty option list without a tab stop or an error', () => {
    driver.host.options.set([]);
    driver.host.value.set('apple');
    driver.detectChanges();

    expect(driver.optionEls()).toEqual([]);
    expect(() => driver.list.focus()).not.toThrow();
  });

  it('clears a single value when its option is removed', async () => {
    driver.selectOption(1);
    driver.host.options.set([{ value: 'apple' }, { value: 'cherry' }]);
    await settle();

    expect(driver.host.value()).toBeNull();
  });

  it('drops only the removed value from a multi selection', async () => {
    driver.host.multiple.set(true);
    driver.detectChanges();
    driver.selectOption(0);
    driver.selectOption(2);
    driver.host.options.set([{ value: 'apple' }, { value: 'banana' }]);
    await settle();

    expect(driver.host.value()).toEqual(['apple']);
  });

  it('re-checks a value written back once its options return', async () => {
    driver.selectOption(1);
    driver.host.options.set([]);
    await settle();

    expect(driver.host.value()).toBeNull();

    driver.host.value.set('banana');
    driver.host.options.set([{ value: 'apple' }, { value: 'banana' }]);
    driver.detectChanges();

    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'true']);
  });

  it('wraps arrow navigation past disabled options at both ends', () => {
    driver.host.options.set([
      { value: 'apple', disabled: true },
      { value: 'banana' },
      { value: 'cherry', disabled: true },
    ]);
    driver.detectChanges();

    driver.focusOption(1);
    driver.pressOption(1, 'ArrowDown');

    expect(focused()).toBe(1);
    expect(driver.host.value()).toBe('banana');

    driver.pressOption(1, 'ArrowUp');

    expect(focused()).toBe(1);
  });

  it('stays put on arrow keys when every option is disabled', () => {
    driver.host.options.set([
      { value: 'apple', disabled: true },
      { value: 'banana', disabled: true },
    ]);
    driver.detectChanges();

    expect(() => driver.pressOption(0, 'ArrowDown')).not.toThrow();
    expect(() => driver.pressOption(0, 'End')).not.toThrow();
    expect(driver.host.value()).toBeNull();
  });
});

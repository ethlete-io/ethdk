import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

@Component({
  template: `
    <div [value]="value()" (valueChange)="value.set($event)" etSelectionList>
      <div etSelectionOption value="a"></div>
      <div disabled etSelectionOption value="b"></div>
      <div etSelectionOption value="c"></div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class OptionTestHost {
  value = signal<string | null>(null);
}

describe('SelectionOptionDirective', () => {
  let driver: SelectionListDriver<OptionTestHost>;

  beforeEach(() => {
    driver = mountSelectionList(OptionTestHost);
  });

  it('should create options', () => {
    expect(driver.optionEls()).toHaveLength(3);
  });

  it('should have role radio in single select', () => {
    expect(driver.optionAttr(0, 'role')).toBe('radio');
  });

  it('should apply aria-disabled on disabled option', () => {
    expect(driver.optionAttr(1, 'aria-disabled')).toBe('true');
  });

  it('should not select a disabled option on click', () => {
    driver.selectOption(1);

    expect(driver.host.value()).toBeNull();
  });

  it('should set aria-checked on selected option', () => {
    driver.selectOption(0);

    expect(driver.optionAttr(0, 'aria-checked')).toBe('true');
    expect(driver.optionAttr(2, 'aria-checked')).toBe('false');
  });
});

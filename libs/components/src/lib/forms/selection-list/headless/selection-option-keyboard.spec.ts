import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { SelectionListDirective } from './selection-list.directive';
import { SelectionOptionDirective } from './selection-option.directive';

@Component({
  template: `
    <div
      [value]="value()"
      [multiple]="multiple()"
      [readonly]="readonly()"
      (valueChange)="value.set($event)"
      etSelectionList
    >
      <div disabled etSelectionOption value="apple">Apple</div>
      <div etSelectionOption value="banana">Banana</div>
      <div etSelectionOption value="blueberry">Blueberry</div>
      <div etSelectionOption value="cherry">Cherry</div>
      <div disabled etSelectionOption value="date">Date</div>
    </div>
  `,
  imports: [SelectionListDirective, SelectionOptionDirective],
})
class KeyboardTestHost {
  value = signal<unknown>(null);
  multiple = signal(false);
  readonly = signal(false);
}

describe('SelectionOptionDirective (Home/End and typeahead)', () => {
  let driver: SelectionListDriver<KeyboardTestHost>;

  const focused = () => driver.optionEls().indexOf(document.activeElement as HTMLElement);

  beforeEach(() => {
    vi.useFakeTimers();
    driver = mountSelectionList(KeyboardTestHost);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('radio group', () => {
    it('End moves focus to and checks the last enabled option, Home the first', () => {
      driver.focusOption(1);
      driver.pressOption(1, 'End');

      expect(focused()).toBe(3);
      expect(driver.host.value()).toBe('cherry');

      driver.pressOption(3, 'Home');

      expect(focused()).toBe(1);
      expect(driver.host.value()).toBe('banana');
    });

    it('a typed character moves to the next option starting with it, cycling on repeats', () => {
      driver.focusOption(3);
      driver.pressOption(3, 'b');

      expect(focused()).toBe(1);
      expect(driver.host.value()).toBe('banana');

      vi.advanceTimersByTime(600);
      driver.pressOption(1, 'b');

      expect(focused()).toBe(2);
      expect(driver.host.value()).toBe('blueberry');
    });

    it('typed characters in quick succession match a prefix', () => {
      driver.focusOption(1);
      driver.pressOption(1, 'b');
      driver.pressOption(2, 'l');

      expect(focused()).toBe(2);
      expect(driver.host.value()).toBe('blueberry');
    });

    it('skips disabled options and ignores a prefix nothing matches', () => {
      driver.focusOption(1);
      driver.pressOption(1, 'd');

      expect(focused()).toBe(1);

      vi.advanceTimersByTime(600);
      driver.pressOption(1, 'a');

      expect(focused()).toBe(1);
      expect(driver.host.value()).toBeNull();
    });

    it('moves focus without checking while readonly', () => {
      driver.host.readonly.set(true);
      driver.tick();
      driver.focusOption(1);
      driver.pressOption(1, 'End');

      expect(focused()).toBe(3);

      driver.pressOption(3, 'b');

      expect(focused()).toBe(1);
      expect(driver.host.value()).toBeNull();
    });
  });

  describe('checkbox group', () => {
    beforeEach(() => {
      driver.host.multiple.set(true);
      driver.host.value.set([]);
      driver.tick();
    });

    it('Home, End and typeahead move focus without toggling', () => {
      driver.focusOption(2);
      driver.pressOption(2, 'End');

      expect(focused()).toBe(3);

      driver.pressOption(3, 'Home');

      expect(focused()).toBe(1);

      driver.pressOption(1, 'c');

      expect(focused()).toBe(3);
      expect(driver.host.value()).toEqual([]);
    });
  });
});

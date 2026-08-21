import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountSwitch, SwitchDriver } from '../../testing/switch-driver';
import { SwitchDirective } from './switch.directive';

@Component({
  template: `<div etSwitch></div>`,
  imports: [SwitchDirective],
})
class StandaloneSwitchTestHost {}

@Component({
  template: `<div [indeterminate]="indeterminate()" etSwitch></div>`,
  imports: [SwitchDirective],
})
class IndeterminateSwitchTestHost {
  indeterminate = signal(true);
}

describe('SwitchDirective', () => {
  describe('standalone', () => {
    let driver: SwitchDriver<StandaloneSwitchTestHost>;

    beforeEach(() => {
      driver = mountSwitch(StandaloneSwitchTestHost);
    });

    it('should have role switch', () => {
      expect(driver.attr('role')).toBe('switch');
    });

    it('should have aria-checked false by default', () => {
      expect(driver.attr('aria-checked')).toBe('false');
    });

    it('should toggle checked on click', () => {
      driver.toggle();

      expect(driver.switch.checked()).toBe(true);
      expect(driver.attr('aria-checked')).toBe('true');
    });
  });

  describe('indeterminate', () => {
    let driver: SwitchDriver<IndeterminateSwitchTestHost>;

    beforeEach(() => {
      driver = mountSwitch(IndeterminateSwitchTestHost);
    });

    it('should reflect data-indeterminate while indeterminate but keep aria-checked boolean', () => {
      // role=switch does not support aria-checked="mixed" - it stays boolean
      expect(driver.attr('aria-checked')).toBe('false');
      expect(driver.attr('data-indeterminate')).toBe('true');
    });

    it('should resolve to checked on the first toggle', () => {
      driver.toggle();

      expect(driver.switch.indeterminate()).toBe(false);
      expect(driver.switch.checked()).toBe(true);
      expect(driver.attr('data-indeterminate')).toBeNull();
      expect(driver.attr('aria-checked')).toBe('true');
    });
  });
});

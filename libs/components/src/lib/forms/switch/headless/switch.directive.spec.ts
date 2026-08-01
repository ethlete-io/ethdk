import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
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
    let fixture: ComponentFixture<StandaloneSwitchTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneSwitchTestHost] });
      fixture = TestBed.createComponent(StandaloneSwitchTestHost);
      fixture.detectChanges();
    });

    it('should have role switch', () => {
      const switchEl = fixture.nativeElement.querySelector('[etSwitch]');
      expect(switchEl.getAttribute('role')).toBe('switch');
    });

    it('should have aria-checked false by default', () => {
      const switchEl = fixture.nativeElement.querySelector('[etSwitch]');
      expect(switchEl.getAttribute('aria-checked')).toBe('false');
    });

    it('should toggle checked on click', () => {
      const switchEl = fixture.nativeElement.querySelector('[etSwitch]') as HTMLElement;
      const switchDir = (fixture.debugElement.children[0] as DebugElement).injector.get(SwitchDirective);

      switchEl.click();
      fixture.detectChanges();

      expect(switchDir.checked()).toBe(true);
      expect(switchEl.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('indeterminate', () => {
    let fixture: ComponentFixture<IndeterminateSwitchTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [IndeterminateSwitchTestHost] });
      fixture = TestBed.createComponent(IndeterminateSwitchTestHost);
      fixture.detectChanges();
    });

    it('should reflect data-indeterminate while indeterminate but keep aria-checked boolean', () => {
      const switchEl = fixture.nativeElement.querySelector('[etSwitch]');

      // role=switch does not support aria-checked="mixed" - it stays boolean
      expect(switchEl.getAttribute('aria-checked')).toBe('false');
      expect(switchEl.getAttribute('data-indeterminate')).toBe('true');
    });

    it('should resolve to checked on the first toggle', () => {
      const switchEl = fixture.nativeElement.querySelector('[etSwitch]') as HTMLElement;
      const switchDir = (fixture.debugElement.children[0] as DebugElement).injector.get(SwitchDirective);

      switchEl.click();
      fixture.detectChanges();

      expect(switchDir.indeterminate()).toBe(false);
      expect(switchDir.checked()).toBe(true);
      expect(switchEl.getAttribute('data-indeterminate')).toBeNull();
      expect(switchEl.getAttribute('aria-checked')).toBe('true');
    });
  });
});

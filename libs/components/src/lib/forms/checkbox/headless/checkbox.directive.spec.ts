import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { CheckboxDirective } from './checkbox.directive';

@Component({
  template: `
    <div etFormField>
      <div etCheckbox></div>
      <et-label>Accept terms</et-label>
    </div>
  `,
  imports: [CheckboxDirective, FormFieldDirective, LabelDirective],
})
class CheckboxInFormFieldTestHost {}

@Component({
  template: `<div etCheckbox></div>`,
  imports: [CheckboxDirective],
})
class StandaloneCheckboxTestHost {}

@Component({
  template: `<div [readonly]="readonly()" etCheckbox></div>`,
  imports: [CheckboxDirective],
})
class ReadonlyCheckboxTestHost {
  readonly = signal(true);
}

describe('CheckboxDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<CheckboxInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [CheckboxInFormFieldTestHost] });
      fixture = TestBed.createComponent(CheckboxInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should create', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      expect(checkboxEl).toBeTruthy();
    });

    it('should have role checkbox', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      expect(checkboxEl.getAttribute('role')).toBe('checkbox');
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const checkboxDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etCheckbox]'))
        .injector.get(CheckboxDirective);

      expect(checkboxDir.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('standalone', () => {
    let fixture: ComponentFixture<StandaloneCheckboxTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneCheckboxTestHost] });
      fixture = TestBed.createComponent(StandaloneCheckboxTestHost);
      fixture.detectChanges();
    });

    it('should create without a parent form field', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      expect(checkboxEl).toBeTruthy();
    });

    it('should have aria-checked false by default', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      expect(checkboxEl.getAttribute('aria-checked')).toBe('false');
    });

    it('should toggle checked on click', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]') as HTMLElement;
      const checkboxDir = (fixture.debugElement.children[0] as DebugElement).injector.get(CheckboxDirective);

      expect(checkboxDir.checked()).toBe(false);

      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(true);
      expect(checkboxEl.getAttribute('aria-checked')).toBe('true');
    });

    it('should toggle back to unchecked on second click', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]') as HTMLElement;
      const checkboxDir = (fixture.debugElement.children[0] as DebugElement).injector.get(CheckboxDirective);

      checkboxEl.click();
      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(false);
    });

    it('should set touched on blur', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]') as HTMLElement;
      const checkboxDir = (fixture.debugElement.children[0] as DebugElement).injector.get(CheckboxDirective);

      expect(checkboxDir.touched()).toBe(false);

      checkboxEl.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(checkboxDir.touched()).toBe(true);
    });

    it('should have tabindex 0 when not disabled', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      expect(checkboxEl.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('readonly', () => {
    let fixture: ComponentFixture<ReadonlyCheckboxTestHost>;
    let checkboxEl: HTMLElement;
    let checkboxDir: CheckboxDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ReadonlyCheckboxTestHost] });
      fixture = TestBed.createComponent(ReadonlyCheckboxTestHost);
      fixture.detectChanges();
      checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]');
      checkboxDir = (fixture.debugElement.children[0] as DebugElement).injector.get(CheckboxDirective);
    });

    it('blocks toggling but stays focusable with the normal look', () => {
      expect(checkboxEl.getAttribute('aria-readonly')).toBe('true');
      expect(checkboxEl.getAttribute('data-readonly')).toBe('true');
      // focusable and not dimmed — view-only, unlike disabled
      expect(checkboxEl.getAttribute('tabindex')).toBe('0');
      expect(checkboxEl.getAttribute('aria-disabled')).toBeNull();

      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(false);
    });

    it('toggles again once readonly is lifted', () => {
      fixture.componentInstance.readonly.set(false);
      fixture.detectChanges();

      expect(checkboxEl.getAttribute('aria-readonly')).toBeNull();

      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(true);
    });
  });
});

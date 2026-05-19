import { Component } from '@angular/core';
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
      const formFieldDir = fixture.debugElement.children[0].injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const checkboxDir = fixture.debugElement.children[0]
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
      const checkboxDir = fixture.debugElement.children[0].injector.get(CheckboxDirective);

      expect(checkboxDir.checked()).toBe(false);

      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(true);
      expect(checkboxEl.getAttribute('aria-checked')).toBe('true');
    });

    it('should toggle back to unchecked on second click', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]') as HTMLElement;
      const checkboxDir = fixture.debugElement.children[0].injector.get(CheckboxDirective);

      checkboxEl.click();
      checkboxEl.click();
      fixture.detectChanges();

      expect(checkboxDir.checked()).toBe(false);
    });

    it('should set touched on blur', () => {
      const checkboxEl = fixture.nativeElement.querySelector('[etCheckbox]') as HTMLElement;
      const checkboxDir = fixture.debugElement.children[0].injector.get(CheckboxDirective);

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
});

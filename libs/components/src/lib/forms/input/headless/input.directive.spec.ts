import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { InputDirective } from './input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Email</et-label>
      <input etInput type="email" placeholder="test@example.com" />
    </div>
  `,
  imports: [InputDirective, FormFieldDirective, LabelDirective],
})
class InputInFormFieldTestHost {}

@Component({
  template: `<input etInput type="text" placeholder="standalone" />`,
  imports: [InputDirective],
})
class StandaloneInputTestHost {}

describe('InputDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<InputInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [InputInFormFieldTestHost] });
      fixture = TestBed.createComponent(InputInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should create', () => {
      const inputEl = fixture.nativeElement.querySelector('[etInput]');
      expect(inputEl).toBeTruthy();
    });

    it('should register with parent form field', () => {
      const formFieldDir = fixture.debugElement.children[0]!.injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const inputDir = fixture.debugElement.children[0]!.query((el) =>
        el.nativeElement.matches('[etInput]'),
      ).injector.get(InputDirective);

      expect(inputDir.labelId()).toMatch(/^et-label-\d+$/);
    });

    it('should have null describedBy when no error or hint is present', () => {
      const inputDir = fixture.debugElement.children[0]!.query((el) =>
        el.nativeElement.matches('[etInput]'),
      ).injector.get(InputDirective);

      // describedBy is only set by the form field when there is an active error or hint
      expect(inputDir.describedById()).toBeNull();
    });
  });

  describe('standalone', () => {
    let fixture: ComponentFixture<StandaloneInputTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneInputTestHost] });
      fixture = TestBed.createComponent(StandaloneInputTestHost);
      fixture.detectChanges();
    });

    it('should create without a parent form field', () => {
      const inputEl = fixture.nativeElement.querySelector('[etInput]');
      expect(inputEl).toBeTruthy();
    });

    it('should have null labelId without parent', () => {
      const inputDir = fixture.debugElement.children[0]!.injector.get(InputDirective);
      expect(inputDir.labelId()).toBeNull();
    });

    it('should have null describedBy without parent', () => {
      const inputDir = fixture.debugElement.children[0]!.injector.get(InputDirective);
      expect(inputDir.describedById()).toBeNull();
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneInputTestHost>;
    let inputDir: InputDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneInputTestHost] });
      fixture = TestBed.createComponent(StandaloneInputTestHost);
      fixture.detectChanges();
      inputDir = fixture.debugElement.children[0]!.injector.get(InputDirective);
    });

    it('should have empty value by default', () => {
      expect(inputDir.value()).toBe('');
    });

    it('should not display error when not touched', () => {
      expect(inputDir.shouldDisplayError()).toBe(false);
    });

    it('should have text type by default', () => {
      expect(inputDir.type()).toBe('text');
    });
  });
});

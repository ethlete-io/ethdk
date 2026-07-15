import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { NumberInputDirective } from './number-input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Amount</et-label>
      <input etNumberInput type="number" placeholder="0" />
    </div>
  `,
  imports: [NumberInputDirective, FormFieldDirective, LabelDirective],
})
class NumberInputInFormFieldTestHost {}

@Component({
  template: `<input etNumberInput type="number" placeholder="standalone" />`,
  imports: [NumberInputDirective],
})
class StandaloneNumberInputTestHost {}

describe('NumberInputDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<NumberInputInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [NumberInputInFormFieldTestHost] });
      fixture = TestBed.createComponent(NumberInputInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const numberInputDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etNumberInput]'))
        .injector.get(NumberInputDirective);

      expect(numberInputDir.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneNumberInputTestHost>;
    let numberInputDir: NumberInputDirective;
    let nativeInput: HTMLInputElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneNumberInputTestHost] });
      fixture = TestBed.createComponent(StandaloneNumberInputTestHost);
      fixture.detectChanges();
      numberInputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(NumberInputDirective);
      nativeInput = fixture.nativeElement.querySelector('[etNumberInput]');
    });

    it('should have null value by default', () => {
      expect(numberInputDir.value()).toBeNull();
      expect(numberInputDir.hasValue()).toBe(false);
    });

    it('should sync a numeric native value', () => {
      nativeInput.value = '42.5';
      numberInputDir.syncFromNativeInput(nativeInput);

      expect(numberInputDir.value()).toBe(42.5);
      expect(numberInputDir.hasValue()).toBe(true);
    });

    it('should sync an empty native value to null', () => {
      nativeInput.value = '42';
      numberInputDir.syncFromNativeInput(nativeInput);
      nativeInput.value = '';
      numberInputDir.syncFromNativeInput(nativeInput);

      expect(numberInputDir.value()).toBeNull();
    });

    it('should expose the host input as nativeControl', () => {
      expect(numberInputDir.nativeControl()).toBe(nativeInput);
    });

    it('should not display error when not touched', () => {
      expect(numberInputDir.shouldDisplayError()).toBe(false);
    });
  });
});

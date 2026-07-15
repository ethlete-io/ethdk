import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { ColorInputDirective } from './color-input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Brand color</et-label>
      <input etColorInput type="color" />
    </div>
  `,
  imports: [ColorInputDirective, FormFieldDirective, LabelDirective],
})
class ColorInputInFormFieldTestHost {}

@Component({
  template: `<input etColorInput type="color" />`,
  imports: [ColorInputDirective],
})
class StandaloneColorInputTestHost {}

describe('ColorInputDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<ColorInputInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ColorInputInFormFieldTestHost] });
      fixture = TestBed.createComponent(ColorInputInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const colorInputDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etColorInput]'))
        .injector.get(ColorInputDirective);

      expect(colorInputDir.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneColorInputTestHost>;
    let colorInputDir: ColorInputDirective;
    let nativeInput: HTMLInputElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneColorInputTestHost] });
      fixture = TestBed.createComponent(StandaloneColorInputTestHost);
      fixture.detectChanges();
      colorInputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(ColorInputDirective);
      nativeInput = fixture.nativeElement.querySelector('[etColorInput]');
    });

    it('should have null value and black resolved color by default', () => {
      expect(colorInputDir.value()).toBeNull();
      expect(colorInputDir.hasValue()).toBe(false);
      expect(colorInputDir.resolvedColor()).toBe('#000000');
    });

    it('should sync a picked color', () => {
      nativeInput.value = '#ff0000';
      colorInputDir.syncFromNativeInput(nativeInput);

      expect(colorInputDir.value()).toBe('#ff0000');
      expect(colorInputDir.hasValue()).toBe(true);
      expect(colorInputDir.resolvedColor()).toBe('#ff0000');
    });

    it('should expose the host input as nativeControl', () => {
      expect(colorInputDir.nativeControl()).toBe(nativeInput);
    });

    it('should not display error when not touched', () => {
      expect(colorInputDir.shouldDisplayError()).toBe(false);
    });
  });
});

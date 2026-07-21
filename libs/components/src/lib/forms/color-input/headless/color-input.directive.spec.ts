import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { COLOR_INPUT_IMPORTS } from '../color-input.imports';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
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

@Component({
  template: `
    <et-color-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed colors"
    />
  `,
  imports: [COLOR_INPUT_IMPORTS],
})
class MixedColorInputTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
}

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

  describe('mixed state', () => {
    const setup = () => {
      TestBed.configureTestingModule({ imports: [MixedColorInputTestHost] });

      const fixture = TestBed.createComponent(MixedColorInputTestHost);

      fixture.detectChanges();

      const host = fixture.componentInstance;
      const nativeInput = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const swatch = () => fixture.nativeElement.querySelector('.et-color-input-swatch') as HTMLElement;
      const valueSlot = () => fixture.nativeElement.querySelector('.et-color-input-value') as HTMLElement;
      const pick = (color: string) => {
        const inputElement = nativeInput();

        inputElement.value = color;
        inputElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        fixture.detectChanges();
      };
      const enterMixed = (rawValue: string) => {
        host.value.set(rawValue);
        host.mixed.set(true);
        fixture.detectChanges();
      };

      return { fixture, host, nativeInput, swatch, valueSlot, pick, enterMixed };
    };

    describeMixedStateContract(() => {
      const { fixture, host, nativeInput, swatch, valueSlot, pick, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('#ff0000'),
        rawValue: () => '#ff0000',
        value: () => host.value(),
        mixed: () => host.mixed(),
        hostElement: () => fixture.nativeElement.querySelector('et-color-input') as HTMLElement,
        writeValueExternally: () => {
          host.value.set('#00ff00');
          fixture.detectChanges();
        },
        externallyWrittenValue: () => '#00ff00',
        commit: () => pick('#123456'),
        committedValue: () => '#123456',
        assertMasked: () => {
          // the value slot shows the mixed label, the swatch drops its inline color (the CSS
          // neutral treatment takes over) and the picker sits on the default, not the raw color
          expect(valueSlot().textContent?.trim()).toBe('Mixed colors');
          expect(swatch().style.backgroundColor).toBe('');
          expect(nativeInput().value).toBe('#000000');
        },
      };
    });

    it('restores the swatch and value text after a pick resolves mixed', () => {
      const { host, swatch, valueSlot, pick, enterMixed } = setup();

      enterMixed('#ff0000');
      pick('#123456');

      expect(host.mixed()).toBe(false);
      expect(host.value()).toBe('#123456');
      expect(valueSlot().textContent?.trim()).toBe('#123456');
      expect(swatch().style.backgroundColor).not.toBe('');
    });

    it('never paints the hidden raw color while mixed', () => {
      const { swatch, nativeInput, enterMixed } = setup();

      enterMixed('#ff0000');

      expect(swatch().style.backgroundColor).toBe('');
      expect(nativeInput().value).toBe('#000000');
    });
  });
});

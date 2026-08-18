import { ApplicationRef, Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { COLOR_INPUT_IMPORTS } from '../color-input.imports';
import { ColorInputDirective } from './color-input.directive';
import { ColorPickerSurfaceDirective } from './color-picker-surface.directive';
import { ColorPickerTriggerDirective } from './color-picker-trigger.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Brand color</et-label>
      <div etColorInput>
        <button etColorPickerTrigger>open</button>
        <ng-template etColorPickerSurface></ng-template>
      </div>
    </div>
  `,
  imports: [
    ColorInputDirective,
    ColorPickerSurfaceDirective,
    ColorPickerTriggerDirective,
    FormFieldDirective,
    LabelDirective,
  ],
})
class ColorInputInFormFieldTestHost {}

@Component({
  template: `
    <div
      [(value)]="value"
      [(mixed)]="mixed"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [alpha]="alpha()"
      [swatches]="swatches()"
      etColorInput
    >
      <button class="open-picker" etColorPickerTrigger>open</button>

      <ng-template etColorPickerSurface let-colorInput>
        <button (click)="colorInput.picker.commitColor(pickColor)" class="pick-color" type="button">pick</button>
      </ng-template>
    </div>

    <button class="outside" type="button">outside</button>
  `,
  imports: [ColorInputDirective, ColorPickerSurfaceDirective, ColorPickerTriggerDirective],
})
class ColorInputTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
  disabled = signal(false);
  readonly = signal(false);
  alpha = signal(false);
  swatches = signal<readonly string[]>([]);
  pickColor = '#123456';
}

@Component({
  template: ` <et-color-input [(value)]="value" [(mixed)]="mixed" mixedLabel="Mixed colors" /> `,
  imports: [COLOR_INPUT_IMPORTS],
})
class ColorInputComponentTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

// overlays render into the document - scope queries to the newest pane so a pane stuck in its
// leave transition (jsdom fires no transition events) cannot pollute them
const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;

describe('ColorInputDirective', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());
  });

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

  describe('value, state and picker', () => {
    let fixture: ComponentFixture<ColorInputTestHost>;
    let host: ColorInputTestHost;
    let colorInputDir: ColorInputDirective;
    let trigger: HTMLButtonElement;
    let outside: HTMLButtonElement;

    const pickButton = () => pane()?.querySelector<HTMLButtonElement>('.pick-color') ?? null;

    const openPicker = async () => {
      trigger.click();
      tick();
      await flushFrames();
      tick();
    };

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ColorInputTestHost] });
      fixture = TestBed.createComponent(ColorInputTestHost);
      host = fixture.componentInstance;
      fixture.detectChanges();
      colorInputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(ColorInputDirective);
      trigger = fixture.nativeElement.querySelector('.open-picker');
      outside = fixture.nativeElement.querySelector('.outside');
    });

    afterEach(async () => {
      colorInputDir.closePicker();
      tick();
      await flushFrames();
    });

    it('should have null value and black resolved color by default', () => {
      expect(colorInputDir.value()).toBeNull();
      expect(colorInputDir.hasValue()).toBe(false);
      expect(colorInputDir.resolvedColor()).toBe('#000000');
    });

    it('should not display error when not touched', () => {
      expect(colorInputDir.shouldDisplayError()).toBe(false);
    });

    it('focuses the trigger', () => {
      colorInputDir.focus();

      expect(document.activeElement).toBe(trigger);
    });

    it('opens the picker from the trigger and reports it on the trigger', async () => {
      await openPicker();

      expect(colorInputDir.pickerOpen()).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(pickButton()).toBeTruthy();
    });

    it('toggles the picker closed from the trigger', async () => {
      await openPicker();
      trigger.click();
      tick();

      expect(colorInputDir.pickerOpen()).toBe(false);
    });

    it('closes the picker once focus leaves the pane', async () => {
      await openPicker();
      outside.focus();
      tick();

      expect(colorInputDir.pickerOpen()).toBe(false);
    });

    it('keeps the picker open while focus moves inside the pane', async () => {
      await openPicker();
      pickButton()?.focus();
      tick();

      expect(colorInputDir.pickerOpen()).toBe(true);
    });

    it('refuses to open while disabled', async () => {
      host.disabled.set(true);
      tick();

      await openPicker();

      expect(colorInputDir.pickerOpen()).toBe(false);
    });

    it('refuses to open while readonly', async () => {
      host.readonly.set(true);
      tick();

      await openPicker();

      expect(colorInputDir.pickerOpen()).toBe(false);
    });

    it('commits a picked color as lowercase hex', async () => {
      await openPicker();
      pickButton()?.click();
      tick();

      expect(host.value()).toBe('#123456');
      expect(colorInputDir.hasValue()).toBe(true);
    });

    it('marks the control touched once the picker closes', async () => {
      await openPicker();
      colorInputDir.closePicker();
      tick();
      await flushFrames();

      expect(colorInputDir.touched()).toBe(true);
    });

    describe('alpha', () => {
      it('emits six digit hex while off', async () => {
        host.pickColor = '#12345680';
        await openPicker();
        pickButton()?.click();
        tick();

        expect(host.value()).toBe('#123456');
      });

      it('emits eight digit hex while on', async () => {
        host.alpha.set(true);
        host.pickColor = '#12345680';
        tick();

        await openPicker();
        pickButton()?.click();
        tick();

        expect(host.value()).toBe('#12345680');
      });
    });

    describe('swatches', () => {
      it('canonicalizes every notation to hex', () => {
        host.swatches.set(['#F00', 'rgb(0 128 255)']);
        tick();

        expect(colorInputDir.resolvedSwatches()).toEqual(['#ff0000', '#0080ff']);
      });

      it('collapses one color given twice in two notations', () => {
        host.swatches.set(['#ff0000', 'rgb(255, 0, 0)']);
        tick();

        expect(colorInputDir.resolvedSwatches()).toEqual(['#ff0000']);
      });

      it('drops an entry it cannot read', () => {
        host.swatches.set(['#ff0000', 'rebeccapurple']);
        tick();

        expect(colorInputDir.resolvedSwatches()).toEqual(['#ff0000']);
      });
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      TestBed.configureTestingModule({
        imports: [ColorInputComponentTestHost],
        // the panel's hex field is an `et-form-field`, whose error and warning themes resolve by type
        providers: [provideColorThemes([...TEST_COLOR_THEMES])],
      });

      const fixture = TestBed.createComponent(ColorInputComponentTestHost);

      fixture.detectChanges();

      const host = fixture.componentInstance;
      const trigger = () => fixture.nativeElement.querySelector('.et-color-input-trigger') as HTMLButtonElement;
      const swatchColor = () =>
        (fixture.nativeElement.querySelector('.et-color-input-swatch') as HTMLElement).style.getPropertyValue(
          '--_et-color-input-swatch-color',
        );
      const valueSlot = () => fixture.nativeElement.querySelector('.et-color-input-value') as HTMLElement;
      const hexField = () => pane()?.querySelector<HTMLInputElement>('.et-color-picker-hex .et-input-native') ?? null;

      const openPicker = async () => {
        trigger().click();
        tick();
        await flushFrames();
        tick();
      };

      const pick = async (color: string) => {
        if (!hexField()) {
          await openPicker();
        }

        const field = hexField();

        if (field) {
          field.value = color;
          // `input` moves the et-input model, `change` is what commits it to the picker
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }

        tick();
      };

      const enterMixed = (rawValue: string) => {
        host.value.set(rawValue);
        host.mixed.set(true);
        tick();
      };

      return { fixture, host, trigger, swatchColor, valueSlot, hexField, openPicker, pick, enterMixed };
    };

    describeMixedStateContract(() => {
      const { fixture, host, swatchColor, valueSlot, hexField, openPicker, pick, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('#ff0000'),
        rawValue: () => '#ff0000',
        value: () => host.value(),
        mixed: () => host.mixed(),
        hostElement: () => fixture.nativeElement.querySelector('et-color-input') as HTMLElement,
        writeValueExternally: () => {
          host.value.set('#00ff00');
          tick();
        },
        externallyWrittenValue: () => '#00ff00',
        commit: () => pick('#123456'),
        committedValue: () => '#123456',
        assertMasked: async () => {
          // the value slot shows the mixed label, the swatch drops its inline color (the CSS neutral
          // treatment takes over) and the picker opens on black, not on the hidden raw color
          expect(valueSlot().textContent?.trim()).toBe('Mixed colors');
          expect(swatchColor()).toBe('');

          await openPicker();

          expect(hexField()?.value).toBe('#000000');
        },
      };
    });

    it('restores the swatch and value text after a pick resolves mixed', async () => {
      const { host, swatchColor, valueSlot, pick, enterMixed } = setup();

      enterMixed('#ff0000');
      await pick('#123456');

      expect(host.mixed()).toBe(false);
      expect(host.value()).toBe('#123456');
      expect(valueSlot().textContent?.trim()).toBe('#123456');
      expect(swatchColor()).toBe('#123456');
    });

    it('never paints the hidden raw color while mixed', async () => {
      const { swatchColor, hexField, openPicker, enterMixed } = setup();

      enterMixed('#ff0000');
      await openPicker();

      expect(swatchColor()).toBe('');
      expect(hexField()?.value).toBe('#000000');
    });
  });
});

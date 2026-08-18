import { ApplicationRef, Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { COLOR_INPUT_IMPORTS } from '../color-input.imports';
import { COLOR_NOTATION_ORDER, ColorNotation } from '../color-input.types';
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
  template: `
    <et-color-input [(value)]="value" [(mixed)]="mixed" [notations]="notations()" mixedLabel="Mixed colors" />
  `,
  imports: [COLOR_INPUT_IMPORTS],
})
class ColorInputComponentTestHost {
  value = signal<string | null>(null);
  mixed = signal(false);
  notations = signal<readonly ColorNotation[]>(COLOR_NOTATION_ORDER);
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
      const hexField = () => pane()?.querySelector<HTMLInputElement>('.et-color-picker-value .et-input-native') ?? null;

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

  describe('notations', () => {
    const setup = (notations?: readonly ColorNotation[]) => {
      TestBed.configureTestingModule({
        imports: [ColorInputComponentTestHost],
        providers: [provideColorThemes([...TEST_COLOR_THEMES])],
      });

      const fixture = TestBed.createComponent(ColorInputComponentTestHost);
      const host = fixture.componentInstance;

      if (notations) {
        host.notations.set(notations);
      }

      fixture.detectChanges();

      const colorInputDir = fixture.debugElement
        .query((node) => node.nativeElement?.tagName === 'ET-COLOR-INPUT')
        .injector.get(ColorInputDirective);

      const openPicker = async () => {
        (fixture.nativeElement.querySelector('.et-color-input-trigger') as HTMLButtonElement).click();
        tick();
        await flushFrames();
        tick();
      };

      const valueField = () => pane()?.querySelector<HTMLInputElement>('.et-color-picker-value .et-input-native');
      const notationCell = () => pane()?.querySelector<HTMLElement>('.et-color-picker-notation') ?? null;
      const support = () => pane()?.querySelector<HTMLElement>('.et-color-picker-value .et-form-field-support');
      // the field's own state, not the support text: a message being animated out stays in the DOM
      // here, because jsdom fires no transition events
      const hasWarning = () => pane()?.querySelector('.et-color-picker-value')?.hasAttribute('data-warning') ?? false;

      // a render between the two events, as a real keystroke and a real commit have: the draft the
      // field displays is only written back to the DOM when change detection runs
      const type = (entry: string) => {
        const field = valueField();

        if (field) {
          field.value = entry;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          tick();
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }

        tick();
      };

      return { fixture, host, colorInputDir, openPicker, valueField, notationCell, support, hasWarning, type };
    };

    it('drops an entry the picker cannot read and keeps the order given', () => {
      const { host, colorInputDir } = setup(['hsl', 'nope' as ColorNotation, 'hex']);

      tick();

      expect(colorInputDir.resolvedNotations()).toEqual(['hsl', 'hex']);
      expect(host.notations().length).toBe(3);
    });

    it('collapses a notation given twice', () => {
      const { colorInputDir } = setup(['rgb', 'rgb', 'hex']);

      tick();

      expect(colorInputDir.resolvedNotations()).toEqual(['rgb', 'hex']);
    });

    it('falls back to hex when nothing is left', () => {
      const { colorInputDir } = setup([]);

      tick();

      expect(colorInputDir.resolvedNotations()).toEqual(['hex']);
    });

    it('offers a switch while more than one notation is given', async () => {
      const { openPicker, notationCell } = setup(['hex', 'rgb']);

      await openPicker();

      expect(notationCell()?.tagName).toBe('BUTTON');
    });

    it('cycles the displayed notation from the switch', async () => {
      const { host, openPicker, notationCell, valueField } = setup(['hex', 'rgb']);

      host.value.set('#3366ff');
      tick();
      await openPicker();

      expect(valueField()?.value).toBe('#3366ff');

      notationCell()?.click();
      tick();

      expect(notationCell()?.textContent?.trim()).toBe('RGB');
      expect(valueField()?.value).toBe('rgb(51 102 255)');
    });

    it('pins the field and shows no switch for a single notation', async () => {
      const { openPicker, notationCell } = setup(['hex']);

      await openPicker();

      expect(notationCell()?.tagName).toBe('SPAN');
    });

    it('opens on the notation the bound value is written in', async () => {
      const { host, openPicker, notationCell } = setup(['hex', 'rgb']);

      host.value.set('rgb(51 102 255)');
      tick();
      await openPicker();

      expect(notationCell()?.textContent?.trim()).toBe('RGB');
    });

    it('follows an entry in another offered notation', async () => {
      const { openPicker, notationCell, valueField, hasWarning, type } = setup(['hex', 'hsl']);

      await openPicker();
      type('hsl(210 100% 50%)');

      expect(notationCell()?.textContent?.trim()).toBe('HSL');
      expect(valueField()?.value).toBe('hsl(210 100% 50%)');
      expect(hasWarning()).toBe(false);
    });

    it('converts an entry in a notation it does not offer, and says so', async () => {
      const { host, openPicker, valueField, support, type } = setup(['hex']);

      await openPicker();
      type('rgb(255 0 0)');

      expect(host.value()).toBe('#ff0000');
      expect(valueField()?.value).toBe('#ff0000');
      expect(support()?.textContent?.trim()).toBe('Converted to Hex.');
    });

    it('drops the advisory on the next entry', async () => {
      const { openPicker, valueField, support, hasWarning, type } = setup(['hex']);

      await openPicker();
      type('rgb(255 0 0)');

      expect(support()?.textContent?.trim()).toBe('Converted to Hex.');

      const field = valueField();

      if (field) {
        field.value = '#00f';
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }

      tick();

      expect(hasWarning()).toBe(false);
    });

    it('drops the advisory when the color changes elsewhere in the panel', async () => {
      const { openPicker, support, hasWarning, type, colorInputDir } = setup(['hex']);

      await openPicker();
      type('rgb(255 0 0)');

      expect(support()?.textContent?.trim()).toBe('Converted to Hex.');

      colorInputDir.picker.commitColor('#00ff00');
      tick();

      expect(hasWarning()).toBe(false);
    });

    it('reverts an entry nothing can read', async () => {
      const { host, openPicker, valueField, type } = setup(['hex']);

      host.value.set('#3366ff');
      tick();
      await openPicker();
      type('not a color');

      expect(host.value()).toBe('#3366ff');
      expect(valueField()?.value).toBe('#3366ff');
    });
  });
});

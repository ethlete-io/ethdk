import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { ColorInputDriver, mountColorInput } from '../../testing/color-input-driver';
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

describe('ColorInputDirective', () => {
  describe('inside form field', () => {
    let driver: ColorInputDriver<ColorInputInFormFieldTestHost>;

    beforeEach(() => {
      driver = mountColorInput(ColorInputInFormFieldTestHost, { directiveSelector: '[etColorInput]' });
    });

    it('should register with parent form field', () => {
      expect(driver.directive(FormFieldDirective).registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      expect(driver.colorInput.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value, state and picker', () => {
    let driver: ColorInputDriver<ColorInputTestHost>;

    const pickButton = () => driver.paneEl<HTMLButtonElement>('.pick-color');

    beforeEach(() => {
      driver = mountColorInput(ColorInputTestHost, { triggerSelector: '.open-picker' });
    });

    afterEach(async () => {
      await driver.close();
    });

    it('should have null value and black resolved color by default', () => {
      expect(driver.colorInput.value()).toBeNull();
      expect(driver.colorInput.hasValue()).toBe(false);
      expect(driver.colorInput.resolvedColor()).toBe('#000000');
    });

    it('should not display error when not touched', () => {
      expect(driver.colorInput.shouldDisplayError()).toBe(false);
    });

    it('focuses the trigger', () => {
      driver.colorInput.focus();

      expect(document.activeElement).toBe(driver.trigger());
    });

    it('opens the picker from the trigger and reports it on the trigger', async () => {
      await driver.open();

      expect(driver.colorInput.pickerOpen()).toBe(true);
      expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');
      expect(pickButton()).toBeTruthy();
    });

    it('toggles the picker closed from the trigger', async () => {
      await driver.open();
      driver.click(driver.trigger());

      expect(driver.colorInput.pickerOpen()).toBe(false);
    });

    it('closes the picker once focus leaves the pane', async () => {
      await driver.open();
      driver.query('.outside')!.focus();
      driver.tick();

      expect(driver.colorInput.pickerOpen()).toBe(false);
    });

    it('keeps the picker open while focus moves inside the pane', async () => {
      await driver.open();
      pickButton()?.focus();
      driver.tick();

      expect(driver.colorInput.pickerOpen()).toBe(true);
    });

    it('refuses to open while disabled', async () => {
      driver.host.disabled.set(true);
      driver.tick();

      await driver.open();

      expect(driver.colorInput.pickerOpen()).toBe(false);
    });

    it('refuses to open while readonly', async () => {
      driver.host.readonly.set(true);
      driver.tick();

      await driver.open();

      expect(driver.colorInput.pickerOpen()).toBe(false);
    });

    it('commits a picked color as lowercase hex', async () => {
      await driver.open();
      driver.clickInPane('.pick-color');

      expect(driver.host.value()).toBe('#123456');
      expect(driver.colorInput.hasValue()).toBe(true);
    });

    it('marks the control touched once the picker closes', async () => {
      await driver.open();
      await driver.close();

      expect(driver.colorInput.touched()).toBe(true);
    });

    describe('alpha', () => {
      it('emits six digit hex while off', async () => {
        driver.host.pickColor = '#12345680';
        await driver.open();
        driver.clickInPane('.pick-color');

        expect(driver.host.value()).toBe('#123456');
      });

      it('emits eight digit hex while on', async () => {
        driver.host.alpha.set(true);
        driver.host.pickColor = '#12345680';
        driver.tick();

        await driver.open();
        driver.clickInPane('.pick-color');

        expect(driver.host.value()).toBe('#12345680');
      });
    });

    describe('swatches', () => {
      it('canonicalizes every notation to hex', () => {
        driver.host.swatches.set(['#F00', 'rgb(0 128 255)']);
        driver.tick();

        expect(driver.colorInput.resolvedSwatches()).toEqual(['#ff0000', '#0080ff']);
      });

      it('collapses one color given twice in two notations', () => {
        driver.host.swatches.set(['#ff0000', 'rgb(255, 0, 0)']);
        driver.tick();

        expect(driver.colorInput.resolvedSwatches()).toEqual(['#ff0000']);
      });

      it('drops an entry it cannot read', () => {
        driver.host.swatches.set(['#ff0000', 'rebeccapurple']);
        driver.tick();

        expect(driver.colorInput.resolvedSwatches()).toEqual(['#ff0000']);
      });
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      const driver = mountColorInput(ColorInputComponentTestHost);

      const pick = async (color: string) => {
        if (!driver.hexField()) {
          await driver.open();
        }

        driver.typeHex(color);
      };

      const enterMixed = (rawValue: string) => {
        driver.host.value.set(rawValue);
        driver.host.mixed.set(true);
        driver.tick();
      };

      return { driver, pick, enterMixed };
    };

    describeMixedStateContract(() => {
      const { driver, pick, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('#ff0000'),
        rawValue: () => '#ff0000',
        value: () => driver.host.value(),
        mixed: () => driver.host.mixed(),
        hostElement: () => driver.element(),
        writeValueExternally: () => {
          driver.host.value.set('#00ff00');
          driver.tick();
        },
        externallyWrittenValue: () => '#00ff00',
        commit: () => pick('#123456'),
        committedValue: () => '#123456',
        assertMasked: async () => {
          // the value slot shows the mixed label, the swatch drops its inline color (the CSS neutral
          // treatment takes over) and the picker opens on black, not on the hidden raw color
          expect(driver.valueText()).toBe('Mixed colors');
          expect(driver.swatchColor()).toBe('');

          await driver.open();

          expect(driver.hexValue()).toBe('#000000');
        },
      };
    });

    it('restores the swatch and value text after a pick resolves mixed', async () => {
      const { driver, pick, enterMixed } = setup();

      enterMixed('#ff0000');
      await pick('#123456');

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toBe('#123456');
      expect(driver.valueText()).toBe('#123456');
      expect(driver.swatchColor()).toBe('#123456');
    });

    it('never paints the hidden raw color while mixed', async () => {
      const { driver, enterMixed } = setup();

      enterMixed('#ff0000');
      await driver.open();

      expect(driver.swatchColor()).toBe('');
      expect(driver.hexValue()).toBe('#000000');
    });
  });

  describe('notations', () => {
    const setup = (notations?: readonly ColorNotation[]) => {
      const driver = mountColorInput(ColorInputComponentTestHost);

      if (notations) {
        driver.host.notations.set(notations);
      }

      driver.tick();

      return driver;
    };

    it('drops an entry the picker cannot read and keeps the order given', () => {
      const driver = setup(['hsl', 'nope' as ColorNotation, 'hex']);

      expect(driver.colorInput.resolvedNotations()).toEqual(['hsl', 'hex']);
      expect(driver.host.notations().length).toBe(3);
    });

    it('collapses a notation given twice', () => {
      const driver = setup(['rgb', 'rgb', 'hex']);

      expect(driver.colorInput.resolvedNotations()).toEqual(['rgb', 'hex']);
    });

    it('falls back to hex when nothing is left', () => {
      const driver = setup([]);

      expect(driver.colorInput.resolvedNotations()).toEqual(['hex']);
    });

    it('offers a switch while more than one notation is given', async () => {
      const driver = setup(['hex', 'rgb']);

      await driver.open();

      expect(driver.notationCell()?.tagName).toBe('BUTTON');
    });

    it('cycles the displayed notation from the switch', async () => {
      const driver = setup(['hex', 'rgb']);

      driver.host.value.set('#3366ff');
      driver.tick();
      await driver.open();

      expect(driver.hexValue()).toBe('#3366ff');

      driver.clickInPane('.et-color-picker-notation');

      expect(driver.notationLabel()).toBe('RGB');
      expect(driver.hexValue()).toBe('rgb(51 102 255)');
    });

    it('pins the field and shows no switch for a single notation', async () => {
      const driver = setup(['hex']);

      await driver.open();

      expect(driver.notationCell()?.tagName).toBe('SPAN');
    });

    it('opens on the notation the bound value is written in', async () => {
      const driver = setup(['hex', 'rgb']);

      driver.host.value.set('rgb(51 102 255)');
      driver.tick();
      await driver.open();

      expect(driver.notationLabel()).toBe('RGB');
    });

    it('follows an entry in another offered notation', async () => {
      const driver = setup(['hex', 'hsl']);

      await driver.open();
      driver.typeHex('hsl(210 100% 50%)');

      expect(driver.notationLabel()).toBe('HSL');
      expect(driver.hexValue()).toBe('hsl(210 100% 50%)');
      expect(driver.hasWarning()).toBe(false);
    });

    it('converts an entry in a notation it does not offer, and says so', async () => {
      const driver = setup(['hex']);

      await driver.open();
      driver.typeHex('rgb(255 0 0)');

      expect(driver.host.value()).toBe('#ff0000');
      expect(driver.hexValue()).toBe('#ff0000');
      expect(driver.support()).toBe('Converted to Hex.');
    });

    it('drops the advisory on the next entry', async () => {
      const driver = setup(['hex']);

      await driver.open();
      driver.typeHex('rgb(255 0 0)');

      expect(driver.support()).toBe('Converted to Hex.');

      driver.typeHexWithoutCommit('#00f');

      expect(driver.hasWarning()).toBe(false);
    });

    it('drops the advisory when the color changes elsewhere in the panel', async () => {
      const driver = setup(['hex']);

      await driver.open();
      driver.typeHex('rgb(255 0 0)');

      expect(driver.support()).toBe('Converted to Hex.');

      driver.colorInput.picker.commitColor('#00ff00');
      driver.tick();

      expect(driver.hasWarning()).toBe(false);
    });

    it('reverts an entry nothing can read', async () => {
      const driver = setup(['hex']);

      driver.host.value.set('#3366ff');
      driver.tick();
      await driver.open();
      driver.typeHex('not a color');

      expect(driver.host.value()).toBe('#3366ff');
      expect(driver.hexValue()).toBe('#3366ff');
    });
  });
});

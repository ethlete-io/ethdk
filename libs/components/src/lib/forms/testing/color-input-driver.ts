import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { textOf, tick } from '../../testing/driver-core';
import { createOverlayControlDriver, OverlayControlDriverOptions } from '../../testing/overlay-control-driver';
import { ColorInputDirective } from '../color-input/headless/color-input.directive';

export type ColorInputDriverOptions = Partial<OverlayControlDriverOptions<ColorInputDirective>>;

export const createColorInputDriver = <T>(fixture: ComponentFixture<T>, options: ColorInputDriverOptions = {}) => {
  const base = createOverlayControlDriver(fixture, ColorInputDirective, {
    triggerSelector: '.et-color-input-trigger',
    hide: (colorInput) => colorInput.closePicker(),
    ...options,
  });

  const hexField = () => base.paneEl<HTMLInputElement>('.et-color-picker-value .et-input-native');

  return {
    ...base,
    colorInput: base.control,

    swatchColor: () => base.query('.et-color-input-swatch')!.style.getPropertyValue('--_et-color-input-swatch-color'),
    valueText: () => base.text('.et-color-input-value'),

    hexField,
    hexValue: () => hexField()?.value,
    notationCell: () => base.paneEl('.et-color-picker-notation'),
    notationLabel: () => textOf(base.paneEl('.et-color-picker-notation')),
    support: () => textOf(base.paneEl('.et-color-picker-value .et-form-field-support')),
    // the field's own state, not the support text: a message being animated out stays in the DOM
    // here, because jsdom fires no transition events
    hasWarning: () => base.paneEl('.et-color-picker-value')?.hasAttribute('data-warning') ?? false,

    // a render between the two events, as a real keystroke and a real commit have: the draft the
    // field displays is only written back to the DOM when change detection runs
    typeHex: (entry: string) => {
      const field = hexField();

      if (!field) {
        return;
      }

      field.value = entry;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
      field.dispatchEvent(new Event('change', { bubbles: true }));
      tick();
    },
    typeHexWithoutCommit: (entry: string) => {
      const field = hexField();

      if (!field) {
        return;
      }

      field.value = entry;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
    },
  };
};

export type ColorInputDriver<T> = ReturnType<typeof createColorInputDriver<T>>;

export const mountColorInput = <T>(
  component: Type<T>,
  options: ColorInputDriverOptions = {},
  providers: Provider[] = [],
) => createColorInputDriver(mountControl(component, providers), options);

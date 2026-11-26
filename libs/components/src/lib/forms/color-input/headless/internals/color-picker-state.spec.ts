import { signal } from '@angular/core';
import { createColorPickerState } from './color-picker-state';

const setup = (options?: { value?: string | null; mixed?: boolean; alpha?: boolean; interactive?: boolean }) => {
  const value = signal<string | null>(options?.value ?? null);
  const mixed = signal(options?.mixed ?? false);
  const alpha = signal(options?.alpha ?? false);
  const interactive = signal(options?.interactive ?? true);
  const state = createColorPickerState({ value, mixed, alpha, interactive });

  return { value, mixed, alpha, interactive, state };
};

describe('createColorPickerState', () => {
  it('seeds from the bound value', () => {
    const { state } = setup({ value: '#00ff00' });

    expect(state.hsv().hue).toBeCloseTo(120, 5);
    expect(state.hsv().saturation).toBeCloseTo(1, 5);
  });

  it('reads a functional notation the validators accept without rewriting the model', () => {
    const { state, value } = setup({ value: 'rgb(0, 255, 0)' });

    expect(state.hsv().hue).toBeCloseTo(120, 5);
    expect(value()).toBe('rgb(0, 255, 0)');
  });

  it('seeds to black when there is no value', () => {
    const { state } = setup();

    expect(state.hsv()).toEqual({ hue: 0, saturation: 0, value: 0, alpha: 1 });
  });

  it('seeds to black while mixed, never to the hidden raw value', () => {
    const { state } = setup({ value: '#00ff00', mixed: true });

    expect(state.hsv()).toEqual({ hue: 0, saturation: 0, value: 0, alpha: 1 });
  });

  it('emits lowercase six digit hex', () => {
    const { state, value } = setup();

    state.setSaturationAndValue(1, 1);

    expect(value()).toBe('#ff0000');
  });

  it('keeps the hue across a drag through zero saturation', () => {
    const { state, value } = setup({ value: '#0080ff' });
    const hue = state.hsv().hue;

    state.setSaturationAndValue(0, 1);

    expect(value()).toBe('#ffffff');

    state.setSaturationAndValue(1, 1);

    expect(state.hsv().hue).toBeCloseTo(hue, 5);
    expect(value()).toBe('#0080ff');
  });

  it('keeps the hue across a drag through zero value', () => {
    const { state, value } = setup({ value: '#0080ff' });
    const hue = state.hsv().hue;

    state.setSaturationAndValue(1, 0);

    expect(value()).toBe('#000000');

    state.setSaturationAndValue(1, 1);

    expect(state.hsv().hue).toBeCloseTo(hue, 5);
  });

  it('keeps the hue while the saturation stays at zero', () => {
    const { state } = setup({ value: '#0080ff' });
    const hue = state.hsv().hue;

    state.setSaturationAndValue(0, 1);

    expect(state.hsv().hue).toBeCloseTo(hue, 5);
  });

  it('re-seeds when the value is written from outside', () => {
    const { state, value } = setup({ value: '#0080ff' });

    state.setSaturationAndValue(0, 1);
    value.set('#00ff00');

    expect(state.hsv().hue).toBeCloseTo(120, 5);
    expect(state.hsv().saturation).toBeCloseTo(1, 5);
  });

  it('resolves mixed on the first commit', () => {
    const { state, mixed, value } = setup({ value: '#00ff00', mixed: true });

    state.setHue(240);

    expect(mixed()).toBe(false);
    expect(value()).toBe('#000000');
  });

  it('drops alpha from the emitted value while alpha is off', () => {
    const { state, value } = setup({ value: '#ff0000' });

    state.setAlpha(0.5);

    expect(value()).toBe('#ff0000');
    expect(state.hsv().alpha).toBe(1);
  });

  it('appends the alpha pair while alpha is on', () => {
    const { state, value } = setup({ value: '#ff0000', alpha: true });

    state.setAlpha(0.8);

    expect(value()).toBe('#ff0000cc');
  });

  it('reads an incoming alpha while alpha is on', () => {
    const { state } = setup({ value: '#ff000080', alpha: true });

    expect(state.hsv().alpha).toBeCloseTo(128 / 255, 5);
  });

  it('emits nothing while not interactive', () => {
    const { state, value } = setup({ value: '#ff0000', interactive: false });

    state.setHue(240);

    expect(value()).toBe('#ff0000');
  });

  describe('commitColor', () => {
    it('commits any accepted notation as canonical hex', () => {
      const { state, value } = setup();

      expect(state.commitColor('rgb(0 128 255)')).toBe(true);
      expect(value()).toBe('#0080ff');
    });

    it('expands the shorthand form', () => {
      const { state, value } = setup();

      state.commitColor('#f80');

      expect(value()).toBe('#ff8800');
    });

    it('leaves the picker untouched on an unreadable color', () => {
      const { state, value } = setup({ value: '#ff0000' });

      expect(state.commitColor('nope')).toBe(false);
      expect(value()).toBe('#ff0000');
    });

    it('drops a typed alpha while alpha is off', () => {
      const { state, value } = setup();

      state.commitColor('#ff000080');

      expect(value()).toBe('#ff0000');
    });
  });
});

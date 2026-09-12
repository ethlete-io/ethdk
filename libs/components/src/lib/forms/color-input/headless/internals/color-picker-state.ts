import { Signal, WritableSignal, computed, signal, untracked } from '@angular/core';
import { HsvColor, formatHsvToHex, parseColorToHsv } from './color-convert';

const SEED_HSV: HsvColor = { hue: 0, saturation: 0, value: 0, alpha: 1 };

export type CreateColorPickerStateOptions = {
  value: WritableSignal<string | null>;
  mixed: WritableSignal<boolean>;
  alpha: Signal<boolean>;
  interactive: Signal<boolean>;
};

export const createColorPickerState = (options: CreateColorPickerStateOptions) => {
  const working = signal<HsvColor | null>(null);
  const lastEmitted = signal<string | null>(null);

  const hsv = computed(() => {
    const current = working();

    if (current && options.value() === lastEmitted()) {
      return current;
    }

    if (options.mixed()) {
      return SEED_HSV;
    }

    return parseColorToHsv(options.value()) ?? SEED_HSV;
  });

  const emit = (next: HsvColor) => {
    if (!options.interactive()) {
      return;
    }

    const resolved: HsvColor = { ...next, alpha: options.alpha() ? next.alpha : 1 };
    const hex = formatHsvToHex(resolved, { alpha: options.alpha() });

    working.set(resolved);
    lastEmitted.set(hex);

    if (untracked(options.mixed)) {
      options.mixed.set(false);
    }

    options.value.set(hex);
  };

  return {
    hsv,

    setHue: (hue: number) => emit({ ...untracked(hsv), hue }),

    setSaturationAndValue: (saturation: number, value: number) => emit({ ...untracked(hsv), saturation, value }),

    setAlpha: (alpha: number) => emit({ ...untracked(hsv), alpha }),

    commitColor: (color: string | null) => {
      const parsed = parseColorToHsv(color);

      if (!parsed) {
        return false;
      }

      emit(parsed);

      return true;
    },
  };
};

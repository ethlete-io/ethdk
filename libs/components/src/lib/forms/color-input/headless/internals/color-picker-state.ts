import { Signal, WritableSignal, computed, signal, untracked } from '@angular/core';
import { HsvColor, formatHsvToHex, parseColorToHsv } from './color-convert';

/**
 * What the picker opens on when there is nothing to open on: no value yet, an unreadable value, or
 * a mixed field whose raw color must stay hidden. Black is what the native input preselected.
 */
const SEED_HSV: HsvColor = { hue: 0, saturation: 0, value: 0, alpha: 1 };

export type CreateColorPickerStateOptions = {
  /** The control's value model. Written on every interactive change - the picker commits live. */
  value: WritableSignal<string | null>;
  /** Resolved by the first commit, mirroring the native input's replace semantics. */
  mixed: WritableSignal<boolean>;
  /** While `false` the emitted hex carries no alpha pair and the working alpha is pinned to 1. */
  alpha: Signal<boolean>;
  /** Emission gate - `!disabled && !readonly`. */
  interactive: Signal<boolean>;
};

/**
 * The picker's working color.
 *
 * Hex and HSV do not round-trip: at value 0 every hue is black and at saturation 0 every hue is
 * grey. Reading the model back on every change would therefore lose the hue as soon as a drag
 * touched either edge, so the HSV reading is held here and converted one way only, outward.
 *
 * A write to `value` that this state did not make - a `patchValue`, an API response - is still
 * honored: the working reading is kept only while `value` still holds what was last emitted.
 */
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

    /**
     * Commits a color in any notation the validators accept - a typed hex, a preset swatch, an
     * eyedropper reading. Returns `false` when it could not be read, leaving the picker untouched.
     */
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

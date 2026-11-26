import { effect } from '@angular/core';
import { RuntimeError } from '@ethlete/core';

export type ValueShapeCheckOptions = {
  value: () => unknown;
  /** `null` skips the check (a mode without a value, such as a tree's `'none'`). */
  multiple: () => boolean | null;
  code: number;
  source: string;
  modeInput: string;
};

/**
 * Warns in dev mode while a selection control's `value` does not match its mode: an array in single
 * mode, or a non-null non-array in multiple mode. Call in an injection context.
 */
export const warnOnValueShapeMismatch = (options: ValueShapeCheckOptions) => {
  if (!ngDevMode) return;

  effect(() => {
    const multiple = options.multiple();
    const value = options.value();

    if (multiple === null || value === null || value === undefined) return;

    const isArray = Array.isArray(value);

    if (multiple === isArray) return;

    const problem = multiple
      ? `${options.modeInput} selects multiple values, but value is not an array. Bind an array (e.g. signal<string[]>([])).`
      : `${options.modeInput} selects a single value, but value is an array. Bind a single value or null (e.g. signal<string | null>(null)), or switch to multiple mode.`;

    console.warn(new RuntimeError(options.code, `[${options.source}] ${problem}`).message);
  });
};

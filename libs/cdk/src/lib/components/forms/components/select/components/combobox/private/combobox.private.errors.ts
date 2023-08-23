import { ComponentType } from '@angular/cdk/overlay';
import { AnimatedOverlayComponentBase, RuntimeError } from '@ethlete/core';

export const COMBOBOX_ERRORS = {
  options_object_mismatch:
    'Expected options to be an array of objects. This is due to "bindLabel" and "bindValue" being set.',
  options_primitive_mismatch:
    'Expected options to be an array of primitives. This is due to "bindLabel" and "bindValue" not being set or "allowCustomValues" being set to true.',
  body_unset: 'Combobox body component is not set',
  init_val_primitive_mismatch:
    'Combobox options are a primitive array, but the supplied "initialValue" is not a primitive',
  init_val_object_mismatch: 'Combobox options are an object array, but the supplied "initialValue" is not an object',
} as const;

const COMBOBOX_ERROR_CODES = Object.keys(COMBOBOX_ERRORS).reduce(
  (acc, key, index) => {
    acc[key as keyof typeof COMBOBOX_ERRORS] = index;
    return acc;
  },
  {} as Record<keyof typeof COMBOBOX_ERRORS, number>,
);

export const comboboxError = (code: keyof typeof COMBOBOX_ERRORS, devOnly: boolean, data?: unknown) => {
  const message = `<et-combobox>: ${COMBOBOX_ERRORS[code]}`;

  throw new RuntimeError(COMBOBOX_ERROR_CODES[code], message, devOnly, data);
};

export function assetComboboxBodyComponentSet(
  component: ComponentType<AnimatedOverlayComponentBase> | null,
): asserts component is ComponentType<AnimatedOverlayComponentBase> {
  if (!component) {
    comboboxError('body_unset', false);
  }
}

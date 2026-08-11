import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings the text-field family's own controls render - the number input's steppers and the password
 * input's reveal toggle. The field's label, hint and errors are yours; these are the parts the control
 * adds by itself.
 */
export type InputLabels = {
  /** Accessible label for the number input's step-up control. */
  increment: string;
  /** Accessible label for the number input's step-down control. */
  decrement: string;
  /** Accessible label for the password input's control while the value is masked. */
  showPassword: string;
  /** Accessible label for the password input's control while the value is visible. */
  hidePassword: string;
  /** The password input's warning that Caps Lock may be on. */
  capsLockOn: string;
};

/** The built-in English labels. */
export const DEFAULT_INPUT_LABELS: InputLabels = {
  increment: 'Increment',
  decrement: 'Decrement',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  capsLockOn: 'Caps Lock might be on',
};

const INPUT_LABELS_DEF = /* @__PURE__ */ defineLabels<InputLabels>('INPUT_LABELS', DEFAULT_INPUT_LABELS);

/**
 * Localize the text field family's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_INPUT_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideInputLabels({ increment: 'Erhöhen', decrement: 'Verringern' });
 */
export const provideInputLabels = /* @__PURE__ */ toProvideFn(INPUT_LABELS_DEF);
export const injectInputLabels = /* @__PURE__ */ toInjectFn(INPUT_LABELS_DEF);
export const INPUT_LABELS = /* @__PURE__ */ toToken(INPUT_LABELS_DEF);

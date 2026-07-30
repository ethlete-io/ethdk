import { createLabels } from '@ethlete/core';

/**
 * The strings the text-field family's own controls render — the number input's steppers and the password
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
  /** The password input's warning that Caps Lock is on. */
  capsLockOn: string;
};

/** The built-in English labels. */
export const DEFAULT_INPUT_LABELS: InputLabels = {
  increment: 'Increment',
  decrement: 'Decrement',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  capsLockOn: 'Caps Lock is on',
};

/**
 * Localize the text field family's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial — whatever you leave out keeps its {@link DEFAULT_INPUT_LABELS} value. See {@link createLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideInputLabels({ increment: 'Erhöhen', decrement: 'Verringern' });
 */
export const [provideInputLabels, injectInputLabels, INPUT_LABELS] = createLabels<InputLabels>(
  'INPUT_LABELS',
  DEFAULT_INPUT_LABELS,
);

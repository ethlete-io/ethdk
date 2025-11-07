import { InputSignal, InputSignalWithTransform } from '@angular/core';
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';

/**
 * Sets the value of an input signal.
 * See issue: https://github.com/angular/angular/issues/54782
 */
export const setInputSignal = <T>(input: InputSignal<T> | InputSignalWithTransform<T, unknown>, value: T) => {
  const node = input[SIGNAL];

  signalSetFn(node, value);
};

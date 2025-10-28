import { Signal, isSignal, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, map, merge, of, startWith, switchMap } from 'rxjs';
import { equal } from '../utils';

export interface ControlValueSignalOptions {
  debounceTime?: number;

  /**
   * @default false
   */
  debounceFirst?: boolean;
}

export const controlValueSignal = <
  TControlInput extends Signal<AbstractControl | null> | AbstractControl,
  TControl extends TControlInput extends Signal<infer TSignalControl> ? TSignalControl : TControlInput,
>(
  control: TControlInput,
  options?: ControlValueSignalOptions,
) => {
  type TValue = ReturnType<NonNullable<TControl>['getRawValue']>;

  let initialValue: TValue | null = null;

  const getRawValueSafe = (ctrl: Signal<AbstractControl | null> | AbstractControl | null): TValue | null => {
    try {
      return isSignal(ctrl) ? (ctrl()?.getRawValue() ?? null) : (ctrl?.getRawValue() ?? null);
    } catch {
      // Ignore errors. This can happen if the passed control is a required input and is not yet initialized.
      return null;
    }
  };

  initialValue = getRawValueSafe(control);

  const controlStream = isSignal(control)
    ? toObservable<AbstractControl | null>(control)
    : of<AbstractControl | null>(control);

  const controlObs = controlStream.pipe(
    switchMap((ctrl) => {
      if (!ctrl) return of(null);

      const vcsObs = options?.debounceTime
        ? ctrl.valueChanges.pipe(debounceTime(options.debounceTime))
        : ctrl.valueChanges;

      return vcsObs.pipe(
        startWith(ctrl.getRawValue()),
        map(() => ctrl.getRawValue()),
      );
    }),
  );

  const obs: Observable<TValue | null> = !options?.debounceFirst ? merge(of(initialValue), controlObs) : controlObs;

  return toSignal(obs.pipe(distinctUntilChanged((a, b) => equal(a, b))), {
    initialValue,
  });
};

/**
 * The first item in the pair is the previous value and the second item is the current value.
 */
export const controlValueSignalWithPrevious = <T extends AbstractControl>(
  control: T,
  options?: ControlValueSignalOptions,
) => {
  type TValue = ReturnType<NonNullable<T extends Signal<infer TSignalControl> ? TSignalControl : T>['getRawValue']>;

  const data = linkedSignal<TValue | null, [TValue | null, TValue | null]>({
    source: controlValueSignal(control, options),
    computation: (curr, prev) => [prev?.source ?? null, curr],
  });

  return data.asReadonly();
};

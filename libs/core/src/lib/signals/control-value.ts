import { Signal, isSignal, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, map, merge, of, switchMap } from 'rxjs';
import { equal } from '../utils';

export type ControlValueSignalOptions = {
  debounceTime?: number;

  /**
   * @default false
   */
  debounceFirst?: boolean;
};

export const controlValueSignal = <
  TControlInput extends Signal<AbstractControl | null> | AbstractControl,
  TControl extends (TControlInput extends Signal<infer TSignalControl> ? TSignalControl : TControlInput),
>(
  control: TControlInput,
  options?: ControlValueSignalOptions,
) => {
  type TValue = ReturnType<NonNullable<TControl>['getRawValue']>;

  const getRawValueSafe = (ctrl: Signal<AbstractControl | null> | AbstractControl | null): TValue | null => {
    try {
      return isSignal(ctrl) ? (ctrl()?.getRawValue() ?? null) : (ctrl?.getRawValue() ?? null);
    } catch {
      // Ignore errors. This can happen if the passed control is a required input and is not yet initialized.
      return null;
    }
  };

  const initialValue = getRawValueSafe(control);

  const controlStream = isSignal(control)
    ? toObservable<AbstractControl | null>(control)
    : of<AbstractControl | null>(control);

  const controlObs = controlStream.pipe(
    switchMap((ctrl) => {
      if (!ctrl) return of(null);

      const changes = ctrl.valueChanges.pipe(map(() => ctrl.getRawValue()));
      const debouncedChanges = options?.debounceTime ? changes.pipe(debounceTime(options.debounceTime)) : changes;

      if (!options?.debounceFirst) {
        return merge(of(ctrl.getRawValue()), debouncedChanges);
      }

      const values = merge(of(ctrl.getRawValue()), changes);
      return options.debounceTime ? values.pipe(debounceTime(options.debounceTime)) : values;
    }),
  );

  const obs: Observable<TValue | null> = controlObs;

  return toSignal(obs.pipe(distinctUntilChanged((a, b) => equal(a, b))), {
    initialValue: options?.debounceFirst ? null : initialValue,
  });
};

/**
 * The first item in the pair is the previous value and the second item is the current value.
 */
export const controlValueSignalWithPrevious = <T extends Signal<AbstractControl | null> | AbstractControl>(
  control: T,
  options?: ControlValueSignalOptions,
) => {
  type TControl = NonNullable<T extends Signal<infer TSignalControl> ? TSignalControl : T>;
  type TValue = ReturnType<TControl['getRawValue']>;

  const data = linkedSignal<TValue | null, [TValue | null, TValue | null]>({
    source: controlValueSignal(control, options),
    computation: (curr, prev) => [prev?.source ?? null, curr],
  });

  return data.asReadonly();
};

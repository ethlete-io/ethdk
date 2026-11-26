import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  isSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { MaybeSignal } from '../signals';

export const applyHeadBinding = <T>(
  binding: MaybeSignal<T | null | undefined>,
  applyFn: (value: T) => void,
  removeFn: () => void,
  isValid?: (value: T | null | undefined) => value is T,
) => {
  const destroyRef = inject(DestroyRef);
  const signalBinding = isSignal(binding) ? binding : signal(binding);

  const defaultIsValid = (value: T | null | undefined): value is T => value !== null && value !== undefined;

  const validator = isValid ?? defaultIsValid;

  const initialValue = untracked(() => signalBinding());
  if (validator(initialValue)) {
    applyFn(initialValue);
  }

  effect(() => {
    const value = signalBinding();
    if (validator(value)) {
      applyFn(value);
    } else {
      removeFn();
    }
  });

  destroyRef.onDestroy(() => {
    removeFn();
  });
};

export const createPropertyBinding = <TConfig>(
  configBuilder: (value: string) => TConfig,
  applyConfigFn: (config: MaybeSignal<TConfig | null | undefined>) => void,
) => {
  return (binding: MaybeSignal<string | null | undefined>) => {
    applyConfigFn(
      computed(() => {
        const value = isSignal(binding) ? binding() : binding;
        return value ? configBuilder(value) : null;
      }),
    );
  };
};

export const createArrayPropertyBinding = <TConfig>(
  configBuilder: (value: string, index: number) => TConfig,
  applyConfigFn: (config: MaybeSignal<TConfig | null | undefined>) => void,
) => {
  return (binding: MaybeSignal<string[] | null | undefined>) => {
    const injector = inject(Injector);
    const valuesSignal = isSignal(binding) ? binding : signal(binding);
    let bindingCount = 0;

    effect(() => {
      const values = valuesSignal() ?? [];

      untracked(() => {
        while (bindingCount < values.length) {
          const index = bindingCount++;
          runInInjectionContext(injector, () => {
            applyConfigFn(
              computed(() => {
                const value = valuesSignal()?.[index];
                return value === undefined ? null : configBuilder(value, index);
              }),
            );
          });
        }
      });
    });
  };
};

export const toStringBinding = (
  binding: MaybeSignal<string | number | null | undefined>,
): MaybeSignal<string | null | undefined> => {
  return computed(() => {
    const value = isSignal(binding) ? binding() : binding;
    return value !== null && value !== undefined ? String(value) : null;
  });
};

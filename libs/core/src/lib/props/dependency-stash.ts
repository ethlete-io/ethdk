import { Injector, Signal, WritableSignal, effect, inject, runInInjectionContext } from '@angular/core';

export const createDependencyStash = <T extends Record<string, WritableSignal<unknown>>>(stash: T) => {
  const injector = inject(Injector);

  const provideSignal = <K extends keyof T>(data: { signal: Signal<ReturnType<T[K]>>; for: K }) => {
    runInInjectionContext(injector, () => {
      effect(() => {
        stash[data.for]!.set(data.signal());
      });
    });
  };

  const provideValue = <K extends keyof T>(data: { value: ReturnType<T[K]>; for: K }) => {
    stash[data.for]!.set(data.value);
  };

  return {
    ...stash,
    provideSignal,
    provideValue,
  };
};

import { DestroyRef, WritableSignal, inject, untracked } from '@angular/core';

/**
 * Registers `instance` as the single occupant of a parent's `target` signal and clears it on
 * destroy. The clear is guarded: if a replacement registered before this one tore down, it must not
 * null the signal out from under the newcomer. Pass `undefined` (an optional parent that wasn't
 * found) and it's a no-op. Call in an injection context.
 */
export const registerSingleton = <T>(target: WritableSignal<T | null> | null | undefined, instance: T) => {
  if (!target) {
    return;
  }

  target.set(instance);

  inject(DestroyRef).onDestroy(() => {
    if (untracked(target) === instance) {
      target.set(null);
    }
  });
};

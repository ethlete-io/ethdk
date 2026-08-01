import { DestroyRef, WritableSignal, inject } from '@angular/core';

/**
 * Registers `instance` as the single occupant of a parent's `target` signal and clears it on
 * destroy - the pattern every overlay sub-directive (trigger, surface, search, value, state
 * templates, …) repeats: `target.set(this)` plus a guarded `target.set(null)` on teardown. The
 * guard matters: if a replacement registered before this one tore down, it must not null the
 * signal out from under the newcomer. Pass `undefined` (an optional parent that wasn't found) and
 * it's a no-op. Call in an injection context.
 */
export const registerSingleton = <T>(target: WritableSignal<T | null> | null | undefined, instance: T) => {
  if (!target) {
    return;
  }

  target.set(instance);

  inject(DestroyRef).onDestroy(() => {
    if (target() === instance) {
      target.set(null);
    }
  });
};

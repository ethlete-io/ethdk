import { DestroyRef, WritableSignal, inject } from '@angular/core';

/**
 * Points a "one of these at a time" slot at `instance`, and clears it again when `instance` is
 * destroyed - so a conditionally rendered trigger, panel or slot template can come and go without
 * leaving a dead reference behind.
 *
 * Must be called from the registering directive's constructor: it takes its teardown from *that*
 * directive's `DestroyRef`, not the accordion's.
 */
export const registerPart = <T>(target: WritableSignal<T | null> | undefined, instance: T) => {
  if (!target) return;

  target.set(instance);

  inject(DestroyRef).onDestroy(() => {
    if (target() === instance) {
      target.set(null);
    }
  });
};

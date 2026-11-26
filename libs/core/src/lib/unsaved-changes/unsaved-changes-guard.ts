import { assertInInjectionContext } from '@angular/core';
import {
  createUnsavedChangesTracker,
  CreateUnsavedChangesTrackerConfig,
  UnsavedChangesTrackerRef,
} from './unsaved-changes-tracker';

export type CreateUnsavedChangesGuardConfig<T> = CreateUnsavedChangesTrackerConfig<T>;

export type UnsavedChangesGuardRef<T> = UnsavedChangesTrackerRef<T> & {
  /**
   * A `CanDeactivateFn`-compatible check: resolves `true` when the route may be left (no changes, or
   * the user confirmed the discard), `false` to stay. Wire it into a route's `canDeactivate`.
   *
   * ```ts
   * export const editGuard: CanDeactivateFn<EditComponent> = (component) => component.guard.canDeactivate();
   * ```
   */
  canDeactivate: () => Promise<boolean>;
};

/**
 * The router / manual flavor of the unsaved-changes family: a {@link createUnsavedChangesTracker}
 * plus a `canDeactivate` bridge for Angular route guards. It touches no overlay APIs, so it also
 * serves as a standalone "does this form have unsaved changes, and may I discard them?" helper.
 * Call from an injection context.
 */
export const createUnsavedChangesGuard = <T>(config: CreateUnsavedChangesGuardConfig<T>): UnsavedChangesGuardRef<T> => {
  assertInInjectionContext(createUnsavedChangesGuard);

  const tracker = createUnsavedChangesTracker(config);

  return {
    ...tracker,
    canDeactivate: () => tracker.runCheck(),
  };
};

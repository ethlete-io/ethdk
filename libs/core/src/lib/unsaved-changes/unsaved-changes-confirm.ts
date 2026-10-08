import { InjectionToken, Provider } from '@angular/core';
import { UnsavedChangesConfirmFn } from './unsaved-changes-tracker';

/** The confirm an unsaved-changes tracker or guard runs when its own config has none. */
export const UNSAVED_CHANGES_CONFIRM = /* @__PURE__ */ new InjectionToken<UnsavedChangesConfirmFn<unknown>>(
  'UNSAVED_CHANGES_CONFIRM',
);

/**
 * Sets the confirm every unsaved-changes tracker and guard below this injector runs when its config has no
 * `confirm`. `factory` runs once, in an injection context, and returns the confirm.
 *
 * @example
 * provideUnsavedChangesConfirm(() => {
 *   const dialogs = inject(MyDialogs);
 *   return () => dialogs.confirmDiscard();
 * });
 */
export const provideUnsavedChangesConfirm = (factory: () => UnsavedChangesConfirmFn<unknown>): Provider => ({
  provide: UNSAVED_CHANGES_CONFIRM,
  useFactory: factory,
});

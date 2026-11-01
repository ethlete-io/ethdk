import { InjectionToken, Provider } from '@angular/core';
import { Observable } from 'rxjs';
import { UnsavedChangesConfirmContext } from './unsaved-changes-coordinator';

/**
 * Decides whether a value with unsaved changes may be discarded. Called with the current value when
 * (and only when) changes exist. Return a truthy value / resolved Promise / emitted Observable value
 * to allow the discard, falsy to keep the changes. Typically opens a confirm dialog.
 *
 * The second argument carries an {@link UnsavedChangesConfirmContext.signal} that aborts when the
 * session ends underneath the confirm (a logout) - close your dialog when it fires.
 */
export type UnsavedChangesConfirmFn<T> = (
  value: T,
  context: UnsavedChangesConfirmContext,
) => boolean | Promise<boolean> | Observable<boolean> | unknown;

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

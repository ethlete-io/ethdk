import { computed, signal, Signal } from '@angular/core';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';

/**
 * Why a guard was abandoned. `'logout'` is issued by `@ethlete/query`'s auth provider; anything else
 * is app-defined.
 */
export type UnsavedChangesAbandonReason = 'logout' | (string & {});

/** The second argument every {@link UnsavedChangesConfirmFn} receives. */
export type UnsavedChangesConfirmContext = {
  /**
   * Aborts when the session this confirm belongs to ends underneath it - a logout, or an explicit
   * `abandonAll()`. **Close your confirm dialog when it fires**, otherwise it is left on screen over
   * a page the user has already been redirected away from. The guard itself stops waiting either way.
   *
   * ```ts
   * confirm: (value, { signal }) => {
   *   const ref = this.overlays.open(ConfirmDiscardComponent);
   *   signal.addEventListener('abort', () => ref.close(false));
   *   return ref.afterClosed();
   * };
   * ```
   */
  signal: AbortSignal;
};

/** @internal A live tracker, as seen by the coordinator. */
export type UnsavedChangesRegistration = {
  abandon: (reason: UnsavedChangesAbandonReason) => void;

  /**
   * Changes the coordinator should still act on - so a tracker folds its own abandoned state in here
   * rather than reporting a raw comparison. An abandoned tracker's edits cannot be saved anymore, and
   * counting them would block a reload nobody can act on.
   */
  hasChanges: Signal<boolean>;
};

const UNSAVED_CHANGES_COORDINATOR_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const _registrations = signal<readonly UnsavedChangesRegistration[]>([]);
    const _isCheckPending = signal(false);

    const hasUnsavedChanges = computed(() => _registrations().some((registration) => registration.hasChanges()));

    let pending: {
      promise: Promise<boolean>;
      controller: AbortController;
      settle: (result: boolean) => void;
    } | null = null;

    /** @internal Runs a tracker's confirm under the single-flight + abandon regime. */
    const runCheck = (runner: (context: UnsavedChangesConfirmContext) => Promise<boolean>): Promise<boolean> => {
      // A confirm is already on screen - adopt its answer rather than opening a second dialog.
      if (pending) {
        return pending.promise;
      }

      const controller = new AbortController();

      let settle!: (result: boolean) => void;
      const abandoned = new Promise<boolean>((resolve) => (settle = resolve));

      // Run the confirm synchronously - a dialog that opens a microtask later can miss a `signal` that
      // already aborted, and callers reasonably expect the dialog to be up when `runCheck()` returns.
      let confirmed: Promise<boolean>;

      try {
        confirmed = runner({ signal: controller.signal }).catch(() => false);
      } catch {
        confirmed = Promise.resolve(false);
      }

      // Whichever settles first wins: a late answer from an abandoned confirm is ignored.
      const promise = Promise.race([confirmed, abandoned]).then((result) => {
        pending = null;
        _isCheckPending.set(false);

        return result;
      });

      pending = { promise, controller, settle };
      _isCheckPending.set(true);

      return promise;
    };

    /** @internal */
    const register = (registration: UnsavedChangesRegistration) => {
      _registrations.update((current) => [...current, registration]);

      return () => _registrations.update((current) => current.filter((entry) => entry !== registration));
    };

    const abandonAll = (reason: UnsavedChangesAbandonReason = 'session-end') => {
      if (pending) {
        pending.controller.abort(reason);
        // The changes are unrecoverable at this point, so the discard is allowed: whatever waited on
        // this check (an overlay close, a `canDeactivate`) proceeds instead of hanging.
        pending.settle(true);
      }

      for (const registration of _registrations()) {
        registration.abandon(reason);
      }
    };

    return {
      /** Whether a confirm is currently on screen. */
      isCheckPending: _isCheckPending.asReadonly(),

      /**
       * Whether any live tracker currently holds changes worth confirming - the app-wide "is it safe to
       * throw this page away?" question, for callers that need the answer without asking the user
       * (see `provideAppUpdates`). Abandoned trackers do not count.
       */
      hasUnsavedChanges,
      abandonAll,
      runCheck,
      register,
    };
  },
  { name: 'Unsaved Changes Coordinator' },
);

/**
 * App-wide coordination for the unsaved-changes family. Two jobs:
 *
 * - **One confirm at a time.** A page form, an overlay form and a route guard can all want a decision
 *   at once; stacking three "discard your changes?" dialogs is never the right answer. A check that
 *   starts while another is pending adopts the pending decision instead of asking again.
 * - **Abandoning guards when the session ends.** `abandonAll()` resolves the pending confirm, tells
 *   its dialog to close (via {@link UnsavedChangesConfirmContext.signal}), and switches every live
 *   guard off: further checks pass, and the tab locks release. Called automatically by
 *   `@ethlete/query`'s auth provider on logout - the edits cannot be saved anymore, so guarding them
 *   only strands dialogs over the login page and blocks the tab.
 *
 * Root-provided; every tracker registers itself. Inject it to abandon guards from app code (a session
 * timeout of your own, a hard reset) or to read whether a confirm is currently on screen.
 */
export const provideUnsavedChangesCoordinator = /* @__PURE__ */ toProvideFn(UNSAVED_CHANGES_COORDINATOR_DEF);
export const injectUnsavedChangesCoordinator = /* @__PURE__ */ toInjectFn(UNSAVED_CHANGES_COORDINATOR_DEF);

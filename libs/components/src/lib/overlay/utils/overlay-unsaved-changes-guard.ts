import { assertInInjectionContext, DestroyRef, inject, isDevMode } from '@angular/core';
import {
  createUnsavedChangesTracker,
  CreateUnsavedChangesTrackerConfig,
  UnsavedChangesTrackerRef,
} from '@ethlete/core';
import { OVERLAY_REF } from '../overlay-ref';

/**
 * Which close sources the guard should intercept. All default to `true`.
 * Maps to the runtime's close sources: `outsidePointer` → `outside-pointer`, `escape` → `escape`,
 * `closeCall` → `api` (programmatic `overlayRef.close()`), `drag` → drag-to-dismiss.
 */
export type OverlayUnsavedChangesDismissSources = {
  outsidePointer?: boolean;
  escape?: boolean;
  closeCall?: boolean;
  drag?: boolean;
};

export type CreateOverlayUnsavedChangesGuardConfig<T> = CreateUnsavedChangesTrackerConfig<T> & {
  /** The close sources to guard. All enabled by default. */
  dismissSources?: OverlayUnsavedChangesDismissSources;
};

export type OverlayUnsavedChangesGuardRef<T> = UnsavedChangesTrackerRef<T> & {
  /** Stop guarding closes and release the guard. Also runs automatically on injector destroy. */
  destroy: () => void;
};

/**
 * The overlay flavor of the unsaved-changes family. Injects the current `OVERLAY_REF` and vetoes a
 * dismissal (outside pointer, escape, drag, or a programmatic `close()`) while the watched form has
 * unsaved changes: it runs the `confirm` and only then re-issues the close. Call from an overlay
 * content component's injection context.
 *
 * Being a tracker, it also locks the browser tab while there are changes (`beforeunload`) - configure
 * or disable that via the inherited `tab` option.
 *
 * ```ts
 * guard = createOverlayUnsavedChangesGuard({
 *   source: this.form,                     // a signal-forms FieldTree
 *   confirm: () => this.overlays
 *     .open(ConfirmDiscardComponent)
 *     .afterClosed(),                       // truthy result = discard
 * });
 * ```
 *
 * After a save that keeps the overlay open, call `guard.refreshDefaultValue()` to re-baseline so the
 * saved state no longer counts as unsaved changes.
 */
export const createOverlayUnsavedChangesGuard = <T>(
  config: CreateOverlayUnsavedChangesGuardConfig<T>,
): OverlayUnsavedChangesGuardRef<T> => {
  assertInInjectionContext(createOverlayUnsavedChangesGuard);

  const overlayRef = inject(OVERLAY_REF);
  const destroyRef = inject(DestroyRef);
  const tracker = createUnsavedChangesTracker(config);

  const dismiss = config.dismissSources ?? {};
  const guarded: Record<string, boolean> = {
    'outside-pointer': dismiss.outsidePointer ?? true,
    escape: dismiss.escape ?? true,
    api: dismiss.closeCall ?? true,
    drag: dismiss.drag ?? true,
  };

  if (isDevMode() && overlayRef.config.disableClose && (dismiss.outsidePointer || dismiss.escape || dismiss.drag)) {
    console.warn(
      '[createOverlayUnsavedChangesGuard] The overlay was opened with disableClose: true, so escape, ' +
        'outside-pointer and drag never fire - only a programmatic close() reaches the guard.',
    );
  }

  // While a confirm is pending we keep vetoing further attempts; the async branch re-issues the
  // close (bypassing this guard) once the user confirms.
  let checkPending = false;

  const unregister = overlayRef.registerCloseGuard((event) => {
    if (!guarded[event.source]) {
      return true;
    }

    // The session ended underneath the overlay (logout): the edits are unrecoverable, so let it close
    // instead of prompting over a page the user is being redirected away from.
    if (tracker.isAbandoned()) {
      return true;
    }

    if (!tracker.hasChanges()) {
      return true;
    }

    if (checkPending) {
      return false;
    }

    checkPending = true;

    tracker
      .runCheck()
      .then((confirmed) => {
        checkPending = false;

        if (confirmed) {
          overlayRef.forceClose(event.source, event.result);
        }
      })
      .catch(() => {
        checkPending = false;
      });

    return false;
  });

  const destroy = () => unregister();

  destroyRef.onDestroy(destroy);

  return { ...tracker, destroy };
};

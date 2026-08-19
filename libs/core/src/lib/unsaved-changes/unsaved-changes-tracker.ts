import {
  assertInInjectionContext,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  Signal,
  untracked,
} from '@angular/core';
import { catchError, defaultIfEmpty, firstValueFrom, isObservable, map, Observable, of, take } from 'rxjs';
import { equal } from '../utils';
import { injectUnsavedChangesCoordinator, UnsavedChangesConfirmContext } from './unsaved-changes-coordinator';
import { normalizeUnsavedChangesSource, UnsavedChangesSource } from './unsaved-changes-source';
import { createUnsavedChangesTabLock, UnsavedChangesTabConfig, UnsavedChangesTabLockRef } from './unsaved-changes-tab';

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

export type CreateUnsavedChangesTrackerConfig<T> = {
  /** The form / value to watch. See {@link UnsavedChangesSource}. */
  source: UnsavedChangesSource<T>;

  /**
   * The baseline the current value is compared against.
   * If omitted, the first non-null value the source produces is captured automatically (so
   * async-filled forms work without wiring). A function is evaluated once, eagerly.
   */
  defaultValue?: T | (() => T);

  /**
   * Required, per call site. Runs only when there are changes to discard.
   * @see UnsavedChangesConfirmFn
   */
  confirm: UnsavedChangesConfirmFn<T>;

  /**
   * Custom equality between the current value and the default. Deep-equal by default.
   *
   * Note: this is snapshot-vs-default comparison, deliberately **not** signal-forms' `dirty()`
   * (which means "was edited", so typing then deleting stays dirty - here it's clean again).
   */
  compareFn?: (current: T, defaultValue: T) => boolean;

  /**
   * How the tracker guards the browser tab itself. The `beforeunload` lock - the browser's confirm
   * prompt before the tab is closed or reloaded - is **on by default**, since a guard that only
   * covers in-app navigation still loses the edits to <kbd>Ctrl</kbd>+<kbd>W</kbd>.
   *
   * Pass an object to also opt into a tab title marker or an app badge, or `false` to leave the tab
   * alone entirely. See {@link UnsavedChangesTabConfig}.
   * @default { lock: true }
   */
  tab?: UnsavedChangesTabConfig | false;
};

export type UnsavedChangesTrackerRef<T> = {
  /** Whether the current value differs from the default. */
  hasChanges: Signal<boolean>;

  /**
   * Whether this guard was switched off because the session ended underneath it (a logout, or an
   * explicit `injectUnsavedChangesCoordinator().abandonAll()`). An abandoned tracker still reports
   * `hasChanges`, but `runCheck()` passes without confirming and the tab lock is released - the edits
   * cannot be saved anymore, so blocking on them only strands the user.
   */
  isAbandoned: Signal<boolean>;

  /** The current baseline. `null` until a value (or explicit default) exists. */
  defaultValue: Signal<T | null>;

  /**
   * Resolves `true` if there are no changes or the user confirmed the discard, `false` otherwise.
   * Normalizes the `confirm` return (value / Promise / Observable) to a `Promise<boolean>`.
   *
   * Only one confirm runs app-wide: a check that starts while another tracker's confirm is on screen
   * adopts that decision instead of opening a second dialog.
   */
  runCheck: () => Promise<boolean>;

  /** Re-baseline to the current value - e.g. after a save that keeps the form open. */
  refreshDefaultValue: () => void;

  /** Write the default back onto the source (revert edits). No-op if there is no default yet. */
  restoreDefaultValue: () => void;

  /**
   * The tab guard (`beforeunload` lock, title marker, app badge) driven by `hasChanges` - `null` when
   * the tracker was created with `tab: false`. Call `tab.destroy()` to release it before the
   * injector is destroyed, e.g. right before a deliberate `location.reload()`.
   */
  tab: UnsavedChangesTabLockRef | null;
};

const toBooleanPromise = (result: boolean | Promise<boolean> | Observable<boolean> | unknown): Promise<boolean> => {
  if (result instanceof Promise) {
    return result.then(Boolean);
  }

  if (isObservable(result)) {
    return firstValueFrom(
      result.pipe(
        take(1),
        map(Boolean),
        defaultIfEmpty(false),
        catchError(() => of(false)),
      ),
    );
  }

  return Promise.resolve(Boolean(result));
};

/**
 * The framework-agnostic core of the unsaved-changes family: snapshots a default value, tracks
 * whether the watched form/value differs from it, and runs an async confirm before a discard.
 * Call from an injection context (a field initializer or constructor).
 *
 * While there are changes the browser tab is locked too (`beforeunload`), so closing or reloading the
 * tab needs a confirmation - see the `tab` config for the title-marker / app-badge extras and for
 * opting out.
 *
 * Every tracker registers with the app-wide {@link injectUnsavedChangesCoordinator}, which keeps a
 * single confirm on screen at a time and switches all guards off when the session ends (logout).
 *
 * Overlay and router flavors (`createOverlayUnsavedChangesGuard`, `createUnsavedChangesGuard`) build
 * on this - use them when you want the guard wired to a close/navigation event automatically.
 */
export const createUnsavedChangesTracker = <T>(
  config: CreateUnsavedChangesTrackerConfig<T>,
): UnsavedChangesTrackerRef<T> => {
  assertInInjectionContext(createUnsavedChangesTracker);

  const { compareFn, confirm } = config;
  const normalized = normalizeUnsavedChangesSource(config.source);

  const hasExplicitDefault = config.defaultValue !== undefined;
  const initialDefault = hasExplicitDefault
    ? typeof config.defaultValue === 'function'
      ? (config.defaultValue as () => T)()
      : (config.defaultValue as T)
    : untracked(normalized.value);

  const _defaultValue = signal<T | null>(initialDefault);

  // No explicit default → capture the first non-null value the source produces as the baseline.
  // This makes async-filled forms "just work" while keeping snapshot (not dirty()) semantics.
  if (!hasExplicitDefault) {
    let captured = initialDefault !== null && initialDefault !== undefined;

    effect(() => {
      const current = normalized.value();

      if (!captured && current !== null && current !== undefined) {
        captured = true;
        untracked(() => _defaultValue.set(current));
      }
    });
  }

  const hasChanges = computed(() => {
    const current = normalized.value();

    if (current === null || current === undefined) {
      return false;
    }

    const defaultValue = _defaultValue();
    if (defaultValue === null || defaultValue === undefined) {
      return false;
    }

    return !(compareFn ? compareFn(current, defaultValue) : equal(current, defaultValue));
  });

  const tab = config.tab === false ? null : createUnsavedChangesTabLock({ ...config.tab, hasChanges });

  const coordinator = injectUnsavedChangesCoordinator();
  const _isAbandoned = signal(false);

  const unregister = coordinator.register({
    abandon: () => {
      _isAbandoned.set(true);
      // The session is gone: stop holding the tab hostage over edits that can no longer be saved.
      tab?.destroy();
    },
    hasChanges: computed(() => !_isAbandoned() && hasChanges()),
  });

  inject(DestroyRef).onDestroy(unregister);

  const runCheck = (): Promise<boolean> => {
    if (untracked(_isAbandoned) || !untracked(hasChanges)) {
      return Promise.resolve(true);
    }

    return coordinator.runCheck((context) => toBooleanPromise(confirm(untracked(normalized.value) as T, context)));
  };

  const refreshDefaultValue = () => _defaultValue.set(untracked(normalized.value));

  const restoreDefaultValue = () => {
    const defaultValue = untracked(_defaultValue);

    if (defaultValue !== null && defaultValue !== undefined) {
      normalized.setValue(defaultValue);
    }
  };

  return {
    hasChanges,
    isAbandoned: _isAbandoned.asReadonly(),
    defaultValue: _defaultValue.asReadonly(),
    runCheck,
    refreshDefaultValue,
    restoreDefaultValue,
    tab,
  };
};

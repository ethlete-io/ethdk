import { assertInInjectionContext, computed, effect, signal, Signal, untracked } from '@angular/core';
import { isObservable, Observable } from 'rxjs';
import { equal } from '../utils';
import { normalizeUnsavedChangesSource, UnsavedChangesSource } from './unsaved-changes-source';

/**
 * Decides whether a value with unsaved changes may be discarded. Called with the current value when
 * (and only when) changes exist. Return a truthy value / resolved Promise / emitted Observable value
 * to allow the discard, falsy to keep the changes. Typically opens a confirm dialog.
 */
export type UnsavedChangesConfirmFn<T> = (value: T) => boolean | Promise<boolean> | Observable<boolean> | unknown;

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
   * (which means "was edited", so typing then deleting stays dirty — here it's clean again).
   */
  compareFn?: (current: T, defaultValue: T) => boolean;
};

export type UnsavedChangesTrackerRef<T> = {
  /** Whether the current value differs from the default. */
  hasChanges: Signal<boolean>;

  /** The current baseline. `null` until a value (or explicit default) exists. */
  defaultValue: Signal<T | null>;

  /**
   * Resolves `true` if there are no changes or the user confirmed the discard, `false` otherwise.
   * Normalizes the `confirm` return (value / Promise / Observable) to a `Promise<boolean>`.
   */
  runCheck: () => Promise<boolean>;

  /** Re-baseline to the current value — e.g. after a save that keeps the form open. */
  refreshDefaultValue: () => void;

  /** Write the default back onto the source (revert edits). No-op if there is no default yet. */
  restoreDefaultValue: () => void;
};

const toBooleanPromise = (result: boolean | Promise<boolean> | Observable<boolean> | unknown): Promise<boolean> => {
  if (result instanceof Promise) {
    return result.then(Boolean);
  }

  if (isObservable(result)) {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const sub = result.subscribe({
        next: (value) => {
          settled = true;
          resolve(Boolean(value));
          sub.unsubscribe();
        },
        error: () => resolve(false),
        complete: () => {
          if (!settled) {
            resolve(false);
          }
        },
      });
    });
  }

  return Promise.resolve(Boolean(result));
};

/**
 * The framework-agnostic core of the unsaved-changes family: snapshots a default value, tracks
 * whether the watched form/value differs from it, and runs an async confirm before a discard.
 * Call from an injection context (a field initializer or constructor).
 *
 * Overlay and router flavors (`createOverlayUnsavedChangesGuard`, `createUnsavedChangesGuard`) build
 * on this — use them when you want the guard wired to a close/navigation event automatically.
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

    const defaultValue = _defaultValue() as T;

    return !(compareFn ? compareFn(current, defaultValue) : equal(current, defaultValue));
  });

  const runCheck = (): Promise<boolean> => {
    if (!untracked(hasChanges)) {
      return Promise.resolve(true);
    }

    return toBooleanPromise(confirm(untracked(normalized.value) as T));
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
    defaultValue: _defaultValue.asReadonly(),
    runCheck,
    refreshDefaultValue,
    restoreDefaultValue,
  };
};

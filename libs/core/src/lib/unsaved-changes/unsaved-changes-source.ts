import { computed, isSignal, Signal, untracked, WritableSignal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldTree } from '@angular/forms/signals';
import { controlValueSignal } from '../signals';

/**
 * The value source an unsaved-changes tracker watches. In order of preference:
 *
 * - **`FieldTree<T>`** (signal forms - primary): read `field().value()`, restore `field().value.set(v)`.
 * - **`Signal<FieldTree<T> | null>`**: a late/async-created signal form - resolves once the field exists.
 * - **`AbstractControl`** (reactive forms - migration path): bridged via `controlValueSignal` + `setValue`.
 * - **`WritableSignal<T>`** (escape hatch for non-form state): read/write directly.
 */
export type UnsavedChangesSource<T> = FieldTree<T> | Signal<FieldTree<T> | null> | AbstractControl | WritableSignal<T>;

/** A value source reduced to a read signal plus a writer, regardless of its original kind. */
export type NormalizedUnsavedChangesSource<T> = {
  /** The current value. `null` while a late/async source has not produced a value yet. */
  value: Signal<T | null>;
  /** Writes a value back to the source (used by `restoreDefaultValue`). No-op if the source isn't ready. */
  setValue: (value: T) => void;
};

const isAbstractControl = (value: unknown): value is AbstractControl =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as AbstractControl).getRawValue === 'function' &&
  typeof (value as AbstractControl).setValue === 'function';

// A signal-forms field node is a callable that is NOT an Angular signal (signals are callable too).
const isFieldTree = <T>(value: unknown): value is FieldTree<T> => typeof value === 'function' && !isSignal(value);

/** Reduces any {@link UnsavedChangesSource} to a uniform read-signal + writer pair. */
export const normalizeUnsavedChangesSource = <T>(
  source: UnsavedChangesSource<T>,
): NormalizedUnsavedChangesSource<T> => {
  if (isAbstractControl(source)) {
    const value = controlValueSignal(source) as Signal<T | null>;

    return { value, setValue: (next) => source.setValue(next) };
  }

  if (isFieldTree<T>(source)) {
    return {
      value: computed(() => source().value()),
      // FieldTree's value type is a generic conditional that TS can't narrow here - cast the writer.
      setValue: (next) => (source().value as WritableSignal<T>).set(next),
    };
  }

  if (isSignal(source)) {
    const peek = untracked(source as Signal<unknown>);

    // A signal that currently holds a FieldTree - or nothing yet (the late/async form case).
    if (peek === null || peek === undefined || isFieldTree(peek)) {
      const fieldSignal = source as Signal<FieldTree<T> | null>;

      return {
        value: computed(() => {
          const field = fieldSignal();

          return isFieldTree<T>(field) ? field().value() : null;
        }),
        setValue: (next) => {
          const field = untracked(fieldSignal);

          if (isFieldTree<T>(field)) {
            (field().value as WritableSignal<T>).set(next);
          }
        },
      };
    }

    // A plain writable value signal (escape hatch). Initialize it with a non-null value so it isn't
    // mistaken for a late FieldTree source above.
    const writable = source as WritableSignal<T>;

    return { value: writable, setValue: (next) => writable.set(next) };
  }

  throw new Error(
    '[unsaved-changes] Unsupported source. Pass a signal-forms FieldTree, a Signal<FieldTree | null>, ' +
      'an AbstractControl, or a WritableSignal.',
  );
};

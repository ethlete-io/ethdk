import { Signal, computed, signal } from '@angular/core';
import { Locale, startOfDay } from 'date-fns';
import { formatDateValue } from './date-value';
import { withTimeOfDay } from './date-time-merge';
import { splitDateTimeFormat } from './date-time-format-split';

/** Every letter and digit blanked out, separators left standing: `12:00 AM` → `__:__ __`. */
const blankOut = (text: string, placeholderChar: string) => text.replace(/[\p{L}\p{N}]/gu, placeholderChar);

export type RenderPartialDateTimeOptions = {
  day: Date | null;
  time: Date | null;
  format: string;
  locale: Locale | null;
  placeholderChar?: string;
};

/**
 * The field text for a half-picked date & time: the picked half rendered in `format`, the missing
 * one blanked to placeholders (`08/13/2026, __:__ __`). `null` when nothing is picked yet, or when
 * the format cannot be split into a date and a time half.
 */
export const renderPartialDateTime = (options: RenderPartialDateTimeOptions) => {
  const reference = options.day ?? options.time;

  if (reference === null) {
    return null;
  }

  const split = splitDateTimeFormat(options.format, options.locale);

  if (split === null) {
    return null;
  }

  const placeholderChar = options.placeholderChar ?? '_';
  const render = (format: string, source: Date | null) => {
    // date-fns throws on an empty pattern, and a split whose time span sits at either end has one
    if (format === '') {
      return '';
    }

    const text = formatDateValue(source ?? reference, { format, locale: options.locale }) ?? '';

    return source === null ? blankOut(text, placeholderChar) : text;
  };

  return (
    render(split.datePrefix, options.day) + render(split.time, options.time) + render(split.dateSuffix, options.day)
  );
};

/**
 * One date-time slot's half-picked state. A combined value is a single string, so a day picked
 * before a time (or the other way round) cannot be committed yet - it is held here until its other
 * half arrives, and the control's value stays `null` in the meantime.
 */
export type PendingDateTime = {
  /** The day picked while no time exists yet. */
  day: Signal<Date | null>;
  /** The time picked while no day exists yet. */
  time: Signal<Date | null>;
  /** Whether a half is being held. */
  active: Signal<boolean>;
  /** Takes a picked day: the completed date-time when a time was already held, else `null`. */
  holdDay: (day: Date) => Date | null;
  /** Takes a picked time: the completed date-time when a day was already held, else `null`. */
  holdTime: (time: Date) => Date | null;
  clear: () => void;
};

export const createPendingDateTime = (): PendingDateTime => {
  const day = signal<Date | null>(null);
  const time = signal<Date | null>(null);

  const clear = () => {
    day.set(null);
    time.set(null);
  };

  return {
    day: day.asReadonly(),
    time: time.asReadonly(),
    active: computed(() => day() !== null || time() !== null),
    holdDay: (picked) => {
      const held = time();

      if (held === null) {
        day.set(startOfDay(picked));

        return null;
      }

      clear();

      return withTimeOfDay(picked, held);
    },
    holdTime: (picked) => {
      const held = day();

      if (held === null) {
        time.set(picked);

        return null;
      }

      clear();

      return withTimeOfDay(held, picked);
    },
    clear,
  };
};

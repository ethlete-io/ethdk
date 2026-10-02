import { Signal, effect } from '@angular/core';
import { Locale } from 'date-fns';
import { formatDateValue } from './date-value';

export type WireValueReading = {
  value: string | null;
  parsed: Date | null;
};

export type UnparsedValueWarningOptions = {
  selector: string;
  formatProvider: 'provideDateFormat' | 'provideTimeFormat';
  readings: () => readonly WireValueReading[];
  format: Signal<string>;
  locale: Signal<Locale | null>;
};

const EXAMPLE_DATE = /* @__PURE__ */ new Date(2026, 6, 16, 21, 30, 0);

/**
 * Dev mode only: warns once per control when a non-empty wire value does not parse against the
 * `valueFormat` in effect, since the field then renders blank. Call in an injection context.
 */
export const warnOnUnparsedValue = (options: UnparsedValueWarningOptions) => {
  if (!ngDevMode) return;

  let warned = false;

  effect(() => {
    if (warned) return;

    const miss = options.readings().find((reading) => !!reading.value?.trim() && reading.parsed === null);

    if (!miss) return;

    warned = true;

    const format = options.format();
    const example = formatDateValue(EXAMPLE_DATE, { format, locale: options.locale() });

    console.warn(
      `[${options.selector}] The value "${miss.value}" does not match the valueFormat "${format}", so the field ` +
        `renders blank. A matching value looks like "${example}". Set valueFormat on the control or ` +
        `${options.formatProvider}() for the app.`,
    );
  });
};

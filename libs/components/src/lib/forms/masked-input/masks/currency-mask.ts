import { MaskSpec } from '../headless/input-mask.types';

export type CurrencyMaskOptions = {
  /** Separator shown (and used in the raw value) before the fraction. Default `','`. */
  decimalSeparator?: string;
  /** Separator grouping the integer digits in the display. Default `'.'`. */
  groupSeparator?: string;
  /** Maximum fraction digits; `0` disables the decimal separator entirely. Default `2`. */
  decimals?: number;
  /** Static text rendered before the amount (e.g. `'€ '`). Must not contain digits or the separators. */
  prefix?: string;
  /** Static text rendered after the amount (e.g. `' €'`). Must not contain digits or the separators. */
  suffix?: string;
  /** Allow a leading minus. Default `false`. */
  allowNegative?: boolean;
};

/**
 * A right-growing grouped number mask for locale-formatted amounts.
 *
 * The raw value is the ungrouped amount using the configured `decimalSeparator`
 * (e.g. `'1234,56'` with the defaults) — parse it with
 * `Number(raw.replace(decimalSeparator, '.'))`.
 */
export const createCurrencyMask = (options: CurrencyMaskOptions = {}): MaskSpec => {
  const {
    decimalSeparator = ',',
    groupSeparator = '.',
    decimals = 2,
    prefix = '',
    suffix = '',
    allowNegative = false,
  } = options;

  const toRaw = (text: string) => {
    let digits = '';
    let negative = false;
    let hasDecimal = false;
    let fractionLength = 0;

    for (const char of text) {
      if (char === '-' && allowNegative && !digits.length && !hasDecimal) {
        negative = true;
      } else if (/[0-9]/.test(char)) {
        if (hasDecimal) {
          if (fractionLength < decimals) {
            digits += char;
            fractionLength += 1;
          }
        } else {
          digits += char;
        }
      } else if (char === decimalSeparator && !hasDecimal && decimals > 0) {
        digits += decimalSeparator;
        hasDecimal = true;
      }
    }

    // strip redundant leading zeros (`007` → `7`, `0,5` stays); a bare fraction gets its zero
    const [integer = '', fraction] = digits.split(decimalSeparator);
    const trimmedInteger = integer.replace(/^0+(?=\d)/, '') || (fraction === undefined ? '' : '0');
    const normalized = fraction === undefined ? trimmedInteger : `${trimmedInteger}${decimalSeparator}${fraction}`;

    if (!normalized.length) {
      return '';
    }

    return negative ? `-${normalized}` : normalized;
  };

  const toDisplay = (raw: string) => {
    if (!raw.length) {
      return '';
    }

    const negative = raw.startsWith('-');
    const unsigned = negative ? raw.slice(1) : raw;
    const [integer = '', fraction] = unsigned.split(decimalSeparator);
    const grouped = (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
    const amount = fraction === undefined ? grouped : `${grouped}${decimalSeparator}${fraction}`;

    return `${prefix}${negative ? '-' : ''}${amount}${suffix}`;
  };

  return { toRaw, toDisplay, caretAnchor: 'end' };
};

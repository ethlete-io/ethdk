import { MaskSpec } from '../headless/input-mask.types';

const CARD_MAX_LENGTH = 19;

/**
 * Groups a payment-card number into blocks of four (uniform grouping - Amex-style
 * 4-6-5 layouts are out of scope). The raw value is the plain digit string.
 */
export const createCardMask = (): MaskSpec => ({
  toRaw: (text) => text.replace(/[^0-9]/g, '').slice(0, CARD_MAX_LENGTH),
  toDisplay: (raw) => raw.replace(/(.{4})(?=.)/g, '$1 '),
});

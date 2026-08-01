import { MaskSpec } from '../headless/input-mask.types';

const IBAN_MAX_LENGTH = 34;

/**
 * Groups an IBAN into blocks of four, uppercasing as you type. Charset and length
 * only - structural validation (country prefix, checksum) belongs to the schema/backend.
 * The raw value is the ungrouped uppercase IBAN.
 */
export const createIbanMask = (): MaskSpec => ({
  toRaw: (text) =>
    text
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, IBAN_MAX_LENGTH),
  toDisplay: (raw) => raw.replace(/(.{4})(?=.)/g, '$1 '),
});

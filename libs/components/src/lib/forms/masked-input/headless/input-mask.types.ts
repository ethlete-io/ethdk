/**
 * A mask definition: a pair of pure text transforms plus caret metadata. Pattern
 * strings passed to `[etInputMask]` are compiled into one of these; the shipped
 * factories (`createCurrencyMask`, `createIbanMask`, `createCardMask`) and custom
 * masks provide it directly.
 */
export type MaskSpec = {
  /**
   * Filters arbitrary text down to the raw value — it defines which characters
   * count as content (everything else is formatting or noise). Must be
   * idempotent: `toRaw(toRaw(x)) === toRaw(x)`.
   */
  toRaw(text: string): string;
  /**
   * Formats a raw value for display. Must return `''` for an empty raw value and
   * round-trip cleanly: `toRaw(toDisplay(raw)) === raw`.
   */
  toDisplay(raw: string): string;
  /**
   * Whether a raw value fills every required slot. Pattern-compiled masks implement it
   * (`0`/`a`/`*` slots are required, `9` optional); spec objects may leave it out when
   * completeness is not a meaningful concept (open-ended masks like currency).
   */
  isComplete?(raw: string): boolean;
  /** Optional focused-state display that renders unfilled slots (e.g. `12-__`). */
  toGuideDisplay?(raw: string): string;
  /** The character `toGuideDisplay` uses for unfilled slots — caret logic stops at it. */
  placeholderChar?: string;
  /**
   * How the caret re-anchors after re-formatting: `'start'` preserves the content
   * before the caret (pattern masks), `'end'` preserves the content after it
   * (right-growing numbers like currency). Defaults to `'start'`.
   */
  caretAnchor?: 'start' | 'end';
};

export const MASK_VALUE_MODES = {
  /** The form value is the unmasked raw text (default). */
  RAW: 'raw',
  /** The form value is the masked display text. */
  MASKED: 'masked',
} as const;

export type MaskValueMode = (typeof MASK_VALUE_MODES)[keyof typeof MASK_VALUE_MODES];

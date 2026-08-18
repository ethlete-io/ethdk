// codes 4800-4899
export const COMMAND_PALETTE_ERROR_CODES = {
  /** `input[etCommandPaletteSearch]` was rendered outside an `[etCommandPalette]`. */
  SEARCH_OUTSIDE_PALETTE: 4800,

  /** The shortcut directive was given a chord of modifiers with no key, which can never fire. */
  SHORTCUT_WITHOUT_KEY: 4801,
} as const;

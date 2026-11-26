export const THEMING_ERROR_CODES = {
  /** Two or more registered color themes have `isDefault: true`. */
  DUPLICATE_DEFAULT_COLOR_THEME: 9200,
  /** Two or more registered surface themes of the same `type` have `isDefault: true`. */
  DUPLICATE_DEFAULT_SURFACE_THEME: 9201,
} as const;

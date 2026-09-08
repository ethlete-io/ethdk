// codes 4400-4499
export const STANDINGS_ERROR_CODES = {
  /** Two zones cover the same position, so a row would be in both. */
  OVERLAPPING_ZONES: 4400,
  /** More than one mark template was given to one pick list. */
  DUPLICATE_MARK_TEMPLATE: 4401,
} as const;

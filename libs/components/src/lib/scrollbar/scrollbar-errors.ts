// codes 4900-4999
export const SCROLLBAR_ERROR_CODES = {
  /** `for` was bound to something that is not an element - a component instance, most often. */
  INVALID_TARGET: 4900,
  /** The scrollbar rendered with nothing marked `etScrollbarThumb`, so it has nothing to move. */
  MISSING_THUMB: 4901,
  /** The scrollbar rendered with no `for`, so there is no scroll container for it to mirror. */
  MISSING_TARGET: 4902,
} as const;

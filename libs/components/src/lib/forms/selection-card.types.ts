/** Which end of a card the control sits at. See {@link SelectionCardControlPosition}. */
export const SELECTION_CARD_CONTROL_POSITIONS = {
  START: 'start',
  END: 'end',
} as const;

/**
 * Which end of a `variant="card"` panel the control sits at. `'end'` (the default) leaves the label leading
 * and the control trailing; `'start'` puts the control first, ahead of any `[etSelectionCardLeading]` media.
 * `variant="plain"` ignores it.
 */
export type SelectionCardControlPosition =
  (typeof SELECTION_CARD_CONTROL_POSITIONS)[keyof typeof SELECTION_CARD_CONTROL_POSITIONS];

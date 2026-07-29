/**
 * Where the trigger is right now.
 *
 * - `inline` — its anchor is on screen, so it sits in the flow where it was written.
 * - `floating` — the anchor has scrolled away but the region it acts on is still in play, so the trigger
 *   detaches and pins itself to the corner.
 * - `hidden` — the region has scrolled away too. There is nothing left to act on, so the trigger goes.
 */
export const FLOATING_ACTION_STATES = {
  INLINE: 'inline',
  FLOATING: 'floating',
  HIDDEN: 'hidden',
} as const;

export type FloatingActionState = (typeof FLOATING_ACTION_STATES)[keyof typeof FLOATING_ACTION_STATES];

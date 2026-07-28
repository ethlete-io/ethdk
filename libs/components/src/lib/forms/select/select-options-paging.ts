import { equal } from '@ethlete/core';

/** The accumulated per-page slices, plus the fold's own verdict on whether the list is exhausted. */
export type PageState<TItem> = {
  slices: TItem[][];
  ended: boolean;
};

/**
 * Whether a freshly settled page ends the pagination. This is the guard against a "load more" control
 * that outlives the data, and it overrules `toHasMore` — which can only ever be as exact as the response
 * it reads. Two cases:
 *
 * - **Nothing came back.** A page with no items has nothing after it either.
 * - **The same page came back again.** Asking a paginated API for a page past the end commonly clamps to
 *   the last one; appending that would show the tail of the list twice.
 *
 * Either way the page is dropped instead of appended, and `hasMore` turns off.
 *
 * @internal
 */
export const endsPagination = <TItem>(nextSlice: TItem[], previousSlice: TItem[] | undefined) =>
  nextSlice.length === 0 || (previousSlice !== undefined && equal(nextSlice, previousSlice));

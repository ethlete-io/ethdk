import { equal } from '@ethlete/core';

export type PageState<TItem> = {
  slices: TItem[][];
  ended: boolean;
};

/**
 * Whether a freshly settled page ends the pagination. Asking a paginated API for a page past the end
 * commonly clamps to the last one; appending that would show the tail of the list twice.
 *
 * @internal
 */
export const endsPagination = <TItem>(nextSlice: TItem[], previousSlice: TItem[] | undefined) =>
  nextSlice.length === 0 || (previousSlice !== undefined && equal(nextSlice, previousSlice));

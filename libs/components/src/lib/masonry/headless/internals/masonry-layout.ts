/**
 * The masonry geometry, as two pure functions. Everything reactive lives in the directives; this file only
 * does arithmetic, which is what makes the packing worth unit-testing rather than driving through a DOM.
 */

import { MasonryColumns, MasonryPacking, MasonryPlacement } from '../../masonry.types';

/**
 * How many columns fit, and how wide they end up.
 *
 * `minColumnInlineSize` is a *minimum*, not a target: the count is the most columns that fit at that width
 * with the gaps included, and the remainder is then shared out so the columns fill the container. This is
 * `repeat(auto-fill, minmax(X, 1fr))` in arithmetic — which is the behaviour a reader expects from a value
 * named like a width, and what cdk got wrong by dividing without accounting for the gaps (a 1000px container
 * at `columWidth: 250` and `gap: 16` gave four 238px columns there, below the width that was asked for).
 */
export const resolveMasonryColumns = ({
  containerInlineSize,
  minColumnInlineSize,
  gap,
}: {
  containerInlineSize: number;
  minColumnInlineSize: number;
  gap: number;
}): MasonryColumns => {
  if (containerInlineSize <= 0) return { count: 0, inlineSize: 0 };

  // A zero or negative minimum would divide by zero and ask for infinite columns.
  const minInlineSize = Math.max(1, minColumnInlineSize);
  const safeGap = Math.max(0, gap);

  // Every column but the first brings a gap with it, hence the `+ gap` on both sides. Always at least one
  // column, so a container narrower than a single column still lays out (the item just overflows it).
  const count = Math.max(1, Math.floor((containerInlineSize + safeGap) / (minInlineSize + safeGap)));
  const inlineSize = (containerInlineSize - (count - 1) * safeGap) / count;

  return { count, inlineSize: Math.max(0, inlineSize) };
};

/** The shortest column, ties going to the one nearest the start — which is what makes a fresh masonry's
 * first row read left to right rather than scatter. */
const shortestColumn = (columnBlockSizes: readonly number[]) => {
  let shortest = 0;

  for (let candidate = 1; candidate < columnBlockSizes.length; candidate++) {
    if ((columnBlockSizes[candidate] ?? 0) < (columnBlockSizes[shortest] ?? 0)) {
      shortest = candidate;
    }
  }

  return shortest;
};

/**
 * Greedy shortest-column packing: each item goes to whichever column is currently shortest. That is the
 * classic masonry algorithm, and it has a property this port leans on heavily — **it is prefix-stable**.
 * Where items `0…k` land depends only on items `0…k`, never on what comes after, so appending items to an
 * infinite-scrolling feed re-derives the existing placements unchanged. cdk needed a partial-invalidation
 * mode to get that; here it falls out of the algorithm, and Angular's binding dedupe is what keeps the
 * unchanged items from being written to the DOM again.
 *
 * `itemColumns` pins items to a column they have already been given, which is what keeps a card *growing*
 * from reshuffling the grid: greedy assignment is stable against items being added, but not against an
 * existing item changing height — a taller card changes which column is shortest for every item after it,
 * so items would hop columns because a paragraph two columns over expanded. Pinned items only re-stack.
 */
export const packMasonryItems = ({
  itemBlockSizes,
  itemColumns,
  columnCount,
  columnInlineSize,
  gap,
}: {
  itemBlockSizes: readonly number[];
  /** Per item, the column to keep it in, or `null`/absent to place it greedily. Index-aligned. */
  itemColumns?: readonly (number | null)[];
  columnCount: number;
  columnInlineSize: number;
  gap: number;
}): MasonryPacking => {
  if (columnCount <= 0) return { placements: [], columnBlockSizes: [], blockSize: 0 };

  const safeGap = Math.max(0, gap);
  const columnBlockSizes = Array.from({ length: columnCount }, () => 0);
  const placements: MasonryPlacement[] = [];

  for (const [index, itemBlockSize] of itemBlockSizes.entries()) {
    const pinned = itemColumns?.[index];
    const column =
      pinned !== null && pinned !== undefined && pinned >= 0 && pinned < columnCount
        ? pinned
        : shortestColumn(columnBlockSizes);

    const blockOffset = columnBlockSizes[column] ?? 0;

    placements.push({
      column,
      inlineOffset: column * (columnInlineSize + safeGap),
      blockOffset,
    });

    columnBlockSizes[column] = blockOffset + Math.max(0, itemBlockSize) + safeGap;
  }

  // Each column carries a trailing gap it doesn't need; the tallest one decides the container's height.
  const blockSize = Math.max(0, Math.max(...columnBlockSizes, 0) - safeGap);

  return { placements, columnBlockSizes, blockSize };
};

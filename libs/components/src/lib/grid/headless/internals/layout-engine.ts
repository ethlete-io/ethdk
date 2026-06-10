import { GridItemConstraints, GridItemPosition, GridLayoutEntry } from '../grid.types';

export type FindCollisionOptions = {
  entries: GridLayoutEntry[];
  position: GridItemPosition;
  excludeId?: string;
};

export type AutoPlaceOptions = {
  entries: GridLayoutEntry[];
  colSpan: number;
  rowSpan: number;
  columns: number;
};

export type ClampPositionOptions = {
  position: GridItemPosition;
  constraints: GridItemConstraints;
  columns: number;
};

export type ResolveCollisionsOptions = {
  entries: GridLayoutEntry[];
  movedId: string;
  columns: number;
  originPosition?: GridItemPosition;
};

/**
 * Checks whether two grid items overlap.
 */
export const itemsCollide = (a: GridItemPosition, b: GridItemPosition) => {
  if (a.col + a.colSpan <= b.col) return false;
  if (b.col + b.colSpan <= a.col) return false;
  if (a.row + a.rowSpan <= b.row) return false;
  if (b.row + b.rowSpan <= a.row) return false;
  return true;
};

/**
 * Returns the first item that collides with the given position, or undefined if none.
 */
export const findCollision = (options: FindCollisionOptions) =>
  options.entries.find((entry) => entry.id !== options.excludeId && itemsCollide(entry.position, options.position));

/**
 * Compacts the layout vertically (moves items up as far as possible without collision).
 */
export const compactLayout = (entries: GridLayoutEntry[], _columns: number) => {
  const sorted = [...entries].sort((a, b) => a.position.row - b.position.row || a.position.col - b.position.col);
  const compacted: GridLayoutEntry[] = [];

  for (const entry of sorted) {
    const candidate = { ...entry, position: { ...entry.position } };

    while (candidate.position.row > 0) {
      const moved = { ...candidate, position: { ...candidate.position, row: candidate.position.row - 1 } };

      if (findCollision({ entries: compacted, position: moved.position, excludeId: candidate.id })) {
        break;
      }

      candidate.position.row = moved.position.row;
    }

    compacted.push(candidate);
  }

  return compacted;
};

/**
 * Finds the first available position for an item with the given span in a grid.
 * Uses top-left gravity: scans row by row, column by column.
 */
export const autoPlace = (options: AutoPlaceOptions) => {
  const clampedColSpan = Math.min(options.colSpan, options.columns);

  for (let row = 0; ; row++) {
    for (let col = 0; col <= options.columns - clampedColSpan; col++) {
      const candidate: GridItemPosition = { col, row, colSpan: clampedColSpan, rowSpan: options.rowSpan };

      if (!findCollision({ entries: options.entries, position: candidate })) {
        return candidate;
      }
    }
  }
};

/**
 * Validates and clamps a position to respect grid boundaries and item constraints.
 */
export const clampPosition = (options: ClampPositionOptions) => {
  const { position, constraints, columns } = options;
  const colSpan = Math.max(constraints.minColSpan, Math.min(constraints.maxColSpan, position.colSpan, columns));
  const rowSpan = Math.max(constraints.minRowSpan, Math.min(constraints.maxRowSpan, position.rowSpan));
  const col = Math.max(0, Math.min(position.col, columns - colSpan));
  const row = Math.max(0, position.row);

  return { col, row, colSpan, rowSpan };
};

/**
 * Resolves collisions by pushing items down when a moved/resized item overlaps others.
 * If exactly one item of the same size collides, they swap positions instead.
 * Cascades: if pushed items collide with others, those are pushed down too.
 */
export const resolveCollisions = (options: ResolveCollisionsOptions) => {
  const { entries, movedId, columns, originPosition } = options;
  const moved = entries.find((e) => e.id === movedId);

  if (!moved) return entries;

  const result = entries.map((e) => ({ ...e, position: { ...e.position } }));
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const movedEntry = result.find((e) => e.id === movedId)!;

  // Detect swap candidates: exactly one colliding item
  const colliding = result.filter((e) => e.id !== movedId && itemsCollide(movedEntry.position, e.position));
  const swapTarget = colliding.length === 1 ? colliding[0] : undefined;

  // Same-position same-size swap — only when origin was immediately adjacent to the target.
  // Without the adjacency guard a far-away drag (e.g. 4 rows up) would teleport the collider
  // back to the drag origin instead of simply pushing it out of the way.
  if (
    swapTarget &&
    swapTarget.position.col === movedEntry.position.col &&
    swapTarget.position.row === movedEntry.position.row &&
    swapTarget.position.colSpan === movedEntry.position.colSpan &&
    swapTarget.position.rowSpan === movedEntry.position.rowSpan &&
    originPosition
  ) {
    const dragRowDir = Math.sign(originPosition.row - movedEntry.position.row);
    const dragColDir = Math.sign(originPosition.col - movedEntry.position.col);

    const adjacentToOrigin =
      (dragRowDir > 0 && swapTarget.position.row + swapTarget.position.rowSpan === originPosition.row) ||
      (dragRowDir < 0 && originPosition.row + originPosition.rowSpan === swapTarget.position.row) ||
      (dragColDir > 0 && swapTarget.position.col + swapTarget.position.colSpan === originPosition.col) ||
      (dragColDir < 0 && originPosition.col + originPosition.colSpan === swapTarget.position.col);

    if (adjacentToOrigin) {
      swapTarget.position = { ...originPosition };

      return compactLayout(result, columns);
    }
  }

  // Horizontal same-row swap for different-size items: when the dragged item moved
  // sideways within the same row and its single collider fits in the vacated origin space.
  if (swapTarget && originPosition) {
    const sameRowBand =
      originPosition.row === movedEntry.position.row &&
      swapTarget.position.row === movedEntry.position.row &&
      swapTarget.position.rowSpan === movedEntry.position.rowSpan;

    const movedDir = Math.sign(movedEntry.position.col - originPosition.col);

    // Log whenever a single-collision drag is evaluated so we can see why the swap does/doesn't fire
    if (sameRowBand && movedDir !== 0) {
      const proposedCol =
        movedDir > 0 ? originPosition.col : originPosition.col + originPosition.colSpan - swapTarget.position.colSpan;

      const proposedPos = { ...swapTarget.position, col: proposedCol };

      const fits =
        proposedCol >= 0 &&
        proposedCol + swapTarget.position.colSpan <= columns &&
        // The two items must not overlap after the swap
        (movedEntry.position.col >= proposedCol + swapTarget.position.colSpan ||
          proposedCol >= movedEntry.position.col + movedEntry.position.colSpan);

      const noSideEffects =
        fits &&
        !result.some(
          (other) => other.id !== swapTarget.id && other.id !== movedId && itemsCollide(proposedPos, other.position),
        );

      if (noSideEffects) {
        swapTarget.position = proposedPos;

        return compactLayout(result, columns);
      }
    }
  }

  // Sort non-moved items by row so we cascade downward
  const others = result.filter((e) => e.id !== movedId).sort((a, b) => a.position.row - b.position.row);

  // Items that need their collisions checked (start with the moved item)
  const toCheck = [movedEntry];

  while (toCheck.length > 0) {
    const current = toCheck.shift() as GridLayoutEntry;

    for (const entry of others) {
      if (entry === current) continue;

      if (itemsCollide(current.position, entry.position)) {
        const newRow = current.position.row + current.position.rowSpan;

        if (newRow !== entry.position.row) {
          entry.position.row = newRow;
          toCheck.push(entry);
        }
      }
    }
  }

  return compactLayout(result, columns);
};

/**
 * Computes the total number of rows occupied by the layout.
 */
export const computeGridHeight = (entries: GridLayoutEntry[]) => {
  if (entries.length === 0) return 0;

  return Math.max(...entries.map((e) => e.position.row + e.position.rowSpan));
};

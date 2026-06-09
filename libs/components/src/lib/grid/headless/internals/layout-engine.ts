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

  // Detect same-size swap: exactly one colliding item with matching dimensions
  const colliding = result.filter((e) => e.id !== movedId && itemsCollide(movedEntry.position, e.position));
  const swapTarget = colliding.length === 1 ? colliding[0] : undefined;

  if (
    swapTarget &&
    swapTarget.position.col === movedEntry.position.col &&
    swapTarget.position.row === movedEntry.position.row &&
    swapTarget.position.colSpan === movedEntry.position.colSpan &&
    swapTarget.position.rowSpan === movedEntry.position.rowSpan &&
    originPosition
  ) {
    // Swap: move the colliding item to the moved item's origin
    swapTarget.position = { ...originPosition };

    return compactLayout(result, columns);
  }

  // Sort non-moved items by row so we cascade downward
  const others = result.filter((e) => e.id !== movedId).sort((a, b) => a.position.row - b.position.row);

  // Items that need their collisions checked (start with the moved item)
  const toCheck = [movedEntry];

  while (toCheck.length > 0) {
    const current = toCheck.shift()!;

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

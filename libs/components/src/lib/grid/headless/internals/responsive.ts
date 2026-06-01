import { GridBreakpointConfig, GridBreakpointName, GridItemPosition, GridLayoutEntry } from '../grid.types';

export type MapLayoutOptions = {
  entries: GridLayoutEntry[];
  fromColumns: number;
  toColumns: number;
};

/**
 * Resolves the active breakpoint name based on the container width.
 * Breakpoints are sorted by minWidth descending — the first one whose minWidth is <= containerWidth wins.
 */
export const resolveBreakpoint = (breakpoints: GridBreakpointConfig[], containerWidth: number): GridBreakpointName => {
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);

  for (const bp of sorted) {
    if (containerWidth >= bp.minWidth) {
      return bp.name;
    }
  }

  return sorted[sorted.length - 1]?.name ?? 'sm';
};

/**
 * Auto-generates a layout for a smaller breakpoint from a larger one.
 * Items are re-flowed into fewer columns, maintaining their relative order.
 */
export const mapLayoutToBreakpoint = (options: MapLayoutOptions) => {
  const { entries, fromColumns, toColumns } = options;

  if (toColumns >= fromColumns) {
    return entries;
  }

  const sorted = [...entries].sort((a, b) => a.position.row - b.position.row || a.position.col - b.position.col);
  const result: GridLayoutEntry[] = [];

  for (const entry of sorted) {
    const colSpan = Math.min(entry.position.colSpan, toColumns);
    const placed = autoPlaceForMapping({
      placed: result,
      colSpan,
      rowSpan: entry.position.rowSpan,
      columns: toColumns,
    });

    result.push({
      id: entry.id,
      position: placed,
    });
  }

  return result;
};

type AutoPlaceForMappingOptions = {
  placed: GridLayoutEntry[];
  colSpan: number;
  rowSpan: number;
  columns: number;
};

/**
 * Internal auto-placement used during breakpoint mapping.
 */
const autoPlaceForMapping = (options: AutoPlaceForMappingOptions): GridItemPosition => {
  const { placed, colSpan, rowSpan, columns } = options;

  for (let row = 0; ; row++) {
    for (let col = 0; col <= columns - colSpan; col++) {
      const candidate: GridItemPosition = { col, row, colSpan, rowSpan };
      const hasCollision = placed.some(
        (existing) =>
          !(
            candidate.col + candidate.colSpan <= existing.position.col ||
            existing.position.col + existing.position.colSpan <= candidate.col ||
            candidate.row + candidate.rowSpan <= existing.position.row ||
            existing.position.row + existing.position.rowSpan <= candidate.row
          ),
      );

      if (!hasCollision) {
        return candidate;
      }
    }
  }
};

export const DEFAULT_BREAKPOINTS: GridBreakpointConfig[] = [
  { name: 'lg', columns: 12, minWidth: 1200 },
  { name: 'md', columns: 6, minWidth: 768 },
  { name: 'sm', columns: 2, minWidth: 0 },
] as const;

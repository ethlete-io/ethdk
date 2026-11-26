import { autoPlace } from './layout-engine';
import { GridBreakpointConfig, GridBreakpointName, GridLayoutEntry } from '../grid.types';

export type MapLayoutOptions = {
  entries: GridLayoutEntry[];
  fromColumns: number;
  toColumns: number;
};

/**
 * Resolves the active breakpoint name based on the container width.
 * Breakpoints are sorted by minWidth descending - the first one whose minWidth is <= containerWidth wins.
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
    const placed = autoPlace({
      entries: result,
      colSpan: entry.position.colSpan,
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

export const DEFAULT_BREAKPOINTS: GridBreakpointConfig[] = [
  { name: 'lg', columns: 12, minWidth: 1200 },
  { name: 'md', columns: 6, minWidth: 768 },
  { name: 'sm', columns: 2, minWidth: 0 },
] as const;

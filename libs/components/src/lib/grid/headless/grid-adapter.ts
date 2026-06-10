import { GridItemConfig, GridItemPosition } from './grid.types';

export type GridAdapter<TExternal> = {
  fromExternal(items: TExternal[]): GridItemConfig[];
  toExternal(items: GridItemConfig[]): TExternal[];
};

export const createGridAdapter = <TExternal>(
  fromItem: (item: TExternal) => GridItemConfig,
  toItem: (item: GridItemConfig) => TExternal,
): GridAdapter<TExternal> => ({
  fromExternal: (items) => items.map(fromItem),
  toExternal: (items) => items.map(toItem),
});

/** Map a backend position shaped as `{x, y, cols, rows}` to a `GridItemPosition`. */
export const toGridPosition = (pos: { x: number; y: number; cols: number; rows: number }): GridItemPosition => ({
  col: pos.x,
  row: pos.y,
  colSpan: pos.cols,
  rowSpan: pos.rows,
});

/** Map a `GridItemPosition` to a backend position shaped as `{x, y, cols, rows}`. */
export const fromGridPosition = (pos: GridItemPosition): { x: number; y: number; cols: number; rows: number } => ({
  x: pos.col,
  y: pos.row,
  cols: pos.colSpan,
  rows: pos.rowSpan,
});

import { GridBreakpointConfig, GridBreakpointName, GridItemConfig, GridItemPosition } from './grid.types';

export type GridAdapter<TExternal, TData = unknown, TBp extends GridBreakpointName = GridBreakpointName> = {
  /** The breakpoints the adapter was declared with, ready to bind into the grid's `breakpoints` input. */
  breakpoints: GridBreakpointConfig<TBp>[];
  fromExternal(items: TExternal[]): GridItemConfig<string, TData, TBp>[];
  toExternal(items: GridItemConfig<string, TData>[]): TExternal[];
};

/** The grid's breakpoints, keyed by name: `{ lg: { columns: 12, minWidth: 1200 }, … }`. */
export type GridAdapterBreakpoints<TBp extends GridBreakpointName = GridBreakpointName> = Record<
  TBp,
  Omit<GridBreakpointConfig, 'name'>
>;

export type CreateGridAdapterOptions<TExternal, TData, TBp extends GridBreakpointName> = {
  /**
   * The grid's breakpoints. Their names type both mappers' `layout`, so a position is required for
   * every one of them and an unknown key is a compile error.
   */
  breakpoints: GridAdapterBreakpoints<TBp>;
  fromExternal: (item: TExternal) => GridItemConfig<string, TData, NoInfer<TBp>>;
  toExternal: (item: GridItemConfig<string, TData, NoInfer<TBp>>) => TExternal;
};

/**
 * Bridges a backend's item shape to the grid's `GridItemConfig` and back - one mapper per direction,
 * each mapping a single item. `breakpoints` is the single source of truth for the layout keys; bind
 * `adapter.breakpoints` into the grid's `breakpoints` input so the two cannot drift.
 */
export const createGridAdapter = <TExternal, TData, TBp extends GridBreakpointName>(
  options: CreateGridAdapterOptions<TExternal, TData, TBp>,
): GridAdapter<TExternal, TData, TBp> => {
  const breakpoints = (Object.entries(options.breakpoints) as [TBp, Omit<GridBreakpointConfig, 'name'>][]).map(
    ([name, geometry]) => ({ name, ...geometry }),
  );

  return {
    breakpoints,
    fromExternal: (items) => items.map(options.fromExternal),
    // The grid places every item on every configured breakpoint, so what it emits is total over the
    // adapter's names - which the emitted type cannot say. An item the grid has not placed yet
    // (`layout: {}`) is the exception, which is why `mapGridLayout` maps keys instead of reading them.
    toExternal: (items) => items.map((item) => options.toExternal(item as GridItemConfig<string, TData, TBp>)),
  };
};

/**
 * Maps every breakpoint of a layout record through one function, keeping the keys. Use it in either
 * adapter direction to avoid repeating the position mapping per breakpoint.
 */
export const mapGridLayout = <TBp extends GridBreakpointName, TIn, TOut>(
  layout: Record<TBp, TIn>,
  map: (value: TIn, breakpoint: TBp) => TOut,
): Record<TBp, TOut> => {
  const mapped = {} as Record<TBp, TOut>;

  for (const breakpoint of Object.keys(layout) as TBp[]) {
    mapped[breakpoint] = map(layout[breakpoint], breakpoint);
  }

  return mapped;
};

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

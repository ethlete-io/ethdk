import { GridBreakpointConfig, GridItemConfig, GridSerializedState } from '../grid.types';

export type SerializeOptions<TData = unknown> = {
  items: GridItemConfig<string, TData>[];
  breakpoints: GridBreakpointConfig[];
  rowHeight: number;
};

/**
 * Serializes the current grid state into a JSON-compatible object suitable for DB storage.
 */
export const serializeGridLayout = <TData>(options: SerializeOptions<TData>): GridSerializedState<TData> => {
  const { items, breakpoints, rowHeight } = options;
  const columns: Record<string, number> = {};

  for (const bp of breakpoints) {
    columns[bp.name] = bp.columns;
  }

  return {
    columns,
    rowHeight,
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      data: item.data,
      layout: { ...item.layout },
    })),
  };
};

/**
 * Deserializes a stored grid state back into working configuration.
 * Returns breakpoint configs and item configs.
 */
export const deserializeGridLayout = <TData>(
  state: GridSerializedState<TData>,
  breakpointMinWidths: Record<string, number>,
): { breakpoints: GridBreakpointConfig[]; items: GridItemConfig<string, TData>[]; rowHeight: number } => {
  const breakpoints: GridBreakpointConfig[] = Object.entries(state.columns).map(([name, columns]) => ({
    name,
    columns,
    minWidth: breakpointMinWidths[name] ?? 0,
  }));

  const items: GridItemConfig<string, TData>[] = state.items.map((item) => ({
    id: item.id,
    type: item.type,
    data: item.data,
    layout: { ...item.layout },
  }));

  return { breakpoints, items, rowHeight: state.rowHeight };
};

import { GridBreakpointConfig, GridItemConfig, GridSerializedState } from '../grid.types';

export type SerializeOptions = {
  items: GridItemConfig[];
  breakpoints: GridBreakpointConfig[];
  rowHeight: number;
};

/**
 * Serializes the current grid state into a JSON-compatible object suitable for DB storage.
 */
export const serializeGridLayout = (options: SerializeOptions): GridSerializedState => {
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
      componentType: item.componentType,
      layout: { ...item.layout },
      constraints: { ...item.constraints },
    })),
  };
};

/**
 * Deserializes a stored grid state back into working configuration.
 * Returns breakpoint configs and item configs.
 */
export const deserializeGridLayout = (
  state: GridSerializedState,
  breakpointMinWidths: Record<string, number>,
): { breakpoints: GridBreakpointConfig[]; items: GridItemConfig[]; rowHeight: number } => {
  const breakpoints: GridBreakpointConfig[] = Object.entries(state.columns).map(([name, columns]) => ({
    name,
    columns,
    minWidth: breakpointMinWidths[name] ?? 0,
  }));

  const items: GridItemConfig[] = state.items.map((item) => ({
    id: item.id,
    componentType: item.componentType,
    layout: { ...item.layout },
    constraints: { ...item.constraints },
  }));

  return { breakpoints, items, rowHeight: state.rowHeight };
};

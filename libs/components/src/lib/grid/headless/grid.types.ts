export type GridBreakpointName = string;

export type GridItemPosition = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

export type GridItemConstraints = {
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
};

export type GridItemConfig = {
  id: string;
  componentType: string;
  layout: Record<GridBreakpointName, GridItemPosition>;
  constraints: GridItemConstraints;
};

export type GridBreakpointConfig = {
  name: GridBreakpointName;
  columns: number;
  minWidth: number;
};

export type GridSerializedState = {
  columns: Record<GridBreakpointName, number>;
  rowHeight: number;
  items: GridItemConfig[];
};

export type GridLayoutEntry = {
  id: string;
  position: GridItemPosition;
};

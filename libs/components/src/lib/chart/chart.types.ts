import { RegisteredColorThemeName } from '@ethlete/core';

/** A rectangle in plot pixels. */
export type ChartRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Where a mark's tooltip opens, relative to its anchor. */
export type ChartTooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/** A value-axis tick: its value, its formatted text and its offset along the value axis in plot pixels. */
export type ChartTick = {
  value: number;
  text: string;
  position: number;
};

/** One label on an `et-chart-axis`, centered at `position` px along the axis. */
export type ChartAxisLabel = {
  key: string | number;
  text: string;
  position: number;
  /** The room the label has along the axis, in px. A longer text is cut off with an ellipsis. */
  extent?: number;
};

/** One entry of an `et-chart-legend`. */
export type ChartLegendItem = {
  key: string;
  label: string;
  /** The color theme the swatch is drawn in; `null` takes the surrounding accent. */
  colorToken: RegisteredColorThemeName | null;
};

/** The rows of an `et-chart-data-table`: a header column followed by one cell per value column. */
export type ChartTableModel = {
  columns: readonly string[];
  rows: readonly { header: string; cells: readonly string[] }[];
};

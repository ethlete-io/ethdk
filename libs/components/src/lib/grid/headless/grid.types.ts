import { InputSignal, Signal, Type } from '@angular/core';

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

export type GridItemConfig<TType extends string = string, TData = unknown> = {
  id: string;
  type: TType;
  data: TData;
  layout: Record<GridBreakpointName, GridItemPosition>;
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

export type GridComponentRegistration<TData = unknown> = {
  component: Type<{ data: InputSignal<TData> }>;
  type: string;
  constraints?: {
    minColSpan?: number;
    maxColSpan?: number;
    minRowSpan?: number;
    maxRowSpan?: number;
  };
  configComponent?: Type<unknown>;
};

/**
 * Injectable reference provided to configComponent instances.
 * Gives the config form access to the item's current data and the ability to save or cancel.
 */
export abstract class GridItemRef<TData = unknown> {
  abstract readonly data: Signal<TData | undefined>;
  abstract save(data: TData): void;
  abstract close(): void;
}

import { Signal, Type } from '@angular/core';

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

/**
 * Span bounds for a grid item: a base that applies everywhere, plus optional overrides per
 * breakpoint. The two merge key by key, so `{ minColSpan: 2, perBreakpoint: { sm: { minColSpan: 1 } } }`
 * keeps the other three bounds at `sm`.
 */
export type GridItemConstraintsConfig = Partial<GridItemConstraints> & {
  perBreakpoint?: Partial<Record<GridBreakpointName, Partial<GridItemConstraints>>>;
};

export type GridItemConfig<
  TType extends string = string,
  TData = unknown,
  TBp extends GridBreakpointName = GridBreakpointName,
> = {
  id: string;
  type: TType;
  data: TData;
  layout: Record<TBp, GridItemPosition>;
};

export type GridBreakpointConfig<TBp extends GridBreakpointName = GridBreakpointName> = {
  name: TBp;
  columns: number;
  minWidth: number;
};

export type GridSerializedState<TData = unknown> = {
  columns: Record<GridBreakpointName, number>;
  rowHeight: number;
  items: GridItemConfig<string, TData>[];
};

export type GridLayoutEntry = {
  id: string;
  position: GridItemPosition;
};

export type GridMutationOptions = {
  /** Skip the `layoutChange` emit for this mutation. */
  silent?: boolean;
};

/**
 * Contract for a grid item's `actionsComponent`: a component that receives the item's `itemId` and
 * `data` as inputs.
 *
 * Declare both with `input.required<T>()` - the grid binds them as inputs. The read-only `Signal`
 * type here does not enforce that.
 */
export type GridItemActionsComponent<TData = unknown> = Type<{
  itemId: Signal<string>;
  data: Signal<TData>;
}>;

/**
 * One entry of `provideGridConfig({ registrations })`: the component rendered for grid items of
 * `type`, plus optional span constraints and a config component for edit mode.
 *
 * The component's `data` must be declared with `input<T>()` - the grid binds it as an input. The
 * read-only `Signal` type here does not enforce that.
 */
export type GridComponentRegistration<TData = unknown> = {
  component: Type<{ data: Signal<TData> }>;
  type: string;
  constraints?: GridItemConstraintsConfig;
  configComponent?: Type<unknown>;
};

/**
 * Injectable reference provided to configComponent instances: the item's current data, and the
 * ability to save or cancel.
 */
export abstract class GridItemRef<TData = unknown> {
  abstract readonly data: Signal<TData | undefined>;
  abstract save(data: TData): void;
  abstract close(): void;
}

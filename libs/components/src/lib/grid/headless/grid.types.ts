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
 * keeps the other three bounds at `sm`. A bound the breakpoint does not name keeps its base value.
 *
 * Column spans are still capped to the breakpoint's column count, so an override only has to say
 * what the cap cannot: a different span where the grid is wide enough for the base one.
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
  /**
   * Skip the `layoutChange` emit for this mutation. For a change the host already knows about -
   * it fed the item in through `items` - so the output keeps meaning "the user moved
   * something".
   */
  silent?: boolean;
};

/**
 * Contract for a grid item's `actionsComponent`: a component that receives the item's `itemId` and
 * `data` as inputs. Both are always provided by the grid.
 *
 * Declare both with `input.required<T>()` - the grid binds them as inputs. The read-only `Signal`
 * type here does not enforce that; see {@link GridComponentRegistration} for why.
 */
export type GridItemActionsComponent<TData = unknown> = Type<{
  itemId: Signal<string>;
  data: Signal<TData>;
}>;

/**
 * One entry of `provideGridConfig({ registrations })`: the component rendered for grid items of
 * `type`, plus optional span constraints and a config component for edit mode.
 *
 * The component's `data` must be declared with `input<T>()` - the grid binds it as an input. It is
 * typed as a read-only `Signal` because `InputSignal<T>` is invariant in `T`, which would make a
 * widget with a concrete payload type unassignable and force a cast at every registration.
 */
export type GridComponentRegistration<TData = unknown> = {
  component: Type<{ data: Signal<TData> }>;
  type: string;
  constraints?: GridItemConstraintsConfig;
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

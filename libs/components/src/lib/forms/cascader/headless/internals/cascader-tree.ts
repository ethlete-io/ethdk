import { Observable, from, isObservable, of } from 'rxjs';

/** A single entry in a cascader's hierarchy. `T` is the consumer's value type. */
export type CascaderNode<T> = {
  /** The value committed to the form when this node is selected (leaf) or picked (any-level). */
  value: T;
  /** The visible label. */
  label: string;
  /** Marks the node as a terminal leaf — it is selectable and never expands. */
  isLeaf?: boolean;
  /**
   * Whether the node has children to drill into. `false` makes it terminal (like `isLeaf`);
   * omit it to discover children lazily by loading them.
   */
  hasChildren?: boolean;
  /** Disables selecting and expanding the node. */
  disabled?: boolean;
};

/**
 * The abstract hierarchical source a cascader browses. `loadChildren` returns the children
 * of a node (or the root's children when `parent` is `null`) as a sync array, a `Promise`,
 * or an `Observable` — so static trees and per-level async both work, and each level loads
 * only when the user drills into it.
 */
export type CascaderDataSource<T> = {
  loadChildren(
    parent: CascaderNode<T> | null,
  ): CascaderNode<T>[] | Promise<CascaderNode<T>[]> | Observable<CascaderNode<T>[]>;
};

/** Whether a node can be drilled into — false for explicit leaves and `hasChildren: false`. */
export const canHaveChildren = <T>(node: CascaderNode<T>) => node.isLeaf !== true && node.hasChildren !== false;

export type CascaderCompareWith<T> = (a: T, b: T) => boolean;

export const defaultCompareWith: CascaderCompareWith<unknown> = (a, b) => a === b;

/** Value equality between two nodes via the configured comparator. */
export const nodesEqual = <T>(options: {
  a: CascaderNode<T> | null;
  b: CascaderNode<T> | null;
  compareWith: CascaderCompareWith<T>;
}) => {
  const { a, b, compareWith } = options;

  return a !== null && b !== null && compareWith(a.value, b.value);
};

/** Index of `node` in `nodes` by value equality, or `-1`. */
export const indexOfNode = <T>(options: {
  nodes: readonly CascaderNode<T>[];
  node: CascaderNode<T> | null;
  compareWith: CascaderCompareWith<T>;
}) => {
  const { nodes, node, compareWith } = options;

  return node === null ? -1 : nodes.findIndex((candidate) => compareWith(candidate.value, node.value));
};

/** Normalizes a `loadChildren` result (array | Promise | Observable) into an Observable. */
export const toChildrenObservable = <T>(
  result: CascaderNode<T>[] | Promise<CascaderNode<T>[]> | Observable<CascaderNode<T>[]>,
): Observable<CascaderNode<T>[]> => {
  if (Array.isArray(result)) {
    return of(result);
  }

  if (isObservable(result)) {
    return result;
  }

  return from(result);
};

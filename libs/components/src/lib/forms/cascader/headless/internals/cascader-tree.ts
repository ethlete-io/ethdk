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

  /**
   * Optionally resolves the ancestor chain (root → committed node) for a value, so the trigger
   * can show its breadcrumb when the value is set **programmatically** (a form patch/restore)
   * rather than picked in the panel. Return `null` (or an empty array) when the value has no
   * resolvable path. Without this hook an externally-set value commits fine but shows the
   * placeholder until the user re-opens and re-picks — the cascader can't reverse a value into
   * a path itself, because `loadChildren` is lazy and per-level (walking every branch to find
   * one value could fire an unbounded number of loads). For a static tree the implementation is
   * a trivial depth-first search; for an async source, resolve it however the backend allows.
   */
  resolvePath?(
    value: T,
  ): CascaderNode<T>[] | null | Promise<CascaderNode<T>[] | null> | Observable<CascaderNode<T>[] | null>;

  /**
   * Optionally searches the whole hierarchy **flat** — across all levels at once, so a known
   * leaf can be jumped to without drilling. Each result is the full ancestor chain (root →
   * matching node). Providing this hook is what enables search: with it, a search input
   * (`etCascaderSearch` / the default component's built-in one) filters the panel into a flat
   * result list. It lives on the data source for the same reason `resolvePath` does — the tree
   * is lazy and per-level, so only the source can search branches that were never loaded. For
   * a static tree it's a depth-first walk collecting matches; for an async source, a backend
   * search endpoint.
   */
  search?(query: string): CascaderNode<T>[][] | Promise<CascaderNode<T>[][]> | Observable<CascaderNode<T>[][]>;
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

/** Normalizes a `search` result (array | Promise | Observable) into an Observable. */
export const toSearchObservable = <T>(
  result: CascaderNode<T>[][] | Promise<CascaderNode<T>[][]> | Observable<CascaderNode<T>[][]>,
): Observable<CascaderNode<T>[][]> => {
  if (Array.isArray(result)) {
    return of(result);
  }

  if (isObservable(result)) {
    return result;
  }

  return from(result);
};

/** Normalizes a `resolvePath` result (array | null | Promise | Observable) into an Observable. */
export const toPathObservable = <T>(
  result: CascaderNode<T>[] | null | Promise<CascaderNode<T>[] | null> | Observable<CascaderNode<T>[] | null>,
): Observable<CascaderNode<T>[] | null> => {
  if (result === null) {
    return of(null);
  }

  if (Array.isArray(result)) {
    return of(result);
  }

  if (isObservable(result)) {
    return result;
  }

  return from(result);
};

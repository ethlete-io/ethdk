import { CascaderNode } from './internals/cascader-tree';

/** The load state of one cascader column (a level of the hierarchy). */
export type CascaderColumnState<T = unknown> = {
  /** The node whose children this column shows — `null` for the root column. */
  parent: CascaderNode<T> | null;
  status: 'loading' | 'loaded' | 'error';
  nodes: CascaderNode<T>[];
  /** Error text when `status` is `'error'`. */
  error: string | null;
};

/** The state of a flat search — `idle` while no query is active. */
export type CascaderSearchState<T = unknown> = {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  /** Matching paths (root → matching node chains) from the data source's `search`. */
  results: CascaderNode<T>[][];
  /** Error text when `status` is `'error'`. */
  error: string | null;
};

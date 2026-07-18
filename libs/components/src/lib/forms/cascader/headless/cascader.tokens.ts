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

import { Observable } from 'rxjs';

/** A single entry in a tree's hierarchy. `T` is the consumer's value type. */
export type TreeNode<T> = {
  /**
   * Identifies the node. Expansion, selection and focus are all tracked by value, so it has to be
   * unique across the whole tree - not just among its siblings.
   */
  value: T;
  /** The visible label. Also what type-ahead matches on. */
  label: string;
  /** Marks the node as a terminal leaf - it is never expandable. */
  isLeaf?: boolean;
  /**
   * Whether the node has children to expand into. `false` makes it terminal (like `isLeaf`); omit it
   * to discover children lazily by loading them.
   */
  hasChildren?: boolean;
  /** Disables selecting and expanding the node. */
  disabled?: boolean;
};

/**
 * The hierarchical source a tree renders. `loadChildren` returns the children of a node (or the
 * root's children when `parent` is `null`) as a sync array, a `Promise`, or an `Observable` - so
 * static trees and per-level async both work, and a branch loads only when it is first expanded.
 *
 * Structurally identical to the cascader's `CascaderDataSource.loadChildren`, so one source object
 * can drive an `et-tree` and an `et-cascader` over the same hierarchy.
 */
export type TreeDataSource<T> = {
  loadChildren(parent: TreeNode<T> | null): TreeNode<T>[] | Promise<TreeNode<T>[]> | Observable<TreeNode<T>[]>;
};

/** Value equality between two node values - override when values are objects. */
export type TreeCompareWith<T> = (a: T, b: T) => boolean;

export const TREE_SELECTION_MODES = {
  /** Rows never select. Expansion, focus and `activated` still work - a pure navigation tree. */
  NONE: 'none',
  /** At most one selected node; `value` is `T | null`. */
  SINGLE: 'single',
  /** Any number of selected nodes; `value` is `T[]`, and activating a row toggles it. */
  MULTIPLE: 'multiple',
} as const;

export type TreeSelectionMode = (typeof TREE_SELECTION_MODES)[keyof typeof TREE_SELECTION_MODES];

export const TREE_LEVEL_STATUSES = {
  /** Not requested yet - a collapsed branch's children start here. */
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
} as const;

export type TreeLevelStatus = (typeof TREE_LEVEL_STATUSES)[keyof typeof TREE_LEVEL_STATUSES];

/**
 * One row of the flattened tree - what a tree renders instead of nesting components per level. Carries
 * everything a row needs, including the ARIA position values a flat DOM has to state explicitly.
 */
export type TreeRow<T> = {
  node: TreeNode<T>;
  /** Depth, 1-based - reported as `aria-level`. */
  level: number;
  /** The chain from the root down to (and including) this node. */
  path: readonly TreeNode<T>[];
  isExpandable: boolean;
  isExpanded: boolean;
  isDisabled: boolean;
  /** Load state of this node's *children*. `'idle'` until the branch is first expanded. */
  childrenStatus: TreeLevelStatus;
  /** The message from a failed child load, via the tree's `toErrorMessage`. */
  childrenError: string | null;
  /** 1-based index among its siblings - reported as `aria-posinset`. */
  posInSet: number;
  /** How many siblings it has in total - reported as `aria-setsize`. */
  setSize: number;
};

/** The context an `etTreeNodeDef` row template is rendered with. */
export type TreeNodeDefContext<T> = {
  $implicit: TreeNode<T>;
  row: TreeRow<T>;
};

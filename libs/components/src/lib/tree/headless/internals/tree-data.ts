import { Observable, from, isObservable, of } from 'rxjs';
import { TreeCompareWith, TreeNode } from '../tree.types';

/** Whether a node can be expanded - false for explicit leaves and `hasChildren: false`. */
export const canExpand = <T>(node: TreeNode<T>) => node.isLeaf !== true && node.hasChildren !== false;

export const defaultCompareWith: TreeCompareWith<unknown> = (a, b) => a === b;

/** Value equality between two nodes via the configured comparator. `null` matches only `null`. */
export const nodesEqual = <T>(options: {
  a: TreeNode<T> | null;
  b: TreeNode<T> | null;
  compareWith: TreeCompareWith<T>;
}) => {
  const { a, b, compareWith } = options;

  if (a === null || b === null) {
    return a === b;
  }

  return compareWith(a.value, b.value);
};

/** Normalizes a `loadChildren` result (array | Promise | Observable) into an Observable. */
export const toChildrenObservable = <T>(
  result: TreeNode<T>[] | Promise<TreeNode<T>[]> | Observable<TreeNode<T>[]>,
): Observable<TreeNode<T>[]> => {
  if (Array.isArray(result)) {
    return of(result);
  }

  if (isObservable(result)) {
    return result;
  }

  return from(result);
};

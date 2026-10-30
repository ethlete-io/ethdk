import { DesignChange } from '../../host/design-changes';

/** How often each list of the system view was asked to read again; `all` also covers comments, notes and the project. */
export type ListRevisions = { all: number; products: number; calls: number; sketches: number; flows: number };

export const NO_LIST_REVISIONS: ListRevisions = { all: 0, products: 0, calls: 0, sketches: 0, flows: 0 };

const LISTS_OF: Record<DesignChange['kind'], (keyof ListRevisions)[]> = {
  all: ['all', 'products', 'calls', 'sketches', 'flows'],
  parts: ['products', 'sketches', 'flows'],
  calls: ['calls'],
  sketches: ['sketches'],
};

/** Bumps each list a burst of changes names once. */
export const listRevisionsWith = (revisions: ListRevisions, changes: DesignChange[]): ListRevisions => {
  const lists = new Set(changes.flatMap((change) => LISTS_OF[change.kind]));

  return lists.size === 0
    ? revisions
    : { ...revisions, ...Object.fromEntries([...lists].map((list) => [list, revisions[list] + 1])) };
};

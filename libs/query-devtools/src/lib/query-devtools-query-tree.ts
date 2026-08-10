/** One folder in the Queries list's path tree, or the tree's own root. */
export type QueryPathNode<T> = {
  /** The full path this node stands for, `/`-prefixed - the stable key its collapsed state is stored under. */
  key: string;

  /** What the row shows. After chain compression this can be several segments, e.g. `api/v1`. */
  label: string;

  /** Rows whose path ends exactly here. */
  items: T[];

  children: QueryPathNode<T>[];

  /** Rows at or below this node, which is what the folder row counts. */
  count: number;
};

/** The tree's root: rows with no path of their own, plus the top-level folders. */
export type QueryPathTree<T> = { items: T[]; children: QueryPathNode<T>[] };

/** Path segments of a route, with the query string left attached to the segment it belongs to. */
export const queryRoutePathSegments = (route: string) => route.split('/').filter(Boolean);

type Building<T> = { key: string; segments: string[]; items: T[]; children: Map<string, Building<T>> };

const node = <T>(key: string, segment: string): Building<T> => ({
  key,
  segments: [segment],
  items: [],
  children: new Map(),
});

/**
 * Folds a node that only exists to hold one child into that child - `api` → `v1` → `teams` becomes one
 * `api/v1/teams` row. Without this a tree of REST routes is mostly rows that say nothing and cost a
 * level of indentation each, which is strictly worse than the flat list it replaced.
 */
const compress = <T>(current: Building<T>): Building<T> => {
  let folded = current;

  while (folded.items.length === 0 && folded.children.size === 1) {
    const [child] = [...folded.children.values()] as [Building<T>];

    folded = { ...child, segments: [...folded.segments, ...child.segments] };
  }

  return {
    ...folded,
    children: new Map([...folded.children].map(([segment, child]) => [segment, compress(child)])),
  };
};

const countOf = <T>(current: Building<T>): number =>
  current.items.length + [...current.children.values()].reduce((sum, child) => sum + countOf(child), 0);

const finalize = <T>(current: Building<T>): QueryPathNode<T> => ({
  key: current.key,
  label: current.segments.join('/'),
  items: current.items,
  children: [...current.children.values()].map(finalize),
  count: countOf(current),
});

/**
 * Arranges rows into a tree by their route path, keeping the order they arrive in - which is the order
 * the flat list already sorted them into, so pinning and the recent-first sort still decide what is near
 * the top. A row whose route has no segments at all sits at the root rather than inventing a folder.
 */
export const buildQueryPathTree = <T>(rows: readonly { path: string[]; item: T }[]): QueryPathTree<T> => {
  const root = node<T>('', '');

  for (const { path, item } of rows) {
    let current = root;

    for (const segment of path) {
      const existing = current.children.get(segment);

      if (existing) {
        current = existing;
        continue;
      }

      const child = node<T>(`${current.key}/${segment}`, segment);
      current.children.set(segment, child);
      current = child;
    }

    current.items.push(item);
  }

  return {
    items: root.items,
    children: [...root.children.values()].map((child) => finalize(compress(child))),
  };
};

/** One line of the rendered tree: a folder, or a row at the depth its path put it. */
export type QueryTreeRow<T> =
  | { kind: 'folder'; key: string; label: string; depth: number; count: number; collapsed: boolean }
  | {
      kind: 'row';
      key: string;
      depth: number;
      item: T;

      /** The path of the folder this row sits under, which the row may leave off its own label. */
      parentPath: string;
    };

/**
 * Flattens the tree into the lines to render, skipping everything under a collapsed folder. A flat list
 * is what the template iterates: one `@for`, and a folder's rows track independently of it.
 *
 * **A node nothing branches off gets no folder row.** A row already shows its whole route, so a `/flaky`
 * heading above one `GET /flaky` costs a line and a level of indentation to repeat what is on the line
 * below it - and a tree made mostly of those is worse than the flat list it replaced. Only a node that
 * actually splits the list earns a heading.
 */
export const flattenQueryPathTree = <T>(
  tree: QueryPathTree<T>,
  options: { isCollapsed: (key: string) => boolean; keyOf: (item: T) => string },
): QueryTreeRow<T>[] => {
  const rows: QueryTreeRow<T>[] = [];

  const walk = (nodes: QueryPathNode<T>[], at: { depth: number; parentPath: string }) => {
    const { depth, parentPath } = at;

    for (const child of nodes) {
      if (!child.children.length) {
        for (const item of child.items) {
          rows.push({ kind: 'row', key: options.keyOf(item), depth, item, parentPath });
        }

        continue;
      }

      const collapsed = options.isCollapsed(child.key);

      rows.push({ kind: 'folder', key: child.key, label: child.label, depth, count: child.count, collapsed });

      if (collapsed) continue;

      for (const item of child.items) {
        rows.push({ kind: 'row', key: options.keyOf(item), depth: depth + 1, item, parentPath: child.key });
      }

      walk(child.children, { depth: depth + 1, parentPath: child.key });
    }
  };

  for (const item of tree.items) {
    rows.push({ kind: 'row', key: options.keyOf(item), depth: 0, item, parentPath: '' });
  }

  walk(tree.children, { depth: 0, parentPath: '' });

  return rows;
};

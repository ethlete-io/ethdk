import { dirname } from 'path';
import { importedSharedOf, partDependenciesOf } from '../imports';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { editedSharedPathsOf } from './merge-shared';
import { overlaySketch } from './overlay';
import { Sketch, sourceFilesIn } from './sketch';

export type MergePreview = { changed: string[]; shared: string[]; affected: string[] };

const SHOWN = new Set(['elements', 'pages']);

const usersOf = (product: ResolvedProduct) => {
  const users = new Map<string, Set<string>>();

  for (const part of product.parts) {
    for (const dependency of partDependenciesOf(part)) {
      const key = partKeyOf(dependency);

      users.set(key, (users.get(key) ?? new Set()).add(partKeyOf(part)));
    }
  }

  return users;
};

const sharedReachOf = (options: { product: ResolvedProduct; sketch: Sketch; variant: string; held: Set<string> }) => {
  const { product, held } = options;
  const edited = new Set(editedSharedPathsOf(options));

  if (edited.size === 0) return [];

  return product.parts
    .filter((part) => !held.has(partKeyOf(part)))
    .filter((part) =>
      importedSharedOf({ product, files: sourceFilesIn(dirname(part.file)) }).some(({ path }) => edited.has(path)),
    )
    .map(partKeyOf);
};

/**
 * What a merge of one variant changes: the parts the variant holds and, in `shared`, each other part that imports a
 * `shared/` file the variant edits (both in `changed`), and each element and page that uses one of them, directly or
 * through another part.
 */
export const mergePreviewOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): MergePreview => {
  const users = usersOf(options.product);
  const held = new Set(overlaySketch(options).sketched);
  const shared = sharedReachOf({ ...options, held });
  const changed = new Set([...held, ...shared]);
  const reached = new Set<string>();
  const queue = [...changed];

  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    for (const user of users.get(key) ?? []) {
      if (reached.has(user)) continue;

      reached.add(user);
      queue.push(user);
    }
  }

  return {
    changed: [...changed].sort(),
    shared: shared.sort(),
    affected: [...reached].filter((key) => !changed.has(key) && SHOWN.has(key.split('/')[0] ?? '')).sort(),
  };
};

import { partDependenciesOf } from '../imports';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { Sketch } from './sketch';

export type MergePreview = { changed: string[]; affected: string[] };

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

/**
 * What a merge of one variant changes: the parts the variant holds, and each element and page that
 * uses one of them, directly or through another part.
 */
export const mergePreviewOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): MergePreview => {
  const users = usersOf(options.product);
  const changed = new Set(overlaySketch(options).sketched);
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
    affected: [...reached].filter((key) => !changed.has(key) && SHOWN.has(key.split('/')[0] ?? '')).sort(),
  };
};

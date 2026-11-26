import { resolve } from 'path';
import { readConfig } from '../design-config';
import { baseDirOf, ProductSource } from './base';
import { repoRootOf } from './reachable-files';

const readableConfigOf = (target: string) => {
  try {
    return readConfig(target);
  } catch {
    return null;
  }
};

/**
 * Whether another product of the same workspace extends `product` as its `base`: a library, whose parts are made
 * for other products to embed and whose states show generic labels instead of a project's sample data.
 */
export const isLibraryProduct = (product: ProductSource) => {
  const target = repoRootOf(product);
  const dir = resolve(product.dir);

  return Object.entries(readableConfigOf(target)?.products ?? {}).some(
    ([name, config]) => name !== product.name && !!config.base && baseDirOf({ target, base: config.base }) === dir,
  );
};

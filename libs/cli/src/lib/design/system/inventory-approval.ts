import { ResolvedPart, ResolvedProduct } from './resolve-product';

/** The directory whose merged.json holds a part: its base's for a part the product takes from its base. */
export const partOwnerOf = (options: { product: ResolvedProduct; part: ResolvedPart }) =>
  options.part.origin === 'base' && options.product.base
    ? { dir: options.product.base.dir, base: null }
    : options.product;

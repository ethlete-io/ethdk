import { partsReachedFrom } from '../imports';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { Sketch } from './sketch';

/**
 * The pages of `product` that embed a part the sketch changes, directly or through another part, sorted by key; a
 * sketch of a tokens part has none, since every part takes those.
 */
export const hostPagesOf = (options: { product: ResolvedProduct; sketch: Pick<Sketch, 'targets'> }): string[] => {
  const { product, sketch } = options;

  if (sketch.targets.some((part) => product.tokens.includes(part))) return [];

  return product.parts
    .filter((page) => {
      const key = partKeyOf(page);

      return (
        key.startsWith('pages/') &&
        !sketch.targets.includes(key) &&
        partsReachedFrom({ product, from: page }).some((reached) => sketch.targets.includes(partKeyOf(reached)))
      );
    })
    .map(partKeyOf)
    .sort();
};

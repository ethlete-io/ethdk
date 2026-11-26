import { partsReachedFrom } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';

/**
 * A part that draws the product's zoom control but reaches the declared canvas part neither itself nor through
 * another part, so it pans a canvas box of its own. Off unless the product config names a `canvas`.
 */
export const ownCanvasesOf = (product: ResolvedProduct): Problem[] => {
  const canvas = product.config.canvas;

  if (!canvas) {
    skipRule({
      rule: 'OWN-CANVAS',
      product: product.name,
      kind: 'not-applicable',
      reason: 'config.json names no canvas part',
    });

    return [];
  }

  return product.parts
    .filter((part) => ![canvas.part, canvas.zoom].includes(partKeyOf(part)))
    .flatMap((part) => {
      const reached = new Set(partsReachedFrom({ product, from: part }).map(partKeyOf));

      return reached.has(canvas.zoom) && !reached.has(canvas.part)
        ? [
            {
              rule: 'OWN-CANVAS',
              file: part.file,
              message: `draws ${canvas.zoom} on a canvas box of its own - draw the canvas with ${canvas.part}, the product's one canvas`,
            },
          ]
        : [];
    });
};

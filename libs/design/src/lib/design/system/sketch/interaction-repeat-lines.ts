import { INTERACTION_REPEAT_RULE } from '../build-ready-contract';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { interactionRepeatMessageOf, repeatedInteractionsOf } from '../rules/interaction-repeat';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

/** One `INTERACTION-REPEAT` line per interaction cell of a target of a live variant, see `repeatedInteractionsOf`. */
export const interactionRepeatLinesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
}): Promise<string[]> => {
  const { product, sketch, load } = options;
  const lines: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry))) {
    const parts = overlaySketch({ product, sketch, variant }).parts;

    for (const target of sketch.targets) {
      const part = parts.find((entry) => partKeyOf(entry) === target);

      if (!part || part.origin === 'base') continue;

      const loaded = (await load({
        file: part.file,
        product: product.name,
        sketch: { target: sketch.target, variant },
      }).catch(() => null)) as { default?: unknown } | null;

      for (const repeated of await repeatedInteractionsOf(loaded?.default))
        lines.push(
          `${INTERACTION_REPEAT_RULE} ${sketch.target} ${variant} ${target}: ${interactionRepeatMessageOf(repeated)}`,
        );
    }
  }

  return lines;
};

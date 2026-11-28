import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { STATE_INNER_RULE } from '../build-ready-contract';
import { checksInnerStates, innerOnlyStatesOf, stateInnerMessageOf } from '../rules/state-inner';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

/** One `STATE-INNER` line per state of a target of a live variant that changes only one inner part, see `innerOnlyStatesOf`. */
export const stateInnerLinesOf = async (options: {
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

      if (!part || !checksInnerStates(part)) continue;

      const loaded = (await load({
        file: part.file,
        product: product.name,
        sketch: { target: sketch.target, variant },
      }).catch(() => null)) as { default?: unknown } | null;

      for (const inner of await innerOnlyStatesOf({ own: target, definition: loaded?.default }))
        lines.push(
          `${STATE_INNER_RULE} ${sketch.target} ${variant} ${target}: ${stateInnerMessageOf({ own: target, ...inner })}`,
        );
    }
  }

  return lines;
};

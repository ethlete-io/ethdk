import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { SketchPartLoader, unchangedStatesOf } from './unchanged-states';
import { PictureOf } from '../../merge-compare';

/**
 * The warning for a part whose "Aktuell" column in the Studio sketch view draws no frame: the rows left once the
 * states every variant draws unchanged are folded away are all new in the sketch. `null` when it draws one.
 */
export const aktuellPlaceholderWarningOf = (options: {
  current: string[];
  variants: { states: string[]; unchanged: string[] }[];
}): string | null => {
  const { current, variants } = options;
  const folded =
    variants.length === 0 ? [] : current.filter((state) => variants.every((v) => v.unchanged.includes(state)));
  const visible = [...new Set([...current, ...variants.flatMap((variant) => variant.states)])].filter(
    (state) => !folded.includes(state),
  );

  if (folded.length === 0 || visible.some((state) => current.includes(state))) return null;

  return `Aktuell shows only placeholders: open "${folded[0]}" to compare`;
};

/** The `VARIANT-UNCHANGED` warning for a variant that draws every one of its states like the product; `null` otherwise. */
export const unchangedVariantWarningOf = (options: { states: string[]; unchanged: string[] }): string | null => {
  const { states, unchanged } = options;

  if (states.length === 0 || states.some((state) => !unchanged.includes(state))) return null;

  return `WARNING VARIANT-UNCHANGED every state (${states.join(', ')}) draws the same pixels as Aktuell - the variant offers no decision`;
};

/**
 * One warning per target part of the sketch whose "Aktuell" column would show only placeholders, and one per live
 * variant that draws every state of a target like the product.
 */
export const aktuellPlaceholderWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const warnings: string[] = [];

  for (const part of sketch.targets) {
    const file = product.parts.find((entry) => partKeyOf(entry) === part)?.file;

    if (!file) continue;

    const current = await readPartModule({
      part: { file },
      product: product.name,
      load: () => load({ file, product: product.name, sketch: null }),
    });

    if (current.problem) continue;

    const variants = [];

    for (const variant of live) {
      const drawn = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;

      if (!drawn) continue;

      const read = await readPartModule({
        part: { file: drawn },
        product: product.name,
        load: () => load({ file: drawn, product: product.name, sketch: { target: sketch.target, variant } }),
      });

      if (read.problem) continue;

      const compared = {
        states: read.states,
        unchanged: await unchangedStatesOf({ product, sketch, variant, load, pictureOf, part }),
      };
      const unchangedWarning = unchangedVariantWarningOf(compared);

      variants.push(compared);

      if (unchangedWarning !== null)
        warnings.push(`${sketch.target} ${variant}${part === sketch.target ? '' : ` ${part}`}: ${unchangedWarning}`);
    }

    const warning = aktuellPlaceholderWarningOf({ current: current.states, variants });

    if (warning !== null) warnings.push(`${sketch.target}${part === sketch.target ? '' : ` ${part}`}: ${warning}`);
  }

  return warnings;
};

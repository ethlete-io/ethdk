import { compareMerge, PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { Sketch, variantDirOf } from './sketch';
import { SketchPartLoader, unchangedStatesOf } from './unchanged-states';

const affectedChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string | null> => {
  const { product, sketch, variant, load, pictureOf } = options;
  const { changed } = await compareMerge({
    product,
    sketch,
    variant,
    size: null,
    params: new URLSearchParams(),
    pictureOf,
    load: (part) => load({ ...part, sketch: null }),
  });

  if (changed.length === 0) return null;

  const rows = changed.map((row) =>
    [row.part, row.state, row.error ? `(${row.error})` : ''].filter((entry) => entry !== '').join(' '),
  );

  return `variant ${variant} changes ${rows.join(', ')}`;
};

const variantChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string | null> => {
  const { product, sketch, variant, load, pictureOf } = options;
  const others = partFilesOf(variantDirOf(sketch, variant))
    .parts.map(partKeyOf)
    .filter((key) => key !== sketch.target);

  if (others.length > 0) return `variant ${variant} also holds ${others.join(', ')}`;

  const file = overlaySketch({ product, sketch, variant }).parts.find(
    (part) => partKeyOf(part) === sketch.target,
  )?.file;

  if (!file) return `variant ${variant} does not draw ${sketch.target}`;

  const read = await readPartModule({
    part: { file },
    product: product.name,
    load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
  });

  if (read.problem) return `variant ${variant} does not load: ${read.problem}`;
  if (read.states.length === 0) return `variant ${variant} has no states`;

  const failures = new Set<string>();
  const recording: PictureOf = async (picture) => {
    try {
      return await pictureOf(picture);
    } catch (error) {
      failures.add(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  const unchanged = await unchangedStatesOf({ product, sketch, variant, load, pictureOf: recording });
  const changed = read.states.filter((state) => !unchanged.includes(state));

  if (changed.length === 0) return affectedChangeOf({ product, sketch, variant, load, pictureOf });

  const failed = failures.size > 0 ? ` - a shot failed: ${[...failures].join('; ')}` : '';

  return `variant ${variant} changes ${changed.join(', ')}${failed}`;
};

/**
 * `true` when every state of every variant of the sketch draws the same pixels as the product does now, in
 * every frame, and so does each state of every part that shows the target; otherwise why not. A variant that holds another part than the target, or a state that fails to
 * draw, counts as a change.
 */
export const sketchShowsNoChange = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<true | string> => {
  const { sketch } = options;

  if (sketch.variants.length === 0) return 'the sketch has no variant';

  const changes = await Promise.all(sketch.variants.map((variant) => variantChangeOf({ ...options, variant })));
  const found = changes.filter((change) => change !== null);

  return found.length === 0 ? true : found.join('; ');
};

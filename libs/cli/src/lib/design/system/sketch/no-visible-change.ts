import { compareMerge, PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { mergePreviewOf } from './merge-preview';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch, variantDirOf } from './sketch';
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

const partChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
  part: string;
  named: boolean;
}): Promise<string | null> => {
  const { product, sketch, variant, load, pictureOf, part, named } = options;
  const file = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;

  if (!file) return `variant ${variant} does not draw ${part}`;

  const read = await readPartModule({
    part: { file },
    product: product.name,
    load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
  });
  const of = named ? ` ${part}` : '';

  if (read.problem) return `variant ${variant}${of} does not load: ${read.problem}`;
  if (read.states.length === 0) return `variant ${variant}${of} has no states`;

  const failures = new Set<string>();
  const recording: PictureOf = async (picture) => {
    try {
      return await pictureOf(picture);
    } catch (error) {
      failures.add(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  const unchanged = await unchangedStatesOf({ product, sketch, variant, load, pictureOf: recording, part });
  const changed = read.states.filter((state) => !unchanged.includes(state));

  if (changed.length === 0) return null;

  const failed = failures.size > 0 ? ` - a shot failed: ${[...failures].join('; ')}` : '';

  return `variant ${variant} changes${of} ${changed.join(', ')}${failed}`;
};

const variantChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string | null> => {
  const { product, sketch, variant } = options;
  const others = partFilesOf(variantDirOf(sketch, variant))
    .parts.map(partKeyOf)
    .filter((key) => !sketch.targets.includes(key));

  if (others.length > 0) return `variant ${variant} also holds ${others.join(', ')}`;

  const parts = [...sketch.targets, ...mergePreviewOf({ product, sketch, variant }).shared];

  for (const part of parts) {
    const change = await partChangeOf({ ...options, part, named: parts.length > 1 });

    if (change !== null) return change;
  }

  return affectedChangeOf(options);
};

/**
 * `true` when every state of every target of every live variant of the sketch draws the same pixels as the product
 * does now, in every frame, and so does each state of every part a `shared/` edit of the variant reaches and of every
 * part that shows one of them; otherwise why not. A variant that holds a part other than a target, or a state that
 * fails to draw, counts as a change.
 */
export const sketchShowsNoChange = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<true | string> => {
  const { sketch } = options;

  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));

  if (live.length === 0) return 'the sketch has no live variant';

  const changes = await Promise.all(live.map((variant) => variantChangeOf({ ...options, variant })));
  const found = changes.filter((change) => change !== null);

  return found.length === 0 ? true : found.join('; ');
};

/** Why each target of each live variant of the sketch fails to load, one line each; `[]` when all of them load. */
export const variantLoadProblemsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
}): Promise<string[]> => {
  const { product, sketch, load } = options;
  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const problems: string[] = [];

  for (const variant of live) {
    const parts = overlaySketch({ product, sketch, variant }).parts;

    for (const target of sketch.targets) {
      const file = parts.find((entry) => partKeyOf(entry) === target)?.file;

      if (!file) continue;

      const read = await readPartModule({
        part: { file },
        product: product.name,
        load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
      });

      if (read.problem) problems.push(`variant ${variant} ${target} does not load: ${read.problem}`);
    }
  }

  return problems;
};

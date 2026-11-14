import { compareMerge, PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { mergePreviewOf } from './merge-preview';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch, variantDirOf } from './sketch';
import { SketchPartLoader, unchangedStatesOf } from './unchanged-states';
import { VariantChange } from './viewed-shots';

type Counted = Omit<VariantChange, 'variant'>;

const SAME: Counted = { changed: 0, change: null };

const uncounted = (change: string): Counted => ({ changed: null, change });

const affectedChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<Counted> => {
  const { product, sketch, variant, load, pictureOf } = options;
  const { changed } = await compareMerge({
    product,
    sketch,
    variant,
    size: null,
    params: new URLSearchParams(),
    pictureOf,
    load,
  });

  if (changed.length === 0) return SAME;

  const rows = changed.map((row) =>
    [row.part, row.state, row.error ? `(${row.error})` : ''].filter((entry) => entry !== '').join(' '),
  );

  return { changed: rows.length, change: `variant ${variant} changes ${rows.join(', ')}` };
};

const partChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
  part: string;
  named: boolean;
}): Promise<Counted> => {
  const { product, sketch, variant, load, pictureOf, part, named } = options;
  const file = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;

  if (!file) return uncounted(`variant ${variant} does not draw ${part}`);

  const read = await readPartModule({
    part: { file },
    product: product.name,
    load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
  });
  const of = named ? ` ${part}` : '';

  if (read.problem) return uncounted(`variant ${variant}${of} does not load: ${read.problem}`);
  if (read.states.length === 0) return uncounted(`variant ${variant}${of} has no states`);

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

  if (changed.length === 0) return SAME;

  const failed = failures.size > 0 ? ` - a shot failed: ${[...failures].join('; ')}` : '';

  return { changed: changed.length, change: `variant ${variant} changes${of} ${changed.join(', ')}${failed}` };
};

const variantChangeOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<Counted> => {
  const { product, sketch, variant } = options;
  const others = partFilesOf(variantDirOf(sketch, variant))
    .parts.map(partKeyOf)
    .filter((key) => !sketch.targets.includes(key));

  if (others.length > 0) return uncounted(`variant ${variant} also holds ${others.join(', ')}`);

  const parts = [...sketch.targets, ...mergePreviewOf({ product, sketch, variant }).shared];
  const found: Counted[] = [];

  for (const part of parts) {
    const counted = await partChangeOf({ ...options, part, named: parts.length > 1 });

    if (counted.changed === null) return counted;
    if (counted.changed > 0) found.push(counted);
  }

  if (found.length === 0) return affectedChangeOf(options);

  return {
    changed: found.reduce((sum, { changed }) => sum + (changed ?? 0), 0),
    change: found.map(({ change }) => change).join('; '),
  };
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
  const changes = await variantChangesOf(options);

  return typeof changes === 'string' ? changes : noChangeOf(changes);
};

/** What each live variant of the sketch draws differently, as `sketchShowsNoChange` judges it; why not when it has none. */
export const variantChangesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<VariantChange[] | string> => {
  const { sketch } = options;

  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));

  if (live.length === 0) return 'the sketch has no live variant';

  return Promise.all(live.map(async (variant) => ({ variant, ...(await variantChangeOf({ ...options, variant })) })));
};

/** `true` when no variant changes anything; otherwise every change, joined. */
export const noChangeOf = (changes: VariantChange[]): true | string => {
  const found = changes.flatMap(({ changed, change }) => (changed === 0 || change === null ? [] : [change]));

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

/**
 * One `NO-CHANGED-STATE` line per live variant whose change is `null`: it draws no state that differs from the
 * product. `[]` when `noVisibleChange` is set and no live variant changes anything: that sketch merges by itself.
 */
export const noChangedStateLinesOf = (options: {
  sketch: Sketch;
  changes: VariantChange[];
  noVisibleChange: boolean;
}): string[] => {
  const { sketch, changes, noVisibleChange } = options;
  const unchanged = changes.filter(({ changed }) => changed === 0);
  const alone = unchanged.length === changes.length;

  if (alone && noVisibleChange) return [];

  const escape = alone ? ', or pass --no-visible-change to sketch ready when the sketch must change no pixel' : '';

  return unchanged.map(
    ({ variant }) =>
      `NO-CHANGED-STATE variant ${variant} of ${sketch.targets.join(', ')} draws no state that differs from the design - ` +
      `draw the state the sketch is about (for a marker sketch: draw the missing state)${escape}`,
  );
};

/** One `CHANGED STATES` line per live variant: how many states it draws differently from the design. */
export const changedStateCountLinesOf = (options: { sketch: Sketch; changes: VariantChange[] }): string[] =>
  options.changes.map(
    ({ variant, changed, change }) =>
      `CHANGED STATES variant ${variant} of ${options.sketch.targets.join(', ')}: ` +
      (changed === null ? `not counted - ${change}` : `${changed}`),
  );

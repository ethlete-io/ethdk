import { createHash } from 'crypto';
import { resolve } from 'path';
import { ALL_PARTS, DrawnPart, PartsChange, redraws } from '../../changed-parts';
import { drawnPair, PictureOf } from '../../merge-compare';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { baselineInTurnsOf, partHashOf } from './baseline';
import { EDIT_OLD } from './edit-sketch';
import { isEditSketch } from './merged-parts';
import { overlaySketch } from './overlay';
import { sharedDirOf, Sketch, variantDirOf } from './sketch';

export type SketchPartLoader = (options: {
  file: string;
  product: string;
  sketch: SketchVariant | null;
}) => Promise<unknown>;

type LoadedPart = {
  states?: Record<string, unknown>;
  widths?: unknown;
  interactions?: unknown;
  render?: (props: unknown) => unknown;
  frame?: (body: string, props: unknown) => string;
};

type Markup = { body: string; styles: string };

type Rendered = { part: LoadedPart; frames: string; states: Map<string, Markup | null> };

const CACHE_LIMIT = 200;

const cache = new Map<string, { unchanged: string[]; drawn: DrawnPart[] }>();

/**
 * Drops the kept results of every part `change` redraws, in the product or in the compared variant, so the next call
 * compares them again. Without `change` it drops them all.
 */
export const forgetUnchangedStates = (change: PartsChange = ALL_PARTS) => {
  for (const [key, { drawn }] of cache) {
    if (drawn.some((part) => redraws(change, part))) cache.delete(key);
  }
};

const hashOf = (value: string) => createHash('sha256').update(value).digest('hex');

const markupOf = async (part: LoadedPart, props: unknown): Promise<Markup | null> => {
  try {
    const drawn = (await part.render?.(props)) as { body?: unknown; styles?: unknown } | undefined;

    const styles = drawn?.styles ?? '';

    return typeof drawn?.body === 'string' && typeof styles === 'string'
      ? { body: hashOf(part.frame ? part.frame(drawn.body, props) : drawn.body), styles: hashOf(styles) }
      : null;
  } catch {
    return null;
  }
};

const renderedOf = async (load: () => Promise<unknown>): Promise<Rendered | null> => {
  try {
    const part = ((await load()) as { default?: LoadedPart }).default;
    const states = part?.states;

    if (!part || !states || typeof states !== 'object') return null;

    const hashes = await Promise.all(
      Object.entries(states).map(async ([state, props]) => [state, await markupOf(part, props)] as const),
    );

    return {
      part,
      frames: JSON.stringify([part.widths ?? null, part.interactions ?? null]),
      states: new Map(hashes),
    };
  } catch {
    return null;
  }
};

const comparesNothing = (sketch: Sketch) => isEditSketch(sketch) && !sketch.variants.includes(EDIT_OLD);

const remember = (key: string, kept: { unchanged: string[]; drawn: DrawnPart[] }) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? '');
  cache.set(key, kept);

  return kept.unchanged;
};

export const framesOf = (part: Pick<LoadedPart, 'widths' | 'interactions'>, presets: string[] | null) => {
  const sizes = presets
    ? presets.map((preset) => ({ preset, width: null }))
    : Array.isArray(part.widths) && part.widths.length > 0
      ? part.widths.map((width) => ({ preset: null, width: Number(width) }))
      : [{ preset: null, width: null }];
  const interactions = [
    null,
    ...(Array.isArray(part.interactions) ? part.interactions.filter((name) => typeof name === 'string') : []),
  ];

  return sizes.flatMap((size) => interactions.map((interaction) => ({ ...size, interaction })));
};

const drawsTheSame = async (options: {
  pictureOf: PictureOf;
  product: string;
  key: string;
  part: LoadedPart;
  presets: string[] | null;
  state: string;
  sketch: SketchVariant;
}) => {
  const { pictureOf, product, key, part, presets, state, sketch } = options;

  try {
    const same = await Promise.all(
      framesOf(part, presets).map(async (frame) => {
        const draw = (drawn: SketchVariant | null, fresh: boolean) =>
          pictureOf({
            product,
            part: key,
            state,
            ...frame,
            sketch: drawn,
            params: new URLSearchParams(),
            fresh,
          });

        return (await drawnPair(draw, sketch)).same;
      }),
    );

    return same.every(Boolean) ? 'same' : 'different';
  } catch {
    return 'failed';
  }
};

const keyOf = async (options: {
  product: ResolvedProduct;
  overlaid: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  compared: string;
  pictured: boolean;
  compareFrames: boolean;
  states: string[] | undefined;
}) => {
  const { product, overlaid, sketch, variant, compared, pictured, compareFrames, states } = options;

  return hashOf(
    JSON.stringify([
      sketch.dir,
      compared,
      variant,
      await baselineInTurnsOf(product),
      await baselineInTurnsOf(overlaid),
      partHashOf({ product, dir: sharedDirOf(sketch) }),
      partHashOf({ product, dir: variantDirOf(sketch, variant) }),
      pictured,
      compareFrames,
      states,
    ]),
  );
};

/**
 * The states `unchangedStatesOf` found unchanged for the same sources with `keepPictures`, or `null` while no such
 * comparison is kept. It renders and draws nothing.
 */
export const keptUnchangedStatesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  pictured: boolean;
  part?: string;
}): Promise<string[] | null> => {
  const { product, sketch, variant, pictured, part: compared = partKeyOf(sketch) } = options;
  const overlaid = overlaySketch({ product, sketch, variant });

  if (comparesNothing(sketch)) return [];
  if (!product.parts.some((part) => partKeyOf(part) === compared)) return null;
  if (!overlaid.parts.some((part) => partKeyOf(part) === compared)) return null;

  const key = await keyOf({
    product,
    overlaid,
    sketch,
    variant,
    compared,
    pictured,
    compareFrames: true,
    states: undefined,
  });

  return cache.get(key)?.unchanged ?? null;
};

/**
 * The states of the sketch's target, or of the part `part` names, that `variant` renders to the same markup and styles as the product
 * does now, with the same widths and interactions, so every frame of them matches, unless the variant changes a
 * part stylesheet the product's stylesheets `@import`. With `pictureOf`, any other state, or one that cannot be
 * rendered outside a browser (`ng()`), is unchanged when every frame draws the
 * same pixels in the default theme. A state the product lacks, or one that fails to draw on either side, is never
 * unchanged, and neither is any state of an edit sketch without `old`: its `new` is the product itself. Markup-only comparisons are kept by source hashes. Pixel comparisons are kept the same way only with
 * `keepPictures`, and never when a draw failed; `forgetUnchangedStates` drops them. Set `compareFrames` to false
 * to compare drawings without requiring matching widths and interactions.
 */
export const unchangedStatesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf?: PictureOf;
  keepPictures?: boolean;
  part?: string;
  compareFrames?: boolean;
  states?: string[];
}): Promise<string[]> => {
  const {
    product,
    sketch,
    variant,
    load,
    pictureOf,
    keepPictures = false,
    part: compared = partKeyOf(sketch),
    compareFrames = true,
    states,
  } = options;
  const current = product.parts.find((part) => partKeyOf(part) === compared);
  const merged = current?.file;
  const overlaid = overlaySketch({ product, sketch, variant });
  const drawn = overlaid.parts.find((part) => partKeyOf(part) === compared)?.file;

  if (!merged || !drawn || comparesNothing(sketch)) return [];

  const key = await keyOf({
    product,
    overlaid,
    sketch,
    variant,
    compared,
    pictured: !!pictureOf,
    compareFrames,
    states,
  });
  const keeps = !pictureOf || keepPictures;
  const known = keeps ? cache.get(key)?.unchanged : undefined;

  if (known) return known;

  const [now, after] = await Promise.all([
    renderedOf(() => load({ file: merged, product: product.name, sketch: null })),
    renderedOf(() => load({ file: drawn, product: product.name, sketch: { target: sketch.target, variant } })),
  ]);

  if (!now || !after) return [];

  const parts: DrawnPart[] = [
    { product: product.name, part: compared, sketch: null },
    { product: product.name, part: compared, sketch: { target: sketch.target, variant } },
  ];

  if (compareFrames && now.frames !== after.frames) return keeps ? remember(key, { unchanged: [], drawn: parts }) : [];

  const imported = productStylesheetFilesOf(product);
  const restyled = overlaid.parts.some((part) => {
    const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));

    return !!own?.css && imported.has(resolve(own.css)) && part.cssSource !== own.cssSource;
  });
  const presets = current?.layer === 'pages' ? Object.keys(product.presets) : null;
  const comparedStates = [...after.states].filter(([state]) => !states || states.includes(state));
  const same = await Promise.all(
    comparedStates.map(async ([state, markup]) => {
      if (!now.states.has(state)) return 'different';

      const before = now.states.get(state);

      if (!restyled && markup && before && markup.body === before.body && markup.styles === before.styles)
        return 'same';

      return pictureOf
        ? drawsTheSame({
            pictureOf,
            product: product.name,
            key: compared,
            part: after.part,
            presets,
            state,
            sketch: { target: sketch.target, variant },
          })
        : 'different';
    }),
  );

  const unchanged = comparedStates.filter((_, index) => same[index] === 'same').map(([state]) => state);

  return keeps && !same.includes('failed') ? remember(key, { unchanged, drawn: parts }) : unchanged;
};

import { createHash } from 'crypto';
import { resolve } from 'path';
import { drawnPair, PictureOf } from '../../merge-compare';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { baselineOf, partHashOf } from './baseline';
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

const cache = new Map<string, string[]>();

/** Drops every kept result, so the next call compares again. Call it when a product file changes. */
export const forgetUnchangedStates = () => cache.clear();

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

const remember = (key: string, unchanged: string[]) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? '');
  cache.set(key, unchanged);

  return unchanged;
};

const framesOf = (part: LoadedPart, presets: string[] | null) => {
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

/**
 * The states of the sketch's target, or of the part `part` names, that `variant` renders to the same markup and styles as the product
 * does now, with the same widths and interactions, so every frame of them matches, unless the variant changes a
 * part stylesheet the product's stylesheets `@import`. With `pictureOf`, any other state, or one that cannot be
 * rendered outside a browser (`ng()`), is unchanged when every frame draws the
 * same pixels in the default theme. A state the product lacks, or one that fails to draw on either side, is never
 * unchanged. Markup-only comparisons are kept by source hashes. Pixel comparisons are kept the same way only with
 * `keepPictures`, and never when a draw failed; `forgetUnchangedStates` drops them all. Set `compareFrames` to false
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
    part: compared = sketch.target,
    compareFrames = true,
    states,
  } = options;
  const current = product.parts.find((part) => partKeyOf(part) === compared);
  const merged = current?.file;
  const overlaid = overlaySketch({ product, sketch, variant });
  const drawn = overlaid.parts.find((part) => partKeyOf(part) === compared)?.file;

  if (!merged || !drawn) return [];

  const key = hashOf(
    JSON.stringify([
      sketch.dir,
      compared,
      variant,
      baselineOf(product),
      baselineOf(overlaid),
      partHashOf({ product, dir: sharedDirOf(sketch) }),
      partHashOf({ product, dir: variantDirOf(sketch, variant) }),
      !!pictureOf,
      compareFrames,
      states,
    ]),
  );
  const keeps = !pictureOf || keepPictures;
  const known = keeps ? cache.get(key) : undefined;

  if (known) return known;

  const [now, after] = await Promise.all([
    renderedOf(() => load({ file: merged, product: product.name, sketch: null })),
    renderedOf(() => load({ file: drawn, product: product.name, sketch: { target: sketch.target, variant } })),
  ]);

  if (!now || !after) return [];
  if (compareFrames && now.frames !== after.frames) return keeps ? remember(key, []) : [];

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

  return keeps && !same.includes('failed') ? remember(key, unchanged) : unchanged;
};

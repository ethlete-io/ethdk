import { createHash } from 'crypto';
import { dirname, resolve } from 'path';
import { ALL_PARTS, DrawnPart, PartsChange, redraws } from '../../changed-parts';
import { drawnPair, PictureOf } from '../../merge-compare';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { partHashOf } from './baseline';
import { ChangeBox } from './change-box';
import { EDIT_OLD } from './edit-sketch';
import { isEditSketch } from './merged-parts';
import { overlaySketch } from './overlay';
import { comparePixelPair } from './pixel-pair';
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
  grid?: unknown;
  render?: (props: unknown) => unknown;
  frame?: (body: string, props: unknown) => string;
};

type Markup = { body: string; styles: string };

type Rendered = { part: LoadedPart; frames: string; states: Map<string, Markup | null> };

const CACHE_LIMIT = 200;

type Kept = { unchanged: string[]; drawn: DrawnPart[]; changes: Record<string, ChangeBox> };

const cache = new Map<string, Kept>();

type KeptRests = { same: Record<string, string>; drawn: DrawnPart[] };

const restCache = new Map<string, KeptRests>();

/**
 * Drops the kept results of every part `change` redraws, in the product or in the compared variant, so the next call
 * compares them again. Without `change` it drops them all.
 */
export const forgetUnchangedStates = (change: PartsChange = ALL_PARTS) => {
  for (const [key, { drawn }] of cache) {
    if (drawn.some((part) => redraws(change, part))) cache.delete(key);
  }
  for (const [key, { drawn }] of restCache) {
    if (drawn.some((part) => redraws(change, part))) restCache.delete(key);
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

const comparesNothing = (sketch: Sketch, variant: string) => isEditSketch(sketch) && variant !== EDIT_OLD;

const remember = (key: string, kept: Kept) => {
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

/** The frame `design shot` draws when no preset, width or interaction is asked: the first of `framesOf`. */
export const defaultFrameOf = (part: Pick<LoadedPart, 'widths' | 'interactions'>, presets: string[] | null) =>
  framesOf(part, presets)[0] ?? { preset: null, width: null, interaction: null };

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
    const changes = await Promise.all(
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

        const { same, change } = await drawnPair(draw, sketch);

        return same ? null : (change ?? undefined);
      }),
    );

    return changes.every((change) => change === null)
      ? ({ result: 'same' } as const)
      : ({ result: 'different', change: changes.find((change) => !!change) } as const);
  } catch {
    return { result: 'failed' } as const;
  }
};

const ownHashOf = (product: ResolvedProduct, compared: string) => {
  const file = product.parts.find((part) => partKeyOf(part) === compared)?.file;

  return file ? partHashOf({ product, dir: dirname(file) }) : null;
};

const keyOf = (options: {
  product: ResolvedProduct;
  overlaid: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  compared: string;
  pictured: boolean;
  compareFrames: boolean;
  states: string[] | undefined;
  rests?: boolean;
}) => {
  const { product, overlaid, sketch, variant, compared, pictured, compareFrames, states, rests = false } = options;

  return hashOf(
    JSON.stringify([
      sketch.dir,
      compared,
      variant,
      ownHashOf(product, compared),
      ownHashOf(overlaid, compared),
      partHashOf({ product, dir: sharedDirOf(sketch) }),
      partHashOf({ product, dir: variantDirOf(sketch, variant) }),
      pictured,
      compareFrames,
      states,
      ...(rests ? ['rests'] : []),
    ]),
  );
};

type KeptOptions = { product: ResolvedProduct; sketch: Sketch; variant: string; pictured: boolean; part?: string };

/**
 * The states `unchangedStatesOf` found unchanged for the same sources with `keepPictures`, and where each state it
 * drew differently differs (`changes`), or `null` while no such comparison is kept. It renders and draws nothing.
 */
export const keptComparisonOf = async (
  options: KeptOptions,
): Promise<{ unchanged: string[]; changes: Record<string, ChangeBox> } | null> => {
  const { product, sketch, variant, pictured, part: compared = partKeyOf(sketch) } = options;
  const overlaid = overlaySketch({ product, sketch, variant });

  if (comparesNothing(sketch, variant)) return { unchanged: [], changes: {} };
  if (!product.parts.some((part) => partKeyOf(part) === compared)) return null;
  if (!overlaid.parts.some((part) => partKeyOf(part) === compared)) return null;

  const key = keyOf({
    product,
    overlaid,
    sketch,
    variant,
    compared,
    pictured,
    compareFrames: true,
    states: undefined,
  });

  const kept = cache.get(key);

  return kept ? { unchanged: kept.unchanged, changes: kept.changes } : null;
};

/**
 * The states of the sketch's target, or of the part `part` names, that `variant` renders to the same markup and styles as the product
 * does now, with the same widths and interactions, so every frame of them matches, unless the variant changes a
 * part stylesheet the product's stylesheets `@import`. With `pictureOf`, any other state, or one that cannot be
 * rendered outside a browser (`ng()`), is unchanged when every frame draws the
 * same pixels in the default theme. A state the product lacks, or one that fails to draw on either side, is never
 * unchanged, and neither is any state of the `new` of an edit sketch: it is the product itself. Markup-only comparisons are kept by the source hashes of the compared part and the sketch, so a change to a part it imports
 * needs `forgetUnchangedStates` to drop them. Pixel comparisons are kept the same way only with
 * `keepPictures`, and never when a draw failed. Set `compareFrames` to false
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

  if (!merged || !drawn || comparesNothing(sketch, variant)) return [];

  const key = keyOf({
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

  if (compareFrames && now.frames !== after.frames)
    return keeps ? remember(key, { unchanged: [], drawn: parts, changes: {} }) : [];

  const imported = productStylesheetFilesOf(product);
  const restyled = overlaid.parts.some((part) => {
    const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));

    return !!own?.css && imported.has(resolve(own.css)) && part.cssSource !== own.cssSource;
  });
  const presets = current?.layer === 'pages' ? Object.keys(product.presets) : null;
  const comparedStates = [...after.states].filter(([state]) => !states || states.includes(state));
  const same = await Promise.all(
    comparedStates.map(async ([state, markup]) => {
      if (!now.states.has(state)) return { result: 'different' } as const;

      const before = now.states.get(state);

      if (!restyled && markup && before && markup.body === before.body && markup.styles === before.styles)
        return { result: 'same' } as const;

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
        : ({ result: 'different' } as const);
    }),
  );

  const unchanged = comparedStates.filter((_, index) => same[index]?.result === 'same').map(([state]) => state);
  const changes = Object.fromEntries(
    comparedStates.flatMap(([state], index) => {
      const entry = same[index];
      const change = entry && 'change' in entry ? entry.change : undefined;

      return change ? [[state, change]] : [];
    }),
  );

  return keeps && !same.some((entry) => entry.result === 'failed')
    ? remember(key, { unchanged, drawn: parts, changes })
    : unchanged;
};

/** The unchanged states the sketch shot and the Studio view both fold by, kept so either one reads the other's compare. */
export const unchangedForFoldOf = (options: Omit<Parameters<typeof unchangedStatesOf>[0], 'keepPictures'>) =>
  unchangedStatesOf({ ...options, keepPictures: true });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Each state a `grid` row places in a column other than `rest`, with the state the row places in `rest`. */
export const restStatesOf = (grid: unknown, states: ReadonlySet<string>): Map<string, string> => {
  const rows =
    isRecord(grid) && Array.isArray(grid['columns']) && grid['columns'].includes('rest') ? grid['rows'] : null;

  return new Map(
    Object.values(isRecord(rows) ? rows : {}).flatMap((row) => {
      const rest = isRecord(row) ? row['rest'] : undefined;

      if (!isRecord(row) || typeof rest !== 'string' || !states.has(rest)) return [];

      return Object.values(row)
        .filter((state): state is string => typeof state === 'string' && state !== rest && states.has(state))
        .map((state) => [state, rest] as const);
    }),
  );
};

const drawsLikeRest = async (options: {
  pictureOf: PictureOf;
  product: string;
  key: string;
  part: LoadedPart;
  presets: string[] | null;
  state: string;
  rest: string;
  sketch: SketchVariant;
}) => {
  const { pictureOf, product, key, part, presets, state, rest, sketch } = options;
  const draw = (drawn: string, frame: ReturnType<typeof framesOf>[number]) =>
    pictureOf({ product, part: key, state: drawn, ...frame, sketch, params: new URLSearchParams(), priority: 'low' });

  try {
    const pairs = await Promise.all(
      framesOf(part, presets).map(async (frame) => {
        const [before, after] = await Promise.all([draw(rest, frame), draw(state, frame)]);

        return (await comparePixelPair(before.png, after.png)).same;
      }),
    );

    return { result: pairs.every(Boolean) ? 'same' : 'different' } as const;
  } catch {
    return { result: 'failed' } as const;
  }
};

const restKeyOf = (options: KeptOptions) => {
  const { product, sketch, variant, pictured, part: compared = partKeyOf(sketch) } = options;

  return keyOf({
    product,
    overlaid: overlaySketch({ product, sketch, variant }),
    sketch,
    variant,
    compared,
    pictured,
    compareFrames: true,
    states: undefined,
    rests: true,
  });
};

/** The states `sameAsRestOf` found drawn like their rest state for the same sources, or `null` while none is kept. */
export const keptSameAsRestOf = async (options: KeptOptions): Promise<Record<string, string> | null> =>
  restCache.get(restKeyOf(options))?.same ?? null;

/**
 * Each state of the grid of the part `variant` draws that renders the same as its row's `rest` state, in every
 * width, preset and interaction of the part, with that rest state: the same markup and styles, or with `pictureOf` the same
 * pixels in the default theme. Kept by source hashes like `unchangedForFoldOf`; `forgetUnchangedStates` drops them.
 */
export const sameAsRestOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
  pictureOf?: PictureOf;
  part?: string;
}): Promise<Record<string, string>> => {
  const { product, sketch, variant, load, pictureOf, part: compared = partKeyOf(sketch) } = options;
  const overlaid = overlaySketch({ product, sketch, variant });
  const drawnPart = overlaid.parts.find((part) => partKeyOf(part) === compared);

  if (!drawnPart) return {};

  const key = restKeyOf({ product, sketch, variant, pictured: !!pictureOf, part: compared });
  const known = restCache.get(key)?.same;

  if (known) return known;

  const on = { target: sketch.target, variant };
  const after = await renderedOf(() => load({ file: drawnPart.file, product: product.name, sketch: on }));

  if (!after) return {};

  const rests = [...restStatesOf(after.part.grid, new Set(after.states.keys()))];
  const presets = drawnPart.layer === 'pages' ? Object.keys(product.presets) : null;
  const compares = await Promise.all(
    rests.map(async ([state, rest]) => {
      const markup = after.states.get(state);
      const restMarkup = after.states.get(rest);

      if (markup && restMarkup && markup.body === restMarkup.body && markup.styles === restMarkup.styles)
        return { result: 'same' } as const;

      return pictureOf
        ? drawsLikeRest({
            pictureOf,
            product: product.name,
            key: compared,
            part: after.part,
            presets,
            state,
            rest,
            sketch: on,
          })
        : ({ result: 'different' } as const);
    }),
  );
  const same = Object.fromEntries(rests.filter((_, index) => compares[index]?.result === 'same'));

  if (compares.some((entry) => entry.result === 'failed')) return same;
  if (restCache.size >= CACHE_LIMIT) restCache.delete(restCache.keys().next().value ?? '');
  restCache.set(key, { same, drawn: [{ product: product.name, part: compared, sketch: on }] });

  return same;
};

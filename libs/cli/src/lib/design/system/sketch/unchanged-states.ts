import { createHash } from 'crypto';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { baselineOf } from './baseline';
import { overlaySketch } from './overlay';
import { Sketch } from './sketch';

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
};

type Rendered = { frames: string; states: Map<string, string | null> };

const CACHE_LIMIT = 200;

const cache = new Map<string, string[]>();

const hashOf = (value: string) => createHash('sha256').update(value).digest('hex');

const markupOf = async (part: LoadedPart, props: unknown) => {
  try {
    const drawn = (await part.render?.(props)) as { body?: unknown; styles?: unknown } | undefined;

    return typeof drawn?.body === 'string' && typeof drawn.styles === 'string'
      ? hashOf(JSON.stringify([drawn.body, drawn.styles]))
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

    return { frames: JSON.stringify([part.widths ?? null, part.interactions ?? null]), states: new Map(hashes) };
  } catch {
    return null;
  }
};

const remember = (key: string, unchanged: string[]) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? '');
  cache.set(key, unchanged);

  return unchanged;
};

/**
 * The states of the sketch's target that `variant` renders to the same markup and styles as the product
 * does now, with the same widths and interactions, so every frame of them matches. A state the product
 * lacks, or one that fails to render on either side, is never unchanged. Cached by the content hashes of
 * the part folders and fixtures on both sides.
 */
export const unchangedStatesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  load: SketchPartLoader;
}): Promise<string[]> => {
  const { product, sketch, variant, load } = options;
  const merged = product.parts.find((part) => partKeyOf(part) === sketch.target)?.file;
  const overlaid = overlaySketch({ product, sketch, variant });
  const drawn = overlaid.parts.find((part) => partKeyOf(part) === sketch.target)?.file;

  if (!merged || !drawn) return [];

  const key = hashOf(JSON.stringify([sketch.dir, sketch.target, variant, baselineOf(product), baselineOf(overlaid)]));
  const known = cache.get(key);

  if (known) return known;

  const [now, after] = await Promise.all([
    renderedOf(() => load({ file: merged, product: product.name, sketch: null })),
    renderedOf(() => load({ file: drawn, product: product.name, sketch: { target: sketch.target, variant } })),
  ]);

  if (!now || !after) return [];
  if (now.frames !== after.frames) return remember(key, []);

  return remember(
    key,
    [...after.states].flatMap(([state, hash]) => (hash !== null && now.states.get(state) === hash ? [state] : [])),
  );
};

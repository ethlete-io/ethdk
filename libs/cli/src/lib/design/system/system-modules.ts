import { DesignConfig } from '../paths';
import { classifyImport } from './imports';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';
import { overlaySketch } from './sketch/overlay';
import { findSketch, listSketches, parseTarget, Sketch } from './sketch/sketch';

const PRODUCT_QUERY = 'design-product';
const SKETCH_QUERY = 'design-sketch';
const VARIANT_QUERY = 'design-variant';

/** One variant of the sketch on `target` (`<layer>/<name>`). */
export type SketchVariant = { target: string; variant: string };

/**
 * The module id of a file as one product draws it, or as one variant of a sketch draws it. A base
 * part is one file but a different module in each product, because each product resolves its
 * `@system/...` imports to its own parts.
 */
export const productModuleIdOf = (options: { file: string; product: string; sketch?: SketchVariant | null }) =>
  `${options.file}?${PRODUCT_QUERY}=${encodeURIComponent(options.product)}` +
  (options.sketch
    ? `&${SKETCH_QUERY}=${encodeURIComponent(options.sketch.target)}&${VARIANT_QUERY}=${encodeURIComponent(options.sketch.variant)}`
    : '');

export const productOfModuleId = (id: string | null | undefined) => {
  const query = id?.split('?')[1];

  return query ? new URLSearchParams(query).get(PRODUCT_QUERY) : null;
};

export const sketchOfModuleId = (id: string | null | undefined): SketchVariant | null => {
  const params = new URLSearchParams(id?.split('?')[1] ?? '');
  const target = params.get(SKETCH_QUERY);
  const variant = params.get(VARIANT_QUERY);

  return target && variant ? { target, variant } : null;
};

export const fileOfModuleId = (id: string) => id.split('?')[0] ?? id;

/**
 * The products of a workspace, resolved on first use and kept until `forget`, and the resolution
 * of `@system/<layer>/<name>`, `@system/<layer>/<name>.css?inline` (the part's stylesheet) and
 * `@system/fixtures` inside a module of one product.
 */
export const createSystemModules = (options: { target: string; config: DesignConfig }) => {
  const { target, config } = options;
  const resolved = new Map<string, ResolvedProduct>();
  const sketched = new Map<string, ResolvedProduct | null>();

  const productOf = (name: string) => {
    const entry = config.products?.[name];

    if (!entry) return null;

    const cached = resolved.get(name) ?? resolveProduct({ target, name, config: entry });

    resolved.set(name, cached);

    return cached;
  };

  const sketchesOf = (name: string) => {
    const product = productOf(name);

    return product
      ? listSketches({ productDir: product.dir, product: name }).filter(
          (sketch): sketch is Sketch => typeof sketch !== 'string',
        )
      : [];
  };

  /** The product as it draws, or as one variant of one of its sketches draws it; `null` when either is missing. */
  const drawnOf = (name: string, sketch?: SketchVariant | null) => {
    const product = productOf(name);

    if (!product || !sketch) return product;

    const key = JSON.stringify([name, sketch.target, sketch.variant]);

    if (sketched.has(key)) return sketched.get(key) ?? null;

    const target = parseTarget(sketch.target);
    const found =
      typeof target === 'string' ? null : findSketch({ productDir: product.dir, product: name, sketch: target });
    const drawn =
      found && typeof found !== 'string' && found.variants.includes(sketch.variant)
        ? overlaySketch({ product, sketch: found, variant: sketch.variant })
        : null;

    sketched.set(key, drawn);

    return drawn;
  };

  const partOf = (options: { product: string; part: string; sketch?: SketchVariant | null }) =>
    drawnOf(options.product, options.sketch)?.parts.find((part) => partKeyOf(part) === options.part) ?? null;

  const resolveId = (specifier: string, importer: string | undefined) => {
    const name = productOfModuleId(importer);
    const imported = classifyImport(specifier);

    if (!name || (imported.kind !== 'part' && imported.kind !== 'fixtures')) return null;

    const sketch = sketchOfModuleId(importer);

    if (imported.kind === 'part' && imported.stylesheet) {
      const css = partOf({ product: name, part: partKeyOf(imported), sketch })?.css;
      const query = specifier.split('?')[1];

      return css ? (query === undefined ? css : `${css}?${query}`) : null;
    }

    const file =
      imported.kind === 'fixtures'
        ? drawnOf(name, sketch)?.fixtures
        : partOf({ product: name, part: partKeyOf(imported), sketch })?.file;

    return file ? productModuleIdOf({ file, product: name, sketch }) : null;
  };

  return {
    products: () => Object.keys(config.products ?? {}),
    productOf,
    sketchesOf,
    drawnOf,
    partOf,
    resolveId,
    forget: () => {
      resolved.clear();
      sketched.clear();
    },
  };
};

export type SystemModules = ReturnType<typeof createSystemModules>;
